import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  registerAgentPermissionRequest,
  resolveRememberedAgentPermission,
  resolveAgentPermissionRequest,
} from '../services/api/src/agent/permission-requests';
import type { AgentPermissionRequest } from '../services/api/src/agent/stream';

test('agent permission requests resolve only for the owning user', async () => {
  const request: AgentPermissionRequest = {
    id: 'perm-test-1',
    toolCallId: 'call-1',
    toolName: 'apply_patch',
    category: 'edit',
    resource: 'src/screens/Demo.tsx',
    pattern: '*',
    arguments: '{}',
  };

  const response = registerAgentPermissionRequest(request, { user: 'owner' });

  expect(
    resolveAgentPermissionRequest({ id: request.id, user: 'intruder', decision: 'allow' }),
  ).toEqual({ ok: false, reason: 'not_found' });

  expect(
    resolveAgentPermissionRequest({ id: request.id, user: 'owner', decision: 'allow' }),
  ).toEqual({ ok: true });
  await expect(response).resolves.toEqual({ decision: 'allow' });
  expect(
    resolveAgentPermissionRequest({ id: request.id, user: 'owner', decision: 'deny' }),
  ).toEqual({
    ok: false,
    reason: 'not_found',
  });
});

test('agent permission requests remember allow decisions per user scope and pattern', async () => {
  const request: AgentPermissionRequest = {
    id: 'perm-test-2',
    toolCallId: 'call-2',
    toolName: 'apply_patch',
    category: 'edit',
    resource: 'src/screens/Demo.tsx',
    pattern: 'src/screens/**',
    arguments: '{}',
  };

  const response = registerAgentPermissionRequest(request, {
    user: 'owner',
    scope: 'workspace-a',
  });
  expect(
    resolveAgentPermissionRequest({
      id: request.id,
      user: 'owner',
      decision: 'allow',
      remember: true,
    }),
  ).toEqual({ ok: true });
  await expect(response).resolves.toEqual({ decision: 'allow', remember: true });

  const nextRequest = {
    ...request,
    id: 'perm-test-3',
    toolCallId: 'call-3',
    resource: 'src/screens/Next.tsx',
  };
  expect(
    resolveRememberedAgentPermission(nextRequest, { user: 'owner', scope: 'workspace-a' }),
  ).toEqual({ decision: 'allow' });
  expect(
    resolveRememberedAgentPermission(nextRequest, { user: 'owner', scope: 'workspace-b' }),
  ).toBeNull();
});

test('duplicate agent permission request ids abort the previous pending request', async () => {
  const request: AgentPermissionRequest = {
    id: 'perm-test-duplicate',
    toolCallId: 'call-old',
    toolName: 'write_file',
    category: 'edit',
    resource: 'src/screens/Old.tsx',
    pattern: '*',
    arguments: '{}',
  };

  const first = registerAgentPermissionRequest(request, { user: 'owner' });
  const second = registerAgentPermissionRequest(
    {
      ...request,
      toolCallId: 'call-new',
      resource: 'src/screens/New.tsx',
    },
    { user: 'owner' },
  );

  await expect(Promise.race([first, sleep(20).then(() => 'pending')])).resolves.toEqual({
    decision: 'deny',
    reason: 'abort',
  });
  expect(
    resolveAgentPermissionRequest({ id: request.id, user: 'owner', decision: 'allow' }),
  ).toEqual({ ok: true });
  await expect(second).resolves.toEqual({ decision: 'allow' });
});

test('agent permission requests write durable timeline events', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-permission-timeline-'));
  const runId = 'run-permission-timeline';
  const request: AgentPermissionRequest = {
    id: 'perm-test-timeline',
    toolCallId: 'call-timeline',
    toolName: 'write_file',
    runId,
    category: 'edit',
    resource: 'src/screens/Demo.tsx',
    pattern: 'src/screens/**',
    arguments: '{}',
  };

  const response = registerAgentPermissionRequest(request, {
    user: 'owner',
    workspacePath: workspace,
    runId,
  });
  expect(
    resolveAgentPermissionRequest({ id: request.id, user: 'owner', decision: 'allow' }),
  ).toEqual({ ok: true });
  await expect(response).resolves.toEqual({ decision: 'allow' });

  const events = await readTimelineEvents(workspace, runId, 2);
  expect(events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: 'permission_requested',
        runId,
        permissionId: request.id,
        toolName: 'write_file',
        category: 'edit',
        resource: 'src/screens/Demo.tsx',
      }),
      expect.objectContaining({
        type: 'permission_resolved',
        runId,
        permissionId: request.id,
        decision: 'allow',
        reason: 'allowed',
      }),
    ]),
  );
});

async function readTimelineEvents(
  workspace: string,
  runId: string,
  expectedCount: number,
): Promise<Record<string, unknown>[]> {
  const path = join(workspace, '.sber-designer', 'runs', runId, 'timeline.jsonl');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const events = (await readFile(path, 'utf8'))
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      if (events.length >= expectedCount) return events;
    } catch {
      // Timeline writes are fire-and-forget from the request registry.
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
