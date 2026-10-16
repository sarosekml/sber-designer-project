import { describe, expect, test } from 'bun:test';

import {
  appendAssistantMessages,
  archiveAssistantSessionsForDeletedScreen,
  buildAgentMessageContext,
  createEmptyAssistantState,
  mergeAssistantStateByFreshness,
  retargetAssistantTask,
  restoreAssistantTask,
  startAssistantTask,
  updateAssistantSessionRunMetadata,
  updateAssistantTaskSummary,
} from '../apps/web/src/lib/assistant-sessions';
import { useChatStore } from '../apps/web/src/stores/chat-store';
import { useProjectStore } from '../apps/web/src/stores/project-store';

describe('assistant session helpers', () => {
  test('new task archives previous screen task and keeps agent context clean', () => {
    let assistant = createEmptyAssistantState();
    let started = startAssistantTask(assistant, 'screen-a', '2026-05-23T10:00:00.000Z');
    assistant = appendAssistantMessages(
      started.assistant,
      started.session.id,
      [
        {
          id: 'old-user',
          role: 'user',
          content: 'Use a large hero.',
          createdAt: '2026-05-23T10:00:01.000Z',
        },
      ],
      '2026-05-23T10:00:01.000Z',
    );

    started = startAssistantTask(assistant, 'screen-a', '2026-05-23T10:05:00.000Z');
    assistant = appendAssistantMessages(
      started.assistant,
      started.session.id,
      [
        {
          id: 'new-user',
          role: 'user',
          content: 'Make the form denser.',
          createdAt: '2026-05-23T10:05:01.000Z',
        },
      ],
      '2026-05-23T10:05:01.000Z',
    );

    const oldSession = assistant.sessions.find((session) =>
      session.messages.some((message) => message.id === 'old-user'),
    );
    const activeSession = assistant.sessions.find((session) =>
      session.messages.some((message) => message.id === 'new-user'),
    );

    expect(oldSession?.status).toBe('archived');
    expect(activeSession?.status).toBe('active');
    expect(assistant.activeSessionByScreenId?.['screen-a']).toBe(activeSession?.id);

    const context = buildAgentMessageContext({
      session: activeSession!,
      latestUserMessageId: 'new-user',
      mode: 'current-task',
    });

    expect(context.messages.map((message) => message.content)).toEqual(['Make the form denser.']);
    expect(context.excludedReasons).toContain(
      'archived sessions are not part of a session context',
    );
  });

  test('summary update promotes task title to llm title without changing messages', () => {
    let assistant = createEmptyAssistantState();
    const started = startAssistantTask(assistant, 'screen-a', '2026-05-23T10:00:00.000Z');
    assistant = appendAssistantMessages(
      started.assistant,
      started.session.id,
      [
        {
          id: 'user-1',
          role: 'user',
          content: 'Please tighten the checkout form spacing.',
          createdAt: '2026-05-23T10:00:01.000Z',
        },
      ],
      '2026-05-23T10:00:01.000Z',
    );

    assistant = updateAssistantTaskSummary(
      assistant,
      started.session.id,
      {
        title: 'Tighten checkout spacing',
        summary: 'The task is about making the checkout form denser.',
        lastSummarizedMessageId: 'user-1',
      },
      '2026-05-23T10:01:00.000Z',
    );

    const session = assistant.sessions.find((candidate) => candidate.id === started.session.id);

    expect(session?.title).toBe('Tighten checkout spacing');
    expect(session?.titleSource).toBe('llm');
    expect(session?.summary).toContain('checkout form');
    expect(session?.messages).toHaveLength(1);
  });

  test('current-task context includes the saved task summary before the message tail', () => {
    let assistant = createEmptyAssistantState();
    const started = startAssistantTask(assistant, 'screen-a', '2026-05-23T10:00:00.000Z');
    assistant = appendAssistantMessages(
      started.assistant,
      started.session.id,
      [
        {
          id: 'user-1',
          role: 'user',
          content: 'Make the checkout form denser.',
          createdAt: '2026-05-23T10:00:01.000Z',
        },
      ],
      '2026-05-23T10:00:01.000Z',
    );
    assistant = updateAssistantTaskSummary(
      assistant,
      started.session.id,
      {
        title: 'Checkout density',
        summary: 'The current task is about tightening checkout form spacing.',
        lastSummarizedMessageId: 'user-1',
      },
      '2026-05-23T10:02:00.000Z',
    );
    const session = assistant.sessions.find((candidate) => candidate.id === started.session.id);

    const context = buildAgentMessageContext({
      session: session!,
      latestUserMessageId: 'user-1',
      mode: 'current-task',
    });

    expect(context.messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(context.messages[0]?.id).toBe(`assistant-summary-${started.session.id}`);
    expect(context.messages[0]?.content).toContain('tightening checkout form spacing');
    expect(context.includedCount).toBe(2);
  });

  test('continue context includes latest real prompt and run evidence instead of only the tail', () => {
    let assistant = createEmptyAssistantState();
    const started = startAssistantTask(assistant, 'screen-a', '2026-05-23T10:00:00.000Z');
    assistant = appendAssistantMessages(
      started.assistant,
      started.session.id,
      [
        {
          id: 'user-brd',
          role: 'user',
          content: 'Generate the approval dashboard from the attached BRD.',
          createdAt: '2026-05-23T10:00:01.000Z',
          attachments: [
            {
              id: 'att-brd',
              name: 'IBP BRD.md',
              mimeType: 'text/markdown',
              size: 5600,
              kind: 'text',
            },
          ],
        },
        ...Array.from({ length: 12 }, (_, index) => ({
          id: `assistant-tail-${index}`,
          role: 'assistant' as const,
          content: `Progress note ${index}`,
          createdAt: `2026-05-23T10:${String(index + 1).padStart(2, '0')}:00.000Z`,
        })),
        {
          id: 'tool-tail',
          role: 'tool',
          toolName: 'read_file',
          toolCallId: 'call-read-file',
          content: 'A very large stale source dump that must not be sent during continue.',
          createdAt: '2026-05-23T10:18:00.000Z',
        },
        {
          id: 'user-corrective',
          role: 'user',
          content: 'Use the compact approval flow and keep deviation cards visible.',
          createdAt: '2026-05-23T10:20:00.000Z',
        },
        {
          id: 'continue-1',
          role: 'user',
          content: 'Continue the previous run.',
          createdAt: '2026-05-23T10:25:00.000Z',
        },
      ],
      '2026-05-23T10:25:00.000Z',
    );
    assistant = updateAssistantTaskSummary(
      assistant,
      started.session.id,
      {
        summary: 'Implementation started but render health failed.',
        lastSummarizedMessageId: 'assistant-tail-11',
      },
      '2026-05-23T10:26:00.000Z',
    );
    assistant = updateAssistantSessionRunMetadata(
      assistant,
      started.session.id,
      {
        lastRunManifestPath: '.sber-designer/runs/run-123/run-manifest.json',
        lastRunStatus: 'failed',
        lastRunSummary: 'Render health failed after the generated screen.',
      },
      '2026-05-23T10:27:00.000Z',
    );
    const session = assistant.sessions.find((candidate) => candidate.id === started.session.id);

    const context = buildAgentMessageContext({
      session: session!,
      latestUserMessageId: 'continue-1',
      mode: 'current-task',
      maxMessages: 4,
    });

    expect(context.messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(context.messages[0]?.role).toBe('system');
    expect(context.messages[0]?.content).toContain('Compact assistant task context');
    expect(context.messages[0]?.content).toContain('Use the compact approval flow');
    expect(context.messages[0]?.content).not.toContain('Generate the approval dashboard');
    expect(context.messages[0]?.content).not.toContain('large stale source dump');
    expect(context.messages[0]?.content).toContain('IBP BRD.md');
    expect(context.messages[0]?.content).toContain(
      '.sber-designer/runs/run-123/continuation-context.json',
    );
    expect(context.messages.at(-1)?.content).toBe('Continue the previous run.');
  });

  test('deleting a screen archives its assistant tasks but preserves their messages', () => {
    let assistant = createEmptyAssistantState();
    const started = startAssistantTask(assistant, 'screen-a', '2026-05-23T10:00:00.000Z');
    assistant = appendAssistantMessages(
      started.assistant,
      started.session.id,
      [
        {
          id: 'user-1',
          role: 'user',
          content: 'Preserve this conversation for later audit.',
          createdAt: '2026-05-23T10:00:01.000Z',
        },
      ],
      '2026-05-23T10:00:01.000Z',
    );

    const next = archiveAssistantSessionsForDeletedScreen(
      assistant,
      'screen-a',
      '2026-05-23T10:05:00.000Z',
    );

    expect(next.activeSessionByScreenId?.['screen-a']).toBeUndefined();
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0]?.status).toBe('archived');
    expect(next.sessions[0]?.archivedAt).toBe('2026-05-23T10:05:00.000Z');
    expect(next.sessions[0]?.messages.map((message) => message.content)).toEqual([
      'Preserve this conversation for later audit.',
    ]);
  });

  test('restoring an archived chat keeps the next turn on compact task context', () => {
    let assistant = createEmptyAssistantState();
    const first = startAssistantTask(assistant, 'screen-a', '2026-05-23T10:00:00.000Z');
    assistant = appendAssistantMessages(
      first.assistant,
      first.session.id,
      [
        {
          id: 'old-user-1',
          role: 'user',
          content: 'Make the first concept minimal.',
          createdAt: '2026-05-23T10:00:01.000Z',
        },
        {
          id: 'old-assistant-1',
          role: 'assistant',
          content: 'I changed the concept direction.',
          createdAt: '2026-05-23T10:00:02.000Z',
        },
      ],
      '2026-05-23T10:00:02.000Z',
    );
    assistant = updateAssistantTaskSummary(
      assistant,
      first.session.id,
      {
        summary: 'The restored task is the minimal first concept.',
        lastSummarizedMessageId: 'old-assistant-1',
      },
      '2026-05-23T10:03:00.000Z',
    );
    assistant = updateAssistantSessionRunMetadata(
      assistant,
      first.session.id,
      {
        lastRunManifestPath: '.sber-designer/runs/run-restored/run-manifest.json',
        lastRunStatus: 'needs_review',
        lastRunSummary: 'First concept was changed and needs review.',
      },
      '2026-05-23T10:04:00.000Z',
    );

    assistant = startAssistantTask(assistant, 'screen-a', '2026-05-23T10:05:00.000Z').assistant;

    const restored = restoreAssistantTask(assistant, first.session.id, '2026-05-23T10:10:00.000Z');

    expect(restored?.session.contextMode).toBe('current-task');
    const context = buildAgentMessageContext({
      session: restored!.session,
      latestUserMessageId: 'old-user-1',
      maxMessages: 1,
    });
    expect(context.messages[0]?.content).toContain('Compact assistant task context');
    expect(context.messages[0]?.content).toContain('Make the first concept minimal.');
    expect(context.messages[0]?.content).toContain(
      '.sber-designer/runs/run-restored/continuation-context.json',
    );
    expect(context.messages.map((message) => message.id)).not.toEqual([
      'old-user-1',
      'old-assistant-1',
    ]);
  });

  test('retargeting a task carries transcript, attachments, run evidence, and links both sessions', () => {
    let assistant = createEmptyAssistantState();
    const started = startAssistantTask(assistant, 'screen-index', '2026-07-05T12:00:00.000Z');
    assistant = appendAssistantMessages(
      started.assistant,
      started.session.id,
      [
        {
          id: 'user-import-ds',
          role: 'user',
          content: 'Create a design system screen from the attached HTML and update Design.md.',
          createdAt: '2026-07-05T12:00:01.000Z',
          attachments: [
            {
              id: 'att-design-system-html',
              name: 'Design System.html',
              mimeType: 'text/html',
              size: 111000,
              kind: 'text',
            },
          ],
        },
        {
          id: 'assistant-failed-scope',
          role: 'assistant',
          content:
            'I prepared the design-system update, but the current screen scope blocked Design.md.',
          createdAt: '2026-07-05T12:00:02.000Z',
        },
      ],
      '2026-07-05T12:00:02.000Z',
    );
    assistant = updateAssistantTaskSummary(
      assistant,
      started.session.id,
      {
        title: 'Import HTML design system',
        summary: 'Import the attached HTML design system and write the canonical Design.md.',
        lastSummarizedMessageId: 'assistant-failed-scope',
      },
      '2026-07-05T12:00:03.000Z',
    );
    assistant = updateAssistantSessionRunMetadata(
      assistant,
      started.session.id,
      {
        lastRunManifestPath: '.sber-designer/runs/run-ds/run-manifest.json',
        lastRunStatus: 'failed',
        lastRunSummary: 'write_file was outside the current screen scope.',
      },
      '2026-07-05T12:00:04.000Z',
    );

    const retargeted = retargetAssistantTask(assistant, started.session.id, 'screen-ds', {
      targetScreenName: 'Design System',
      now: '2026-07-05T12:05:00.000Z',
    });

    expect(retargeted).not.toBeNull();
    const next = retargeted!.assistant;
    const source = next.sessions.find((session) => session.id === started.session.id);
    const target = retargeted!.session;

    expect(target.primaryScreenId).toBe('screen-ds');
    expect(target.status).toBe('active');
    expect(next.activeSessionByScreenId?.['screen-ds']).toBe(target.id);
    expect(source?.linkedScreenIds).toContain('screen-ds');
    expect(target.linkedScreenIds).toContain('screen-index');
    expect(target.summary).toContain('canonical Design.md');
    expect(target.linkedRunManifestIds).toContain('.sber-designer/runs/run-ds/run-manifest.json');
    expect(target.metadata).toMatchObject({
      lastRunManifestPath: '.sber-designer/runs/run-ds/run-manifest.json',
      lastContinuationContextPath: '.sber-designer/runs/run-ds/continuation-context.json',
      retargetedFromSessionId: started.session.id,
      retargetedFromScreenId: 'screen-index',
      retargetedAt: '2026-07-05T12:05:00.000Z',
    });
    expect(target.messages.map((message) => message.id)).toContain('user-import-ds');
    expect(target.messages.map((message) => message.id)).toContain('assistant-failed-scope');
    expect(target.messages.some((message) => message.metadata?.retargetHandoff)).toBe(true);
    expect(source?.messages.some((message) => message.metadata?.retargetHandoff)).toBe(true);

    const context = buildAgentMessageContext({
      session: target,
      latestUserMessageId: 'user-import-ds',
      mode: 'current-task',
      maxMessages: 3,
    });
    expect(context.messages[0]?.content).toContain('Compact assistant task context');
    expect(context.messages[0]?.content).toContain('Design System.html');
    expect(context.messages[0]?.content).toContain(
      '.sber-designer/runs/run-ds/continuation-context.json',
    );
    expect(context.messages[0]?.content).toContain('- screenId: screen-ds');
  });

  test('retargeting an archived task does not reactivate it on the source screen', () => {
    let assistant = createEmptyAssistantState();
    const archivedSource = startAssistantTask(
      assistant,
      'screen-index',
      '2026-07-05T12:00:00.000Z',
    );
    assistant = appendAssistantMessages(
      archivedSource.assistant,
      archivedSource.session.id,
      [
        {
          id: 'old-user',
          role: 'user',
          content: 'Old design-system import.',
          createdAt: '2026-07-05T12:00:01.000Z',
        },
      ],
      '2026-07-05T12:00:01.000Z',
    );
    const activeSource = startAssistantTask(assistant, 'screen-index', '2026-07-05T12:10:00.000Z');

    const retargeted = retargetAssistantTask(
      activeSource.assistant,
      archivedSource.session.id,
      'screen-ds',
      {
        now: '2026-07-05T12:15:00.000Z',
      },
    );

    expect(retargeted).not.toBeNull();
    expect(retargeted!.assistant.activeSessionByScreenId?.['screen-index']).toBe(
      activeSource.session.id,
    );
    expect(retargeted!.assistant.activeSessionByScreenId?.['screen-ds']).toBe(
      retargeted!.session.id,
    );
    const source = retargeted!.assistant.sessions.find(
      (session) => session.id === archivedSource.session.id,
    );
    expect(source?.status).toBe('archived');
    expect(source?.messages.some((message) => message.metadata?.retargetHandoff)).toBe(true);
  });
});

describe('chat store screen sessions', () => {
  test('switching screens restores each screen transcript without mixing messages', () => {
    useProjectStore.setState({
      project: {
        version: 1,
        name: 'Chat project',
        workspacePath: '/workspace',
        screens: [
          { id: 'screen-a', name: 'Screen A', kind: 'page' },
          { id: 'screen-b', name: 'Screen B', kind: 'page' },
        ],
        flow: [],
      },
      baseline: null,
      saving: false,
      loadError: null,
      saveError: null,
    });
    useChatStore.getState().reset();

    useChatStore.getState().switchToScreen('screen-a');
    useChatStore.getState().appendUser('Message for A');
    useChatStore.getState().switchToScreen('screen-b');
    useChatStore.getState().appendUser('Message for B');

    expect(useChatStore.getState().messages.map((message) => message.content)).toContain(
      'Message for B',
    );
    expect(useChatStore.getState().messages.map((message) => message.content)).not.toContain(
      'Message for A',
    );

    useChatStore.getState().switchToScreen('screen-a');

    expect(useChatStore.getState().messages.map((message) => message.content)).toContain(
      'Message for A',
    );
    expect(useChatStore.getState().messages.map((message) => message.content)).not.toContain(
      'Message for B',
    );
  });

  test('assistant messages are present in project state after a chat turn and can hydrate after reload', () => {
    useProjectStore.setState({
      project: {
        version: 1,
        name: 'Chat project',
        workspacePath: '/workspace',
        screens: [{ id: 'screen-a', name: 'Screen A', kind: 'page' }],
        flow: [],
      },
      baseline: null,
      saving: false,
      loadError: null,
      saveError: null,
    });
    useChatStore.getState().reset();
    useChatStore.getState().switchToScreen('screen-a');
    useChatStore.getState().appendUser('Persist this message');

    const savedProject = useProjectStore.getState().project;
    expect(savedProject?.assistant?.sessions[0]?.messages[0]?.content).toBe('Persist this message');

    useChatStore.getState().reset();
    useChatStore.getState().hydrateFromProject(savedProject);
    useChatStore.getState().switchToScreen('screen-a');

    expect(useChatStore.getState().messages.map((message) => message.content)).toContain(
      'Persist this message',
    );
  });

  test('completed agent run transcript and metadata survive project hydrate after reload', () => {
    useProjectStore.setState({
      project: {
        version: 1,
        name: 'Chat project',
        workspacePath: '/workspace',
        screens: [{ id: 'screen-a', name: 'Screen A', kind: 'page' }],
        flow: [],
      },
      baseline: null,
      saving: false,
      loadError: null,
      saveError: null,
    });
    useChatStore.getState().reset();
    useChatStore.getState().switchToScreen('screen-a');
    const sessionId = useChatStore.getState().ensureSessionForScreen('screen-a').sessionId;
    useChatStore.getState().appendUserToSession(sessionId, 'Generate a screen');
    useChatStore.getState().replaceTurnForSession(
      sessionId,
      [
        {
          id: 'server-user',
          role: 'user',
          content: 'Generate a screen',
          createdAt: '2026-06-13T00:00:00.000Z',
        },
        {
          id: 'server-assistant',
          role: 'assistant',
          content: 'Writing source.',
          createdAt: '2026-06-13T00:00:01.000Z',
          toolCalls: [{ id: 'call-1', name: 'write_file', arguments: '{}' }],
        },
        {
          id: 'server-tool',
          role: 'tool',
          toolCallId: 'call-1',
          content: '{"ok":true}',
          createdAt: '2026-06-13T00:00:02.000Z',
        },
        {
          id: 'server-final',
          role: 'assistant',
          content: 'Canvas render verification needs review.',
          createdAt: '2026-06-13T00:00:03.000Z',
        },
      ],
      {
        iterations: 19,
        truncated: false,
        runStatus: 'needs_review',
        runSummary: 'Canvas render verification needs review.',
        runManifestPath: '.sber-designer/runs/run-123/run-manifest.json',
      },
      { persistProject: true },
    );

    const savedProject = useProjectStore.getState().project;
    const savedSession = savedProject?.assistant?.sessions.find(
      (session) => session.id === sessionId,
    );
    expect(savedSession?.messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'tool',
      'assistant',
    ]);
    expect(savedSession?.metadata?.lastRunStatus).toBe('needs_review');
    expect(savedSession?.linkedRunManifestIds).toContain(
      '.sber-designer/runs/run-123/run-manifest.json',
    );

    useChatStore.getState().reset();
    useChatStore.getState().hydrateFromProject(savedProject);
    useChatStore.getState().switchToScreen('screen-a');

    expect(useChatStore.getState().messages.map((message) => message.content)).toEqual([
      'Generate a screen',
      'Writing source.',
      '{"ok":true}',
      'Canvas render verification needs review.',
    ]);
    expect(useChatStore.getState().lastRunManifestPath).toBe(
      '.sber-designer/runs/run-123/run-manifest.json',
    );
    expect(useChatStore.getState().lastRunStatus).toBe('needs_review');
  });

  test('hydrating before active screen selection still restores history on screen switch', () => {
    const project = {
      version: 1 as const,
      name: 'Chat project',
      workspacePath: '/workspace',
      screens: [{ id: 'screen-a', name: 'Screen A', kind: 'page' as const }],
      flow: [],
      assistant: {
        storageVersion: 1,
        activeSessionByScreenId: { 'screen-a': 'session-a' },
        sessions: [
          {
            id: 'session-a',
            title: 'Task',
            titleSource: 'fallback' as const,
            primaryScreenId: 'screen-a',
            status: 'active' as const,
            contextMode: 'current-task' as const,
            messages: [
              {
                id: 'message-a',
                role: 'user' as const,
                content: 'Reloaded message',
                createdAt: '2026-05-26T00:00:00.000Z',
              },
            ],
            createdAt: '2026-05-26T00:00:00.000Z',
            updatedAt: '2026-05-26T00:00:00.000Z',
          },
        ],
      },
    };

    useProjectStore.setState({
      project,
      baseline: JSON.stringify(project),
      saving: false,
      loadError: null,
      saveError: null,
    });
    useChatStore.getState().reset();
    useChatStore.getState().hydrateFromProject(project);
    useChatStore.getState().switchToScreen('screen-a');

    expect(useChatStore.getState().messages.map((message) => message.content)).toContain(
      'Reloaded message',
    );
  });

  test('hydrating restored chat also restores session-level run metadata', () => {
    const project = {
      version: 1 as const,
      name: 'Chat project',
      workspacePath: '/workspace',
      screens: [{ id: 'screen-a', name: 'Screen A', kind: 'page' as const }],
      flow: [],
      assistant: {
        storageVersion: 1,
        activeSessionByScreenId: { 'screen-a': 'session-a' },
        sessions: [
          {
            id: 'session-a',
            title: 'Task',
            titleSource: 'fallback' as const,
            primaryScreenId: 'screen-a',
            status: 'active' as const,
            contextMode: 'current-task' as const,
            linkedRunManifestIds: ['.sber-designer/runs/run-a/run-manifest.json'],
            metadata: {
              lastAttemptId: 'attempt-a',
              lastDebugLogPath: '/tmp/sber-designer/agent-runs/attempt-a.jsonl',
              lastRunManifestPath: '.sber-designer/runs/run-a/run-manifest.json',
              lastRunStatus: 'failed' as const,
              lastRunSummary: 'Tool loop truncated.',
            },
            messages: [
              {
                id: 'assistant-a',
                role: 'assistant' as const,
                content: 'Failed before completing.',
                runManifestId: '.sber-designer/runs/run-a/run-manifest.json',
                createdAt: '2026-05-26T00:00:00.000Z',
              },
            ],
            createdAt: '2026-05-26T00:00:00.000Z',
            updatedAt: '2026-05-26T00:00:00.000Z',
          },
        ],
      },
    };

    useProjectStore.setState({
      project,
      baseline: JSON.stringify(project),
      saving: false,
      loadError: null,
      saveError: null,
    });
    useChatStore.getState().reset();
    useChatStore.getState().hydrateFromProject(project);
    useChatStore.getState().switchToScreen('screen-a');

    expect(useChatStore.getState().lastRunManifestPath).toBe(
      '.sber-designer/runs/run-a/run-manifest.json',
    );
    expect(useChatStore.getState().lastDebugLogPath).toBe(
      '/tmp/sber-designer/agent-runs/attempt-a.jsonl',
    );
    expect(useChatStore.getState().lastAttemptId).toBe('attempt-a');
    expect(useChatStore.getState().lastRunStatus).toBe('failed');
  });

  test('assistant freshness merge keeps newer in-flight local messages over stale project refreshes', () => {
    const local = {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-a': 'session-a' },
      sessions: [
        {
          id: 'session-a',
          title: 'Local',
          primaryScreenId: 'screen-a',
          status: 'active' as const,
          contextMode: 'current-task' as const,
          messages: [
            {
              id: 'local-user',
              role: 'user' as const,
              content: 'Fresh local message',
              createdAt: '2026-05-26T00:00:02.000Z',
            },
          ],
          createdAt: '2026-05-26T00:00:00.000Z',
          updatedAt: '2026-05-26T00:00:02.000Z',
        },
      ],
    };
    const incoming = {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-a': 'session-a' },
      sessions: [
        {
          id: 'session-a',
          title: 'Incoming',
          primaryScreenId: 'screen-a',
          status: 'active' as const,
          contextMode: 'current-task' as const,
          messages: [
            {
              id: 'old-user',
              role: 'user' as const,
              content: 'Older server message',
              createdAt: '2026-05-26T00:00:01.000Z',
            },
          ],
          createdAt: '2026-05-26T00:00:00.000Z',
          updatedAt: '2026-05-26T00:00:01.000Z',
        },
      ],
    };

    const merged = mergeAssistantStateByFreshness({ local, incoming });

    expect(merged.sessions).toHaveLength(1);
    expect(merged.sessions[0]?.messages.map((message) => message.id)).toEqual(['local-user']);
    expect(merged.activeSessionByScreenId?.['screen-a']).toBe('session-a');
  });

  test('W7.15 freshness merge keeps a newly selected empty task over a later old-session refresh', () => {
    const local = {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-a': 'session-new' },
      sessions: [
        {
          id: 'session-old',
          title: 'Previous task',
          primaryScreenId: 'screen-a',
          status: 'archived' as const,
          messages: [
            {
              id: 'old-user',
              role: 'user' as const,
              content: 'Previous request',
              createdAt: '2026-07-20T20:30:00.000Z',
            },
          ],
          createdAt: '2026-07-20T20:30:00.000Z',
          updatedAt: '2026-07-20T20:35:36.554Z',
          archivedAt: '2026-07-20T20:35:36.554Z',
        },
        {
          id: 'session-new',
          title: 'New task',
          primaryScreenId: 'screen-a',
          status: 'active' as const,
          messages: [],
          createdAt: '2026-07-20T20:35:36.554Z',
          updatedAt: '2026-07-20T20:35:36.554Z',
        },
      ],
    };
    const incoming = {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-a': 'session-old' },
      sessions: [
        {
          id: 'session-old',
          title: 'Previous task',
          primaryScreenId: 'screen-a',
          status: 'active' as const,
          messages: [
            {
              id: 'old-user',
              role: 'user' as const,
              content: 'Previous request',
              createdAt: '2026-07-20T20:30:00.000Z',
            },
            {
              id: 'late-server-message',
              role: 'assistant' as const,
              content: 'Late completion refresh',
              createdAt: '2026-07-20T20:35:40.000Z',
            },
          ],
          createdAt: '2026-07-20T20:30:00.000Z',
          updatedAt: '2026-07-20T20:35:40.000Z',
        },
      ],
    };

    const merged = mergeAssistantStateByFreshness({ local, incoming });

    expect(merged.activeSessionByScreenId?.['screen-a']).toBe('session-new');
    expect(merged.sessions.find((session) => session.id === 'session-new')?.status).toBe('active');
    expect(merged.sessions.find((session) => session.id === 'session-old')?.status).toBe(
      'archived',
    );
    expect(
      merged.sessions
        .find((session) => session.id === 'session-old')
        ?.messages.map((message) => message.id),
    ).toEqual(['old-user', 'late-server-message']);
  });
});
