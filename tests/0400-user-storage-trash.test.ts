import { afterEach, describe, expect, test } from 'bun:test';
import { lstat, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Hono } from 'hono';

import type { AdminUser, SessionUser } from '../services/api/src/auth/types';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';
import { git } from '../services/api/src/git/git-worker';
import { loadProjectForWorkspace } from '../services/api/src/project-store';
import {
  readProjectsRegistry,
  registerProject,
  registryPath,
} from '../services/api/src/projects-registry';
import { fsRouter } from '../services/api/src/routes/fs';
import { projectsRouter } from '../services/api/src/routes/projects';
import { scaffoldRouter } from '../services/api/src/routes/scaffold';
import { stateRouter } from '../services/api/src/routes/state';
import { getState, patchState, resetState, subscribeState } from '../services/api/src/state-store';
import {
  assertWorkspacePathForIdentity,
  localStorageIdentity,
  storageIdentityForUser,
  updateUserLastFolder,
  userDataDirectory,
  userProjectsRoot,
} from '../services/api/src/user-storage';
import {
  listTrashEntries,
  moveUserToTrash,
  previewUserTrash,
  purgeTrash,
  rollbackUserTrash,
  restoreTrashProject,
} from '../services/api/src/user-trash';

const temporaryDirectories: string[] = [];
const ORIGINAL_ENV = {
  deploymentMode: process.env.SBER_DESIGNER_DEPLOYMENT_MODE,
  authMode: process.env.SBER_DESIGNER_AUTH_MODE,
  projectsRoot: process.env.SBER_DESIGNER_PROJECTS_ROOT,
  usersRoot: process.env.SBER_DESIGNER_USERS_ROOT,
  registryPath: process.env.SBER_DESIGNER_PROJECTS_REGISTRY_PATH,
  thumbnailsDir: process.env.SBER_DESIGNER_PROJECT_THUMBNAILS_DIR,
};

afterEach(async () => {
  resetState();
  restoreEnv('SBER_DESIGNER_DEPLOYMENT_MODE', ORIGINAL_ENV.deploymentMode);
  restoreEnv('SBER_DESIGNER_AUTH_MODE', ORIGINAL_ENV.authMode);
  restoreEnv('SBER_DESIGNER_PROJECTS_ROOT', ORIGINAL_ENV.projectsRoot);
  restoreEnv('SBER_DESIGNER_USERS_ROOT', ORIGINAL_ENV.usersRoot);
  restoreEnv('SBER_DESIGNER_PROJECTS_REGISTRY_PATH', ORIGINAL_ENV.registryPath);
  restoreEnv('SBER_DESIGNER_PROJECT_THUMBNAILS_DIR', ORIGINAL_ENV.thumbnailsDir);
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('0400 per-user project storage', () => {
  test('isolates project lists and returns 404 when another user opens a project id', async () => {
    const roots = await configurePasswordStorage();
    const ada = sessionUser('user-ada', 'ada@example.com', 'Ada Lovelace');
    const grace = sessionUser('user-grace', 'grace@example.com', 'Grace Hopper');
    const adaRoot = await userProjectsRoot(storageIdentityForUser(ada));
    expect(adaRoot).not.toBeNull();
    const workspace = join(adaRoot!, 'private-product');
    await writeProject(workspace, 'Private product');

    const app = projectApp({ ada, grace });
    const registered = await requestAs(app, ada, '/projects', {
      method: 'POST',
      body: JSON.stringify({ workspacePath: workspace }),
    });
    expect(registered.status).toBe(201);
    const entry = (await registered.json()) as { id: string };

    const ownList = await requestAs(app, ada, '/projects');
    expect((await ownList.json()).projects).toHaveLength(1);
    const foreignList = await requestAs(app, grace, '/projects');
    expect(await foreignList.json()).toEqual({ version: 1, projects: [] });

    const foreignOpen = await requestAs(app, grace, `/projects/${entry.id}/open`, {
      method: 'POST',
    });
    expect(foreignOpen.status).toBe(404);
    expect((await foreignOpen.json()).error).toBe('project_not_found');

    const stateWrite = await requestAs(app, ada, '/state', {
      method: 'POST',
      body: JSON.stringify({ workspacePath: workspace, mode: 'design' }),
    });
    expect(stateWrite.status).toBe(200);
    const ownState = await requestAs(
      app,
      ada,
      `/state?workspacePath=${encodeURIComponent(workspace)}`,
    );
    expect(await ownState.json()).toMatchObject({ workspacePath: workspace, mode: 'design' });
    const foreignState = await requestAs(
      app,
      grace,
      `/state?workspacePath=${encodeURIComponent(workspace)}`,
    );
    expect(foreignState.status).toBe(422);
    expect((await foreignState.json()).error).toBe('workspace_outside_user_root');
    expect(registryPath(storageIdentityForUser(ada))).toStartWith(roots.usersRoot);
    expect(registryPath(storageIdentityForUser(grace))).toStartWith(roots.usersRoot);
  });

  test('confines folder browsing and scaffold to the authenticated user root', async () => {
    const roots = await configurePasswordStorage();
    const ada = sessionUser('user-ada', 'ada@example.com', 'Ada Lovelace');
    const identity = storageIdentityForUser(ada);
    const ownRoot = await userProjectsRoot(identity);
    expect(ownRoot).not.toBeNull();
    const outside = join(roots.base, 'outside');
    await mkdir(outside);
    await symlink(outside, join(ownRoot!, 'escape'));

    await expect(assertWorkspacePathForIdentity(identity, outside)).rejects.toThrow(
      'Projects must live under your folder on this server.',
    );
    await expect(
      assertWorkspacePathForIdentity(identity, join(ownRoot!, '..', 'outside')),
    ).rejects.toThrow('Projects must live under your folder on this server.');
    await expect(
      assertWorkspacePathForIdentity(identity, join(ownRoot!, 'escape')),
    ).rejects.toThrow('Projects must live under your folder on this server.');

    const app = projectApp({ ada });
    const initialList = await requestAs(app, ada, '/fs/list');
    expect(initialList.status).toBe(200);
    expect((await initialList.json()).path).toBe(ownRoot);

    await writeFile(
      join(userDataDirectory(identity)!, 'settings.json'),
      JSON.stringify({ version: 1, lastFolder: outside }),
      'utf8',
    );
    const staleSettingList = await requestAs(app, ada, '/fs/list');
    expect(staleSettingList.status).toBe(200);
    expect((await staleSettingList.json()).path).toBe(ownRoot);

    for (const path of [outside, join(ownRoot!, '..'), join(ownRoot!, 'escape')]) {
      const response = await requestAs(app, ada, `/fs/list?path=${encodeURIComponent(path)}`);
      expect(response.status).toBe(422);
      expect((await response.json()).error).toBe('workspace_outside_user_root');
    }

    const blockedScaffold = await requestAs(app, ada, '/scaffold', {
      method: 'POST',
      body: JSON.stringify({ parentDir: outside, name: 'blocked', projectKind: 'html-first' }),
    });
    expect(blockedScaffold.status).toBe(422);
    expect((await blockedScaffold.json()).detail).toContain(
      'Projects must live under your folder on this server.',
    );

    const scaffolded = await requestAs(app, ada, '/scaffold', {
      method: 'POST',
      body: JSON.stringify({
        parentDir: ownRoot,
        name: 'owned-project',
        projectKind: 'html-first',
        createStarterFiles: true,
      }),
    });
    expect(scaffolded.status).toBe(200);
    const scaffoldBody = (await scaffolded.json()) as { workspacePath: string };
    expect(scaffoldBody.workspacePath).toStartWith(`${ownRoot}/`);
    const gitignore = await readFile(join(scaffoldBody.workspacePath, '.gitignore'), 'utf8');
    expect(gitignore).toContain('.sber-designer/runs/');
    expect(gitignore).not.toContain('project.sdproj');
    expect(gitignore).not.toContain('Design.md');

    const settings = JSON.parse(
      await readFile(join(userDataDirectory(identity)!, 'settings.json'), 'utf8'),
    );
    expect(settings).toEqual({ version: 1, lastFolder: ownRoot });
  });

  test('keeps local mode on the legacy registry paths and migrates shared entries only to admin', async () => {
    const roots = await configurePasswordStorage();
    const legacyRegistry = join(roots.base, 'legacy-projects.json');
    const legacyThumbnails = join(roots.base, 'legacy-thumbnails');
    const legacyWorkspace = join(roots.base, 'legacy-workspace');
    await writeProject(legacyWorkspace, 'Legacy project');
    process.env.SBER_DESIGNER_PROJECTS_REGISTRY_PATH = legacyRegistry;
    process.env.SBER_DESIGNER_PROJECT_THUMBNAILS_DIR = legacyThumbnails;

    process.env.SBER_DESIGNER_AUTH_MODE = 'local';
    const localEntry = await registerProject(
      { workspacePath: legacyWorkspace },
      localStorageIdentity('local-dev'),
    );
    expect(registryPath(localStorageIdentity())).toBe(legacyRegistry);
    expect((await readProjectsRegistry(localStorageIdentity())).projects[0]?.id).toBe(
      localEntry.id,
    );

    process.env.SBER_DESIGNER_AUTH_MODE = 'password';
    const admin = sessionUser('admin-user', 'admin@example.com', 'Admin', 'admin');
    const member = sessionUser('member-user', 'member@example.com', 'Member');
    const adminRegistry = await readProjectsRegistry(storageIdentityForUser(admin));
    expect(adminRegistry.projects).toMatchObject([{ id: localEntry.id, legacy: true }]);
    expect(await readProjectsRegistry(storageIdentityForUser(member))).toEqual({
      version: 1,
      projects: [],
    });
    expect(JSON.parse(await readFile(legacyRegistry, 'utf8')).projects[0].legacy).toBeUndefined();
  });
});

describe('0400 admin trash and recovery', () => {
  test('rolls a completed filesystem trash move back when account deletion cannot commit', async () => {
    await configurePasswordStorage();
    const owner = adminUser('rollback-user', 'rollback@example.com', 'Rollback User');
    const identity = storageIdentityForUser(owner);
    const ownerRoot = (await userProjectsRoot(identity))!;
    const workspace = join(ownerRoot, 'rollback-project');
    await writeProject(workspace, 'Rollback project');
    const registered = await registerProject({ workspacePath: workspace }, identity);
    await updateUserLastFolder(identity, ownerRoot);

    const manifest = await moveUserToTrash(owner, 'admin@example.com');
    await rollbackUserTrash(owner, manifest);

    expect(await readFile(join(workspace, 'Design.md'), 'utf8')).toContain('Rollback project');
    expect((await readProjectsRegistry(identity)).projects).toMatchObject([
      { id: registered.id, workspacePath: workspace },
    ]);
    expect(await listTrashEntries()).toEqual([]);
  });

  test('classifies git risk, moves by rename, restores with collision, and purges safely', async () => {
    const roots = await configurePasswordStorage();
    const owner = adminUser('owner-user', 'owner@example.com', 'Original Owner');
    const target = adminUser('target-user', 'target@example.com', 'New Owner');
    const ownerIdentity = storageIdentityForUser(owner);
    const ownerRoot = (await userProjectsRoot(ownerIdentity))!;

    const clean = await createRepo(join(ownerRoot, 'clean-remote'), 'Clean remote', true);
    const dirty = await createRepo(join(ownerRoot, 'dirty-local'), 'Dirty local', false);
    await writeFile(join(dirty, 'draft.txt'), 'not committed\n', 'utf8');
    const unpushed = await createRepo(join(ownerRoot, 'unpushed-remote'), 'Unpushed remote', true);
    await writeFile(join(unpushed, 'ahead.txt'), 'ahead\n', 'utf8');
    await mustGit(unpushed, ['add', 'ahead.txt']);
    await mustGit(unpushed, ['commit', '-m', 'local ahead']);

    for (const workspacePath of [clean, dirty, unpushed]) {
      await registerProject({ workspacePath }, ownerIdentity);
    }
    await updateUserLastFolder(ownerIdentity, ownerRoot);

    const preview = await previewUserTrash(owner);
    expect(preview.projects.find((project) => project.folder === 'clean-remote')).toMatchObject({
      hasRemote: true,
      uncommitted: false,
      unpushedCommits: 0,
      notPushedAnywhere: false,
    });
    expect(preview.projects.find((project) => project.folder === 'dirty-local')).toMatchObject({
      hasRemote: false,
      uncommitted: true,
      notPushedAnywhere: true,
    });
    expect(preview.projects.find((project) => project.folder === 'unpushed-remote')).toMatchObject({
      hasRemote: true,
      uncommitted: false,
      unpushedCommits: 1,
      notPushedAnywhere: true,
    });
    expect(preview.riskyProjects).toBe(2);
    expect(preview.totalBytes).toBeGreaterThan(0);

    const originalOwnerInode = (await lstat(ownerRoot)).ino;
    const manifest = await moveUserToTrash(owner, 'admin@example.com');
    await expect(stat(ownerRoot)).rejects.toThrow();
    const trashedRoot = join(roots.projectsRoot, '.trash', manifest.entryId, 'projects');
    expect((await lstat(trashedRoot)).ino).toBe(originalOwnerInode);
    expect(await listTrashEntries()).toMatchObject([
      {
        entryId: manifest.entryId,
        user: { email: owner.email },
        riskyProjects: 2,
        userDataMoved: true,
      },
    ]);
    expect(
      JSON.parse(
        await readFile(
          join(roots.projectsRoot, '.trash', manifest.entryId, 'manifest.json'),
          'utf8',
        ),
      ),
    ).toMatchObject({ entryId: manifest.entryId, totalBytes: preview.totalBytes });

    const targetRoot = (await userProjectsRoot(storageIdentityForUser(target)))!;
    await mkdir(join(targetRoot, 'clean-remote'));
    const restored = await restoreTrashProject({
      entryId: manifest.entryId,
      folder: 'clean-remote',
      targetUser: target,
    });
    expect(restored.project.workspacePath).toBe(join(targetRoot, 'clean-remote-restored-1'));
    expect(await readFile(join(restored.project.workspacePath, 'Design.md'), 'utf8')).toContain(
      'Clean remote',
    );
    expect((await readProjectsRegistry(storageIdentityForUser(target))).projects).toMatchObject([
      { id: restored.project.id, workspacePath: restored.project.workspacePath },
    ]);
    const restoredProject = await loadProjectForWorkspace(restored.project.workspacePath);
    expect(restoredProject).toMatchObject({
      name: 'Clean remote',
      screens: [{ description: 'Recovery description' }],
    });
    const restoredIndex = await generateProjectDesignIndexFiles(restored.project.workspacePath, {
      projectName: restoredProject.name,
      catalog: null,
    });
    expect(restoredIndex.changedFiles).toContain('.sber-designer/design-index/manifest.json');

    const projectPurge = await purgeTrash({
      entryId: manifest.entryId,
      folder: 'dirty-local',
    });
    expect(projectPurge.purgedEntry).toBe(false);
    await expect(stat(join(trashedRoot, 'dirty-local'))).rejects.toThrow();
    expect(await stat(roots.projectsRoot)).toBeTruthy();

    const entryPurge = await purgeTrash({ entryId: manifest.entryId });
    expect(entryPurge).toEqual({ purgedEntry: true, manifest: null });
    await expect(stat(join(roots.projectsRoot, '.trash', manifest.entryId))).rejects.toThrow();
    await expect(stat(join(roots.usersRoot, '.trash', manifest.entryId))).rejects.toThrow();
    expect(await stat(restored.project.workspacePath)).toBeTruthy();
  });

  test('recovers a deleted project through re-clone into a newly registered user home', async () => {
    await configurePasswordStorage();
    const owner = adminUser('old-account', 'same@example.com', 'Old Account');
    const ownerIdentity = storageIdentityForUser(owner);
    const ownerRoot = (await userProjectsRoot(ownerIdentity))!;
    const workspace = await createRepo(join(ownerRoot, 'reclone-project'), 'Reclone project', true);
    const remote = (await git(['remote', 'get-url', 'origin'], { cwd: workspace })).stdout.trim();
    await registerProject({ workspacePath: workspace }, ownerIdentity);
    const manifest = await moveUserToTrash(owner, 'admin@example.com');

    const replacement = adminUser('new-account', 'same@example.com', 'New Account');
    const replacementIdentity = storageIdentityForUser(replacement);
    const replacementRoot = (await userProjectsRoot(replacementIdentity))!;
    const clonePath = join(replacementRoot, 'reclone-project');
    await mustGit(replacementRoot, ['clone', remote, clonePath]);
    const registered = await registerProject({ workspacePath: clonePath }, replacementIdentity);
    const project = await loadProjectForWorkspace(registered.workspacePath);
    expect(project).toMatchObject({
      name: 'Reclone project',
      screens: [{ description: 'Recovery description' }],
    });
    const rebuiltIndex = await generateProjectDesignIndexFiles(registered.workspacePath, {
      projectName: project.name,
      catalog: null,
    });
    expect(rebuiltIndex.changedFiles).toContain('.sber-designer/design-index/manifest.json');
    expect(await readProjectsRegistry(replacementIdentity)).toMatchObject({
      projects: [{ id: registered.id }],
    });

    await purgeTrash({ entryId: manifest.entryId });
  });
});

test('editor state and subscriptions are isolated by workspace path', () => {
  const workspaceA = '/tmp/stage-9-workspace-a';
  const workspaceB = '/tmp/stage-9-workspace-b';
  const eventsA: string[] = [];
  const eventsB: string[] = [];
  const unsubscribeA = subscribeState((next) => eventsA.push(next.mode ?? 'none'), workspaceA);
  const unsubscribeB = subscribeState((next) => eventsB.push(next.mode ?? 'none'), workspaceB);

  patchState({ workspacePath: workspaceA, mode: 'design', projectName: 'A' }, workspaceA);
  patchState({ workspacePath: workspaceB, mode: 'code', projectName: 'B' }, workspaceB);
  patchState({ selection: null, mode: 'interact' }, workspaceA);

  expect(getState(workspaceA)).toMatchObject({ projectName: 'A', mode: 'interact' });
  expect(getState(workspaceB)).toMatchObject({ projectName: 'B', mode: 'code' });
  expect(eventsA).toEqual(['design', 'interact']);
  expect(eventsB).toEqual(['code']);

  unsubscribeA();
  unsubscribeB();
});

async function configurePasswordStorage(): Promise<{
  base: string;
  projectsRoot: string;
  usersRoot: string;
}> {
  const base = await mkdtemp(join(tmpdir(), 'sd-0400-stage9-'));
  temporaryDirectories.push(base);
  const projectsRoot = join(base, 'projects');
  const usersRoot = join(base, 'users');
  await mkdir(projectsRoot, { recursive: true });
  await mkdir(usersRoot, { recursive: true });
  process.env.SBER_DESIGNER_AUTH_MODE = 'password';
  process.env.SBER_DESIGNER_DEPLOYMENT_MODE = 'server';
  process.env.SBER_DESIGNER_PROJECTS_ROOT = projectsRoot;
  process.env.SBER_DESIGNER_USERS_ROOT = usersRoot;
  return { base, projectsRoot, usersRoot };
}

function projectApp(users: Record<string, SessionUser>): Hono {
  const byEmail = new Map(Object.values(users).map((user) => [user.email, user]));
  const app = new Hono();
  app.use('*', async (c, next) => {
    const email = c.req.header('x-test-user') ?? '';
    const user = byEmail.get(email);
    if (!user) return c.json({ error: 'unauthenticated' }, 401);
    c.set('user', user.email);
    c.set('sessionUser', user);
    await next();
  });
  app.route('/projects', projectsRouter);
  app.route('/fs', fsRouter);
  app.route('/scaffold', scaffoldRouter);
  app.route('/state', stateRouter);
  return app;
}

function requestAs(app: Hono, user: SessionUser, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('x-test-user', user.email);
  if (init.body) headers.set('content-type', 'application/json');
  return app.request(`http://localhost${path}`, { ...init, headers });
}

function sessionUser(
  id: string,
  email: string,
  displayName: string,
  role: 'admin' | 'member' = 'member',
): SessionUser {
  return { id, email, displayName, role, mustChangePassword: false };
}

function adminUser(id: string, email: string, displayName: string): AdminUser {
  const now = '2026-07-10T00:00:00.000Z';
  return {
    id,
    email,
    displayName,
    role: 'member',
    status: 'disabled',
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
}

async function writeProject(workspacePath: string, name: string): Promise<void> {
  await mkdir(join(workspacePath, '.sber-designer'), { recursive: true });
  await writeFile(
    join(workspacePath, '.sber-designer', 'project.sdproj'),
    JSON.stringify({
      version: 1,
      name,
      workspacePath,
      screens: [
        {
          id: 'screen-1',
          name: 'Recovery screen',
          kind: 'page',
          filePath: 'screen.tsx',
          description: 'Recovery description',
        },
      ],
      flow: [],
    }),
    'utf8',
  );
  await writeFile(join(workspacePath, 'screen.tsx'), 'export default function Screen() {}\n');
  await writeFile(join(workspacePath, 'Design.md'), `# ${name}\n\nRecovery description\n`, 'utf8');
}

async function createRepo(
  workspacePath: string,
  name: string,
  withRemote: boolean,
): Promise<string> {
  await writeProject(workspacePath, name);
  await mustGit(workspacePath, ['init', '-b', 'main']);
  await mustGit(workspacePath, ['config', 'user.email', 'test@sber-designer.local']);
  await mustGit(workspacePath, ['config', 'user.name', 'sber-designer test']);
  await mustGit(workspacePath, ['config', 'commit.gpgsign', 'false']);
  await mustGit(workspacePath, ['add', '.']);
  await mustGit(workspacePath, ['commit', '-m', 'initial']);
  if (withRemote) {
    const remote = join(dirnameForTemporaryRepo(workspacePath), `${basename(workspacePath)}.git`);
    await mkdir(remote, { recursive: true });
    await mustGit(remote, ['init', '--bare', '-b', 'main']);
    await mustGit(workspacePath, ['remote', 'add', 'origin', remote]);
    await mustGit(workspacePath, ['push', '-u', 'origin', 'main']);
  }
  return workspacePath;
}

function dirnameForTemporaryRepo(workspacePath: string): string {
  return join(workspacePath, '..', '..', 'remotes');
}

async function mustGit(cwd: string, args: string[]): Promise<void> {
  const result = await git(args, { cwd });
  if (!result.ok) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
