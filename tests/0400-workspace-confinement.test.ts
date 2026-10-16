import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';

import type { SessionUser } from '../services/api/src/auth/types';
import { agentKitRouter } from '../services/api/src/routes/agent-kit';
import { agentRunsRouter } from '../services/api/src/routes/agent-runs';
import { assetsRouter } from '../services/api/src/routes/assets';
import { catalogRouter } from '../services/api/src/routes/catalog';
import { chatRouter } from '../services/api/src/routes/chat';
import { designContextRouter } from '../services/api/src/routes/design-context';
import { designRouter } from '../services/api/src/routes/design';
import { designIndexRouter } from '../services/api/src/routes/design-index';
import { filesRouter } from '../services/api/src/routes/files';
import { flowRouter } from '../services/api/src/routes/flow';
import { gitRouter } from '../services/api/src/routes/git';
import { patchRouter } from '../services/api/src/routes/patch';
import { previewRouter } from '../services/api/src/routes/preview';
import { projectTemplatesRouter } from '../services/api/src/routes/project-templates';
import { projectRouter } from '../services/api/src/routes/project';
import { sandboxRouter } from '../services/api/src/routes/sandbox';
import { screenFoldersRouter } from '../services/api/src/routes/screen-folders';
import { screenTemplatesRouter } from '../services/api/src/routes/screen-templates';
import { patchState, resetState } from '../services/api/src/state-store';
import {
  getProject,
  loadProjectForWorkspace,
  resetProject,
} from '../services/api/src/project-store';
import {
  storageIdentityForUser,
  updateUserActiveWorkspace,
  userProjectsRoot,
} from '../services/api/src/user-storage';
import { createWorkspaceAccessGuard } from '../services/api/src/workspace-access';
import { runWithRequestWorkspace } from '../services/api/src/workspace-context';

const temporaryDirectories: string[] = [];
const ORIGINAL_ENV = {
  deploymentMode: process.env.SBER_DESIGNER_DEPLOYMENT_MODE,
  authMode: process.env.SBER_DESIGNER_AUTH_MODE,
  projectsRoot: process.env.SBER_DESIGNER_PROJECTS_ROOT,
  usersRoot: process.env.SBER_DESIGNER_USERS_ROOT,
};

afterEach(async () => {
  resetState();
  resetProject();
  restoreEnv('SBER_DESIGNER_DEPLOYMENT_MODE', ORIGINAL_ENV.deploymentMode);
  restoreEnv('SBER_DESIGNER_AUTH_MODE', ORIGINAL_ENV.authMode);
  restoreEnv('SBER_DESIGNER_PROJECTS_ROOT', ORIGINAL_ENV.projectsRoot);
  restoreEnv('SBER_DESIGNER_USERS_ROOT', ORIGINAL_ENV.usersRoot);
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('0400 workspace confinement guard', () => {
  test('rejects another user workspace before every workspace route family', async () => {
    const { ada, grace, graceWorkspace } = await configureUsers();
    const app = workspaceApp({ ada, grace });
    const encoded = encodeURIComponent(graceWorkspace);
    const requests: Array<{ path: string; init?: RequestInit }> = [
      { path: `/git/diff?workspacePath=${encoded}` },
      { path: '/patch', init: jsonPost({ workspacePath: graceWorkspace }) },
      { path: '/design/inspect', init: jsonPost({ workspacePath: graceWorkspace }) },
      { path: '/assets/import-pack', init: jsonPost({ workspacePath: graceWorkspace }) },
      { path: `/files?path=marker.txt&workspacePath=${encoded}` },
      {
        path: `/screen-folders/health?workspacePath=${encoded}`,
        init: jsonPost({ screens: [] }),
      },
      { path: `/flow/previews/screens/missing.png?workspacePath=${encoded}` },
      { path: `/catalog?workspacePath=${encoded}` },
      { path: `/design-index?workspacePath=${encoded}` },
      { path: `/design-context?workspacePath=${encoded}` },
      { path: '/project', init: jsonPut({ workspacePath: graceWorkspace }) },
      { path: '/sandbox/sessions', init: jsonPost({ workspacePath: graceWorkspace }) },
      { path: `/screen-templates?workspacePath=${encoded}` },
      { path: `/project-templates?workspacePath=${encoded}` },
      { path: `/agent-kit?workspacePath=${encoded}` },
      { path: `/agent-runs/example/evidence?workspacePath=${encoded}` },
      { path: `/preview/index.html?workspacePath=${encoded}` },
      { path: '/chat', init: jsonPost({ workspacePath: graceWorkspace }) },
    ];

    for (const request of requests) {
      const response = await requestAs(app, ada, request.path, request.init);
      expect(response.status, request.path).toBe(422);
      expect((await response.json()).error, request.path).toBe('workspace_outside_user_root');
    }
  });

  test('uses only the current user active workspace when a legacy route omits workspacePath', async () => {
    const { ada, grace, adaWorkspace, graceWorkspace } = await configureUsers();
    await writeFile(join(adaWorkspace, 'marker.txt'), 'ada-only', 'utf8');
    await writeFile(join(graceWorkspace, 'marker.txt'), 'grace-only', 'utf8');
    await updateUserActiveWorkspace(storageIdentityForUser(ada), adaWorkspace);
    await updateUserActiveWorkspace(storageIdentityForUser(grace), graceWorkspace);
    patchState({ workspacePath: adaWorkspace }, adaWorkspace);
    patchState({ workspacePath: graceWorkspace }, graceWorkspace);

    const app = workspaceApp({ ada, grace });
    const adaFile = await requestAs(app, ada, '/files?path=marker.txt');
    expect(adaFile.status).toBe(200);
    expect(await adaFile.json()).toEqual({ path: 'marker.txt', contents: 'ada-only' });

    const graceFile = await requestAs(app, grace, '/files?path=marker.txt');
    expect(graceFile.status).toBe(200);
    expect(await graceFile.json()).toEqual({ path: 'marker.txt', contents: 'grace-only' });

    const linus = sessionUser('user-linus', 'linus@example.com', 'Linus Torvalds');
    await userProjectsRoot(storageIdentityForUser(linus));
    const noActiveWorkspace = await requestAs(
      workspaceApp({ linus }),
      linus,
      '/files?path=marker.txt',
    );
    expect(noActiveWorkspace.status).toBe(400);
    expect((await noActiveWorkspace.json()).error).toBe('no_workspace');
  });

  test('keeps loaded project metadata isolated during concurrent requests', async () => {
    const { adaWorkspace, graceWorkspace } = await configureUsers();
    await Promise.all([
      writeProjectRecord(adaWorkspace, 'Ada project'),
      writeProjectRecord(graceWorkspace, 'Grace project'),
    ]);
    await Promise.all([
      loadProjectForWorkspace(adaWorkspace),
      loadProjectForWorkspace(graceWorkspace),
    ]);

    expect(runWithRequestWorkspace(adaWorkspace, () => getProject().name)).toBe('Ada project');
    expect(runWithRequestWorkspace(graceWorkspace, () => getProject().name)).toBe('Grace project');
  });
});

async function configureUsers(): Promise<{
  ada: SessionUser;
  grace: SessionUser;
  adaWorkspace: string;
  graceWorkspace: string;
}> {
  const base = await mkdtemp(join(tmpdir(), 'sd-0400-confinement-'));
  temporaryDirectories.push(base);
  process.env.SBER_DESIGNER_AUTH_MODE = 'password';
  process.env.SBER_DESIGNER_DEPLOYMENT_MODE = 'server';
  process.env.SBER_DESIGNER_PROJECTS_ROOT = join(base, 'projects');
  process.env.SBER_DESIGNER_USERS_ROOT = join(base, 'users');
  await mkdir(process.env.SBER_DESIGNER_PROJECTS_ROOT, { recursive: true });
  await mkdir(process.env.SBER_DESIGNER_USERS_ROOT, { recursive: true });
  const ada = sessionUser('user-ada', 'ada@example.com', 'Ada Lovelace');
  const grace = sessionUser('user-grace', 'grace@example.com', 'Grace Hopper');
  const adaWorkspace = join(
    (await userProjectsRoot(storageIdentityForUser(ada)))!,
    'private-product',
  );
  const graceWorkspace = join(
    (await userProjectsRoot(storageIdentityForUser(grace)))!,
    'private-product',
  );
  await mkdir(adaWorkspace, { recursive: true });
  await mkdir(graceWorkspace, { recursive: true });
  return { ada, grace, adaWorkspace, graceWorkspace };
}

function workspaceApp(users: Record<string, SessionUser>): Hono {
  const byEmail = new Map(Object.values(users).map((user) => [user.email, user]));
  const app = new Hono();
  app.use('*', async (c, next) => {
    const user = byEmail.get(c.req.header('x-test-user') ?? '');
    if (!user) return c.json({ error: 'unauthenticated' }, 401);
    c.set('user', user.email);
    c.set('sessionUser', user);
    c.set('authMethod', 'session');
    await next();
  });
  app.use('*', createWorkspaceAccessGuard());
  app.route('/git', gitRouter);
  app.route('/patch', patchRouter);
  app.route('/design', designRouter);
  app.route('/assets', assetsRouter);
  app.route('/files', filesRouter);
  app.route('/screen-folders', screenFoldersRouter);
  app.route('/flow', flowRouter);
  app.route('/catalog', catalogRouter);
  app.route('/design-index', designIndexRouter);
  app.route('/design-context', designContextRouter);
  app.route('/project', projectRouter);
  app.route('/sandbox', sandboxRouter);
  app.route('/screen-templates', screenTemplatesRouter);
  app.route('/project-templates', projectTemplatesRouter);
  app.route('/agent-kit', agentKitRouter);
  app.route('/agent-runs', agentRunsRouter);
  app.route('/preview', previewRouter);
  app.route('/chat', chatRouter);
  return app;
}

function requestAs(
  app: Hono,
  user: SessionUser,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('x-test-user', user.email);
  return app.request(`http://localhost${path}`, { ...init, headers });
}

function jsonPost(body: unknown): RequestInit {
  return jsonRequest('POST', body);
}

function jsonPut(body: unknown): RequestInit {
  return jsonRequest('PUT', body);
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function sessionUser(id: string, email: string, displayName: string): SessionUser {
  return { id, email, displayName, role: 'member', mustChangePassword: false };
}

async function writeProjectRecord(workspacePath: string, name: string): Promise<void> {
  await mkdir(join(workspacePath, '.sber-designer'), { recursive: true });
  await writeFile(
    join(workspacePath, '.sber-designer', 'project.sdproj'),
    JSON.stringify({ version: 1, name, workspacePath, screens: [], flow: [] }),
    'utf8',
  );
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
