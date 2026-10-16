import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'bun:test';
import { isProjectStyleMemoryEnabled } from '@sber-designer/shared-types';

import {
  ProjectSchema,
  loadProjectForWorkspace,
  saveAssistantSessionRunMetadata,
  saveProject,
} from '../services/api/src/project-store';
import { listProjectTemplates } from '../services/api/src/project-templates';

test('project schema accepts demo comments for persistence', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Commented project',
    workspacePath: '/workspace',
    screens: [
      {
        id: 'screen-a',
        name: 'Screen A',
        kind: 'story',
        storyId: 'screens-demo--screen-a',
      },
    ],
    flow: [],
    comments: [
      {
        id: 'comment-1',
        screenId: 'screen-a',
        anchor: { x: 0.25, y: 0.5 },
        selector: '[data-sd-flow-id="approve"]',
        elementText: 'Approve',
        status: 'open',
        createdAt: 1,
        updatedAt: 2,
        messages: [
          {
            id: 'message-1',
            authorName: 'Mikhail',
            body: 'Needs a stronger label.',
            createdAt: 1,
          },
        ],
      },
    ],
  });

  expect(parsed.comments?.[0]?.messages[0]?.body).toBe('Needs a stronger label.');
});

test('project schema accepts screen health labels for persistence', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Screen health project',
    workspacePath: '/workspace',
    screens: [
      {
        id: 'screen-broken',
        name: 'Broken Screen',
        kind: 'story',
        storyId: 'screens-broken--default',
        health: {
          status: 'broken',
          reason: 'Created by failed assistant run run-a.',
          source: 'failed-run',
          updatedAt: 1,
        },
      },
      {
        id: 'screen-needs-review',
        name: 'Needs Review Screen',
        kind: 'story',
        storyId: 'screens-needs-review--default',
        health: {
          status: 'needs-review',
          reason: 'Fallback icon was used because the requested icon was not indexed.',
          source: 'fallback',
          updatedAt: 2,
        },
      },
    ],
    flow: [],
  });

  expect(parsed.screens[0]?.health?.status).toBe('broken');
  expect(parsed.screens[1]?.health?.status).toBe('needs-review');
});

test('project schema accepts screen creation folder settings', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Screen creation settings project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    screenCreation: {
      lastFolder: 'Ungrouped',
    },
  });

  expect(parsed.screenCreation?.lastFolder).toBe('Ungrouped');
});

test('project schema accepts Screens panel collapse settings', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Screens panel settings project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    screensPanel: {
      collapsedFolderNames: ['Archive', 'Drafts'],
    },
  });

  expect(parsed.screensPanel?.collapsedFolderNames).toEqual(['Archive', 'Drafts']);
});

test('project schema accepts Screens panel one-shot design-system nudge state', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Screens panel nudge settings project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    screensPanel: {
      collapsedFolderNames: ['Archive'],
      htmlDesignSystemDistillNudgeDismissedKey: 'html-ds-distill:deals,request',
    },
  });

  expect(parsed.screensPanel?.htmlDesignSystemDistillNudgeDismissedKey).toBe(
    'html-ds-distill:deals,request',
  );
});

test('server run metadata persistence stores runtime session resume fields', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-project-runtime-session-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  await saveProject({
    version: 1,
    name: 'Runtime session project',
    workspacePath: workspace,
    screens: [{ id: 'screen-a', name: 'Screen A', kind: 'story' }],
    flow: [],
    assistant: {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-a': 'session-a' },
      sessions: [
        {
          id: 'session-a',
          title: 'Screen A',
          primaryScreenId: 'screen-a',
          status: 'active',
          sessionMode: 'plan',
          messages: [],
          createdAt: '2026-07-03T00:00:00.000Z',
          updatedAt: '2026-07-03T00:00:00.000Z',
        },
      ],
    },
  });

  const saved = await saveAssistantSessionRunMetadata({
    sessionId: 'session-a',
    runManifestPath: '.sber-designer/runs/run-codex/run-manifest.json',
    runtimeSession: {
      runtime: 'codex',
      style: 'capture',
      mode: 'new',
      resumeUsed: false,
      model: 'gpt-5.5',
      workspacePath: workspace,
      sessionId: 'codex-thread-id',
      source: 'runtime-event',
      captureSeen: true,
      captureEvent: 'thread.started',
      cumulativeUsage: { inputTokens: 240, outputTokens: 20, totalTokens: 260 },
      updatedAt: '2026-07-03T00:01:00.000Z',
    },
  });

  const session = saved.assistant?.sessions.find((candidate) => candidate.id === 'session-a');
  expect(session?.linkedRunManifestIds).toEqual([
    '.sber-designer/runs/run-codex/run-manifest.json',
  ]);
  expect(session?.metadata).toMatchObject({
    lastRunManifestPath: '.sber-designer/runs/run-codex/run-manifest.json',
    runtimeSessionId: 'codex-thread-id',
    runtimeSessionRuntime: 'codex',
    runtimeSessionModel: 'gpt-5.5',
    runtimeSessionWorkspacePath: workspace,
    runtimeSessionUsage: { inputTokens: 240, outputTokens: 20, totalTokens: 260 },
    runtimeSessionUpdatedAt: '2026-07-03T00:01:00.000Z',
  });
});

test('W7.15 project save keeps a newly selected task over late metadata from the old task', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-project-new-task-race-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const baseProject = {
    version: 1 as const,
    name: 'New task race project',
    workspacePath: workspace,
    screens: [{ id: 'screen-a', name: 'Screen A', kind: 'story' as const }],
    flow: [],
  };
  await saveProject({
    ...baseProject,
    assistant: {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-a': 'session-old' },
      sessions: [
        {
          id: 'session-old',
          title: 'Previous task',
          primaryScreenId: 'screen-a',
          status: 'active' as const,
          sessionMode: 'design' as const,
          messages: [],
          metadata: { runtimeSessionId: 'codex-old-thread' },
          createdAt: '2026-07-20T20:30:00.000Z',
          updatedAt: '2026-07-20T20:35:40.000Z',
        },
      ],
    },
  });

  const saved = await saveProject({
    ...baseProject,
    assistant: {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-a': 'session-new' },
      sessions: [
        {
          id: 'session-old',
          title: 'Previous task',
          primaryScreenId: 'screen-a',
          status: 'archived' as const,
          sessionMode: 'design' as const,
          messages: [],
          createdAt: '2026-07-20T20:30:00.000Z',
          updatedAt: '2026-07-20T20:35:36.554Z',
          archivedAt: '2026-07-20T20:35:36.554Z',
        },
        {
          id: 'session-new',
          title: 'New task',
          primaryScreenId: 'screen-a',
          status: 'active' as const,
          sessionMode: 'design' as const,
          messages: [],
          createdAt: '2026-07-20T20:35:36.554Z',
          updatedAt: '2026-07-20T20:35:36.554Z',
        },
      ],
    },
  });

  expect(saved.assistant?.activeSessionByScreenId?.['screen-a']).toBe('session-new');
  expect(
    saved.assistant?.sessions.filter(
      (session) => session.primaryScreenId === 'screen-a' && session.status === 'active',
    ),
  ).toEqual([expect.objectContaining({ id: 'session-new' })]);
  expect(
    saved.assistant?.sessions.find((session) => session.id === 'session-old')?.metadata,
  ).toMatchObject({ runtimeSessionId: 'codex-old-thread' });
});

test('project schema accepts Flow view visibility settings', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Flow view project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    flowView: {
      previewSize: 'frames',
      showConnections: false,
      showDescriptions: true,
      hiddenScreenIds: ['screen-a'],
      hiddenFolderNames: ['Archive'],
      hiddenEdgeIds: ['edge-a'],
      previewViewport: { width: 1280, height: 720 },
      previewCaptures: [
        {
          screenId: 'screen-a',
          imagePath: '.sber-designer/previews/screens/screen-a.png',
          viewport: { width: 1280, height: 720 },
          capturedAt: 1,
          sourceFingerprint: 'fingerprint-a',
        },
      ],
    },
  });

  expect(parsed.flowView).toEqual({
    previewSize: 'frames',
    showConnections: false,
    showDescriptions: true,
    hiddenScreenIds: ['screen-a'],
    hiddenFolderNames: ['Archive'],
    hiddenEdgeIds: ['edge-a'],
    previewViewport: { width: 1280, height: 720 },
    previewCaptures: [
      {
        screenId: 'screen-a',
        imagePath: '.sber-designer/previews/screens/screen-a.png',
        viewport: { width: 1280, height: 720 },
        capturedAt: 1,
        sourceFingerprint: 'fingerprint-a',
      },
    ],
  });
});

test('project schema accepts screen assistant task history', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Assistant history project',
    workspacePath: '/workspace',
    screens: [
      {
        id: 'screen-a',
        name: 'Screen A',
        kind: 'page',
        filePath: 'src/screens/ScreenA.stories.tsx',
      },
    ],
    flow: [],
    assistant: {
      storageVersion: 1,
      activeSessionByScreenId: {
        'screen-a': 'session-a',
      },
      sessions: [
        {
          id: 'session-a',
          title: 'Refine screen copy',
          titleSource: 'llm',
          primaryScreenId: 'screen-a',
          status: 'active',
          sessionMode: 'plan',
          contextMode: 'current-task',
          summary: 'Assistant helped tighten labels on Screen A.',
          summaryUpdatedAt: '2026-05-23T10:00:00.000Z',
          lastSummarizedMessageId: 'message-2',
          contextCutoffMessageId: 'message-1',
          linkedRunManifestIds: ['.sber-designer/runs/run-a.json'],
          messages: [
            {
              id: 'message-1',
              role: 'user',
              content: 'Make the labels shorter.',
              createdAt: '2026-05-23T09:59:00.000Z',
            },
            {
              id: 'message-2',
              role: 'assistant',
              content: 'I shortened the labels.',
              createdAt: '2026-05-23T10:00:00.000Z',
              contextEligible: true,
              runManifestId: '.sber-designer/runs/run-a.json',
              meta: {
                provider: 'openai',
                model: 'gpt-5',
                sessionMode: 'plan',
              },
            },
          ],
          createdAt: '2026-05-23T09:59:00.000Z',
          updatedAt: '2026-05-23T10:00:00.000Z',
        },
      ],
    },
  });

  expect(parsed.assistant?.activeSessionByScreenId?.['screen-a']).toBe('session-a');
  expect(parsed.assistant?.sessions[0]?.messages).toHaveLength(2);
  expect(parsed.assistant?.sessions[0]?.sessionMode).toBe('plan');
  expect(parsed.assistant?.sessions[0]?.messages[1]?.meta?.sessionMode).toBe('plan');
});

test('project save/load round-trips assistant messages on disk', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-assistant-history-'));
  await saveProject({
    version: 1,
    name: 'Assistant history project',
    workspacePath: workspace,
    screens: [{ id: 'screen-a', name: 'Screen A', kind: 'page' }],
    flow: [],
    assistant: {
      storageVersion: 1,
      activeSessionByScreenId: { 'screen-a': 'session-a' },
      sessions: [
        {
          id: 'session-a',
          title: 'Task',
          titleSource: 'fallback',
          primaryScreenId: 'screen-a',
          status: 'active',
          messages: [
            {
              id: 'message-a',
              role: 'user',
              content: 'Disk message',
              createdAt: '2026-05-26T00:00:00.000Z',
            },
          ],
          createdAt: '2026-05-26T00:00:00.000Z',
          updatedAt: '2026-05-26T00:00:00.000Z',
        },
      ],
    },
  });

  const loaded = await loadProjectForWorkspace(workspace);
  expect(loaded.assistant?.sessions[0]?.messages[0]?.content).toBe('Disk message');
});

test('project load recovers incomplete assistant history from linked run transcript', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-assistant-transcript-recovery-'));
  const runRoot = join(workspace, '.sber-designer', 'runs', 'run-a');
  await mkdir(runRoot, { recursive: true });
  await writeFile(
    join(runRoot, 'transcript.jsonl'),
    [
      JSON.stringify({
        version: 1,
        runId: 'run-a',
        source: 'chat-stream',
        index: 0,
        role: 'system',
        content: 'Internal agent context must never become visible chat history.',
      }),
      JSON.stringify({
        version: 1,
        runId: 'run-a',
        source: 'chat-stream',
        index: 1,
        role: 'user',
        content: 'Generate the screen.',
      }),
      JSON.stringify({
        version: 1,
        runId: 'run-a',
        source: 'chat-stream',
        index: 2,
        role: 'assistant',
        content: 'Writing files.',
        toolCalls: [{ id: 'call-1', name: 'write_file', arguments: '{}' }],
      }),
      JSON.stringify({
        version: 1,
        runId: 'run-a',
        source: 'chat-stream',
        index: 3,
        role: 'tool',
        toolCallId: 'call-1',
        content: '{"ok":true}',
      }),
      JSON.stringify({
        version: 1,
        runId: 'run-a',
        source: 'chat-stream',
        index: 4,
        role: 'assistant',
        content: 'Render verification needs review.',
      }),
    ].join('\n') + '\n',
    'utf8',
  );
  await writeFile(
    join(runRoot, 'run-manifest.json'),
    JSON.stringify({ version: 1, runId: 'run-a', status: 'needs_review' }, null, 2),
    'utf8',
  );
  await writeFile(
    join(workspace, '.sber-designer', 'project.sdproj'),
    JSON.stringify(
      {
        version: 1,
        name: 'Assistant recovery project',
        workspacePath: workspace,
        screens: [{ id: 'screen-a', name: 'Screen A', kind: 'page' }],
        flow: [],
        assistant: {
          storageVersion: 1,
          activeSessionByScreenId: { 'screen-a': 'session-a' },
          sessions: [
            {
              id: 'session-a',
              title: 'Task',
              titleSource: 'fallback',
              primaryScreenId: 'screen-a',
              status: 'active',
              contextMode: 'current-task',
              linkedRunManifestIds: ['.sber-designer/runs/run-a/run-manifest.json'],
              metadata: {
                lastRunManifestPath: '.sber-designer/runs/run-a/run-manifest.json',
                lastRunStatus: 'needs_review',
              },
              messages: [
                {
                  id: 'user-a',
                  role: 'user',
                  content: 'Generate the screen.',
                  createdAt: '2026-06-13T00:00:00.000Z',
                },
                {
                  id: 'assistant-partial',
                  role: 'assistant',
                  content: 'Writing files.',
                  createdAt: '2026-06-13T00:00:01.000Z',
                  runManifestId: '.sber-designer/runs/run-a/run-manifest.json',
                  toolCalls: [{ id: 'call-1', name: 'write_file', arguments: '{}' }],
                },
              ],
              createdAt: '2026-06-13T00:00:00.000Z',
              updatedAt: '2026-06-13T00:00:00.000Z',
            },
          ],
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  const loaded = await loadProjectForWorkspace(workspace);
  const messages = loaded.assistant?.sessions[0]?.messages ?? [];

  expect(messages.map((message) => message.role)).toEqual([
    'user',
    'assistant',
    'tool',
    'assistant',
  ]);
  expect(messages.map((message) => message.content)).toContain('Render verification needs review.');
  expect(messages[1]?.id).toBe('assistant-partial');
  expect(messages[1]?.runManifestId).toBe('.sber-designer/runs/run-a/run-manifest.json');
  expect(messages[2]?.toolCallId).toBe('call-1');
});

test('project load preserves completed per-turn usage instead of replaying model context', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-assistant-token-reload-'));
  const runRoot = join(workspace, '.sber-designer', 'runs', 'run-token');
  const runManifestPath = '.sber-designer/runs/run-token/run-manifest.json';
  await mkdir(runRoot, { recursive: true });
  await writeFile(
    join(runRoot, 'transcript.jsonl'),
    [
      JSON.stringify({
        version: 1,
        runId: 'run-token',
        source: 'chat-stream',
        index: 0,
        role: 'system',
        content: 'Internal system context.',
      }),
      JSON.stringify({
        version: 1,
        runId: 'run-token',
        source: 'chat-stream',
        index: 1,
        role: 'user',
        content: 'Second question',
      }),
      JSON.stringify({
        version: 1,
        runId: 'run-token',
        source: 'chat-stream',
        index: 2,
        role: 'assistant',
        content: 'Second answer from model transcript',
      }),
    ].join('\n') + '\n',
    'utf8',
  );
  await writeFile(
    join(runRoot, 'run-manifest.json'),
    JSON.stringify({ version: 1, runId: 'run-token', status: 'complete' }, null, 2),
    'utf8',
  );
  await writeFile(
    join(workspace, '.sber-designer', 'project.sdproj'),
    JSON.stringify(
      {
        version: 1,
        name: 'Assistant token reload project',
        workspacePath: workspace,
        screens: [{ id: 'screen-a', name: 'Screen A', kind: 'page' }],
        flow: [],
        assistant: {
          storageVersion: 1,
          activeSessionByScreenId: { 'screen-a': 'session-a' },
          sessions: [
            {
              id: 'session-a',
              title: 'Task',
              primaryScreenId: 'screen-a',
              status: 'active',
              metadata: { lastRunManifestPath: runManifestPath, lastRunStatus: 'complete' },
              messages: [
                {
                  id: 'user-a',
                  role: 'user',
                  content: 'Second question',
                  createdAt: '2026-07-20T00:00:00.000Z',
                },
                {
                  id: 'assistant-a',
                  role: 'assistant',
                  content: 'Second answer',
                  createdAt: '2026-07-20T00:00:01.000Z',
                  runManifestId: runManifestPath,
                  tokenUsage: { totalTokens: 60, inputTokens: 52, outputTokens: 8 },
                },
              ],
              createdAt: '2026-07-20T00:00:00.000Z',
              updatedAt: '2026-07-20T00:00:01.000Z',
            },
          ],
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  const loaded = await loadProjectForWorkspace(workspace);
  const messages = loaded.assistant?.sessions[0]?.messages ?? [];

  expect(messages.map((message) => message.content)).toEqual(['Second question', 'Second answer']);
  expect(messages[1]?.tokenUsage).toEqual({
    totalTokens: 60,
    inputTokens: 52,
    outputTokens: 8,
  });
});

test('project load recovers unlinked assistant history from matching screen run transcripts', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-assistant-orphan-transcript-recovery-'));
  const firstRunRoot = join(workspace, '.sber-designer', 'runs', 'run-first');
  const secondRunRoot = join(workspace, '.sber-designer', 'runs', 'run-second');
  await mkdir(firstRunRoot, { recursive: true });
  await mkdir(secondRunRoot, { recursive: true });
  await writeFile(
    join(firstRunRoot, 'transcript.jsonl'),
    [
      JSON.stringify({
        version: 1,
        runId: 'run-first',
        source: 'external-runtime',
        index: 0,
        role: 'user',
        content: [
          '# sber-designer External Runtime Handoff',
          '',
          '## User Request',
          '',
          'Generate the payment screen.',
          '',
          'Attached text files:',
          '',
          'File 1: TZ.md (text/markdown, 10 bytes)',
          '```markdown',
          '# spec',
          '```',
          '',
          '---',
        ].join('\n'),
      }),
      JSON.stringify({
        version: 1,
        runId: 'run-first',
        source: 'external-runtime',
        index: 1,
        role: 'assistant',
        content: 'Generated the first pass.',
      }),
    ].join('\n') + '\n',
    'utf8',
  );
  await writeFile(
    join(secondRunRoot, 'transcript.jsonl'),
    [
      JSON.stringify({
        version: 1,
        runId: 'run-second',
        source: 'external-runtime',
        index: 0,
        role: 'user',
        content: [
          '# sber-designer External Runtime Handoff',
          '',
          '## User Request',
          '',
          'Rebuild it from scratch with better components.',
          '',
          '---',
        ].join('\n'),
      }),
      JSON.stringify({
        version: 1,
        runId: 'run-second',
        source: 'external-runtime',
        index: 1,
        role: 'assistant',
        content: 'Reworked the screen from scratch.',
      }),
    ].join('\n') + '\n',
    'utf8',
  );
  await writeFile(
    join(firstRunRoot, 'run-manifest.json'),
    JSON.stringify(
      {
        version: 1,
        runId: 'run-first',
        status: 'complete',
        createdAt: Date.parse('2026-06-14T17:22:31.200Z'),
        updatedAt: Date.parse('2026-06-14T17:22:40.000Z'),
        completedAt: Date.parse('2026-06-14T17:22:40.000Z'),
        activeScreen: { id: 'screen-a', storyId: 'screens-a--default' },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(secondRunRoot, 'run-manifest.json'),
    JSON.stringify(
      {
        version: 1,
        runId: 'run-second',
        status: 'complete',
        createdAt: Date.parse('2026-06-14T17:35:56.000Z'),
        updatedAt: Date.parse('2026-06-14T17:36:10.000Z'),
        completedAt: Date.parse('2026-06-14T17:36:10.000Z'),
        activeScreen: { id: 'screen-a', storyId: 'screens-a--default' },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(workspace, '.sber-designer', 'project.sdproj'),
    JSON.stringify(
      {
        version: 1,
        name: 'Assistant orphan recovery project',
        workspacePath: workspace,
        screens: [
          {
            id: 'screen-a',
            name: 'Screen A',
            kind: 'story',
            storyId: 'screens-a--default',
          },
        ],
        flow: [],
        assistant: {
          storageVersion: 1,
          activeSessionByScreenId: { 'screen-a': 'session-a' },
          sessions: [
            {
              id: 'session-a',
              title: 'Task',
              titleSource: 'fallback',
              primaryScreenId: 'screen-a',
              status: 'active',
              contextMode: 'current-task',
              messages: [
                {
                  id: 'user-a',
                  role: 'user',
                  content: 'Generate the payment screen.',
                  createdAt: '2026-06-14T17:22:31.075Z',
                  attachments: [
                    {
                      id: 'att-a',
                      name: 'TZ.md',
                      mimeType: 'text/markdown',
                      size: 10,
                      kind: 'text',
                    },
                  ],
                },
              ],
              createdAt: '2026-06-14T17:22:31.061Z',
              updatedAt: '2026-06-14T17:22:31.075Z',
            },
          ],
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  const loaded = await loadProjectForWorkspace(workspace);
  const session = loaded.assistant?.sessions[0];

  expect(session?.messages.map((message) => [message.role, message.content])).toEqual([
    ['user', 'Generate the payment screen.'],
    ['assistant', 'Generated the first pass.'],
    ['user', 'Rebuild it from scratch with better components.'],
    ['assistant', 'Reworked the screen from scratch.'],
  ]);
  expect(session?.messages[0]?.attachments?.[0]?.name).toBe('TZ.md');
  expect(session?.linkedRunManifestIds).toEqual([
    '.sber-designer/runs/run-first/run-manifest.json',
    '.sber-designer/runs/run-second/run-manifest.json',
  ]);
  expect(session?.metadata?.lastRunManifestPath).toBe(
    '.sber-designer/runs/run-second/run-manifest.json',
  );
  expect(session?.messages[3]?.runManifestId).toBe(
    '.sber-designer/runs/run-second/run-manifest.json',
  );
});

test('project schema accepts manual project instructions', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Instruction project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    projectInstructions:
      'Use production components first. Keep financial metrics realistic and label mock data.',
  });

  expect(parsed.projectInstructions).toContain('production components');
});

test('project schema persists the project style memory kill-switch with an enabled default', () => {
  const disabled = ProjectSchema.parse({
    version: 1,
    name: 'Memory settings project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    agentMemory: { styleMemoryEnabled: false },
  });
  const defaults = ProjectSchema.parse({
    version: 1,
    name: 'Default memory project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
  });

  expect(isProjectStyleMemoryEnabled(disabled)).toBe(false);
  expect(isProjectStyleMemoryEnabled(defaults)).toBe(true);
});

test('project schema accepts screen design export template metadata', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Export project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    screenDesignExportTemplate: {
      path: '.sber-designer/screen.design.md',
      fileName: 'screen.design.md',
      uploadedAt: 1,
    },
  });

  expect(parsed.screenDesignExportTemplate?.path).toBe('.sber-designer/screen.design.md');
});

test('project schema accepts asset pack import preferences', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Asset project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    assetPacks: {
      localSourcePath: '/Users/me/assets/product-kit',
      kinds: ['icons'],
      updatedAt: 1,
    },
  });

  expect(parsed.assetPacks).toEqual({
    localSourcePath: '/Users/me/assets/product-kit',
    kinds: ['icons'],
    updatedAt: 1,
  });
});

test('project schema accepts portable external asset source references', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Icon source project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    externalAssetSources: {
      icons: [
        {
          id: 'source-icons',
          name: 'Design icon folder',
          kind: 'local-folder',
          mode: 'external',
          families: ['icons'],
          localPath: '/Users/me/icon-packs/core',
          updatedAt: 1,
        },
      ],
    },
  });

  expect(parsed.externalAssetSources?.icons?.[0]).toEqual({
    id: 'source-icons',
    name: 'Design icon folder',
    kind: 'local-folder',
    mode: 'external',
    families: ['icons'],
    localPath: '/Users/me/icon-packs/core',
    updatedAt: 1,
  });
});

test('project schema accepts visual editing policy metadata', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Visual editing project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    visualEditing: {
      tokenMode: 'strict-tokens',
      allowInlineStyles: false,
      allowClassNameEdits: true,
      allowComponentSwaps: true,
    },
  });

  expect(parsed.visualEditing).toEqual({
    tokenMode: 'strict-tokens',
    allowInlineStyles: false,
    allowClassNameEdits: true,
    allowComponentSwaps: true,
  });
});

test('project schema accepts screen readiness post-check profile', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Readiness project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    postChecks: {
      screenReadiness: {
        enabled: true,
        profile: 'custom',
        categories: {
          sourceIntegrity: true,
          designSystemFit: false,
          dataHonesty: true,
          operationalUxStates: true,
          accessibilityBasics: true,
          renderHealth: false,
          responsiveVisualSanity: false,
          designModeCompatibility: false,
        },
      },
    },
  });

  expect(parsed.postChecks?.screenReadiness.profile).toBe('custom');
  expect(parsed.postChecks?.screenReadiness.categories.designSystemFit).toBe(false);
});

test('project schema accepts project-wide generation pipeline defaults', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Generation defaults project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    generationDefaults: {
      directionPicker: true,
      wireframe: false,
      designJury: true,
    },
  });

  expect(parsed.generationDefaults).toEqual({
    directionPicker: true,
    wireframe: false,
    designJury: true,
  });
});

test('project schema accepts URL-only task tracker config and auto PR preference', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Auto project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    taskTracker: {
      type: 'linear',
      projectUrl: 'https://linear.app/acme/project/demo',
      labelFilter: 'sber-designer',
    },
    agentAutoPr: true,
  });

  expect(parsed.taskTracker).toEqual({
    type: 'linear',
    projectUrl: 'https://linear.app/acme/project/demo',
    labelFilter: 'sber-designer',
  });
  expect(parsed.agentAutoPr).toBe(true);
});

test('project schema preserves git branch session metadata', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Git project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    gitSession: {
      provider: 'github',
      remote: 'origin',
      remoteUrl: 'git@github.com:acme/demo.git',
      baseBranch: 'main',
      workingBranch: 'sd/add-dashboard',
      status: 'review-open',
      createdAt: 1,
      updatedAt: 2,
      prUrl: 'https://github.com/acme/demo/pull/1',
      prNumber: '1',
      commitSha: 'abc123',
      pushedAt: 3,
      autoPush: true,
    },
  });

  expect(parsed.gitSession).toEqual({
    provider: 'github',
    remote: 'origin',
    remoteUrl: 'git@github.com:acme/demo.git',
    baseBranch: 'main',
    workingBranch: 'sd/add-dashboard',
    status: 'review-open',
    createdAt: 1,
    updatedAt: 2,
    prUrl: 'https://github.com/acme/demo/pull/1',
    prNumber: '1',
    commitSha: 'abc123',
    pushedAt: 3,
    autoPush: true,
  });
});

test('project schema accepts MCP runtime switcher overrides', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'MCP settings project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    mcpSettings: {
      serverOverrides: {
        'pixso-desktop': {
          enabled: false,
          configHash: `sha256:${'a'.repeat(64)}`,
          updatedAt: 1,
          toolOverrides: {
            read_frame: { enabled: false, updatedAt: 2 },
          },
          toolSelection: {
            mode: 'explicit',
            selectedTools: ['connect_to_pixso', 'get_selection'],
            updatedAt: 10,
          },
        },
      },
    },
  });

  expect(parsed.mcpSettings?.serverOverrides?.['pixso-desktop']).toEqual({
    enabled: false,
    configHash: `sha256:${'a'.repeat(64)}`,
    updatedAt: 1,
    toolOverrides: {
      read_frame: { enabled: false, updatedAt: 2 },
    },
    toolSelection: {
      mode: 'explicit',
      selectedTools: ['connect_to_pixso', 'get_selection'],
      updatedAt: 10,
    },
  });
});

test('project template compatibility alias returns built-in screen templates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-templates-'));
  const templates = await listProjectTemplates(root);

  expect(templates.map((template) => template.id)).toEqual([
    'dashboard',
    'list-table',
    'detail',
    'form',
    'settings',
  ]);
});

test('project template compatibility alias ignores project-local markdown patterns', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-templates-'));
  const localDir = join(root, '.sber-designer', 'templates');
  await mkdir(localDir, { recursive: true });
  await writeFile(
    join(localDir, 'approval-flow.md'),
    '# Approval Flow\n\nUse for approvals.',
    'utf8',
  );

  const templates = await listProjectTemplates(root);

  expect(templates.some((template) => template.id === 'detail')).toBe(true);
  expect(templates.some((template) => template.id === 'approval-flow')).toBe(false);
});
