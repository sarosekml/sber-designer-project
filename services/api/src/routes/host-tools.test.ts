import { expect, test } from 'bun:test';

import type { HostAppId } from '@sber-designer/shared-types';

import { createHostToolsRouter } from './host-tools';

const LOCAL_APPS = {
  platform: 'darwin' as const,
  apps: [{ id: 'cursor' as const, label: 'Cursor', kind: 'editor' as const, available: true }],
};

function openRequest(appId: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ appId }),
  };
}

test('host routes are disabled in server deployments', async () => {
  const router = createHostToolsRouter({ deploymentMode: () => 'server' });

  expect((await router.request('/apps')).status).toBe(403);
  expect((await router.request('/open-in', openRequest('cursor'))).status).toBe(403);
});

test('host open route validates app and active workspace', async () => {
  const router = createHostToolsRouter({
    deploymentMode: () => 'local',
    platform: () => 'darwin',
    listApps: async () => LOCAL_APPS,
    workspacePath: () => null,
  });

  expect((await router.request('/open-in', openRequest('unknown'))).status).toBe(400);
  expect((await router.request('/open-in', openRequest('explorer'))).status).toBe(400);
  expect((await router.request('/open-in', openRequest('cursor'))).status).toBe(404);
});

test('host open route reports unavailable and launch failure', async () => {
  const base = {
    deploymentMode: () => 'local' as const,
    platform: () => 'darwin' as const,
    workspacePath: () => '/workspace/Work Dev/project',
    listApps: async () => LOCAL_APPS,
  };
  const unavailable = createHostToolsRouter({
    ...base,
    resolveLaunchPlan: async () => ({ available: false }),
  });
  const launchFailed = createHostToolsRouter({
    ...base,
    resolveLaunchPlan: async () => ({
      available: true,
      command: '/usr/local/bin/cursor',
      args: ['/workspace/Work Dev/project'],
    }),
    launch: async () => ({ ok: false, error: 'blocked' }),
  });

  expect((await unavailable.request('/open-in', openRequest('cursor'))).status).toBe(409);
  const failedResponse = await launchFailed.request('/open-in', openRequest('cursor'));
  expect(failedResponse.status).toBe(500);
  expect(await failedResponse.json()).toEqual({
    error: 'launch_failed',
    detail: 'Failed to launch Cursor: blocked',
  });
});

test('host open route launches the server-owned workspace as one argument', async () => {
  const calls: Array<{ appId: HostAppId; workspacePath: string }> = [];
  const launches: Array<{ command: string; args: string[] }> = [];
  const workspacePath = '/workspace/Work Dev/project & notes';
  const router = createHostToolsRouter({
    deploymentMode: () => 'local',
    platform: () => 'darwin',
    workspacePath: () => workspacePath,
    listApps: async () => LOCAL_APPS,
    resolveLaunchPlan: async (appId, resolvedWorkspacePath) => {
      calls.push({ appId, workspacePath: resolvedWorkspacePath });
      return {
        available: true,
        command: '/usr/local/bin/cursor',
        args: [resolvedWorkspacePath],
      };
    },
    launch: async (command, args) => {
      launches.push({ command, args });
      return { ok: true };
    },
  });

  expect((await router.request('/apps')).status).toBe(200);
  const response = await router.request('/open-in', openRequest('cursor'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, appId: 'cursor', path: workspacePath });
  expect(calls).toEqual([{ appId: 'cursor', workspacePath }]);
  expect(launches).toEqual([
    { command: '/usr/local/bin/cursor', args: ['/workspace/Work Dev/project & notes'] },
  ]);
});
