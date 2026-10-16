import { afterEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Hono } from 'hono';

import {
  ensureSberDesignerGitignore,
  readProjectCover,
  writeProjectCover,
  writeProjectCoverAndResetThumbnail,
} from './project-cover-store';
import {
  readProjectsRegistry,
  setProjectCoverScreen,
  updateProjectThumbnail,
  withProjectRegistryMutation,
  writeProjectsRegistry,
  type ProjectEntry,
} from './projects-registry';
import { projectsRouter } from './routes/projects';
import type { UserStorageIdentity } from './user-storage';

// 1x1 images, enough to exercise the encode/extension handling.
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const WEBP_DATA_URL = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

const previousRegistryPath = process.env.SBER_DESIGNER_PROJECTS_REGISTRY_PATH;
const previousThumbnailsDir = process.env.SBER_DESIGNER_PROJECT_THUMBNAILS_DIR;
const previousUsersRoot = process.env.SBER_DESIGNER_USERS_ROOT;
const temporaryRoots: string[] = [];

afterEach(async () => {
  restoreEnv('SBER_DESIGNER_PROJECTS_REGISTRY_PATH', previousRegistryPath);
  restoreEnv('SBER_DESIGNER_PROJECT_THUMBNAILS_DIR', previousThumbnailsDir);
  restoreEnv('SBER_DESIGNER_USERS_ROOT', previousUsersRoot);
  await Promise.all(
    temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function seedProject(): Promise<{ id: string; workspacePath: string }> {
  const root = await mkdtemp(resolve(tmpdir(), 'sber-designer-cover-'));
  temporaryRoots.push(root);
  process.env.SBER_DESIGNER_PROJECTS_REGISTRY_PATH = resolve(root, 'projects.json');
  process.env.SBER_DESIGNER_PROJECT_THUMBNAILS_DIR = resolve(root, 'thumbnails');
  const workspacePath = resolve(root, 'workspace');
  await mkdir(workspacePath, { recursive: true });
  const id = 'project-under-test';
  const entry: ProjectEntry = {
    id,
    name: 'Cover Project',
    workspacePath,
    projectType: 'unknown',
    lastOpenedAt: Date.now(),
    createdAt: Date.now(),
  };
  await writeProjectsRegistry({ version: 1, projects: [entry] });
  return { id, workspacePath };
}

test('cover is stored inside the project .sber-designer folder and served back', async () => {
  const { id, workspacePath } = await seedProject();
  expect(await readProjectCover(id)).toBeNull();

  const written = await writeProjectCover({ id, dataUrl: WEBP_DATA_URL });
  expect(written?.bytes).toBeGreaterThan(0);

  const coverPath = resolve(workspacePath, '.sber-designer/previews/cover.webp');
  expect((await stat(coverPath)).isFile()).toBe(true);

  const cover = await readProjectCover(id);
  expect(cover?.contentType).toBe('image/webp');
  expect(cover?.bytes.length).toBeGreaterThan(0);
});

test('the committed cover is not gitignored, but the flow captures are', async () => {
  const { id, workspacePath } = await seedProject();
  await writeProjectCover({ id, dataUrl: WEBP_DATA_URL });

  const gitignore = await readFile(resolve(workspacePath, '.sber-designer/.gitignore'), 'utf8');
  const entries = gitignore.split(/\r?\n/).map((line) => line.trim());
  expect(entries).toContain('previews/screens/');
  // A blanket `previews/` would also hide the cover we intend to commit.
  expect(entries).not.toContain('previews/');
});

test('a legacy blanket previews/ ignore is narrowed to the flow captures', async () => {
  const { workspacePath } = await seedProject();
  const gitignorePath = resolve(workspacePath, '.sber-designer/.gitignore');
  await mkdir(resolve(workspacePath, '.sber-designer'), { recursive: true });
  await writeFile(gitignorePath, 'previews/\npreviews/screens/\npreviews/\n', 'utf8');

  await ensureSberDesignerGitignore(workspacePath);

  const entries = (await readFile(gitignorePath, 'utf8')).split(/\r?\n/).map((line) => line.trim());
  expect(entries.filter((entry) => entry === 'previews/screens/')).toHaveLength(1);
  expect(entries).not.toContain('previews/');
});

test('switching encoding replaces the previous cover file', async () => {
  const { id, workspacePath } = await seedProject();
  await writeProjectCover({ id, dataUrl: PNG_DATA_URL });
  expect((await stat(resolve(workspacePath, '.sber-designer/previews/cover.png'))).isFile()).toBe(
    true,
  );

  await writeProjectCover({ id, dataUrl: WEBP_DATA_URL });
  await expect(stat(resolve(workspacePath, '.sber-designer/previews/cover.png'))).rejects.toThrow();
  const cover = await readProjectCover(id);
  expect(cover?.contentType).toBe('image/webp');
});

test('cover writes reject anything that is not a WebP or PNG data URL', async () => {
  const { id } = await seedProject();
  await expect(
    writeProjectCover({ id, dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }),
  ).rejects.toThrow(/WebP or PNG/u);
  await expect(
    writeProjectCover({ id, dataUrl: 'data:image/webp;base64,R0lGODlhAQABAAAAACw=' }),
  ).rejects.toThrow(/do not match/u);
});

test('cover reads reject oversized or corrupt files already present in the project', async () => {
  const { id, workspacePath } = await seedProject();
  const previews = resolve(workspacePath, '.sber-designer/previews');
  await mkdir(previews, { recursive: true });
  await writeFile(resolve(previews, 'cover.webp'), Buffer.alloc(1024 * 1024 + 1, 0));
  expect(await readProjectCover(id)).toBeNull();

  await writeFile(resolve(previews, 'cover.webp'), Buffer.from('not a webp'));
  expect(await readProjectCover(id)).toBeNull();
});

test('cover storage refuses a previews symlink that escapes the project', async () => {
  const { id, workspacePath } = await seedProject();
  const outside = resolve(workspacePath, '..', 'outside-covers');
  await mkdir(outside, { recursive: true });
  await mkdir(resolve(workspacePath, '.sber-designer'), { recursive: true });
  await symlink(outside, resolve(workspacePath, '.sber-designer/previews'));

  await expect(writeProjectCover({ id, dataUrl: WEBP_DATA_URL })).rejects.toThrow(
    /outside the workspace/u,
  );
  await expect(stat(resolve(outside, 'cover.webp'))).rejects.toThrow();
});

test('pinning a screen records it, and unpinning returns to auto', async () => {
  const { id } = await seedProject();
  const pinned = await setProjectCoverScreen({ id, screenId: 'screen-42' });
  expect(pinned?.coverScreenId).toBe('screen-42');
  await expect(
    writeProjectCover({ id, dataUrl: WEBP_DATA_URL, screenId: 'stale-screen' }),
  ).rejects.toThrow(/source changed/u);
  expect(
    await writeProjectCover({ id, dataUrl: WEBP_DATA_URL, screenId: 'screen-42' }),
  ).not.toBeNull();

  const unpinned = await setProjectCoverScreen({ id, screenId: null });
  expect(unpinned).not.toBeNull();
  expect(unpinned?.coverScreenId).toBeUndefined();
});

test('opening a project heals a cover pin whose screen no longer exists', async () => {
  const { id } = await seedProject();
  await setProjectCoverScreen({ id, screenId: 'deleted-screen' });
  const app = new Hono().route('/api/projects', projectsRouter);

  const response = await app.request(`/api/projects/${id}/open`, { method: 'POST' });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { entry: ProjectEntry };
  expect(body.entry.coverScreenId).toBeUndefined();
});

test('reset clears the explicit thumbnail override so the cover can win', async () => {
  const { id } = await seedProject();
  const withOverride = await updateProjectThumbnail({
    id,
    thumbnailPath: '/project-preview/image02.png',
  });
  expect(withOverride?.thumbnailPath).toBe('/project-preview/image02.webp');

  const reset = await updateProjectThumbnail({ id, reset: true });
  expect(reset).not.toBeNull();
  expect(reset?.thumbnailPath).toBeUndefined();
});

test('cover reads return null for an unknown project id', async () => {
  await seedProject();
  expect(await readProjectCover('does-not-exist')).toBeNull();
});

test('a written cover drops the manual thumbnail choice so the screenshot wins again', async () => {
  const { id } = await seedProject();
  await updateProjectThumbnail({ id, thumbnailPath: '/project-preview/image02.png' });
  const app = new Hono().route('/api/projects', projectsRouter);

  const response = await app.request(`/api/projects/${id}/cover`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dataUrl: WEBP_DATA_URL }),
  });
  expect(response.status).toBe(200);

  // Picking a placeholder is a temporary choice: only the Generative thumbnail
  // switch keeps generated covers away for good (0135 Р-7).
  const listed = await app.request('/api/projects');
  const registry = (await listed.json()) as { projects: ProjectEntry[] };
  expect(registry.projects.find((project) => project.id === id)?.thumbnailPath).toBeUndefined();
});

test('a manual thumbnail picked after cover refresh starts wins the serialized registry race', async () => {
  const { id } = await seedProject();
  await updateProjectThumbnail({ id, thumbnailPath: '/project-preview/image02.png' });

  let releaseRegistry = () => {};
  let markRegistryHeld = () => {};
  const registryHeld = new Promise<void>((resolveHeld) => {
    markRegistryHeld = resolveHeld;
  });
  const registryRelease = new Promise<void>((resolveRelease) => {
    releaseRegistry = resolveRelease;
  });
  const blocker = withProjectRegistryMutation(undefined, async () => {
    markRegistryHeld();
    await registryRelease;
  });
  await registryHeld;

  // Queue the cover first, then the newer explicit user choice. The shared
  // registry mutation queue must let the later user action win.
  const cover = writeProjectCoverAndResetThumbnail({ id, dataUrl: WEBP_DATA_URL });
  const manualPick = updateProjectThumbnail({
    id,
    thumbnailPath: '/project-preview/image03.png',
  });
  releaseRegistry();
  await Promise.all([blocker, cover, manualPick]);

  const registry = await readProjectsRegistry();
  expect(registry.projects.find((project) => project.id === id)?.thumbnailPath).toBe(
    '/project-preview/image03.webp',
  );
});

test('cover route returns a content ETag and honors If-None-Match', async () => {
  const { id } = await seedProject();
  await writeProjectCover({ id, dataUrl: WEBP_DATA_URL });
  const app = new Hono().route('/api/projects', projectsRouter);

  const first = await app.request(`/api/projects/${id}/cover`);
  expect(first.status).toBe(200);
  expect(first.headers.get('content-type')).toBe('image/webp');
  expect(first.headers.get('x-content-type-options')).toBe('nosniff');
  const etag = first.headers.get('etag');
  expect(etag).toMatch(/^"cover-sha256-/u);

  const cached = await app.request(`/api/projects/${id}/cover`, {
    headers: { 'if-none-match': etag ?? '' },
  });
  expect(cached.status).toBe(304);
  expect(cached.headers.get('etag')).toBe(etag);
  expect(cached.headers.get('cache-control')).toContain('must-revalidate');
});

test('cover lookup is scoped to the caller registry identity', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'sber-designer-cover-scope-'));
  temporaryRoots.push(root);
  process.env.SBER_DESIGNER_USERS_ROOT = resolve(root, 'users');
  const workspacePath = resolve(root, 'alice-workspace');
  await mkdir(workspacePath, { recursive: true });
  const alice = identity('alice');
  const bob = identity('bob');
  const entry: ProjectEntry = {
    id: 'shared-looking-id',
    name: 'Alice Project',
    workspacePath,
    projectType: 'unknown',
    lastOpenedAt: Date.now(),
    createdAt: Date.now(),
  };
  await writeProjectsRegistry({ version: 1, projects: [entry] }, alice);
  await writeProjectsRegistry({ version: 1, projects: [] }, bob);
  await writeProjectCover({ id: entry.id, dataUrl: WEBP_DATA_URL }, alice);

  expect(await readProjectCover(entry.id, alice)).not.toBeNull();
  expect(await readProjectCover(entry.id, bob)).toBeNull();
});

function identity(key: string): UserStorageIdentity {
  return {
    kind: 'user',
    key,
    principal: `${key}@example.test`,
    userId: key,
    isAdmin: false,
  };
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
