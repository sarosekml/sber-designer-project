import { expect, test } from 'bun:test';

import { ApiError } from '@/lib/api/http';
import {
  activeScreenChangedByToolResult,
  attachRunTokenUsage,
  doneEventRunInfo,
  failedSendRunInfo,
  formatComponentPackStatus,
  mergeDoneTranscriptMessages,
  componentPackSummaryFromMetadata,
  screenChangedByToolResult,
  selectChatCanvasUrl,
  upsertComponentPackStatusMessage,
} from './chat-transcript';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';

test('failed send metadata marks API preflight errors separately from truncated runs', () => {
  const info = failedSendRunInfo(
    'model_cannot_read_images: Cheap text cannot read raster image attachments.',
    new ApiError(
      'Cheap text cannot read raster image attachments.',
      400,
      'model_cannot_read_images',
      {
        attemptId: 'attempt-1',
        debugLogPath: '/tmp/attempt.jsonl',
      },
    ),
  );

  expect(info).toEqual({
    iterations: 0,
    truncated: false,
    runStatus: 'preflight_rejected',
    runErrorCode: 'model_cannot_read_images',
    runSummary: 'model_cannot_read_images: Cheap text cannot read raster image attachments.',
    attemptId: 'attempt-1',
    debugLogPath: '/tmp/attempt.jsonl',
  });
});

test('stream done with finishReason other is stored as failed run metadata', () => {
  const info = doneEventRunInfo({
    type: 'done',
    transcript: [],
    iterations: 1,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    finalResponse: {
      text: 'sber-designer: The external runtime finished without changing any allowed target files.',
      provider: 'codex-runtime',
      model: 'default',
      finishReason: 'other',
    },
    runManifestPath: '.sber-designer/runs/run-1/run-manifest.json',
  });

  expect(info).toEqual({
    iterations: 1,
    truncated: false,
    runStatus: 'failed',
    runManifestPath: '.sber-designer/runs/run-1/run-manifest.json',
    runSummary:
      'sber-designer: The external runtime finished without changing any allowed target files.',
  });
});

test('stream done preserves component reuse summary for transcript notices', () => {
  const info = doneEventRunInfo({
    type: 'done',
    transcript: [],
    iterations: 4,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    finalResponse: {
      text: 'Done',
      provider: 'mock',
      model: 'default',
      finishReason: 'stop',
    },
    componentReuse: {
      expected: ['BreadCrumbs', 'PageBar', 'Tile'],
      used: ['Button', 'Paper'],
      missing: ['BreadCrumbs', 'PageBar', 'Tile'],
    },
  });

  expect(info).toEqual({
    iterations: 4,
    truncated: false,
    runStatus: 'complete',
    componentReuse: {
      expected: ['BreadCrumbs', 'PageBar', 'Tile'],
      used: ['Button', 'Paper'],
      missing: ['BreadCrumbs', 'PageBar', 'Tile'],
    },
  });
});

test('stream done exposes token usage as run metrics', () => {
  const info = doneEventRunInfo({
    type: 'done',
    transcript: [],
    iterations: 2,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    finalResponse: {
      text: 'Done',
      provider: 'mock',
      model: 'default',
      finishReason: 'stop',
      usage: {
        inputTokens: 700,
        outputTokens: 106,
      },
    },
  });

  expect(info.runMetrics).toEqual({
    iterations: 2,
    inputTokens: 700,
    outputTokens: 106,
    totalTokens: 806,
  });
});

test('token usage is attached only to the completed reply after the latest user message', () => {
  const messages = attachRunTokenUsage(
    [
      { id: 'user-1', role: 'user', content: 'First' },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'First answer',
        tokenUsage: { totalTokens: 30, inputTokens: 20, outputTokens: 10 },
      },
      { id: 'user-2', role: 'user', content: 'Second' },
      {
        id: 'operational',
        role: 'assistant',
        content: 'Preparing runtime',
        contextEligible: false,
      },
      { id: 'assistant-2', role: 'assistant', content: 'Second answer' },
    ],
    { inputTokens: 70, outputTokens: 11, totalTokens: 999 },
  );

  expect(messages[1]?.tokenUsage).toEqual({
    totalTokens: 30,
    inputTokens: 20,
    outputTokens: 10,
  });
  expect(messages[3]?.tokenUsage).toBeUndefined();
  expect(messages[4]?.tokenUsage).toEqual({
    totalTokens: 81,
    inputTokens: 70,
    outputTokens: 11,
  });
});

test('unknown token split does not invent a zero or partial total', () => {
  const info = doneEventRunInfo({
    type: 'done',
    transcript: [],
    iterations: 1,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    finalResponse: {
      text: 'Done',
      provider: 'external',
      model: 'cli',
      usage: { inputTokens: 700 },
    },
  });

  expect(info.runMetrics).toEqual({ iterations: 1, inputTokens: 700 });
});

test('stream done keeps server needs_review status for truncated partial writes', () => {
  const info = doneEventRunInfo({
    type: 'done',
    transcript: [],
    iterations: 20,
    truncated: true,
    hadErrors: true,
    stoppedAfterPermissionDeny: false,
    finalResponse: {
      text: 'sber-designer: Source written, validation unfinished.',
      provider: 'mock',
      model: 'default',
      finishReason: 'tool_calls',
    },
    runStatus: 'needs_review',
    runSummary: 'Source was written, but final validation did not finish.',
  });

  expect(info.runStatus).toBe('needs_review');
  expect(info.runSummary).toContain('Source was written');
});

test('stream done keeps server cancelled status as non-failed run metadata', () => {
  const info = doneEventRunInfo({
    type: 'done',
    transcript: [],
    iterations: 1,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    finalResponse: {
      text: 'Cancelled by user.',
      provider: 'mock',
      model: 'default',
      finishReason: 'other',
    },
    runStatus: 'cancelled',
    runSummary: 'Cancelled by user.',
  });

  expect(info).toEqual({
    iterations: 1,
    truncated: false,
    runStatus: 'cancelled',
    runSummary: 'Cancelled by user.',
  });
});

test('active screen changed helper detects generated implementation writes', () => {
  useProjectStore.setState({
    project: {
      id: 'project-1',
      name: 'Project',
      workspacePath: '/tmp/project',
      screens: [
        {
          id: 'screen-1',
          name: 'Screen',
          kind: 'story',
          storyId: 'screens-screen--default',
          filePath: 'src/stories/screens/Screen.stories.tsx',
          implementationFilePath: 'src/screens/Screen.tsx',
        },
      ],
      flow: [],
      comments: [],
    },
  });
  useEditorStore.setState({ activeScreenId: 'screen-1' });

  expect(activeScreenChangedByToolResult(['./src/screens/Screen.tsx'])).toBe(true);
  expect(activeScreenChangedByToolResult(['src/screens/Other.tsx'])).toBe(false);
  expect(screenChangedByToolResult('screen-1', ['./src/screens/Screen.tsx'])).toBe(true);
  expect(screenChangedByToolResult('screen-2', ['./src/screens/Screen.tsx'])).toBe(false);
});

test('chat editor context keeps sandbox origin instead of active screen proxy url', () => {
  expect(
    selectChatCanvasUrl(
      'http://localhost:3000/api/preview/iframe.html?id=screens-admin--default&viewMode=story',
      '/demo-target/index.html',
      'http://127.0.0.1:6100',
    ),
  ).toBe('http://127.0.0.1:6100');
});

test('done transcript from server replaces incomplete frontend turn messages', () => {
  const messages = mergeDoneTranscriptMessages({
    snapshot: [
      {
        id: 'user-1',
        role: 'user',
        content: 'Generate screen',
        createdAt: '2026-06-08T00:00:00.000Z',
      },
    ],
    turnMessages: [
      {
        id: 'assistant-local',
        role: 'assistant',
        content: 'partial',
        createdAt: '2026-06-08T00:00:01.000Z',
      },
    ],
    transcript: [
      { role: 'user', content: 'Generate screen' },
      {
        role: 'assistant',
        content: 'Using project components.',
        toolCalls: [{ id: 'call-1', name: 'write_file', arguments: '{}' }],
      },
      { role: 'tool', toolCallId: 'call-1', content: '{"ok":true}' },
      { role: 'assistant', content: 'Done.' },
    ],
    meta: { provider: 'mock', model: 'default' },
  });

  expect(messages.map((message) => message.role)).toEqual([
    'user',
    'assistant',
    'tool',
    'assistant',
  ]);
  expect(messages.some((message) => message.content === 'partial')).toBe(false);
  expect(messages.find((message) => message.role === 'tool')?.toolCallId).toBe('call-1');
});

test('done transcript appends only the current turn when the server returns full history', () => {
  const messages = mergeDoneTranscriptMessages({
    snapshot: [
      {
        id: 'user-1',
        role: 'user',
        content: 'First question',
        createdAt: '2026-07-20T00:00:00.000Z',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'First answer',
        createdAt: '2026-07-20T00:00:01.000Z',
        tokenUsage: { totalTokens: 30, inputTokens: 20, outputTokens: 10 },
      },
      {
        id: 'user-2',
        role: 'user',
        content: 'Second question',
        createdAt: '2026-07-20T00:00:02.000Z',
      },
    ],
    turnMessages: [
      {
        id: 'assistant-local',
        role: 'assistant',
        content: 'partial',
        createdAt: '2026-07-20T00:00:03.000Z',
      },
    ],
    transcript: [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
      { role: 'user', content: 'Second question' },
      { role: 'assistant', content: 'Second answer' },
    ],
    meta: { provider: 'openrouter', model: 'deepseek/deepseek-v4-pro' },
  });

  expect(messages.map((message) => message.content)).toEqual([
    'First question',
    'First answer',
    'Second question',
    'Second answer',
  ]);
  expect(messages[1]?.tokenUsage).toEqual({
    totalTokens: 30,
    inputTokens: 20,
    outputTokens: 10,
  });
});

test('done transcript hides internal budget nudge user messages', () => {
  const messages = mergeDoneTranscriptMessages({
    snapshot: [
      {
        id: 'user-1',
        role: 'user',
        content: 'Generate screen',
        createdAt: '2026-06-08T00:00:00.000Z',
      },
    ],
    turnMessages: [],
    transcript: [
      { role: 'user', content: 'Generate screen' },
      {
        role: 'user',
        content:
          '[sber-designer · auto] Enough exploring — write the active screen now to src/screens/New.tsx.',
      },
      { role: 'assistant', content: 'Writing the screen now.' },
    ],
    meta: { provider: 'mock', model: 'default' },
  });

  expect(messages.map((message) => message.content)).toEqual([
    'Generate screen',
    'Writing the screen now.',
  ]);
});

test('W7.16 done transcript does not persist external handoff or craft-repair prompts as users', () => {
  const messages = mergeDoneTranscriptMessages({
    snapshot: [
      {
        id: 'user-1',
        role: 'user',
        content: 'Tighten the header actions.',
        createdAt: '2026-07-20T20:48:00.000Z',
      },
    ],
    turnMessages: [],
    transcript: [
      {
        role: 'user',
        content:
          '# Design session mode\n\n# sber-designer External Runtime Handoff\n\n## User Request\nTighten the header actions.',
      },
      {
        role: 'user',
        content: '# sber-designer bounded craft repair\n\nThe previous CLI pass left one finding.',
      },
      { role: 'assistant', content: 'Changed the header action gap.' },
    ],
    meta: { provider: 'codex-runtime', model: 'gpt-5.5' },
  });

  expect(messages.map((message) => message.content)).toEqual([
    'Tighten the header actions.',
    'Changed the header action gap.',
  ]);
});

test('project design-system status reports indexed, described, selected, and hydrated counts', () => {
  expect(
    formatComponentPackStatus({
      status: 'ready',
      workspaceFreshness: 'stale',
      candidateCount: 9,
      selectedCount: 9,
      diagnosticCount: 0,
      indexedCount: 150,
      describedCount: 32,
      hydratedCount: 9,
    }),
  ).toBe('Project DS: 150 indexed · 32 described · 9 selected · 9 hydrated');
});

test('component pack status is inserted after the user and replaced with final late additions', () => {
  const initial = {
    status: 'ready' as const,
    workspaceFreshness: 'current' as const,
    candidateCount: 1,
    selectedCount: 1,
    diagnosticCount: 0,
    indexedCount: 150,
    describedCount: 32,
    hydratedCount: 1,
  };
  const inserted = upsertComponentPackStatusMessage(
    [
      { id: 'user', role: 'user', content: 'Generate a registry' },
      { id: 'answer', role: 'assistant', content: 'Working on it' },
    ],
    initial,
    '2026-07-20T00:00:00.000Z',
  );

  expect(inserted.map((message) => message.id)).toEqual([
    'user',
    expect.stringContaining('component-pack-'),
    'answer',
  ]);
  expect(inserted[1]).toMatchObject({ role: 'assistant', contextEligible: false });

  const updated = upsertComponentPackStatusMessage(inserted, {
    ...initial,
    candidateCount: 2,
    selectedCount: 2,
    hydratedCount: 2,
    lateSelectionCount: 1,
    lateSelectionBudget: 2,
  });
  const packMessages = updated.filter((message) =>
    Boolean(componentPackSummaryFromMetadata(message.metadata)),
  );
  expect(packMessages).toHaveLength(1);
  expect(packMessages[0]?.id).toBe(inserted[1]?.id);
  expect(componentPackSummaryFromMetadata(packMessages[0]?.metadata)).toMatchObject({
    selectedCount: 2,
    hydratedCount: 2,
    lateSelectionCount: 1,
  });
});
