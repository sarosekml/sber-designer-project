import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { expect, test } from 'bun:test';

import {
  completeAgentRun,
  createAgentRun,
  readRunManifest,
} from '../services/api/src/agent/run-recorder';
import {
  readAgentRunReceipts,
  recordToolReceiptSafely,
} from '../services/api/src/agent/run-record/receipts';
import {
  registerAgentPermissionRequest,
  resolveAgentPermissionRequest,
} from '../services/api/src/agent/permission-requests';
import { getAgentRunCoordinator } from '../services/api/src/agent/run-coordinator';
import type { AgentPermissionRequest } from '../services/api/src/agent/stream';
import { agentRunsRouter } from '../services/api/src/routes/agent-runs';
import { patchState, resetState } from '../services/api/src/state-store';

test('render re-probe confirms proof without rewriting terminal run status', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-render-reprobe-'));
  const screenPath = 'src/screens/ReprobePage.tsx';
  const canvasUrl = 'data:text/html,%3Cmain%20data-sd-screen-root%3EReady%3C%2Fmain%3E';
  resetState();
  patchState({ workspacePath });
  await mkdir(join(workspacePath, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspacePath, screenPath),
    [
      'export function ReprobePage() {',
      '  return <main data-sd-screen-root="true">Ready</main>;',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'echo',
    workspacePath,
    activeScreen: {
      id: 'screen-reprobe',
      name: 'Reprobe page',
      kind: 'page',
      filePath: screenPath,
      implementationFilePath: screenPath,
    },
  });
  await recordToolReceiptSafely({
    workspacePath,
    runId: agentRun.runId,
    tool: 'runtime_render_health',
    status: 'skipped',
    changedFiles: [screenPath],
    summary: 'Runtime proof pending.',
    metadata: {
      canvasUrl,
      runtimeRootProbe: {
        reasonCode: 'runtime_root_unproven',
        evidenceSource: 'storybook-http',
        weakEvidence: true,
      },
    },
  });
  await completeAgentRun({
    workspacePath,
    runId: agentRun.runId,
    status: 'needs_review',
    summary: 'Screen updated — runtime proof pending.',
    diagnostics: { iterations: 3, finishReason: 'stop' },
  });

  const app = new Hono().route('/api/agent-runs', agentRunsRouter);
  const response = await app.request(
    `/api/agent-runs/${encodeURIComponent(agentRun.runId)}/render-reprobe`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ canvasUrl }),
    },
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    ok: true,
    renderProof: {
      status: 'confirmed',
      attempt: 2,
      evidenceSource: 'static-html-http',
    },
    health: {
      status: 'ok',
    },
  });
  const manifest = await readRunManifest(workspacePath, agentRun.runId);
  const receipts = await readAgentRunReceipts(workspacePath, agentRun.runId);
  expect(manifest?.status).toBe('needs_review');
  expect(manifest?.diagnostics?.renderProof).toMatchObject({
    status: 'confirmed',
    attempt: 2,
  });
  expect(receipts).toContainEqual(
    expect.objectContaining({
      tool: 'runtime_root_probe',
      status: 'ok',
      changedFiles: [screenPath],
      metadata: expect.objectContaining({
        renderProof: expect.objectContaining({
          status: 'confirmed',
          attempt: 2,
        }),
      }),
    }),
  );
});

test('render re-probe without browser canvas records browser evidence requirement', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-render-reprobe-missing-canvas-'));
  const screenPath = 'src/screens/ReprobeMissingCanvas.tsx';
  resetState();
  patchState({ workspacePath });
  await mkdir(join(workspacePath, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspacePath, screenPath),
    [
      'export function ReprobeMissingCanvas() {',
      '  return <main data-sd-screen-root="true">Ready</main>;',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'echo',
    workspacePath,
    activeScreen: {
      id: 'screen-reprobe-missing-canvas',
      name: 'Reprobe missing canvas',
      kind: 'page',
      filePath: screenPath,
      implementationFilePath: screenPath,
    },
  });
  await recordToolReceiptSafely({
    workspacePath,
    runId: agentRun.runId,
    tool: 'runtime_render_health',
    status: 'skipped',
    changedFiles: [screenPath],
    summary: 'Runtime proof pending.',
    metadata: {
      runtimeRootProbe: {
        reasonCode: 'runtime_root_unproven',
        evidenceSource: 'storybook-http',
        weakEvidence: true,
      },
    },
  });
  await completeAgentRun({
    workspacePath,
    runId: agentRun.runId,
    status: 'needs_review',
    summary: 'Screen updated — runtime proof pending.',
    diagnostics: { iterations: 3, finishReason: 'stop' },
  });

  const app = new Hono().route('/api/agent-runs', agentRunsRouter);
  const response = await app.request(
    `/api/agent-runs/${encodeURIComponent(agentRun.runId)}/render-reprobe`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    },
  );

  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({
    ok: false,
    code: 'browser_evidence_required',
    renderProof: {
      status: 'pending',
      attempt: 2,
      reasonCode: 'browser_evidence_required',
      evidenceSource: 'browser-preview',
    },
  });
  const manifest = await readRunManifest(workspacePath, agentRun.runId);
  const receipts = await readAgentRunReceipts(workspacePath, agentRun.runId);
  expect(manifest?.status).toBe('needs_review');
  expect(manifest?.diagnostics?.renderProof).toMatchObject({
    status: 'pending',
    reasonCode: 'browser_evidence_required',
  });
  expect(receipts).toContainEqual(
    expect.objectContaining({
      tool: 'runtime_root_probe',
      status: 'skipped',
      changedFiles: [screenPath],
      metadata: expect.objectContaining({
        code: 'browser_evidence_required',
        renderProof: expect.objectContaining({
          reasonCode: 'browser_evidence_required',
        }),
      }),
    }),
  );
});

test('active runs include recoverable pending permission requests for the owning user', async () => {
  const coordinator = getAgentRunCoordinator();
  coordinator.reset();
  const acquire = coordinator.acquire({
    clientRunId: 'client-run-permission',
    sessionId: 'session-permission',
    screenId: 'screen-permission',
    provider: 'mock',
    model: 'echo',
    runtimeKind: 'api',
    targetPaths: ['src/screens/Permission.tsx'],
  });
  expect(acquire.ok).toBe(true);
  if (!acquire.ok) return;
  coordinator.attachRun(acquire.lease.leaseId, { runId: 'run-permission' });

  const request: AgentPermissionRequest = {
    id: 'perm-active-run',
    toolCallId: 'call-active-run',
    toolName: 'write_file',
    runId: 'run-permission',
    category: 'edit',
    resource: 'src/screens/Other.tsx',
    pattern: 'src/screens/**',
    arguments: '{}',
  };
  const waiting = registerAgentPermissionRequest(request, {
    user: 'test-user',
    workspacePath: '/workspace',
    runId: 'run-permission',
    timeoutMs: 0,
  });

  const app = new Hono().route('/api/agent-runs', agentRunsRouter);
  const response = await app.request('/api/agent-runs/active', {
    headers: { 'x-sber-designer-user': 'test-user' },
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    runs: [
      expect.objectContaining({
        clientRunId: 'client-run-permission',
        runId: 'run-permission',
      }),
    ],
    pendingPermissions: [
      expect.objectContaining({
        id: 'perm-active-run',
        runId: 'run-permission',
        clientRunId: 'client-run-permission',
        sessionId: 'session-permission',
        status: 'pending',
        createdAt: expect.any(Number),
      }),
    ],
  });

  expect(
    resolveAgentPermissionRequest({
      id: request.id,
      user: 'test-user',
      decision: 'deny',
    }),
  ).toEqual({ ok: true });
  await expect(waiting).resolves.toMatchObject({ decision: 'deny' });
  coordinator.release(acquire.lease.leaseId);
});
