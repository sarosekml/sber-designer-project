import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { buildHtmlDesignSystemApplyDirective } from '@sber-designer/shared-types';
import { DESIGN_INDEX_PATHS } from '@sber-designer/design-indexer';

import { resetConfigCache } from '../services/api/src/config-store';
import { getAgentRunCoordinator } from '../services/api/src/agent/run-coordinator';
import {
  chatStreamRouter,
  resolveInitialEditorStateForChat,
  selectRunCanvasUrl,
} from '../services/api/src/routes/chat-stream/index';
import { readAgentRunReceipts } from '../services/api/src/agent/run-recorder';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { getProject, saveProject } from '../services/api/src/project-store';
import { patchState, resetState } from '../services/api/src/state-store';

test('chat stream request context overrides stale global editor screen state', () => {
  const state = resolveInitialEditorStateForChat(
    {
      activeScreen: {
        id: 'screen-a',
        name: 'Screen A',
        kind: 'story',
        filePath: 'src/stories/screens/A.stories.tsx',
      },
      canvasUrl: 'http://localhost:3000/preview/a',
    },
    {
      activeScreen: {
        id: 'screen-b',
        name: 'Screen B',
        kind: 'story',
        filePath: 'src/stories/screens/B.stories.tsx',
        implementationFilePath: 'src/screens/B.tsx',
      },
      assistantTaskIntent: { kind: 'edit-current-screen', targetScreenId: 'screen-b' },
      canvasUrl: 'http://localhost:3000/preview/b',
    },
  );

  expect(state.activeScreen?.id).toBe('screen-b');
  expect(state.activeScreen?.implementationFilePath).toBe('src/screens/B.tsx');
  expect(state.assistantTaskIntent).toEqual({
    kind: 'edit-current-screen',
    targetScreenId: 'screen-b',
  });
  expect(state.canvasUrl).toBe('http://localhost:3000/preview/b');
});

test('system prompt keeps the request-scoped screen when global editor state changes in parallel', async () => {
  resetState();
  patchState({
    activeScreen: {
      id: 'screen-global',
      name: 'Global Screen',
      kind: 'story',
      filePath: 'src/stories/screens/Global.stories.tsx',
      implementationFilePath: 'src/screens/Global.tsx',
    },
  });

  const requestState = resolveInitialEditorStateForChat(
    {},
    {
      mode: 'interact',
      canvasView: 'screen',
      activeScreen: {
        id: 'screen-request',
        name: 'Request Screen',
        kind: 'story',
        filePath: 'src/stories/screens/Request.stories.tsx',
        implementationFilePath: 'src/screens/Request.tsx',
      },
      assistantTaskIntent: {
        kind: 'edit-current-screen',
        targetScreenId: 'screen-request',
      },
    },
  );

  const prompt = await buildSystemPrompt({ state: requestState });

  expect(prompt.text).toContain('activeScreen: `Request Screen` (screen-request)');
  expect(prompt.text).toContain('activeScreenImplementationFile: `src/screens/Request.tsx`');
  expect(prompt.text).not.toContain('activeScreen: `Global Screen` (screen-global)');
  resetState();
});

test('chat stream request context keeps server fields that were not sent by the client', () => {
  const state = resolveInitialEditorStateForChat(
    {
      workspacePath: '/workspace',
      projectName: 'Project',
      activeScreen: {
        id: 'screen-a',
        name: 'Screen A',
        kind: 'story',
      },
    },
    { mode: 'design' },
  );

  expect(state.workspacePath).toBe('/workspace');
  expect(state.projectName).toBe('Project');
  expect(state.mode).toBe('design');
  expect(state.activeScreen?.id).toBe('screen-a');
});

test('chat stream request context carries project, selection, comments, tasks, and visual design', () => {
  const state = resolveInitialEditorStateForChat(
    {
      workspacePath: '/stale',
      projectName: 'Stale project',
      agentCraftPostCheckEnabled: false,
    },
    {
      workspacePath: '/workspace/project',
      projectName: 'Fresh project',
      projectInstructions: 'Use dense enterprise UI.',
      selection: {
        loc: 'dom://button',
        tagName: 'BUTTON',
        text: 'Pay',
        rect: { x: 1, y: 2, width: 3, height: 4 },
      },
      selectedComment: {
        id: 'comment-1',
        screenId: 'screen-1',
        body: 'Make this clearer',
        anchor: { x: 10, y: 20 },
        status: 'open',
      },
      commentContext: [
        {
          id: 'comment-2',
          screenId: 'screen-1',
          body: 'Related note',
          anchor: { x: 12, y: 24 },
          status: 'open',
        },
      ],
      taskContext: [
        {
          id: 'task-1',
          title: 'Improve payment screen',
          source: 'jira',
          screenIds: ['screen-1'],
        },
      ],
      visualDesign: {
        draftChanges: [
          {
            kind: 'color',
            label: 'Primary action',
            filePath: 'src/screens/Payment.tsx',
          },
        ],
      },
      agentCraftPostCheckEnabled: true,
      screenReadiness: {
        enabled: true,
        profile: 'custom',
        categories: {
          dataHonesty: false,
        },
      },
    } as any,
  );

  expect(state.workspacePath).toBe('/workspace/project');
  expect(state.projectName).toBe('Fresh project');
  expect(state.projectInstructions).toBe('Use dense enterprise UI.');
  expect(state.selection?.text).toBe('Pay');
  expect(state.selectedComment?.id).toBe('comment-1');
  expect(state.commentContext?.[0]?.id).toBe('comment-2');
  expect(state.taskContext?.[0]?.id).toBe('task-1');
  expect(state.visualDesign?.draftChanges[0]?.label).toBe('Primary action');
  expect(state.agentCraftPostCheckEnabled).toBe(true);
  expect(state.screenReadiness?.profile).toBe('custom');
  expect(state.screenReadiness?.categories.dataHonesty).toBe(false);
});

test('run canvas URL prefers the request-scoped editor context over stale server state', () => {
  expect(selectRunCanvasUrl('/screen/from-request')).toBe('/screen/from-request');
  expect(selectRunCanvasUrl(null)).toBeNull();
  expect(selectRunCanvasUrl(undefined)).toBeNull();
});

test('chat stream request context only merges fields from the explicit allowlist', () => {
  const state = resolveInitialEditorStateForChat(
    {
      mode: 'interact',
      storybookReloadPending: false,
    },
    {
      mode: 'code',
      storybookReloadPending: true,
    } as any,
  );

  expect(state.mode).toBe('code');
  expect(state.storybookReloadPending).toBe(false);
});

test('chat stream accepts the relative canvas URL used by the iframe fallback', async () => {
  const response = await chatStreamRouter.request('/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Continue the previous run.' }],
      provider: 'providerA',
      model: 'text-model',
      attachContext: false,
      enableTools: false,
      attachments: [
        {
          id: 'attachment-1',
          kind: 'image',
          name: 'reference.png',
          mimeType: 'image/png',
          size: 1,
          dataUrl: 'data:image/png;base64,AA==',
        },
      ],
      editorContext: {
        mode: 'interact',
        canvasView: 'screen',
        canvasUrl: '/demo-target/index.html',
      },
    }),
  });

  const body = await response.json();

  expect(body.error).toBe('model_cannot_read_images');
  expect(JSON.stringify(body.detail ?? '')).not.toContain('Invalid url');
});

test('chat stream rejects HTML design-system apply when sources are not connected', async () => {
  const previousConfigPath = process.env.SBER_DESIGNER_CONFIG_PATH;
  const workspace = await mkdtemp(join(tmpdir(), 'sd-html-ds-apply-preflight-'));
  const configPath = join(workspace, 'sber-designer.json');
  process.env.SBER_DESIGNER_CONFIG_PATH = configPath;
  resetConfigCache();
  resetState();

  try {
    await writeFile(
      configPath,
      JSON.stringify(
        {
          agent: { default: { provider: 'providerA', model: 'text-model' } },
          provider: {
            providerA: {
              type: 'openai-compatible',
              name: 'Provider A',
              options: { baseURL: 'http://127.0.0.1:9/v1', apiKey: 'test-key' },
              models: { 'text-model': { name: 'Text model', vision: false } },
            },
          },
          mcpServers: {},
        },
        null,
        2,
      ),
      'utf8',
    );
    await mkdir(join(workspace, '.sber-designer', 'design-index'), { recursive: true });
    await writeFile(
      join(workspace, DESIGN_INDEX_PATHS.manifest),
      JSON.stringify(
        {
          version: 3,
          generatedAt: Date.now(),
          projectName: 'Bootstrap HTML DS',
          projectProfile: {
            kind: 'html-css',
            screenUnit: {
              sourceGlob: '**/*.html',
              storyRequired: false,
              rootMarker: 'data-sd-screen-root',
            },
            componentModel: 'css-catalog',
            renderProbe: 'static-html',
            htmlDesignSystem: {
              status: 'bootstrap',
              foundRequired: ['design-md'],
              missingRequired: ['tokens-css', 'components-css'],
              sources: [],
            },
          },
          sources: {
            storybookCatalog: false,
            staticScan: true,
            designMd: true,
            componentNotes: false,
            legacyComponentSelectionMap: false,
            lucideFallback: false,
            assetPacks: false,
            iconSources: false,
            externalIconSources: false,
            usageScan: false,
            screenTemplates: false,
          },
          counts: {
            components: 0,
            componentGroups: 0,
            tokens: 0,
            icons: 0,
            assets: 0,
            routes: 0,
            screens: 0,
            examples: 0,
            notes: 0,
            diagnostics: 0,
            usageSnippets: 0,
            usageCards: 0,
            screenTemplates: 0,
          },
          fingerprint: 'bootstrap-html-ds',
          artifacts: { manifest: DESIGN_INDEX_PATHS.manifest },
        },
        null,
        2,
      ),
      'utf8',
    );

    const directive = buildHtmlDesignSystemApplyDirective(['pages/deals.html']);
    const response = await chatStreamRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: `Apply the accepted HTML design system\n\n${directive}`,
          },
        ],
        provider: 'providerA',
        model: 'text-model',
        attachContext: false,
        enableTools: false,
        editorContext: {
          projectName: 'Bootstrap HTML DS',
          workspacePath: workspace,
          activeScreen: {
            id: 'index',
            name: 'Index',
            kind: 'page',
            filePath: 'index.html',
            implementationFilePath: 'index.html',
          },
        },
      }),
    });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('html_design_system_not_connected');
    expect(body.detail).toContain('requires connected HTML design-system sources');
  } finally {
    if (previousConfigPath === undefined) {
      delete process.env.SBER_DESIGNER_CONFIG_PATH;
    } else {
      process.env.SBER_DESIGNER_CONFIG_PATH = previousConfigPath;
    }
    resetConfigCache();
    resetState();
    await rm(workspace, { recursive: true, force: true });
  }
});

test('chat stream rejects carried raster attachments without leaving the screen locked', async () => {
  const previousConfigPath = process.env.SBER_DESIGNER_CONFIG_PATH;
  const workspace = await mkdtemp(join(tmpdir(), 'sd-carried-raster-lock-'));
  const configPath = join(workspace, 'sber-designer.json');
  process.env.SBER_DESIGNER_CONFIG_PATH = configPath;
  await writeFile(
    configPath,
    JSON.stringify(
      {
        agent: { default: { provider: 'providerA', model: 'text-model' } },
        provider: {
          providerA: {
            type: 'openai-compatible',
            name: 'Provider A',
            options: { baseURL: 'http://127.0.0.1:9/v1', apiKey: 'test-key' },
            models: { 'text-model': { name: 'Text model', vision: false } },
          },
        },
        mcpServers: {},
      },
      null,
      2,
    ),
    'utf8',
  );
  await mkdir(join(workspace, '.sber-designer', 'runs', 'run-prev'), { recursive: true });
  await writeFile(
    join(workspace, '.sber-designer', 'runs', 'run-prev', 'continuation-context.json'),
    JSON.stringify(
      {
        version: 1,
        runId: 'run-prev',
        attachments: [
          {
            id: 'att-prev',
            kind: 'image',
            name: 'previous.png',
            mimeType: 'image/png',
            size: 1,
            sha256: 'a'.repeat(64),
            runPath: '.sber-designer/runs/run-prev/attachments/01-previous.png',
            width: 1,
            height: 1,
            sourceKind: 'upload',
          },
        ],
        changedFiles: [],
        lastToolCalls: [],
        runStatus: 'failed',
      },
      null,
      2,
    ),
    'utf8',
  );
  resetState();
  resetConfigCache();
  getAgentRunCoordinator().reset();

  try {
    const requestBody = {
      messages: [
        {
          role: 'assistant',
          content:
            'Previous run failed. continuationContext: .sber-designer/runs/run-prev/continuation-context.json',
        },
        { role: 'user', content: 'Try again without using the image.' },
      ],
      provider: 'providerA',
      model: 'text-model',
      attachContext: false,
      enableTools: false,
      screenId: 'screen-carried-raster',
      editorContext: {
        workspacePath: workspace,
        projectName: 'Carried Raster Project',
        mode: 'interact',
        canvasView: 'screen',
        canvasUrl: '/demo-target/index.html',
      },
    };

    const first = await chatStreamRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const firstBody = (await first.json()) as { error: string };

    expect(first.status).toBe(400);
    expect(firstBody.error).toBe('model_cannot_read_images');
    expect(getAgentRunCoordinator().activeRuns()).toHaveLength(0);

    const second = await chatStreamRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const secondBody = (await second.json()) as { error: string };

    expect(second.status).toBe(400);
    expect(secondBody.error).toBe('model_cannot_read_images');
  } finally {
    if (previousConfigPath === undefined) {
      delete process.env.SBER_DESIGNER_CONFIG_PATH;
    } else {
      process.env.SBER_DESIGNER_CONFIG_PATH = previousConfigPath;
    }
    getAgentRunCoordinator().reset();
    resetState();
    resetConfigCache();
    await rm(workspace, { recursive: true, force: true });
  }
});

test('chat stream allows Codex CLI raster images past API vision preflight', async () => {
  const previousRuntimePath = process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH;
  const runtimeDir = await mkdtemp(join(tmpdir(), 'sd-codex-runtime-empty-'));
  process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH = join(runtimeDir, 'agent-runtimes.json');
  resetState();
  resetConfigCache();

  try {
    const response = await chatStreamRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Draw this screen from the attached image.' }],
        provider: 'codex-runtime',
        model: 'default',
        attachContext: false,
        enableTools: false,
        attachments: [
          {
            id: 'attachment-1',
            kind: 'image',
            name: 'reference.png',
            mimeType: 'image/png',
            size: 1,
            dataUrl: 'data:image/png;base64,AA==',
          },
        ],
        editorContext: {
          mode: 'interact',
          canvasView: 'screen',
          canvasUrl: '/demo-target/index.html',
        },
      }),
    });

    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('runtime_not_connected');
    expect(JSON.stringify(body)).not.toContain('model_cannot_read_images');
  } finally {
    if (previousRuntimePath === undefined) {
      delete process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH;
    } else {
      process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH = previousRuntimePath;
    }
    resetState();
    resetConfigCache();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});

test('chat stream persists terminal run status in server-side session metadata', async () => {
  const previousConfigPath = process.env.SBER_DESIGNER_CONFIG_PATH;
  const workspace = await mkdtemp(join(tmpdir(), 'sd-chat-terminal-status-'));
  const configPath = join(workspace, 'sber-designer.json');
  process.env.SBER_DESIGNER_CONFIG_PATH = configPath;
  await writeFile(
    configPath,
    JSON.stringify(
      {
        agent: { default: { provider: 'mock', model: 'echo' } },
        provider: {
          mock: {
            type: 'mock',
            name: 'Mock',
            models: { echo: { name: 'Echo' } },
          },
        },
        mcpServers: {},
      },
      null,
      2,
    ),
    'utf8',
  );
  await saveProject({
    version: 1,
    name: 'Terminal status project',
    workspacePath: workspace,
    screens: [
      {
        id: 'screen-a',
        name: 'Screen A',
        kind: 'story',
        filePath: 'src/stories/screens/ScreenA.stories.tsx',
        implementationFilePath: 'src/screens/ScreenA.tsx',
      },
    ],
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
          messages: [],
          createdAt: '2026-07-03T00:00:00.000Z',
          updatedAt: '2026-07-03T00:00:00.000Z',
        },
      ],
    },
  });
  resetConfigCache();
  getAgentRunCoordinator().reset();

  try {
    const response = await chatStreamRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Generate the screen.' }],
        provider: 'mock',
        model: 'echo',
        attachContext: false,
        enableTools: false,
        clientRunId: 'client-run-terminal-status',
        sessionId: 'session-a',
        screenId: 'screen-a',
        editorContext: {
          workspacePath: workspace,
          projectName: 'Terminal status project',
          mode: 'interact',
          canvasView: 'screen',
          activeScreen: {
            id: 'screen-a',
            name: 'Screen A',
            kind: 'story',
            filePath: 'src/stories/screens/ScreenA.stories.tsx',
            implementationFilePath: 'src/screens/ScreenA.tsx',
          },
          canvasUrl: '/demo-target/index.html',
        },
      }),
    });

    await response.text();

    expect(response.status).toBe(200);
    const session = getProject().assistant?.sessions.find(
      (candidate) => candidate.id === 'session-a',
    );
    expect(session?.metadata?.lastRunStatus).toBe('failed');
    expect(session?.metadata?.lastRunSummary).toBe(
      'The agent finished without writing the active screen source.',
    );
    expect(session?.metadata?.lastRunManifestPath).toContain('.sber-designer/runs/');
    const runId = session?.metadata?.lastRunManifestPath?.match(
      /runs\/([^/]+)\/run-manifest\.json/u,
    )?.[1];
    expect(runId).toBeTruthy();
    const receipts = await readAgentRunReceipts(workspace, runId ?? '');
    expect(receipts).toContainEqual(
      expect.objectContaining({
        tool: 'run_identity',
        status: 'ok',
        changedFiles: [],
        metadata: expect.objectContaining({
          provider: 'mock',
          model: 'echo',
          runtimeKind: 'api',
          screenName: 'Screen A',
          screenId: 'screen-a',
          contextEligible: false,
        }),
      }),
    );
  } finally {
    if (previousConfigPath === undefined) {
      delete process.env.SBER_DESIGNER_CONFIG_PATH;
    } else {
      process.env.SBER_DESIGNER_CONFIG_PATH = previousConfigPath;
    }
    resetConfigCache();
    getAgentRunCoordinator().reset();
    resetState();
    await rm(workspace, { recursive: true, force: true });
  }
});

test('chat stream blocks Codex generation when the CLI smoke-check reports invalid config', async () => {
  const previousRuntimePath = process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH;
  const runtimeDir = await mkdtemp(join(tmpdir(), 'sd-codex-runtime-config-failure-'));
  process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH = join(runtimeDir, 'agent-runtimes.json');
  const fakeCodex = join(runtimeDir, 'codex-fails-config.js');
  await writeFile(
    fakeCodex,
    [
      '#!/usr/bin/env node',
      'process.stderr.write("Error loading config.toml: unknown variant `priority`, expected `fast` or `flex`\\nin `service_tier`\\n");',
      'process.exit(1);',
      '',
    ].join('\n'),
    'utf8',
  );
  await chmod(fakeCodex, 0o755);
  await writeFile(
    process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH,
    JSON.stringify(
      {
        agentRuntimes: {
          codex: {
            connected: true,
            command: fakeCodex,
            selectedModel: 'default',
            lastDetectedVersion: 'test',
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  resetState();
  resetConfigCache();

  try {
    const response = await chatStreamRouter.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Generate the active screen.' }],
        provider: 'codex-runtime',
        model: 'default',
        attachContext: false,
        enableTools: false,
        editorContext: {
          mode: 'interact',
          canvasView: 'screen',
          canvasUrl: '/demo-target/index.html',
        },
      }),
    });

    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error).toBe('runtime_config_invalid');
    expect(body.detail).toContain('Codex config invalid');
  } finally {
    if (previousRuntimePath === undefined) {
      delete process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH;
    } else {
      process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH = previousRuntimePath;
    }
    resetState();
    resetConfigCache();
    await rm(runtimeDir, { recursive: true, force: true });
  }
});
