import { expect, test } from 'bun:test';

import {
  planAgentRuntimeSession,
  runtimeSessionMetadataFromDiagnostics,
  updateRuntimeSessionFromEvent,
} from '../services/api/src/agent-runtimes/session';
import {
  CLAUDE_CODE_RUNTIME_DEF,
  CODEX_RUNTIME_DEF,
  GIGACODE_RUNTIME_DEF,
  OPENCODE_RUNTIME_DEF,
} from '../services/api/src/agent-runtimes/registry';

const READY_CAPABILITIES = {
  sessionSpecify: true,
  sessionResume: true,
  sessionCapture: true,
};

test('plans a new specify-style session when no compatible metadata exists', () => {
  const plan = planAgentRuntimeSession({
    def: CLAUDE_CODE_RUNTIME_DEF,
    capabilities: READY_CAPABILITIES,
    sessionMetadata: null,
    model: 'sonnet',
    workspacePath: '/work/app',
    createSessionId: () => 'new-claude-session',
  });

  expect(plan.runSession).toEqual({ mode: 'new', sessionId: 'new-claude-session' });
  expect(plan.handoffSession).toMatchObject({
    mode: 'new',
    runtime: 'claude-code',
    sessionId: 'new-claude-session',
    model: 'sonnet',
    workspacePath: '/work/app',
  });
  expect(plan.diagnostics).toMatchObject({
    mode: 'new',
    style: 'specify',
    sessionId: 'new-claude-session',
    captureSeen: true,
  });
});

test('resumes only when runtime, model, and workspace metadata match', () => {
  const matching = planAgentRuntimeSession({
    def: CLAUDE_CODE_RUNTIME_DEF,
    capabilities: READY_CAPABILITIES,
    sessionMetadata: {
      runtimeSessionId: 'existing-claude-session',
      runtimeSessionRuntime: 'claude-code',
      runtimeSessionModel: 'sonnet',
      runtimeSessionWorkspacePath: '/work/app',
      runtimeSessionUsage: { inputTokens: 300, outputTokens: 50, totalTokens: 350 },
      lastRunMetrics: { inputTokens: 120, outputTokens: 30, totalTokens: 150 },
    },
    model: 'sonnet',
    workspacePath: '/work/app',
    createSessionId: () => 'new-should-not-be-used',
  });
  const modelMismatch = planAgentRuntimeSession({
    def: CLAUDE_CODE_RUNTIME_DEF,
    capabilities: READY_CAPABILITIES,
    sessionMetadata: {
      runtimeSessionId: 'existing-claude-session',
      runtimeSessionRuntime: 'claude-code',
      runtimeSessionModel: 'opus',
      runtimeSessionWorkspacePath: '/work/app',
    },
    model: 'sonnet',
    workspacePath: '/work/app',
    createSessionId: () => 'new-after-model-change',
  });

  expect(matching.runSession).toEqual({
    mode: 'resume',
    sessionId: 'existing-claude-session',
    usageBaseline: { inputTokens: 300, outputTokens: 50, totalTokens: 350 },
  });
  expect(matching.diagnostics.resumeUsed).toBe(true);
  expect(modelMismatch.runSession).toEqual({ mode: 'new', sessionId: 'new-after-model-change' });
  expect(modelMismatch.diagnostics.resumeUsed).toBe(false);
  expect(modelMismatch.diagnostics.missReason).toBe('model_mismatch');
});

test('plans capture-style Codex sessions and converts captured diagnostics to metadata', () => {
  const plan = planAgentRuntimeSession({
    def: CODEX_RUNTIME_DEF,
    capabilities: READY_CAPABILITIES,
    sessionMetadata: null,
    model: 'gpt-5.5',
    workspacePath: '/work/app',
  });
  const metadata = runtimeSessionMetadataFromDiagnostics({
    ...plan.diagnostics,
    sessionId: 'codex-thread-id',
  });

  expect(plan.runSession).toEqual({ mode: 'new' });
  expect(plan.diagnostics).toMatchObject({
    mode: 'new',
    style: 'capture',
    resumeUsed: false,
    captureSeen: false,
    missReason: 'capture_event_pending',
  });
  const captured = updateRuntimeSessionFromEvent({
    current: plan.diagnostics,
    event: 'runtime.session',
    data: {
      runtime: 'codex',
      sessionId: 'codex-thread-id',
      threadId: 'codex-thread-id',
      captureEvent: 'thread.started',
    },
  });
  expect(captured).toMatchObject({
    runtime: 'codex',
    style: 'capture',
    mode: 'new',
    resumeUsed: false,
    sessionId: 'codex-thread-id',
    source: 'runtime-event',
    captureSeen: true,
  });
  expect(captured?.missReason).toBeUndefined();
  expect(metadata).toMatchObject({
    runtimeSessionId: 'codex-thread-id',
    runtimeSessionRuntime: 'codex',
    runtimeSessionModel: 'gpt-5.5',
    runtimeSessionWorkspacePath: '/work/app',
  });
});

test('capture-style sessions resume from captured metadata and ignore mismatched runtime events', () => {
  const plan = planAgentRuntimeSession({
    def: CODEX_RUNTIME_DEF,
    capabilities: READY_CAPABILITIES,
    sessionMetadata: null,
    model: 'gpt-5.5',
    workspacePath: '/work/app',
  });

  const ignored = updateRuntimeSessionFromEvent({
    current: plan.diagnostics,
    event: 'runtime.session',
    data: { runtime: 'claude-code', sessionId: 'wrong-runtime-session' },
  });
  const captured = updateRuntimeSessionFromEvent({
    current: plan.diagnostics,
    event: 'thread.started',
    data: { runtime: 'codex', threadId: 'codex-thread-id' },
  });
  const withUsage = updateRuntimeSessionFromEvent({
    current: captured ?? undefined,
    event: 'runtime.usage.cumulative',
    data: { runtime: 'codex', inputTokens: 240, outputTokens: 20 },
  });
  const metadata = runtimeSessionMetadataFromDiagnostics(withUsage);
  const resumed = planAgentRuntimeSession({
    def: CODEX_RUNTIME_DEF,
    capabilities: READY_CAPABILITIES,
    sessionMetadata: metadata,
    model: 'gpt-5.5',
    workspacePath: '/work/app',
  });

  expect(ignored).toBeNull();
  expect(captured?.sessionId).toBe('codex-thread-id');
  expect(withUsage?.cumulativeUsage).toEqual({ inputTokens: 240, outputTokens: 20 });
  expect(metadata.runtimeSessionUsage).toEqual({ inputTokens: 240, outputTokens: 20 });
  expect(resumed.runSession).toEqual({
    mode: 'resume',
    sessionId: 'codex-thread-id',
    usageBaseline: { inputTokens: 240, outputTokens: 20 },
  });
  expect(resumed.handoffSession).toMatchObject({
    mode: 'resume',
    runtime: 'codex',
    sessionId: 'codex-thread-id',
  });
  expect(resumed.diagnostics).toMatchObject({
    mode: 'resume',
    style: 'capture',
    resumeUsed: true,
    source: 'metadata',
    captureSeen: true,
  });
});

test('Codex capture session rolls over after the prompt-cache idle window', () => {
  const now = Date.parse('2026-07-20T16:00:00.000Z');
  const baseMetadata = {
    runtimeSessionId: 'codex-thread-id',
    runtimeSessionRuntime: 'codex',
    runtimeSessionModel: 'gpt-5.5',
    runtimeSessionWorkspacePath: '/work/app',
    runtimeSessionUsage: { inputTokens: 500, outputTokens: 50, totalTokens: 550 },
  };
  const recent = planAgentRuntimeSession({
    def: CODEX_RUNTIME_DEF,
    capabilities: READY_CAPABILITIES,
    sessionMetadata: {
      ...baseMetadata,
      runtimeSessionUpdatedAt: '2026-07-20T15:30:00.000Z',
    },
    model: 'gpt-5.5',
    workspacePath: '/work/app',
    now: () => now,
  });
  const expired = planAgentRuntimeSession({
    def: CODEX_RUNTIME_DEF,
    capabilities: READY_CAPABILITIES,
    sessionMetadata: {
      ...baseMetadata,
      runtimeSessionUpdatedAt: '2026-07-20T15:29:59.000Z',
    },
    model: 'gpt-5.5',
    workspacePath: '/work/app',
    now: () => now,
  });

  expect(recent.runSession).toMatchObject({
    mode: 'resume',
    sessionId: 'codex-thread-id',
  });
  expect(expired.runSession).toEqual({ mode: 'new' });
  expect(expired.handoffSession).toMatchObject({ mode: 'new', runtime: 'codex' });
  expect(expired.diagnostics).toMatchObject({
    mode: 'new',
    resumeUsed: false,
    missReason: 'idle_expired',
  });
});

test('does not plan sessions for runtimes without a session contract', () => {
  const plan = planAgentRuntimeSession({
    def: OPENCODE_RUNTIME_DEF,
    capabilities: READY_CAPABILITIES,
    sessionMetadata: null,
    model: 'default',
    workspacePath: '/work/app',
  });

  expect(plan.runSession).toBeNull();
  expect(plan.handoffSession).toBeNull();
  expect(plan.diagnostics).toBeUndefined();
});

test('GigaCode captures the CLI-owned session id before resuming it', () => {
  const first = planAgentRuntimeSession({
    def: GIGACODE_RUNTIME_DEF,
    capabilities: READY_CAPABILITIES,
    sessionMetadata: null,
    model: 'default',
    workspacePath: '/work/app',
  });

  expect(first.runSession).toEqual({ mode: 'new' });
  expect(first.diagnostics).toMatchObject({
    runtime: 'gigacode',
    style: 'capture',
    mode: 'new',
    captureSeen: false,
    missReason: 'capture_event_pending',
  });

  const captured = updateRuntimeSessionFromEvent({
    current: first.diagnostics!,
    event: 'runtime.session',
    data: { runtime: 'gigacode', sessionId: 'cli-owned-session' },
  });
  expect(captured).toMatchObject({
    sessionId: 'cli-owned-session',
    source: 'runtime-event',
    captureSeen: true,
  });
  expect(runtimeSessionMetadataFromDiagnostics(captured)).toMatchObject({
    runtimeSessionId: 'cli-owned-session',
    runtimeSessionRuntime: 'gigacode',
    runtimeSessionModel: null,
  });

  const resumed = planAgentRuntimeSession({
    def: GIGACODE_RUNTIME_DEF,
    capabilities: READY_CAPABILITIES,
    sessionMetadata: runtimeSessionMetadataFromDiagnostics(captured),
    model: 'default',
    workspacePath: '/work/app',
  });
  expect(resumed.runSession).toEqual({ mode: 'resume', sessionId: 'cli-owned-session' });
});
