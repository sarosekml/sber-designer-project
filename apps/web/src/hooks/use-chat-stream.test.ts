import { beforeEach, expect, test } from 'bun:test';

import type { AgentStreamEvent } from '@/lib/api-client';
import { useChatStore, type ChatMessage } from '@/stores/chat-store';
import { useProjectStore } from '@/stores/project-store';
import {
  handleStreamEvent,
  shouldRefreshProjectAfterAgentRun,
  withLastUserDisplayContent,
  type ChatRunBinding,
} from './use-chat-stream';

beforeEach(() => {
  useProjectStore.setState({
    project: null,
    baseline: null,
    saving: false,
    loadError: null,
    saveError: null,
  });
  useChatStore.getState().reset();
});

test('0114 B6 streaming keeps the short direction choice as display content', () => {
  const transcript = withLastUserDisplayContent(
    [
      { role: 'user', content: 'Create the full target screen with internal context.' },
      { role: 'assistant', content: 'Done.' },
    ],
    'Use direction 2: Operational overview',
  );

  expect(transcript).toEqual([
    { role: 'user', content: 'Use direction 2: Operational overview' },
    { role: 'assistant', content: 'Done.' },
  ]);
});

test('D4 run-rejected becomes transcript history instead of sticky active error', () => {
  const { binding, turnMessages, assistantByIteration, snapshot } = setupStreamingTurn();
  useChatStore.getState().setError('previous Claude auth error');

  handleStreamEvent(
    {
      type: 'run-rejected',
      clientRunId: binding.clientRunId,
      sessionId: binding.sessionId,
      screenId: binding.screenId,
      reason: 'Request rejected before agent start',
    },
    binding,
    turnMessages,
    assistantByIteration,
    { provider: 'claude-code-runtime', model: 'opus' },
    snapshot,
  );

  expect(useChatStore.getState().error).toBeNull();
  expect(useChatStore.getState().lastRunStatus).toBe('preflight_rejected');
  expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
    'Generate a page from the image',
    'Request rejected before agent start',
  ]);
});

test('D4 stream error is persisted as failed run history without re-setting active error', () => {
  const { binding, turnMessages, assistantByIteration, snapshot } = setupStreamingTurn();
  useChatStore.getState().setError('previous Claude auth error');

  handleStreamEvent(
    {
      type: 'error',
      message: 'Claude Code print-mode authentication failed for model "opus"',
      attemptId: 'attempt-a',
      debugLogPath: '/tmp/attempt.jsonl',
      runManifestPath: '.sber-designer/runs/run-a/run-manifest.json',
    } as Extract<AgentStreamEvent, { type: 'error' }>,
    binding,
    turnMessages,
    assistantByIteration,
    { provider: 'claude-code-runtime', model: 'opus' },
    snapshot,
  );

  expect(useChatStore.getState().error).toBeNull();
  expect(useChatStore.getState().lastRunStatus).toBe('failed');
  expect(useChatStore.getState().lastAttemptId).toBe('attempt-a');
  expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
    'Generate a page from the image',
    'Claude Code print-mode authentication failed for model "opus"',
  ]);
});

test('0114 completed stream stores aggregate token usage on its own assistant reply', () => {
  const { binding, turnMessages, assistantByIteration, snapshot } = setupStreamingTurn();

  handleStreamEvent(
    {
      type: 'done',
      transcript: [
        { role: 'user', content: 'Generate a page from the image' },
        { role: 'assistant', content: 'Page created' },
      ],
      iterations: 2,
      truncated: false,
      hadErrors: false,
      stoppedAfterPermissionDeny: false,
      finalResponse: {
        text: 'Page created',
        provider: 'codex-runtime',
        model: 'gpt-5.5',
        finishReason: 'stop',
      },
      usage: { inputTokens: 1_000, outputTokens: 125 },
    },
    binding,
    turnMessages,
    assistantByIteration,
    { provider: 'codex-runtime', model: 'gpt-5.5' },
    snapshot,
  );

  const state = useChatStore.getState();
  expect(state.lastRunMetrics).toEqual({
    iterations: 2,
    totalTokens: 1_125,
    inputTokens: 1_000,
    outputTokens: 125,
  });
  expect(state.messages.at(-1)?.tokenUsage).toEqual({
    totalTokens: 1_125,
    inputTokens: 1_000,
    outputTokens: 125,
  });
  expect(
    state.assistant.sessions.find((session) => session.id === binding.sessionId)?.messages.at(-1)
      ?.tokenUsage,
  ).toEqual({ totalTokens: 1_125, inputTokens: 1_000, outputTokens: 125 });
});

test('0114 completed stream preserves an explicit unknown usage footer for CLI parity', () => {
  const { binding, turnMessages, assistantByIteration, snapshot } = setupStreamingTurn();

  handleStreamEvent(
    {
      type: 'done',
      transcript: [
        { role: 'user', content: 'Generate a page from the image' },
        { role: 'assistant', content: 'Page created' },
      ],
      iterations: 1,
      truncated: false,
      hadErrors: false,
      stoppedAfterPermissionDeny: false,
      finalResponse: {
        text: 'Page created',
        provider: 'codex-runtime',
        model: 'gpt-5.5',
        finishReason: 'stop',
      },
    },
    binding,
    turnMessages,
    assistantByIteration,
    { provider: 'codex-runtime', model: 'gpt-5.5' },
    snapshot,
  );

  expect(useChatStore.getState().messages.at(-1)?.tokenUsage).toEqual({});
  expect(useChatStore.getState().lastRunMetrics).toBeNull();
});

test('0114 B6.2.9 late selection updates live and survives the final transcript merge', () => {
  const { binding, turnMessages, assistantByIteration, snapshot } = setupStreamingTurn();
  const initialPack = {
    status: 'ready' as const,
    workspaceFreshness: 'current' as const,
    candidateCount: 1,
    selectedCount: 1,
    diagnosticCount: 0,
    indexedCount: 150,
    describedCount: 32,
    hydratedCount: 1,
  };
  const finalPack = {
    ...initialPack,
    candidateCount: 2,
    selectedCount: 2,
    hydratedCount: 2,
    lateSelectionCount: 1,
    lateSelectionBudget: 2,
    lateSelections: [
      {
        sequence: 1,
        action: 'add' as const,
        role: 'side-preview',
        componentId: 'preview-pane',
        reason: 'The selected row needs a persistent detail preview.',
        regionIds: ['preview'],
        resolutionStatus: 'resolved' as const,
      },
    ],
  };
  const meta = { provider: 'mock', model: 'echo' };

  handleStreamEvent(
    {
      type: 'run-started',
      clientRunId: binding.clientRunId,
      sessionId: binding.sessionId,
      screenId: binding.screenId,
      provider: 'mock',
      model: 'echo',
      componentPack: initialPack,
    },
    binding,
    turnMessages,
    assistantByIteration,
    meta,
    snapshot,
  );
  handleStreamEvent(
    {
      type: 'tool-result',
      iteration: 1,
      toolCallId: 'late-selection',
      toolName: 'update_component_selection',
      content: '{}',
      isError: false,
      status: 'ok',
      componentPack: finalPack,
    },
    binding,
    turnMessages,
    assistantByIteration,
    meta,
    snapshot,
  );

  expect(
    useChatStore.getState().messages.find((message) => message.metadata?.componentPack)?.metadata
      ?.componentPack,
  ).toMatchObject({ selectedCount: 2, hydratedCount: 2, lateSelectionCount: 1 });

  handleStreamEvent(
    {
      type: 'done',
      transcript: [
        { role: 'user', content: 'Generate a page from the image' },
        { role: 'assistant', content: 'Page created' },
      ],
      iterations: 1,
      truncated: false,
      hadErrors: false,
      stoppedAfterPermissionDeny: false,
      finalResponse: {
        text: 'Page created',
        provider: 'mock',
        model: 'echo',
        finishReason: 'stop',
      },
    },
    binding,
    turnMessages,
    assistantByIteration,
    meta,
    snapshot,
  );

  const packMessages = useChatStore
    .getState()
    .messages.filter((message) => message.metadata?.componentPack);
  expect(packMessages).toHaveLength(1);
  expect(packMessages[0]?.metadata?.componentPack).toMatchObject({
    selectedCount: 2,
    hydratedCount: 2,
    lateSelectionCount: 1,
  });
  expect(packMessages[0]?.content).toBe(
    'Project DS: 150 indexed · 32 described · 2 selected · 2 hydrated',
  );
});

test('D4 run-started clears stale active error before the next runtime emits output', () => {
  const { binding, turnMessages, assistantByIteration, snapshot } = setupStreamingTurn();
  useChatStore.getState().setError('previous Claude auth error');
  useChatStore.getState().replaceTurnForSession(
    binding.sessionId,
    [
      ...snapshot,
      {
        id: 'previous-rejection',
        role: 'assistant',
        content: 'Request rejected before agent start',
        contextEligible: false,
      },
    ],
    {
      iterations: 0,
      truncated: true,
      runStatus: 'preflight_rejected',
      runErrorCode: 'auth_expired',
      debugLogPath: '/tmp/old-attempt.jsonl',
      runManifestPath: '.sber-designer/runs/old-run/run-manifest.json',
    },
    { persistProject: false },
  );
  expect(useChatStore.getState().lastRunStatus).toBe('preflight_rejected');

  handleStreamEvent(
    {
      type: 'run-started',
      clientRunId: binding.clientRunId,
      sessionId: binding.sessionId,
      screenId: binding.screenId,
      provider: 'codex-runtime',
      model: 'gpt-5.5',
      runId: 'run-b',
      runManifestPath: '.sber-designer/runs/run-b/run-manifest.json',
    },
    binding,
    turnMessages,
    assistantByIteration,
    { provider: 'codex-runtime', model: 'gpt-5.5' },
    snapshot,
  );

  expect(useChatStore.getState().error).toBeNull();
  expect(useChatStore.getState().lastRunStatus).toBe('running');
  expect(useChatStore.getState().lastRunErrorCode).toBeNull();
  expect(useChatStore.getState().lastDebugLogPath).toBeNull();
  expect(useChatStore.getState().lastRunManifestPath).toBe(
    '.sber-designer/runs/run-b/run-manifest.json',
  );
});

test('permission stream events are scoped to the active run binding', () => {
  const { binding, turnMessages, assistantByIteration, snapshot } = setupStreamingTurn();
  const request = {
    id: 'permission-stream',
    toolCallId: 'tool-stream',
    toolName: 'write_file',
    runId: 'server-run-stream',
    category: 'edit',
    resource: 'src/screens/Demo.tsx',
    pattern: 'src/screens/**',
    arguments: '{}',
  };

  handleStreamEvent(
    { type: 'permission-request', iteration: 1, request },
    binding,
    turnMessages,
    assistantByIteration,
    { provider: 'mock', model: 'echo' },
    snapshot,
  );

  expect(useChatStore.getState().pendingPermissionForRun('server-run-stream')).toEqual(request);
  expect(useChatStore.getState().pendingPermissionForRun(binding.clientRunId)).toEqual(request);

  handleStreamEvent(
    {
      type: 'tool-result',
      iteration: 1,
      toolCallId: 'tool-stream',
      content: 'denied',
      isError: true,
      toolName: 'write_file',
      status: 'error',
    },
    binding,
    turnMessages,
    assistantByIteration,
    { provider: 'mock', model: 'echo' },
    snapshot,
  );

  expect(useChatStore.getState().pendingPermissionForRun('server-run-stream')).toBeNull();
  expect(useChatStore.getState().pendingPermissionForRun(binding.clientRunId)).toBeNull();
});

test('W7.3 cancelled done settles pending tool calls and stores neutral terminal metadata', () => {
  const { binding, turnMessages, assistantByIteration, snapshot } = setupStreamingTurn();
  const meta = { provider: 'mock', model: 'echo' };

  handleStreamEvent(
    {
      type: 'tool-call',
      iteration: 1,
      call: {
        id: 'tool-cancelled',
        name: 'write_file',
        arguments: '{"path":"src/screens/Demo.tsx"}',
      },
    },
    binding,
    turnMessages,
    assistantByIteration,
    meta,
    snapshot,
  );
  handleStreamEvent(
    {
      type: 'done',
      transcript: [],
      iterations: 1,
      truncated: false,
      hadErrors: false,
      stoppedAfterPermissionDeny: false,
      finalResponse: {
        text: 'Cancelled by user.',
        provider: 'mock',
        model: 'echo',
        finishReason: 'stop',
      },
      runStatus: 'cancelled',
      runSummary: 'Cancelled by user.',
    },
    binding,
    turnMessages,
    assistantByIteration,
    meta,
    snapshot,
  );

  const state = useChatStore.getState();
  expect(state.lastRunStatus).toBe('cancelled');
  expect(state.lastRunSummary).toBe('Cancelled by user.');
  expect(state.messages.filter((message) => message.toolCallId === 'tool-cancelled')).toEqual([
    expect.objectContaining({
      role: 'tool',
      contextEligible: false,
      metadata: { toolTerminalStatus: 'cancelled' },
    }),
  ]);
});

test('D4 post-run project refresh also runs after failed validation statuses', () => {
  expect(shouldRefreshProjectAfterAgentRun('complete')).toBe(true);
  expect(shouldRefreshProjectAfterAgentRun('needs_review')).toBe(true);
  expect(shouldRefreshProjectAfterAgentRun('failed')).toBe(true);
  expect(shouldRefreshProjectAfterAgentRun('preflight_rejected')).toBe(false);
  expect(shouldRefreshProjectAfterAgentRun('running')).toBe(false);
  expect(shouldRefreshProjectAfterAgentRun(null)).toBe(false);
});

function setupStreamingTurn(): {
  binding: ChatRunBinding;
  turnMessages: ChatMessage[];
  assistantByIteration: Map<number, string>;
  snapshot: ChatMessage[];
} {
  const store = useChatStore.getState();
  store.switchToScreen('screen-a');
  const { sessionId } = store.ensureSessionForScreen('screen-a');
  store.appendUserToSession(sessionId, 'Generate a page from the image');
  return {
    binding: {
      clientRunId: 'client-run-a',
      sessionId,
      screenId: 'screen-a',
    },
    turnMessages: [],
    assistantByIteration: new Map(),
    snapshot: useChatStore.getState().messages.map((message) => ({ ...message })),
  };
}
