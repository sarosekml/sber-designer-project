import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';
import { z } from 'zod';

import type { AdminUser } from './auth/types';
import { getRemoteUrl, git, hasUncommitted, isGitRepo } from './git/git-worker';
import { readProjectsRegistry, registerProject, type ProjectEntry } from './projects-registry';
import { deleteWorkspaceTree, renameWorkspaceFile } from './safe-fs';
import {
  configuredProjectsRoot,
  isPathInside,
  storageIdentityForUser,
  userDataDirectory,
  userDataRoot,
  userProjectsRoot,
} from './user-storage';

const TrashProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    folder: z.string(),
    originalWorkspacePath: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    hasRemote: z.boolean(),
    uncommitted: z.boolean(),
    unpushedCommits: z.number().int().nonnegative(),
    notPushedAnywhere: z.boolean(),
  })
  .strict();

const TrashManifestSchema = z
  .object({
    version: z.literal(1),
    entryId: z.string(),
    user: z.object({
      id: z.string(),
      email: z.string(),
      displayName: z.string(),
    }),
    deletedAt: z.string(),
    deletedBy: z.string(),
    projects: z.array(TrashProjectSchema),
    totalBytes: z.number().int().nonnegative(),
    riskyProjects: z.number().int().nonnegative(),
    userDataMoved: z.boolean(),
  })
  .strict();

export type TrashProject = z.infer<typeof TrashProjectSchema>;
export type TrashManifest = z.infer<typeof TrashManifestSchema>;

export class UserTrashError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 404 | 409 | 422,
    message: string,
  ) {
    super(message);
    this.name = 'UserTrashError';
  }
}

export interface UserTrashPreview {
  projects: TrashProject[];
  totalBytes: number;
  riskyProjects: number;
}

export async function previewUserTrash(user: AdminUser): Promise<UserTrashPreview> {
  const identity = storageIdentityForUser(user);
  const registry = await readProjectsRegistry(identity);
  const root = await userProjectsRoot(identity);
  const projects = await Promise.all(
    registry.projects.map((project) => classifyProject(project, root)),
  );
  return summarizeProjects(projects);
}

export async function moveUserToTrash(user: AdminUser, deletedBy: string): Promise<TrashManifest> {
  const identity = storageIdentityForUser(user);
  const preview = await previewUserTrash(user);
  const root = configuredProjectsRoot();
  if (preview.projects.length > 0 && !root) {
    throw new UserTrashError(
      'trash_root_unconfigured',
      409,
      'SBER_DESIGNER_PROJECTS_ROOT is required before deleting users with managed projects.',
    );
  }

  const entryId = `trash-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const sourceRoot = root ? resolve(root, identity.key) : null;
  if (sourceRoot) {
    for (const project of preview.projects) {
      if (!isPathInside(sourceRoot, project.originalWorkspacePath)) {
        throw new UserTrashError(
          'project_outside_user_root',
          422,
          'A registered project is outside the user workspace root.',
        );
      }
    }
  }

  let projectsMoved = false;
  let userDataMoved = false;
  const dataDirectory = userDataDirectory(identity);
  try {
    if (root && sourceRoot && (await pathExists(sourceRoot))) {
      await renameWorkspaceFile(root, identity.key, `.trash/${entryId}/projects`);
      projectsMoved = true;
    } else {
      await mkdir(resolve(trashEntryDirectory(entryId), 'projects'), { recursive: true });
    }
    if (dataDirectory && (await pathExists(dataDirectory))) {
      await renameWorkspaceFile(userDataRoot(), identity.key, `.trash/${entryId}/user-data`);
      userDataMoved = true;
    }

    const manifest: TrashManifest = {
      version: 1,
      entryId,
      user: { id: user.id, email: user.email, displayName: user.displayName },
      deletedAt: new Date().toISOString(),
      deletedBy,
      projects: preview.projects,
      totalBytes: preview.totalBytes,
      riskyProjects: preview.riskyProjects,
      userDataMoved,
    };
    await writeManifest(manifest);
    return manifest;
  } catch (error) {
    await rollbackMovedUserData({ identity, entryId, root, projectsMoved, userDataMoved });
    throw error;
  }
}

/** Compensating action when auth-store deletion fails after the filesystem move. */
export async function rollbackUserTrash(user: AdminUser, manifest: TrashManifest): Promise<void> {
  if (user.id !== manifest.user.id) {
    throw new UserTrashError('trash_user_mismatch', 409, 'Trash entry belongs to another user.');
  }
  const identity = storageIdentityForUser(user);
  const root = configuredProjectsRoot();
  await rollbackMovedUserData({
    identity,
    entryId: manifest.entryId,
    root,
    projectsMoved: Boolean(
      root && (await pathExists(resolve(trashEntryDirectory(manifest.entryId), 'projects'))),
    ),
    userDataMoved: manifest.userDataMoved,
  });
}

export async function listTrashEntries(): Promise<TrashManifest[]> {
  const root = trashRoot();
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const manifests = await Promise.all(
    entries.filter((entry) => entry.isDirectory()).map((entry) => readTrashManifest(entry.name)),
  );
  return manifests
    .filter((manifest): manifest is TrashManifest => manifest !== null)
    .sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
}

export async function readTrashManifest(entryId: string): Promise<TrashManifest | null> {
  if (!safeSegment(entryId)) return null;
  try {
    return TrashManifestSchema.parse(
      JSON.parse(await readFile(resolve(trashEntryDirectory(entryId), 'manifest.json'), 'utf8')),
    );
  } catch {
    return null;
  }
}

export async function restoreTrashProject(input: {
  entryId: string;
  folder: string;
  targetUser: AdminUser;
}): Promise<{ manifest: TrashManifest; project: ProjectEntry }> {
  const manifest = await requireManifest(input.entryId);
  const trashProject = manifest.projects.find((project) => project.folder === input.folder);
  if (!trashProject)
    throw new UserTrashError('trash_project_not_found', 404, 'Trash project not found.');
  const root = configuredProjectsRoot();
  if (!root) {
    throw new UserTrashError(
      'trash_root_unconfigured',
      409,
      'SBER_DESIGNER_PROJECTS_ROOT is required to restore projects.',
    );
  }
  const targetIdentity = storageIdentityForUser(input.targetUser);
  const targetRoot = await userProjectsRoot(targetIdentity);
  if (!targetRoot) {
    throw new UserTrashError(
      'target_workspace_unavailable',
      409,
      'Target user workspace root is unavailable.',
    );
  }

  const sourceRel = `.trash/${manifest.entryId}/projects/${trashProject.folder}`;
  const source = resolve(root, sourceRel);
  if (!isPathInside(resolve(root, '.trash', manifest.entryId, 'projects'), source)) {
    throw new UserTrashError('invalid_trash_path', 422, 'Trash project path is invalid.');
  }
  const targetFolder = await availableRestoreFolder(targetRoot, basename(trashProject.folder));
  const destinationRel = relative(root, resolve(targetRoot, targetFolder));
  await renameWorkspaceFile(root, sourceRel, destinationRel);

  const project = await registerProject(
    { workspacePath: resolve(targetRoot, targetFolder), name: trashProject.name },
    targetIdentity,
  );
  const next = withProjects(
    manifest,
    manifest.projects.filter((item) => item !== trashProject),
  );
  await writeManifest(next);
  return { manifest: next, project };
}

export async function purgeTrash(input: {
  entryId: string;
  folder?: string;
}): Promise<{ purgedEntry: boolean; manifest: TrashManifest | null }> {
  const manifest = await requireManifest(input.entryId);
  const root = trashRoot();
  if (!input.folder) {
    await deleteWorkspaceTree(root, manifest.entryId);
    await deleteUserDataTrash(manifest.entryId);
    return { purgedEntry: true, manifest: null };
  }
  const project = manifest.projects.find((candidate) => candidate.folder === input.folder);
  if (!project)
    throw new UserTrashError('trash_project_not_found', 404, 'Trash project not found.');
  await deleteWorkspaceTree(root, `${manifest.entryId}/projects/${project.folder}`);
  const next = withProjects(
    manifest,
    manifest.projects.filter((candidate) => candidate !== project),
  );
  await writeManifest(next);
  return { purgedEntry: false, manifest: next };
}

function trashRoot(): string {
  return resolve(configuredProjectsRoot() ?? userDataRoot(), '.trash');
}

function trashEntryDirectory(entryId: string): string {
  if (!safeSegment(entryId)) {
    throw new UserTrashError('invalid_trash_entry', 400, 'Invalid trash entry id.');
  }
  return resolve(trashRoot(), entryId);
}

function userDataTrashDirectory(entryId: string): string {
  if (!safeSegment(entryId)) {
    throw new UserTrashError('invalid_trash_entry', 400, 'Invalid trash entry id.');
  }
  return resolve(userDataRoot(), '.trash', entryId);
}

async function classifyProject(project: ProjectEntry, root: string | null): Promise<TrashProject> {
  const workspacePath = resolve(project.workspacePath);
  const folder =
    root && isPathInside(root, workspacePath)
      ? relative(root, workspacePath).split(sep).join('/')
      : basename(workspacePath);
  const repo = await isGitRepo(workspacePath).catch(() => false);
  const hasRemote = repo ? Boolean(await getRemoteUrl(workspacePath).catch(() => null)) : false;
  const uncommitted = repo ? await hasUncommitted(workspacePath).catch(() => false) : false;
  const unpushedCommits = repo ? await countUnpushedCommits(workspacePath) : 0;
  const sizeBytes = await directorySize(workspacePath);
  return {
    id: project.id,
    name: project.name,
    folder,
    originalWorkspacePath: workspacePath,
    sizeBytes,
    hasRemote,
    uncommitted,
    unpushedCommits,
    notPushedAnywhere: !hasRemote || uncommitted || unpushedCommits > 0,
  };
}

async function countUnpushedCommits(workspacePath: string): Promise<number> {
  const result = await git(['rev-list', '--count', '--branches', '--not', '--remotes'], {
    cwd: workspacePath,
  });
  if (!result.ok) return 0;
  return Number.parseInt(result.stdout.trim(), 10) || 0;
}

async function directorySize(path: string): Promise<number> {
  let info;
  try {
    info = await lstat(path);
  } catch {
    return 0;
  }
  if (info.isSymbolicLink()) return 0;
  if (!info.isDirectory()) return info.size;
  const entries = await readdir(path);
  const sizes = await Promise.all(entries.map((entry) => directorySize(resolve(path, entry))));
  return sizes.reduce((sum, size) => sum + size, 0);
}

function summarizeProjects(projects: TrashProject[]): UserTrashPreview {
  return {
    projects,
    totalBytes: projects.reduce((sum, project) => sum + project.sizeBytes, 0),
    riskyProjects: projects.filter((project) => project.notPushedAnywhere).length,
  };
}

function withProjects(manifest: TrashManifest, projects: TrashProject[]): TrashManifest {
  const summary = summarizeProjects(projects);
  return { ...manifest, ...summary };
}

async function requireManifest(entryId: string): Promise<TrashManifest> {
  const manifest = await readTrashManifest(entryId);
  if (!manifest) throw new UserTrashError('trash_entry_not_found', 404, 'Trash entry not found.');
  return manifest;
}

async function writeManifest(manifest: TrashManifest): Promise<void> {
  const directory = trashEntryDirectory(manifest.entryId);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
}

async function availableRestoreFolder(root: string, original: string): Promise<string> {
  if (!(await pathExists(resolve(root, original)))) return original;
  for (let index = 1; index <= 10_000; index += 1) {
    const candidate = `${original}-restored-${index}`;
    if (!(await pathExists(resolve(root, candidate)))) return candidate;
  }
  throw new UserTrashError(
    'restore_name_exhausted',
    409,
    'Could not allocate a restored project folder.',
  );
}

async function deleteUserDataTrash(entryId: string): Promise<void> {
  const directory = userDataTrashDirectory(entryId);
  if (!(await pathExists(directory))) return;
  await deleteWorkspaceTree(resolve(userDataRoot(), '.trash'), entryId);
}

async function rollbackMovedUserData(input: {
  identity: ReturnType<typeof storageIdentityForUser>;
  entryId: string;
  root: string | null;
  projectsMoved: boolean;
  userDataMoved: boolean;
}): Promise<void> {
  const failures: string[] = [];
  if (input.projectsMoved && input.root) {
    try {
      await renameWorkspaceFile(input.root, `.trash/${input.entryId}/projects`, input.identity.key);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (input.userDataMoved) {
    try {
      await renameWorkspaceFile(
        userDataRoot(),
        `.trash/${input.entryId}/user-data`,
        input.identity.key,
      );
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (failures.length > 0) {
    throw new Error(`Could not roll back trash move: ${failures.join('; ')}`);
  }
  if (await pathExists(trashEntryDirectory(input.entryId))) {
    await deleteWorkspaceTree(trashRoot(), input.entryId);
  }
  await deleteUserDataTrash(input.entryId);
}

async function pathExists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}

function safeSegment(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/u.test(value);
}
