import { beforeEach, expect, test } from 'bun:test';

import type { AgentPermissionRequest } from '@/lib/api-client';
import { useChatStore } from './chat-store';
import { useProjectStore } from './project-store';

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

test('session-bound streaming updates do not replace the visible transcript after screen switch', () => {
  const store = useChatStore.getState();
  store.switchToScreen('screen-1');
  const screenOne = store.ensureSessionForScreen('screen-1');
  const userId = store.appendUserToSession(screenOne.sessionId, 'Message for screen one');

  useChatStore.getState().switchToScreen('screen-2');
  const screenTwo = useChatStore.getState().ensureSessionForScreen('screen-2');
  useChatStore.getState().appendUserToSession(screenTwo.sessionId, 'Message for screen two');

  useChatStore.getState().setVisibleMessagesForSession(screenOne.sessionId, [
    {
      id: userId,
      role: 'user',
      content: 'Message for screen one',
    },
    {
      id: 'assistant-screen-one',
      role: 'assistant',
      content: 'Screen one update',
    },
  ]);

  expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
    'Message for screen two',
  ]);

  useChatStore.getState().switchToScreen('screen-1');
  expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
    'Message for screen one',
    'Screen one update',
  ]);
});

test('0114 B6 direction interruption persists assistant metadata outside model context', () => {
  const store = useChatStore.getState();
  store.switchToScreen('screen-direction');
  const target = store.ensureSessionForScreen('screen-direction');
  store.appendUserToSession(target.sessionId, 'Create screen', [], {
    contextEligible: false,
    metadata: { directionPickerRequest: true },
  });
  store.appendAssistantToSession(target.sessionId, 'Choose direction', {
    contextEligible: false,
    metadata: { directionPicker: { version: 1 } },
  });

  const state = useChatStore.getState();
  expect(state.messages).toEqual([
    expect.objectContaining({
      role: 'user',
      contextEligible: false,
      metadata: { directionPickerRequest: true },
    }),
    expect.objectContaining({
      role: 'assistant',
      contextEligible: false,
      metadata: { directionPicker: { version: 1 } },
    }),
  ]);
  expect(state.contextMessagesForSession(target.sessionId)).toEqual([]);
});

test('pending permission prompts are scoped by run and survive screen switches', () => {
  const store = useChatStore.getState();
  const request: AgentPermissionRequest = {
    id: 'permission-run-1',
    toolCallId: 'tool-run-1',
    toolName: 'write_file',
    runId: 'server-run-1',
    category: 'edit',
    resource: 'src/screens/Demo.tsx',
    pattern: 'src/screens/**',
    arguments: '{}',
  };

  store.setPendingPermissionForRun('client-run-1', request);
  expect(useChatStore.getState().pendingPermissionForRun('server-run-1')).toEqual(request);

  useChatStore.getState().switchToScreen('screen-2');

  expect(useChatStore.getState().pendingPermissionForRun('server-run-1')).toEqual(request);
  expect(useChatStore.getState().pendingPermissionsByRunId).toMatchObject({
    'server-run-1': request,
    'client-run-1': request,
  });
});

test('clearing a permission by tool call leaves other run prompts intact', () => {
  const first: AgentPermissionRequest = {
    id: 'permission-run-1',
    toolCallId: 'tool-run-1',
    toolName: 'write_file',
    runId: 'server-run-1',
    category: 'edit',
    resource: 'src/screens/Demo.tsx',
    pattern: 'src/screens/**',
    arguments: '{}',
  };
  const second: AgentPermissionRequest = {
    ...first,
    id: 'permission-run-2',
    toolCallId: 'tool-run-2',
    runId: 'server-run-2',
  };

  const store = useChatStore.getState();
  store.setPendingPermissionForRun('client-run-1', first);
  store.setPendingPermissionForRun('client-run-2', second);
  store.clearPendingPermissionForTool('tool-run-1', 'client-run-1');

  expect(useChatStore.getState().pendingPermissionForRun('server-run-1')).toBeNull();
  expect(useChatStore.getState().pendingPermissionForRun('server-run-2')).toEqual(second);
});

test('W7.3 local cancellation settles pending tools for the current run only', () => {
  const store = useChatStore.getState();
  store.switchToScreen('screen-1');
  const target = store.ensureSessionForScreen('screen-1');
  const previousUserId = store.appendUserToSession(target.sessionId, 'Previous request');
  store.setVisibleMessagesForSession(target.sessionId, [
    {
      id: previousUserId,
      role: 'user',
      content: 'Previous request',
    },
    {
      id: 'previous-assistant-tool',
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'previous-tool', name: 'read_file', arguments: '{}' }],
    },
  ]);
  const currentUserId = store.appendUserToSession(target.sessionId, 'Current request');
  store.markRunStartedForSession(target.sessionId, {
    runManifestPath: '.sber-designer/runs/run-cancelled/run-manifest.json',
  });
  store.setVisibleMessagesForSession(target.sessionId, [
    ...useChatStore.getState().messages,
    {
      id: 'current-assistant-tool',
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'current-tool', name: 'write_file', arguments: '{}' }],
    },
  ]);

  useChatStore.getState().settleCancelledRunForSession(target.sessionId, {
    afterMessageId: currentUserId,
  });

  const state = useChatStore.getState();
  expect(state.lastRunStatus).toBe('cancelled');
  expect(state.lastRunSummary).toBe('Cancelled by user.');
  expect(state.lastRunManifestPath).toBe('.sber-designer/runs/run-cancelled/run-manifest.json');
  expect(state.messages.some((message) => message.toolCallId === 'previous-tool')).toBe(false);
  expect(state.messages.filter((message) => message.toolCallId === 'current-tool')).toEqual([
    expect.objectContaining({
      role: 'tool',
      metadata: { toolTerminalStatus: 'cancelled' },
    }),
  ]);
});

test('W7.3 hydration deterministically settles cancelled pending tools without duplicates', () => {
  const project = {
    version: 1 as const,
    name: 'Cancelled project',
    workspacePath: '/workspace',
    screens: [{ id: 'screen-1', name: 'Screen 1', kind: 'story' as const }],
    flow: [],
    assistant: {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-1': 'session-1' },
      sessions: [
        {
          id: 'session-1',
          title: 'Cancelled task',
          primaryScreenId: 'screen-1',
          status: 'active' as const,
          metadata: {
            lastRunStatus: 'cancelled' as const,
            lastRunSummary: 'Cancelled by user.',
            lastRunManifestPath: '.sber-designer/runs/run-hydrated/run-manifest.json',
          },
          messages: [
            {
              id: 'hydrated-user',
              role: 'user' as const,
              content: 'Create a screen',
              createdAt: '2026-07-17T10:00:00.000Z',
            },
            {
              id: 'hydrated-assistant',
              role: 'assistant' as const,
              content: '',
              createdAt: '2026-07-17T10:00:01.000Z',
              toolCalls: [{ id: 'hydrated-tool', name: 'write_file', arguments: '{}' }],
            },
          ],
          createdAt: '2026-07-17T10:00:00.000Z',
          updatedAt: '2026-07-17T10:00:02.000Z',
        },
      ],
    },
  };
  useChatStore.setState({ activeScreenId: 'screen-1' });

  useChatStore.getState().hydrateFromProject(project);
  useChatStore.getState().hydrateFromProject(project);

  const state = useChatStore.getState();
  expect(state.lastRunStatus).toBe('cancelled');
  expect(state.messages.filter((message) => message.toolCallId === 'hydrated-tool')).toEqual([
    expect.objectContaining({
      role: 'tool',
      contextEligible: false,
      metadata: { toolTerminalStatus: 'cancelled' },
    }),
  ]);
  expect(
    state.assistant.sessions[0]?.messages.filter(
      (message) => message.toolCallId === 'hydrated-tool',
    ),
  ).toHaveLength(1);
});

test('session agent is sticky per session and a fresh chat resets it (0083 D6/D7)', () => {
  const store = useChatStore.getState();
  store.switchToScreen('__storybook__');
  store.ensureSessionForScreen('__storybook__');

  // Pin the description agent to this session.
  useChatStore.getState().setSessionAgentName('ai-description-layer');
  expect(useChatStore.getState().activeSessionAgentName()).toBe('ai-description-layer');

  // A brand-new chat defaults back to no pinned agent (primary).
  useChatStore.getState().startNewTask('__storybook__');
  expect(useChatStore.getState().activeSessionAgentName()).toBeNull();

  // The pin is per-session: switching to a different screen does not inherit it.
  useChatStore.getState().switchToScreen('screen-1');
  useChatStore.getState().ensureSessionForScreen('screen-1');
  expect(useChatStore.getState().activeSessionAgentName()).toBeNull();
});

test('contextMessagesForSession reads the requested session instead of the active session', () => {
  const store = useChatStore.getState();
  store.switchToScreen('screen-1');
  const screenOne = useChatStore.getState().ensureSessionForScreen('screen-1');
  const userId = useChatStore
    .getState()
    .appendUserToSession(screenOne.sessionId, 'Message for screen one');

  useChatStore.getState().switchToScreen('screen-2');
  const screenTwo = useChatStore.getState().ensureSessionForScreen('screen-2');
  useChatStore.getState().appendUserToSession(screenTwo.sessionId, 'Message for screen two');

  expect(
    useChatStore
      .getState()
      .contextMessagesForSession(screenOne.sessionId, userId)
      .map((message) => message.content),
  ).toEqual(['Message for screen one']);
});

test('session-bound visible updates can skip project persistence during streaming', () => {
  useProjectStore.setState({
    project: {
      version: 1,
      name: 'Project',
      workspacePath: '/workspace',
      screens: [],
      flow: [],
      assistant: { storageVersion: 1, activeSessionByScreenId: {}, sessions: [] },
    },
    baseline: null,
    saving: false,
    loadError: null,
    saveError: null,
  });

  const store = useChatStore.getState();
  store.switchToScreen('screen-1');
  const target = store.ensureSessionForScreen('screen-1');
  useChatStore.getState().setVisibleMessagesForSession(
    target.sessionId,
    [
      {
        id: 'assistant-streaming',
        role: 'assistant',
        content: 'Streaming text',
      },
    ],
    { persistProject: false },
  );

  expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
    'Streaming text',
  ]);
  expect(
    useChatStore.getState().assistant.sessions[0]?.messages.map((message) => message.content),
  ).toEqual(['Streaming text']);
  expect(useProjectStore.getState().project?.assistant?.sessions[0]?.messages).toEqual([]);
});

test('final turn replacement can skip project persistence for failed runs', () => {
  useProjectStore.setState({
    project: {
      version: 1,
      name: 'Project',
      workspacePath: '/workspace',
      screens: [],
      flow: [],
      assistant: { storageVersion: 1, activeSessionByScreenId: {}, sessions: [] },
    },
    baseline: null,
    saving: false,
    loadError: null,
    saveError: null,
  });

  const store = useChatStore.getState();
  store.switchToScreen('screen-1');
  const target = store.ensureSessionForScreen('screen-1');
  useChatStore.getState().replaceTurnForSession(
    target.sessionId,
    [
      {
        id: 'assistant-failed',
        role: 'assistant',
        content: 'The run failed.',
      },
    ],
    {
      iterations: 1,
      truncated: false,
      runStatus: 'failed',
      runSummary: 'The run failed.',
    },
    { persistProject: false },
  );

  expect(useChatStore.getState().lastRunStatus).toBe('failed');
  expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
    'The run failed.',
  ]);
  expect(useProjectStore.getState().project?.assistant?.sessions[0]?.messages).toEqual([]);
});

test('starting a new run archives a derived terminal error notice into chat history', () => {
  const store = useChatStore.getState();
  store.switchToScreen('screen-1');
  const target = store.ensureSessionForScreen('screen-1');

  useChatStore.getState().replaceTurnForSession(
    target.sessionId,
    [],
    {
      iterations: 0,
      truncated: false,
      runStatus: 'preflight_rejected',
      runSummary: 'Request rejected before agent start',
      runErrorCode: 'auth_expired',
      debugLogPath: '/tmp/sber-designer/attempt.jsonl',
      runManifestPath: '.sber-designer/runs/run-old/run-manifest.json',
    },
    { persistProject: false },
  );

  useChatStore.getState().markRunStartedForSession(
    target.sessionId,
    {
      attemptId: 'attempt-new',
      runManifestPath: '.sber-designer/runs/run-new/run-manifest.json',
    },
    { persistProject: false },
  );

  const archived = useChatStore
    .getState()
    .messages.find((message) => message.metadata?.archivedRunNotice);

  expect(archived).toMatchObject({
    role: 'assistant',
    content: 'Previous run was rejected before start: Request rejected before agent start',
    contextEligible: false,
    metadata: {
      archivedRunNotice: {
        status: 'preflight_rejected',
        summary: 'Request rejected before agent start',
        errorCode: 'auth_expired',
        debugLogPath: '/tmp/sber-designer/attempt.jsonl',
        runManifestPath: '.sber-designer/runs/run-old/run-manifest.json',
      },
    },
  });
  expect(useChatStore.getState().lastRunStatus).toBe('running');
  expect(useChatStore.getState().lastRunManifestPath).toBe(
    '.sber-designer/runs/run-new/run-manifest.json',
  );
});

test('retargetTaskToScreen persists a continued task on the new screen', () => {
  useProjectStore.setState({
    project: {
      version: 1,
      name: 'HTML project',
      workspacePath: '/workspace',
      screens: [
        { id: 'screen-index', name: 'Index', kind: 'page' },
        { id: 'screen-ds', name: 'Design System', kind: 'page' },
      ],
      flow: [],
      assistant: { storageVersion: 1, activeSessionByScreenId: {}, sessions: [] },
    },
    baseline: null,
    saving: false,
    loadError: null,
    saveError: null,
  });

  const store = useChatStore.getState();
  store.switchToScreen('screen-index');
  const source = store.ensureSessionForScreen('screen-index');
  const userId = store.appendUserToSession(source.sessionId, 'Import this HTML design system', [
    {
      id: 'att-html',
      name: 'Design System.html',
      mimeType: 'text/html',
      size: 111000,
      kind: 'text',
    },
  ]);
  useChatStore.getState().replaceTurnForSession(
    source.sessionId,
    [
      {
        id: userId,
        role: 'user',
        content: 'Import this HTML design system',
        attachments: [
          {
            id: 'att-html',
            name: 'Design System.html',
            mimeType: 'text/html',
            size: 111000,
            kind: 'text',
          },
        ],
      },
      {
        id: 'assistant-scope-failure',
        role: 'assistant',
        content: 'The Design.md write was blocked by the current screen scope.',
      },
    ],
    {
      iterations: 6,
      truncated: false,
      runStatus: 'failed',
      runSummary: 'The Design.md write was blocked by the current screen scope.',
      runManifestPath: '.sber-designer/runs/run-ds/run-manifest.json',
    },
  );

  const targetSessionId = useChatStore
    .getState()
    .retargetTaskToScreen(source.sessionId, 'screen-ds', {
      targetScreenName: 'Design System',
    });

  expect(targetSessionId).toBeTruthy();
  expect(useChatStore.getState().activeScreenId).toBe('screen-ds');
  expect(useChatStore.getState().activeSessionId).toBe(targetSessionId);
  expect(useChatStore.getState().messages.map((message) => message.id)).toContain(userId);
  expect(useChatStore.getState().lastRunManifestPath).toBe(
    '.sber-designer/runs/run-ds/run-manifest.json',
  );
  expect(
    useProjectStore.getState().project?.assistant?.activeSessionByScreenId?.['screen-ds'],
  ).toBe(targetSessionId);
  const targetSession = useProjectStore
    .getState()
    .project?.assistant?.sessions.find((session) => session.id === targetSessionId);
  expect(targetSession?.metadata).toMatchObject({
    retargetedFromSessionId: source.sessionId,
    retargetedFromScreenId: 'screen-index',
  });
  expect(targetSession?.linkedScreenIds).toContain('screen-index');
});

test('switching screens preserves in-memory chat when project assistant is stale', () => {
  useProjectStore.setState({
    project: {
      version: 1,
      name: 'Project',
      workspacePath: '/workspace',
      screens: [{ id: 'screen-1', name: 'Screen 1', kind: 'story' }],
      flow: [],
      assistant: { storageVersion: 1, activeSessionByScreenId: {}, sessions: [] },
    },
    baseline: null,
    saving: false,
    loadError: null,
    saveError: null,
  });

  const store = useChatStore.getState();
  store.switchToScreen('screen-1');
  const target = store.ensureSessionForScreen('screen-1');
  useChatStore.getState().setVisibleMessagesForSession(
    target.sessionId,
    [
      {
        id: 'user-plan',
        role: 'user',
        content: 'Plan a change',
      },
      {
        id: 'assistant-plan',
        role: 'assistant',
        content: 'Here is the plan',
      },
    ],
    { persistProject: false },
  );

  useChatStore.getState().switchToScreen('screen-1');

  expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
    'Plan a change',
    'Here is the plan',
  ]);
});

test('hydrating a different project does not carry over in-memory chat', () => {
  useProjectStore.setState({
    project: {
      version: 1,
      name: 'Project A',
      workspacePath: '/workspace-a',
      screens: [{ id: 'screen-1', name: 'Screen 1', kind: 'story' }],
      flow: [],
      assistant: { storageVersion: 1, activeSessionByScreenId: {}, sessions: [] },
    },
    baseline: null,
    saving: false,
    loadError: null,
    saveError: null,
  });

  const store = useChatStore.getState();
  store.switchToScreen('screen-1');
  const target = store.ensureSessionForScreen('screen-1');
  useChatStore.getState().appendUserToSession(target.sessionId, 'Project A chat');

  useChatStore.getState().hydrateFromProject({
    version: 1,
    name: 'Project B',
    workspacePath: '/workspace-b',
    screens: [{ id: 'screen-1', name: 'Screen 1', kind: 'story' }],
    flow: [],
    assistant: { storageVersion: 1, activeSessionByScreenId: {}, sessions: [] },
  });

  expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
    'Hi! Let’s design something cool together. Tell me what you’d like to build — I can read files, list components, edit code with structured patches, and switch the editor mode.',
  ]);
});

test('0114 per-turn token usage survives project persistence and reload', () => {
  const store = useChatStore.getState();
  store.switchToScreen('screen-1');
  const target = store.ensureSessionForScreen('screen-1');
  store.setVisibleMessagesForSession(target.sessionId, [
    { id: 'user-1', role: 'user', content: 'First' },
    {
      id: 'assistant-1',
      role: 'assistant',
      content: 'First answer',
      tokenUsage: { totalTokens: 120, inputTokens: 100, outputTokens: 20 },
    },
    { id: 'user-2', role: 'user', content: 'Second' },
    {
      id: 'assistant-2',
      role: 'assistant',
      content: 'Second answer',
      tokenUsage: { totalTokens: 255, inputTokens: 220, outputTokens: 35 },
    },
  ]);
  const persistedAssistant = useChatStore.getState().assistant;

  useChatStore.getState().reset();
  useChatStore.setState({ activeScreenId: 'screen-1' });
  useChatStore.getState().hydrateFromProject({
    version: 1,
    name: 'Token project',
    workspacePath: '/workspace',
    screens: [{ id: 'screen-1', name: 'Screen 1', kind: 'story' }],
    flow: [],
    assistant: persistedAssistant,
  });

  expect(
    useChatStore
      .getState()
      .messages.filter((message) => message.role === 'assistant')
      .map((message) => message.tokenUsage),
  ).toEqual([
    { totalTokens: 120, inputTokens: 100, outputTokens: 20 },
    { totalTokens: 255, inputTokens: 220, outputTokens: 35 },
  ]);
});

test('0114 completed turns keep their own run manifest identity', () => {
  const store = useChatStore.getState();
  store.switchToScreen('screen-1');
  const target = store.ensureSessionForScreen('screen-1');
  const firstUserId = store.appendUserToSession(target.sessionId, 'First');
  store.replaceTurnForSession(
    target.sessionId,
    [
      { id: firstUserId, role: 'user', content: 'First' },
      { id: 'assistant-1', role: 'assistant', content: 'First answer' },
    ],
    {
      iterations: 1,
      truncated: false,
      runManifestPath: '.sber-designer/runs/run-1/run-manifest.json',
    },
  );

  const secondUserId = store.appendUserToSession(target.sessionId, 'Second');
  store.replaceTurnForSession(
    target.sessionId,
    [
      ...useChatStore.getState().messages,
      { id: 'assistant-2', role: 'assistant', content: 'Second answer' },
    ],
    {
      iterations: 1,
      truncated: false,
      runManifestPath: '.sber-designer/runs/run-2/run-manifest.json',
    },
  );

  expect(secondUserId).toBeTruthy();
  expect(
    useChatStore
      .getState()
      .messages.filter((message) => message.role === 'assistant')
      .map((message) => message.runManifestId),
  ).toEqual([
    '.sber-designer/runs/run-1/run-manifest.json',
    '.sber-designer/runs/run-2/run-manifest.json',
  ]);
});
