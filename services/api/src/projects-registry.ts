/**
 * Per-user projects registry (Backlog 0001).
 *
 * This is intentionally tiny and file-backed for the local MVP:
 * dashboard state must survive browser reloads before we introduce
 * multi-user storage.
 */
import { randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

import { scanProjectProfile } from '@sber-designer/design-indexer';

import {
  ProjectSchema,
  projectFilePath,
  loadProjectForWorkspace,
  saveProject,
} from './project-store';
import {
  assertWorkspacePathForIdentity,
  userDataDirectory,
  type UserStorageIdentity,
} from './user-storage';

const MAX_PROJECTS = 10;
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const DEFAULT_THUMBNAIL_PATHS = new Map([
  ['/project-preview/image01.png', '/project-preview/image01.webp'],
  ['/project-preview/image02.png', '/project-preview/image02.webp'],
  ['/project-preview/image03.png', '/project-preview/image03.webp'],
  ['/project-preview/image04.png', '/project-preview/image04.webp'],
  ['/project-preview/image05.png', '/project-preview/image05.webp'],
  ['/project-preview/image01.webp', '/project-preview/image01.webp'],
  ['/project-preview/image02.webp', '/project-preview/image02.webp'],
  ['/project-preview/image03.webp', '/project-preview/image03.webp'],
  ['/project-preview/image04.webp', '/project-preview/image04.webp'],
  ['/project-preview/image05.webp', '/project-preview/image05.webp'],
]);
const PROJECT_ROOT_DUPLICATE_EXCLUDED_NAMES = new Set([
  'dist',
  'storybook-static',
  '.turbo',
  '.next',
  'coverage',
  '.cache',
  '.git',
  'node_modules',
  '.pnpm-store',
]);

const THUMBNAIL_MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const THUMBNAIL_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const THUMBNAIL_EXTENSIONS = [...new Set(Object.values(THUMBNAIL_MIME_EXT))];

export const PROJECT_TYPES = ['storybook', 'html', 'react', 'unknown'] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const ProjectEntrySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    workspacePath: z.string().min(1),
    thumbnailPath: z.string().optional(),
    // 0135: screen pinned as the cover source ("Set as thumbnail"). When set,
    // only that screen refreshes the cover; absent means follow every run.
    coverScreenId: z.string().optional(),
    lastOpenedAt: z.number().int().nonnegative(),
    createdAt: z.number().int().nonnegative(),
    projectType: z.enum(PROJECT_TYPES).optional(),
    // Legacy registry field: accepted so old demo entries can be detached.
    isDemo: z.boolean().optional(),
    // Stage 9 migration: shared Stage-0 entries adopted by the first admin.
    legacy: z.boolean().optional(),
  })
  .strict();

export const ProjectsRegistrySchema = z
  .object({
    version: z.literal(1),
    projects: z.array(ProjectEntrySchema),
  })
  .strict();

export type StoredProjectEntry = z.infer<typeof ProjectEntrySchema>;
export type ProjectEntry = Omit<StoredProjectEntry, 'projectType'> & {
  projectType: ProjectType;
};
export interface ProjectsRegistry {
  version: 1;
  projects: ProjectEntry[];
}

const registryMutationTails = new Map<string, Promise<void>>();

/**
 * Serialize read-modify-write operations for one identity registry.
 *
 * Cover refresh, manual thumbnail selection and screen pinning can arrive from
 * separate browser tabs. Without a shared queue each operation writes a stale
 * snapshot of the whole projects.json file and can silently erase the other.
 */
export async function withProjectRegistryMutation<T>(
  identity: UserStorageIdentity | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  const key = registryPath(identity);
  const previous = registryMutationTails.get(key) ?? Promise.resolve();
  let release = () => {};
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  const tail = previous.catch(() => undefined).then(() => gate);
  registryMutationTails.set(key, tail);

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    if (registryMutationTails.get(key) === tail) {
      registryMutationTails.delete(key);
    }
  }
}

/**
 * Find one registry entry without the per-type profile scan performed by
 * `readProjectsRegistry`. File-backed card assets use this cheap lookup once
 * per Home card.
 */
export async function findStoredProjectEntryById(
  id: string,
  identity?: UserStorageIdentity,
): Promise<StoredProjectEntry | null> {
  try {
    const raw = await readFile(registryPath(identity), 'utf8');
    const parsed = ProjectsRegistrySchema.parse(JSON.parse(raw));
    return parsed.projects.find((project) => project.id === id) ?? null;
  } catch {
    return null;
  }
}

export async function readProjectsRegistry(
  identity?: UserStorageIdentity,
): Promise<ProjectsRegistry> {
  await migrateLegacyRegistryForAdmin(identity);
  try {
    const raw = await readFile(registryPath(identity), 'utf8');
    const parsed = ProjectsRegistrySchema.parse(JSON.parse(raw));
    const projects = await Promise.all(
      parsed.projects.map(async (project) => ({
        ...project,
        projectType: await detectProjectType(project.workspacePath),
      })),
    );
    return {
      version: 1,
      projects: sortProjects(projects).slice(0, MAX_PROJECTS),
    };
  } catch {
    return { version: 1, projects: [] };
  }
}

export async function registerProject(
  input: {
    workspacePath: string;
    name?: string;
  },
  identity?: UserStorageIdentity,
): Promise<ProjectEntry> {
  const workspacePath = identity
    ? await assertWorkspacePathForIdentity(identity, input.workspacePath)
    : resolve(input.workspacePath);
  const info = await stat(workspacePath);
  if (!info.isDirectory()) {
    throw new Error('workspacePath must point to a directory');
  }

  const registry = await readProjectsRegistry(identity);
  const now = Date.now();
  const existing = registry.projects.find((p) => p.workspacePath === workspacePath);
  const name =
    input.name?.trim() || (await readProjectName(workspacePath)) || basename(workspacePath);
  const projectType = await detectProjectType(workspacePath);
  const entry: ProjectEntry = existing
    ? { ...existing, name, projectType, lastOpenedAt: now }
    : {
        id: randomUUID(),
        name,
        workspacePath,
        projectType,
        lastOpenedAt: now,
        createdAt: now,
      };

  await writeProjectsRegistry(
    {
      version: 1,
      projects: [entry, ...registry.projects.filter((p) => p.id !== entry.id)].slice(
        0,
        MAX_PROJECTS,
      ),
    },
    identity,
  );
  return entry;
}

export async function renameProject(
  input: {
    id: string;
    name: string;
  },
  identity?: UserStorageIdentity,
): Promise<ProjectEntry | null> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Project name must not be empty.');
  }

  const registry = await readProjectsRegistry(identity);
  const current = registry.projects.find((p) => p.id === input.id);
  if (!current) return null;

  await writeProjectName(current.workspacePath, name);

  const entry: ProjectEntry = { ...current, name };
  await writeProjectsRegistry(
    {
      version: 1,
      projects: registry.projects.map((project) => (project.id === input.id ? entry : project)),
    },
    identity,
  );
  return entry;
}

export async function duplicateProject(
  input: {
    id: string;
    name: string;
    parentDir: string;
  },
  identity?: UserStorageIdentity,
): Promise<ProjectEntry | null> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Project name must not be empty.');
  }

  const registry = await readProjectsRegistry(identity);
  const current = registry.projects.find((p) => p.id === input.id);
  if (!current) return null;

  const sourcePath = resolve(current.workspacePath);
  const sourceInfo = await stat(sourcePath);
  if (!sourceInfo.isDirectory()) {
    throw new Error('Source project must point to a directory.');
  }

  const parentDir = identity
    ? await assertWorkspacePathForIdentity(identity, input.parentDir)
    : resolve(input.parentDir);
  const parentInfo = await stat(parentDir);
  if (!parentInfo.isDirectory()) {
    throw new Error('Destination folder must point to a directory.');
  }

  const workspacePath = resolve(parentDir, sanitiseProjectFolderName(name));
  if (isSameOrChildPath(sourcePath, workspacePath)) {
    throw new Error('Destination folder cannot be inside the source project.');
  }
  await assertPathDoesNotExist(workspacePath);

  await cp(sourcePath, workspacePath, {
    recursive: true,
    force: false,
    errorOnExist: true,
    filter: (source) => shouldCopyDuplicateEntry(sourcePath, source),
  });
  await writeProjectName(workspacePath, name);

  return await registerProject({ workspacePath, name }, identity);
}

export function shouldCopyDuplicateEntry(sourceRoot: string, candidatePath: string): boolean {
  const resolvedSourceRoot = resolve(sourceRoot);
  const resolvedCandidate = resolve(candidatePath);
  if (resolvedCandidate === resolvedSourceRoot) return true;

  const relativePath = relative(resolvedSourceRoot, resolvedCandidate);
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    return false;
  }

  const pathParts = relativePath.split(sep);
  const topLevelName = pathParts[0];
  if (topLevelName === '.yarn' && pathParts[1] === 'cache') {
    return false;
  }

  return !PROJECT_ROOT_DUPLICATE_EXCLUDED_NAMES.has(topLevelName ?? '');
}

export async function touchProject(
  id: string,
  identity?: UserStorageIdentity,
): Promise<ProjectEntry | null> {
  const registry = await readProjectsRegistry(identity);
  const current = registry.projects.find((p) => p.id === id);
  if (!current) return null;
  const entry: ProjectEntry = { ...current, lastOpenedAt: Date.now() };
  await writeProjectsRegistry(
    {
      version: 1,
      projects: [entry, ...registry.projects.filter((p) => p.id !== id)].slice(0, MAX_PROJECTS),
    },
    identity,
  );
  return entry;
}

export async function removeProject(id: string, identity?: UserStorageIdentity): Promise<boolean> {
  const registry = await readProjectsRegistry(identity);
  const next = registry.projects.filter((p) => p.id !== id);
  if (next.length === registry.projects.length) return false;
  await removeStoredThumbnail(id, identity);
  await writeProjectsRegistry({ version: 1, projects: next }, identity);
  return true;
}

export async function updateProjectThumbnail(
  input: {
    id: string;
    dataUrl?: string;
    thumbnailPath?: string;
    // 0135: clear the explicit override so the card falls back to the generated
    // cover (or the stock placeholder), including the Generated preview choice.
    reset?: boolean;
  },
  identity?: UserStorageIdentity,
): Promise<ProjectEntry | null> {
  return withProjectRegistryMutation(identity, () =>
    updateProjectThumbnailWithinMutation(input, identity),
  );
}

async function updateProjectThumbnailWithinMutation(
  input: {
    id: string;
    dataUrl?: string;
    thumbnailPath?: string;
    reset?: boolean;
  },
  identity?: UserStorageIdentity,
): Promise<ProjectEntry | null> {
  const registry = await readProjectsRegistry(identity);
  const current = registry.projects.find((p) => p.id === input.id);
  if (!current) return null;

  let entry: ProjectEntry;
  let writtenThumbnailExt: string | undefined;
  if (input.reset) {
    const { thumbnailPath: _cleared, ...rest } = current;
    entry = rest;
  } else if (input.thumbnailPath) {
    const thumbnailPath = normalizeDefaultThumbnailPath(input.thumbnailPath);
    entry = { ...current, thumbnailPath };
  } else if (input.dataUrl) {
    const parsed = parseThumbnailDataUrl(input.dataUrl);
    writtenThumbnailExt = parsed.ext;
    await mkdir(thumbnailsDir(identity), { recursive: true });

    const filePath = resolve(thumbnailsDir(identity), `${input.id}${parsed.ext}`);
    await writeFileAtomic(filePath, parsed.bytes);
    entry = {
      ...current,
      thumbnailPath: `/api/projects/${encodeURIComponent(input.id)}/thumbnail?v=${Date.now()}`,
    };
  } else {
    throw new Error('Provide dataUrl, thumbnailPath, or reset.');
  }

  await writeProjectsRegistry(
    {
      version: 1,
      projects: registry.projects.map((project) => (project.id === input.id ? entry : project)),
    },
    identity,
  );
  if (input.reset || input.thumbnailPath) {
    await removeStoredThumbnail(input.id, identity);
  } else if (writtenThumbnailExt) {
    await removeStoredThumbnail(input.id, identity, writtenThumbnailExt);
  }
  return entry;
}

/**
 * Clear a temporary manual choice after a cover write.
 *
 * The caller must already hold `withProjectRegistryMutation` across both the
 * cover write and this mutation so a later manual pick/pin cannot be erased.
 */
export async function resetProjectThumbnailAfterCoverWithinMutation(
  id: string,
  identity?: UserStorageIdentity,
): Promise<ProjectEntry | null> {
  const registry = await readProjectsRegistry(identity);
  const current = registry.projects.find((project) => project.id === id);
  if (!current) return null;
  if (!current.thumbnailPath) return current;

  const { thumbnailPath: _cleared, ...entry } = current;
  await writeProjectsRegistry(
    {
      version: 1,
      projects: registry.projects.map((project) => (project.id === id ? entry : project)),
    },
    identity,
  );
  await removeStoredThumbnail(id, identity);
  return entry;
}

/** Pin (or clear, with `null`) the screen the project cover is captured from. */
export async function setProjectCoverScreen(
  input: { id: string; screenId: string | null },
  identity?: UserStorageIdentity,
): Promise<ProjectEntry | null> {
  return withProjectRegistryMutation(identity, () =>
    setProjectCoverScreenWithinMutation(input, identity),
  );
}

async function setProjectCoverScreenWithinMutation(
  input: { id: string; screenId: string | null },
  identity?: UserStorageIdentity,
): Promise<ProjectEntry | null> {
  const registry = await readProjectsRegistry(identity);
  const current = registry.projects.find((p) => p.id === input.id);
  if (!current) return null;

  let entry: ProjectEntry;
  if (input.screenId) {
    entry = { ...current, coverScreenId: input.screenId };
  } else {
    const { coverScreenId: _cleared, ...rest } = current;
    entry = rest;
  }
  await writeProjectsRegistry(
    {
      version: 1,
      projects: registry.projects.map((project) => (project.id === input.id ? entry : project)),
    },
    identity,
  );
  return entry;
}

function normalizeDefaultThumbnailPath(thumbnailPath: string): string {
  const parsed = thumbnailPath.startsWith('http')
    ? new URL(thumbnailPath).pathname
    : thumbnailPath.split('?')[0]!;
  const currentPath = DEFAULT_THUMBNAIL_PATHS.get(parsed);
  if (!currentPath) {
    throw new Error('Unsupported default thumbnail.');
  }
  return currentPath;
}

export async function readProjectThumbnail(
  id: string,
  identity?: UserStorageIdentity,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const path = await storedThumbnailPath(id, identity);
  if (!path) return null;
  const contentType = THUMBNAIL_CONTENT_TYPES[extname(path).toLowerCase()];
  if (!contentType) return null;
  return { bytes: await readFile(path), contentType };
}

function sortProjects(projects: ProjectEntry[]): ProjectEntry[] {
  return [...projects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export async function detectProjectType(workspacePath: string): Promise<ProjectType> {
  try {
    const profile = await scanProjectProfile(workspacePath);
    if (profile.kind === 'react-storybook') return 'storybook';
    if (profile.kind === 'html-css') return 'html';
    if (profile.kind === 'react') return 'react';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

async function readProjectName(workspacePath: string): Promise<string | null> {
  try {
    const raw = await readFile(projectFilePath(workspacePath), 'utf8');
    const parsed = ProjectSchema.parse(JSON.parse(raw));
    return parsed.name;
  } catch {
    return null;
  }
}

async function writeProjectName(workspacePath: string, name: string): Promise<void> {
  const resolvedWorkspace = resolve(workspacePath);
  const project = await loadProjectForWorkspace(resolvedWorkspace);
  await saveProject({ ...project, name, workspacePath: resolvedWorkspace });
}

function sanitiseProjectFolderName(name: string): string {
  const folderName = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!folderName) {
    throw new Error('Project name must include letters or numbers.');
  }
  return folderName;
}

function isSameOrChildPath(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);
  return (
    relativePath === '' ||
    (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
  );
}

async function assertPathDoesNotExist(path: string): Promise<void> {
  try {
    await stat(path);
  } catch (err) {
    if (isNotFoundError(err)) return;
    throw err;
  }
  throw new Error(`Destination already exists: ${path}`);
}

async function pathExists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}

function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
}

export async function writeProjectsRegistry(
  registry: ProjectsRegistry,
  identity?: UserStorageIdentity,
): Promise<void> {
  const path = registryPath(identity);
  await mkdir(dirname(path), { recursive: true });
  await writeFileAtomic(path, JSON.stringify(registry, null, 2));
}

function parseThumbnailDataUrl(dataUrl: string): { bytes: Buffer; ext: string } {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/u.exec(dataUrl);
  if (!match) {
    throw new Error('Thumbnail must be a PNG, JPEG, or WebP data URL.');
  }
  const mime = match[1]!;
  const ext = THUMBNAIL_MIME_EXT[mime];
  if (!ext) {
    throw new Error('Unsupported thumbnail type.');
  }
  const bytes = Buffer.from(match[2]!, 'base64');
  if (bytes.length === 0) {
    throw new Error('Thumbnail is empty.');
  }
  if (bytes.length > MAX_THUMBNAIL_BYTES) {
    throw new Error('Thumbnail is larger than 5MB.');
  }
  return { bytes, ext };
}

async function removeStoredThumbnail(
  id: string,
  identity?: UserStorageIdentity,
  keepExt?: string,
): Promise<void> {
  await Promise.all(
    THUMBNAIL_EXTENSIONS.filter((ext) => ext !== keepExt).map((ext) =>
      unlink(resolve(thumbnailsDir(identity), `${id}${ext}`)).catch(() => undefined),
    ),
  );
}

async function writeFileAtomic(path: string, data: string | Uint8Array): Promise<void> {
  const temporaryPath = resolve(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, data);
    await rename(temporaryPath, path);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

async function storedThumbnailPath(
  id: string,
  identity?: UserStorageIdentity,
): Promise<string | null> {
  for (const ext of THUMBNAIL_EXTENSIONS) {
    const path = resolve(thumbnailsDir(identity), `${id}${ext}`);
    try {
      const info = await stat(path);
      if (info.isFile()) return path;
    } catch {
      // Keep probing the remaining supported extensions.
    }
  }
  return null;
}

export function registryPath(identity?: UserStorageIdentity): string {
  const directory = identity ? userDataDirectory(identity) : null;
  if (directory) return resolve(directory, 'projects.json');
  return resolve(
    process.env.SBER_DESIGNER_PROJECTS_REGISTRY_PATH ??
      resolve(homedir(), '.sber-designer', 'projects.json'),
  );
}

export function thumbnailsDir(identity?: UserStorageIdentity): string {
  const directory = identity ? userDataDirectory(identity) : null;
  if (directory) return resolve(directory, 'thumbnails');
  return resolve(
    process.env.SBER_DESIGNER_PROJECT_THUMBNAILS_DIR ??
      resolve(homedir(), '.sber-designer', 'thumbnails'),
  );
}

async function migrateLegacyRegistryForAdmin(
  identity: UserStorageIdentity | undefined,
): Promise<void> {
  if (!identity || identity.kind !== 'user' || !identity.isAdmin) return;
  const target = registryPath(identity);
  if (await pathExists(target)) return;
  const legacy = registryPath();
  if (!(await pathExists(legacy)) || legacy === target) return;
  try {
    const parsed = ProjectsRegistrySchema.parse(JSON.parse(await readFile(legacy, 'utf8')));
    if (parsed.projects.length === 0) return;
    const projects = await Promise.all(
      parsed.projects.map(async (project) => ({
        ...project,
        legacy: true,
        projectType: await detectProjectType(project.workspacePath),
      })),
    );
    await writeProjectsRegistry(
      {
        version: 1,
        projects,
      },
      identity,
    );
  } catch {
    // Invalid Stage-0 registries stay untouched for manual SSH recovery.
  }
}
