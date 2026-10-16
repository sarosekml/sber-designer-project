import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  buildRunEvidenceExportManifest,
  recordComponentPack,
  recordExternalRuntimeContextBundle,
  recordRunTranscript,
} from '../services/api/src/agent/run-record/evidence';
import { completeAgentRun, createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { recordToolReceipt } from '../services/api/src/agent/run-record/receipts';
import { DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';

test('agent run recorder writes manifest, timeline, receipt, and handoff files', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-run-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });

  const run = await createAgentRun({
    route: 'chat',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Run CRM',
    workspacePath: workspace,
    userGoal: 'Make the dashboard KPI cards clearer and verify the changed screen.',
    runtimeKind: 'api',
    targetCapabilities: {
      targetKind: 'api',
      runtimeKind: 'api',
      imageInputMode: 'inline',
      rasterImageInput: true,
      svgSourceInput: true,
      nativeFileInput: false,
      projectMcpTools: true,
      ownMcpConfig: false,
    },
    activeScreen: {
      id: 'screen-dashboard',
      name: 'Dashboard',
      kind: 'story',
      storyId: 'screens-dashboard--default',
      filePath: 'src/stories/Dashboard.stories.tsx',
      implementationFilePath: 'src/screens/Dashboard.tsx',
    },
    assistantTaskIntent: {
      kind: 'edit-current-screen',
      targetScreenId: 'screen-dashboard',
    },
  });

  expect(run.runId.startsWith('run-')).toBe(true);

  const runRoot = join(workspace, '.sber-designer', 'runs', run.runId);
  const manifest = JSON.parse(await readFile(join(runRoot, 'run-manifest.json'), 'utf8'));
  expect(manifest).toMatchObject({
    version: 1,
    runId: run.runId,
    route: 'chat',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Run CRM',
    userGoal: 'Make the dashboard KPI cards clearer and verify the changed screen.',
    status: 'running',
    runtimeKind: 'api',
    targetCapabilities: {
      targetKind: 'api',
      runtimeKind: 'api',
      imageInputMode: 'inline',
      rasterImageInput: true,
      projectMcpTools: true,
      ownMcpConfig: false,
    },
    activeScreen: {
      id: 'screen-dashboard',
      name: 'Dashboard',
      implementationFilePath: 'src/screens/Dashboard.tsx',
    },
    assistantTaskIntent: {
      kind: 'edit-current-screen',
      targetScreenId: 'screen-dashboard',
    },
  });

  const startedEvents = await readTimeline(runRoot);
  expect(startedEvents).toHaveLength(1);
  expect(startedEvents[0]).toMatchObject({
    type: 'run_started',
    runId: run.runId,
    route: 'chat',
  });

  const receipt = await recordToolReceipt({
    workspacePath: workspace,
    runId: run.runId,
    tool: 'write_file',
    status: 'ok',
    changedFiles: ['src/screens/Dashboard.tsx'],
    summary: 'Updated screen implementation.',
    metadata: {
      beforeExists: true,
      afterBytes: 128,
    },
  });

  const receiptFiles = await readdir(join(runRoot, 'receipts'));
  expect(receiptFiles).toEqual([receipt.receiptId + '.json']);
  const savedReceipt = JSON.parse(
    await readFile(join(runRoot, 'receipts', receipt.receiptId + '.json'), 'utf8'),
  );
  expect(savedReceipt).toMatchObject({
    version: 1,
    runId: run.runId,
    receiptId: receipt.receiptId,
    tool: 'write_file',
    status: 'ok',
    changedFiles: ['src/screens/Dashboard.tsx'],
    summary: 'Updated screen implementation.',
  });

  await recordToolReceipt({
    workspacePath: workspace,
    runId: run.runId,
    tool: 'validate_screen_craft',
    status: 'ok',
    changedFiles: ['src/screens/Dashboard.tsx'],
    summary: 'Craft validation passed with no blocking findings.',
    metadata: {
      status: 'ok',
      blocking: 0,
      componentReuse: {
        expected: ['BreadCrumbs', 'PageBar', 'Tile'],
        used: ['Button', 'Card', 'IconButton', 'Text'],
        missing: ['BreadCrumbs', 'PageBar', 'Tile'],
      },
    },
  });

  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'complete',
    summary: 'Screen updated successfully.',
    diagnostics: {
      iterations: 3,
      truncated: false,
      hadErrors: false,
      stoppedAfterPermissionDeny: false,
      finishReason: 'stop',
      attemptId: 'attempt-123',
      attemptLogPath: '/tmp/sber-designer/agent-runs/attempt-123.jsonl',
      debugLogPath: '/tmp/sber-designer/agent-runs/run-123.jsonl',
      runManifestPath: '.sber-designer/runs/run-123/run-manifest.json',
    },
  });

  const finalManifest = JSON.parse(await readFile(join(runRoot, 'run-manifest.json'), 'utf8'));
  expect(finalManifest.status).toBe('complete');
  expect(finalManifest.summary).toBe('Screen updated successfully.');
  expect(finalManifest.metrics).toMatchObject({
    iterations: 3,
  });
  expect(finalManifest.metrics.startedAt).toBe(finalManifest.createdAt);
  expect(finalManifest.metrics.completedAt).toBe(finalManifest.completedAt);
  expect(finalManifest.metrics.durationMs).toBeGreaterThanOrEqual(0);
  expect(finalManifest.diagnostics).toMatchObject({
    iterations: 3,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    finishReason: 'stop',
    attemptId: 'attempt-123',
    attemptLogPath: '/tmp/sber-designer/agent-runs/attempt-123.jsonl',
    debugLogPath: '/tmp/sber-designer/agent-runs/run-123.jsonl',
    runManifestPath: '.sber-designer/runs/run-123/run-manifest.json',
  });

  const finalEvents = await readTimeline(runRoot);
  expect(finalEvents.map((event) => event.type)).toEqual([
    'run_started',
    'tool_receipt',
    'tool_receipt',
    'run_completed',
  ]);

  const handoff = await readFile(join(runRoot, 'handoff.md'), 'utf8');
  expect(handoff).toContain('# Assistant Run Handoff');
  expect(handoff).toContain(`Run: ${run.runId}`);
  expect(handoff).toContain('Project: Run CRM');
  expect(handoff).toContain('Active screen: Dashboard');
  expect(handoff).toContain('## User Goal');
  expect(handoff).toContain('Make the dashboard KPI cards clearer');
  expect(handoff).toContain('## Scope');
  expect(handoff).toContain('## Changed Files');
  expect(handoff).toContain('src/screens/Dashboard.tsx');
  expect(handoff).toContain('## Source / Design Evidence');
  expect(handoff).toContain('## Validation');
  expect(handoff).toContain('validate_screen_craft: ok');
  expect(handoff).toContain('## Component Reuse');
  expect(handoff).toContain('Expected: BreadCrumbs, PageBar, Tile');
  expect(handoff).toContain('Used: Button, Card, IconButton, Text');
  expect(handoff).toContain('Missing: BreadCrumbs, PageBar, Tile');
  expect(handoff).toContain('## Screenshots');
  expect(handoff).toContain('## Open Assumptions');
  expect(handoff).toContain('## Prompt For Next Coding Agent');
  expect(handoff).toContain('Review the run artifacts and continue from this handoff.');
  expect(handoff).toContain('## Machine Artifacts');
  expect(handoff).toContain('Receipts: receipts/');
  expect(handoff).toContain('Attempt log: /tmp/sber-designer/agent-runs/attempt-123.jsonl');
  expect(handoff).toContain('Debug log: /tmp/sber-designer/agent-runs/run-123.jsonl');
  expect(handoff).toContain('Run manifest: .sber-designer/runs/run-123/run-manifest.json');
});

test('agent run manifest snapshots the project profile contract when available', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-run-profile-'));
  await mkdir(join(workspace, '.sber-designer', 'design-index'), { recursive: true });
  await writeFile(
    join(workspace, DESIGN_INDEX_PATHS.projectProfile),
    JSON.stringify(
      {
        kind: 'html-css',
        screenUnit: {
          sourceGlob: '{pages,screens,public,site}/**/*.html',
          storyRequired: false,
          rootMarker: 'data-sd-screen-root',
        },
        componentModel: 'css-catalog',
        renderProbe: 'static-html',
        packageManager: 'unknown',
        frameworks: ['html', 'css'],
        sourceRoots: ['site'],
        styling: ['css'],
        aliases: {},
        packageScripts: {},
        allowedUiPackages: ['project-static-css'],
      },
      null,
      2,
    ),
    'utf8',
  );

  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    workspacePath: workspace,
  });

  expect(run.projectProfile).toMatchObject({
    kind: 'html-css',
    screenUnit: {
      sourceGlob: '{pages,screens,public,site}/**/*.html',
      storyRequired: false,
      rootMarker: 'data-sd-screen-root',
    },
    componentModel: 'css-catalog',
    renderProbe: 'static-html',
    allowedUiPackages: ['project-static-css'],
  });
});

test('agent run recorder writes external runtime context bundle', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-external-runtime-bundle-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'selected-model',
    projectName: 'Runtime CRM',
    workspacePath: workspace,
    userGoal: 'Generate a screen.',
  });

  await recordExternalRuntimeContextBundle({
    workspacePath: workspace,
    runId: run.runId,
    runtimeLabel: 'Codex CLI',
    handoff: {
      prompt: '# sber-designer External Runtime Handoff\n\nPrompt body',
      agentName: 'ai-product-designer',
      skillInventory: [
        {
          name: 'product-screen-generation',
          description: 'Generate screens.',
          whenToUse: 'Use for BRD-to-screen tasks.',
          path: 'skills/product-screen-generation/SKILL.md',
          source: 'default',
        },
      ],
      knowledgeInventory: [
        {
          id: 'project-notes',
          description: 'Project notes.',
          path: 'knowledge/project-notes.md',
          source: 'default',
        },
      ],
      includedKnowledge: ['project-notes'],
      includedTaskHistorySummary: true,
      omittedSections: [{ section: 'instructions', reason: 'Capped.' }],
      estimatedBytes: 1234,
      runtimeWarnings: [],
      stableContextDigest:
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      stableContextBytes: 987,
      kitStableDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      kitStableBytes: 987,
      taskBytes: 321,
      stableContextReuse: 'full',
    },
  });

  const root = join(workspace, '.sber-designer', 'runs', run.runId, 'external-runtime');
  expect(await readFile(join(root, 'prompt.md'), 'utf8')).toContain('Prompt body');
  expect(await readFile(join(root, 'skill-inventory.md'), 'utf8')).toContain(
    'product-screen-generation',
  );
  expect(await readFile(join(root, 'knowledge-inventory.md'), 'utf8')).toContain('project-notes');
  expect(await readFile(join(root, 'context-budget.json'), 'utf8')).toContain('estimatedBytes');
  expect(await readFile(join(root, 'context-budget.json'), 'utf8')).toContain(
    'stableContextDigest',
  );
  expect(await readFile(join(root, 'context-budget.json'), 'utf8')).toContain('kitStableDigest');
  expect(await readFile(join(root, 'context-budget.json'), 'utf8')).toContain('taskBytes');

  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'complete',
    summary: 'Done.',
  });

  const handoff = await readFile(
    join(workspace, '.sber-designer', 'runs', run.runId, 'handoff.md'),
    'utf8',
  );
  expect(handoff).toContain('external-runtime/prompt.md');
  expect(handoff).toContain('external_runtime_context_bundle');
});

test('agent run recorder preserves latest component reuse summary for needs-review runs', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-run-component-reuse-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Run CRM',
    workspacePath: workspace,
    activeScreen: {
      id: 'screen-dcm',
      name: 'DCM draft',
      kind: 'story',
      storyId: 'screens-dcm-draft--default',
      filePath: 'src/stories/DcmDraft.stories.tsx',
      implementationFilePath: 'src/screens/DcmDraft.tsx',
    },
  });

  await recordToolReceipt({
    workspacePath: workspace,
    runId: run.runId,
    tool: 'validate_screen_craft',
    status: 'ok',
    changedFiles: ['src/screens/DcmDraft.tsx'],
    summary: 'Craft validation passed with render evidence still pending.',
    metadata: {
      componentReuse: {
        expected: ['BreadCrumbs', 'Overlay', 'IconButton'],
        used: ['BreadCrumbs', 'Grid', 'IconButton', 'Table'],
        missing: ['Overlay'],
        exact: ['BreadCrumbs', 'IconButton'],
        substituted: [
          {
            role: 'data-table',
            expected: 'Overlay',
            componentId: 'organisms-tables-columnvisibility-overlay',
            used: ['Grid', 'Table'],
          },
        ],
        skipped: [],
        requiredRoles: ['data-table'],
        usedComponentIds: ['organisms-tables-columnvisibility-overlay'],
        missingRequiredRoles: [],
        designSystemGaps: [],
        optionalSkipped: [
          {
            role: 'side-preview',
            expected: 'SidePreview',
            componentId: 'organisms-side-preview',
          },
        ],
        score: { earned: 2.5, total: 3, label: '2.5/3' },
      },
    },
  });

  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'needs_review',
    summary: 'Browser render evidence is unavailable.',
  });

  const finalManifest = JSON.parse(
    await readFile(
      join(workspace, '.sber-designer', 'runs', run.runId, 'run-manifest.json'),
      'utf8',
    ),
  );
  expect(finalManifest.componentReuse).toMatchObject({
    expected: ['BreadCrumbs', 'IconButton', 'Overlay'],
    used: ['BreadCrumbs', 'Grid', 'IconButton', 'Table'],
    missing: ['Overlay'],
    exact: ['BreadCrumbs', 'IconButton'],
    substituted: [
      {
        role: 'data-table',
        expected: 'Overlay',
        used: ['Grid', 'Table'],
      },
    ],
    requiredRoles: ['data-table'],
    usedComponentIds: ['organisms-tables-columnvisibility-overlay'],
    optionalSkipped: [
      {
        role: 'side-preview',
        expected: 'SidePreview',
        componentId: 'organisms-side-preview',
      },
    ],
    score: { label: '2.5/3' },
  });
});

test('agent run recorder persists task-relevant component pack evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-component-pack-run-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Component Pack CRM',
    workspacePath: workspace,
    userGoal: 'Generate a payment screen from image.',
  });

  await recordComponentPack({
    workspacePath: workspace,
    runId: run.runId,
    componentPack: {
      status: 'weak',
      source: 'design-index',
      stale: true,
      taskKind: 'image-to-screen',
      diagnostics: ['Index is stale.'],
      candidates: [
        {
          role: 'breadcrumb',
          componentId: 'molecules-breadcrumbs',
          title: 'Molecules/BreadCrumbs',
          shortName: 'BreadCrumbs',
          importHint: 'src/components/BreadCrumbs.tsx',
          recommendedStoryId: 'molecules-breadcrumbs--default',
          confidence: 'high',
          recordConfidence: 'high',
          score: 18,
          reason: 'Matched breadcrumb via descriptionLayer.purpose.',
          guidance: ['Use BreadCrumbs before raw breadcrumb text.'],
        },
      ],
    },
  });

  const runRoot = join(workspace, '.sber-designer', 'runs', run.runId);
  const savedPack = JSON.parse(await readFile(join(runRoot, 'component-pack.json'), 'utf8'));
  expect(savedPack).toMatchObject({
    status: 'weak',
    taskKind: 'image-to-screen',
    candidates: [expect.objectContaining({ componentId: 'molecules-breadcrumbs' })],
  });

  const receipts = await readdir(join(runRoot, 'receipts'));
  expect(receipts).toHaveLength(1);
  const receipt = JSON.parse(await readFile(join(runRoot, 'receipts', receipts[0] ?? ''), 'utf8'));
  expect(receipt).toMatchObject({
    tool: 'task_relevant_component_pack',
    status: 'ok',
    metadata: {
      path: 'component-pack.json',
      status: 'weak',
      candidateCount: 1,
    },
  });

  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'complete',
    summary: 'Done.',
  });

  const handoff = await readFile(join(runRoot, 'handoff.md'), 'utf8');
  expect(handoff).toContain('component-pack.json');
  expect(handoff).toContain('task_relevant_component_pack');
});

test('agent run recorder persists the final transcript as project-owned run evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-run-transcript-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Transcript CRM',
    workspacePath: workspace,
    userGoal: 'Generate a payment schedule screen.',
  });

  await recordRunTranscript({
    workspacePath: workspace,
    runId: run.runId,
    source: 'chat-stream',
    transcript: [
      { role: 'user', content: 'Generate screen' },
      {
        role: 'assistant',
        content: 'Writing files.',
        toolCalls: [{ id: 'call-1', name: 'write_file', arguments: '{}' }],
      },
      { role: 'tool', toolCallId: 'call-1', content: '{"ok":true}' },
      { role: 'assistant', content: 'Render verification needs review.' },
    ],
  });

  const runRoot = join(workspace, '.sber-designer', 'runs', run.runId);
  const transcriptLines = (await readFile(join(runRoot, 'transcript.jsonl'), 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(transcriptLines).toHaveLength(4);
  expect(transcriptLines[1]).toMatchObject({
    role: 'assistant',
    content: 'Writing files.',
    toolCalls: [{ id: 'call-1', name: 'write_file', arguments: '{}' }],
  });

  const receipts = await readdir(join(runRoot, 'receipts'));
  const receipt = JSON.parse(await readFile(join(runRoot, 'receipts', receipts[0] ?? ''), 'utf8'));
  expect(receipt).toMatchObject({
    tool: 'run_transcript',
    status: 'ok',
    metadata: {
      transcriptPath: 'transcript.jsonl',
      messageCount: 4,
      source: 'chat-stream',
    },
  });

  const exportManifest = await buildRunEvidenceExportManifest(workspace, run.runId);
  expect(exportManifest.artifacts).toContainEqual(
    expect.objectContaining({ kind: 'transcript', path: 'transcript.jsonl', exists: true }),
  );
});

test('agent run recorder builds a folder-like evidence export manifest', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-run-export-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'opencode-runtime',
    model: 'mlproxy/model',
    projectName: 'Evidence CRM',
    workspacePath: workspace,
    userGoal: 'Generate a funds list screen.',
    activeScreen: {
      id: 'funds',
      name: 'Funds',
      kind: 'story',
      storyId: 'screens-funds--default',
      filePath: 'src/stories/Funds.stories.tsx',
      implementationFilePath: 'src/screens/Funds.tsx',
    },
  });

  await recordComponentPack({
    workspacePath: workspace,
    runId: run.runId,
    componentPack: {
      status: 'ready',
      source: 'design-index',
      stale: false,
      taskKind: 'screen-generation',
      diagnostics: [],
      candidates: [
        {
          role: 'data-table',
          componentId: 'organisms-data-grid',
          title: 'Organisms/DataGrid',
          shortName: 'DataGrid',
          importHint: 'src/components/DataGrid.tsx',
          recommendedStoryId: 'organisms-data-grid--default',
          confidence: 'high',
          recordConfidence: 'high',
          score: 18,
          reason: 'Matched data-table via descriptionLayer.purpose.',
          guidance: ['Use DataGrid for dense registry rows.'],
        },
      ],
    },
  });

  await recordExternalRuntimeContextBundle({
    workspacePath: workspace,
    runId: run.runId,
    runtimeLabel: 'OpenCode',
    handoff: {
      prompt: '# Handoff',
      agentName: 'ai-product-designer',
      skillInventory: [],
      knowledgeInventory: [],
      includedKnowledge: [],
      includedTaskHistorySummary: false,
      omittedSections: [],
      estimatedBytes: 42,
      runtimeWarnings: [],
      stableContextDigest:
        'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      stableContextBytes: 42,
      kitStableDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      kitStableBytes: 42,
      taskBytes: 24,
      stableContextReuse: 'full',
    },
  });

  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'complete',
    summary: 'Render validation unavailable.',
    diagnostics: {
      attemptId: 'attempt-export',
      attemptLogPath: '/tmp/sber-designer/agent-runs/attempt-export.jsonl',
      debugLogPath: '/tmp/sber-designer/agent-runs/run-export.jsonl',
      runManifestPath: `.sber-designer/runs/${run.runId}/run-manifest.json`,
    },
  });

  const exportManifest = await buildRunEvidenceExportManifest(workspace, run.runId);

  expect(exportManifest).toMatchObject({
    version: 1,
    runId: run.runId,
    status: 'complete',
    provider: 'opencode-runtime',
    model: 'mlproxy/model',
    runtimeKind: null,
    rootPath: `.sber-designer/runs/${run.runId}`,
    activeScreen: expect.objectContaining({
      id: 'funds',
      name: 'Funds',
    }),
    activeTarget: {
      screenId: 'funds',
      screenName: 'Funds',
      files: ['src/screens/Funds.tsx', 'src/stories/Funds.stories.tsx'],
    },
    diagnostics: expect.objectContaining({
      attemptId: 'attempt-export',
    }),
    receiptSummary: expect.objectContaining({
      total: 2,
      byStatus: { ok: 2 },
      tools: ['external_runtime_context_bundle', 'task_relevant_component_pack'],
    }),
    pendingPermissions: [],
  });
  expect(exportManifest.artifacts).toContainEqual(
    expect.objectContaining({ kind: 'manifest', path: 'run-manifest.json', required: true }),
  );
  expect(exportManifest.artifacts).toContainEqual(
    expect.objectContaining({ kind: 'component-pack', path: 'component-pack.json' }),
  );
  expect(exportManifest.artifacts).toContainEqual(
    expect.objectContaining({
      kind: 'external-runtime',
      path: 'external-runtime/prompt.md',
    }),
  );
  expect(exportManifest.externalLogs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'attempt-log',
        path: '/tmp/sber-designer/agent-runs/attempt-export.jsonl',
      }),
      expect.objectContaining({
        kind: 'debug-log',
        path: '/tmp/sber-designer/agent-runs/run-export.jsonl',
      }),
    ]),
  );
});

test('agent run recorder persists cancelled as a terminal non-failed status', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-run-'));
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    workspacePath: workspace,
  });

  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'cancelled',
    summary: 'Cancelled by user.',
    diagnostics: { finishReason: 'cancelled' },
  });

  const runRoot = join(workspace, '.sber-designer', 'runs', run.runId);
  const manifest = JSON.parse(await readFile(join(runRoot, 'run-manifest.json'), 'utf8'));
  const timeline = await readTimeline(runRoot);

  expect(manifest).toMatchObject({
    status: 'cancelled',
    summary: 'Cancelled by user.',
    diagnostics: { finishReason: 'cancelled' },
  });
  expect(timeline.at(-1)).toMatchObject({
    type: 'run_completed',
    status: 'cancelled',
    summary: 'Cancelled by user.',
  });
});

async function readTimeline(runRoot: string): Promise<Record<string, unknown>[]> {
  const text = await readFile(join(runRoot, 'timeline.jsonl'), 'utf8');
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
