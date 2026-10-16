import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sandboxServer from '../services/sandbox/src/index';
import {
  idsToReapBeforeCapacity,
  idsToReapForWorkspace,
} from '../services/sandbox/src/session-reaper';
import {
  resolveSandboxMaxSessions,
  sandboxCapacityError,
} from '../services/sandbox/src/session-budget';

const temporaryDirectories: string[] = [];
const ORIGINAL_DEPLOYMENT_MODE = process.env.SBER_DESIGNER_DEPLOYMENT_MODE;

afterEach(async () => {
  delete process.env.SBER_DESIGNER_SANDBOX_MAX_SESSIONS;
  if (ORIGINAL_DEPLOYMENT_MODE === undefined) delete process.env.SBER_DESIGNER_DEPLOYMENT_MODE;
  else process.env.SBER_DESIGNER_DEPLOYMENT_MODE = ORIGINAL_DEPLOYMENT_MODE;
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test('idsToReapForWorkspace returns prior sessions for the same workspace (task 9999 LIVE-3)', () => {
  const entries = [
    { id: 'a', workspacePath: '/w/one' },
    { id: 'b', workspacePath: '/w/two' },
    { id: 'c', workspacePath: '/w/one' },
  ];
  expect(idsToReapForWorkspace(entries, '/w/one').sort()).toEqual(['a', 'c']);
  expect(idsToReapForWorkspace(entries, '/w/two')).toEqual(['b']);
  expect(idsToReapForWorkspace(entries, '/w/none')).toEqual([]);
  expect(idsToReapForWorkspace([], '/w/one')).toEqual([]);
});

test('sandbox budget is unlimited locally and defaults to five only on server', () => {
  expect(resolveSandboxMaxSessions(undefined, 'local')).toBeNull();
  expect(resolveSandboxMaxSessions(undefined, 'server')).toBe(5);
  expect(resolveSandboxMaxSessions('0', 'local')).toBe(0);
  expect(resolveSandboxMaxSessions('2', 'local')).toBe(2);
  expect(() => resolveSandboxMaxSessions('invalid', 'server')).toThrow('non-negative integer');
  expect(sandboxCapacityError(100, null)).toBeNull();
  expect(sandboxCapacityError(1, 2)).toBeNull();
  expect(sandboxCapacityError(2, 2)).toEqual({
    error: 'sandbox_session_limit',
    detail:
      'Sandbox capacity is full (2/2). Stop an inactive project session before starting another.',
    activeSessions: 2,
    maxSessions: 2,
  });
});

test('capacity reaper evicts stopped and failed sessions but keeps live sessions', () => {
  expect(
    idsToReapBeforeCapacity([
      { id: 'starting', status: 'starting' },
      { id: 'ready', status: 'ready' },
      { id: 'failed', status: 'failed' },
      { id: 'stopped', status: 'stopped' },
    ]),
  ).toEqual(['failed', 'stopped']);
});

test('sandbox session route returns 429 when a distinct workspace exceeds the budget', async () => {
  process.env.SBER_DESIGNER_DEPLOYMENT_MODE = 'local';
  process.env.SBER_DESIGNER_SANDBOX_MAX_SESSIONS = '0';
  const workspace = await mkdtemp(join(tmpdir(), 'sd-sandbox-budget-'));
  temporaryDirectories.push(workspace);
  const blocked = await sandboxRequest('/api/sessions', {
    method: 'POST',
    // 0136 R01 — the controller only spawns allowlisted bare commands, so this
    // capacity assertion uses one. The budget behaviour under test is unchanged.
    body: JSON.stringify({ workspacePath: workspace, command: 'bun', args: [] }),
  });
  expect(blocked.status).toBe(429);
  expect(await blocked.json()).toEqual({
    error: 'sandbox_session_limit',
    detail:
      'Sandbox capacity is full (0/0). Stop an inactive project session before starting another.',
    activeSessions: 0,
    maxSessions: 0,
  });
});

function sandboxRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  return sandboxServer.fetch(new Request(`http://localhost${path}`, { ...init, headers }));
}
