import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ScreenStructurePlan } from '@sber-designer/shared-types';

import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import { buildAgentKitHandoff } from '../services/api/src/agent-runtimes/agent-kit-handoff';
import { recordComponentPack } from '../services/api/src/agent/run-record/evidence';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import {
  buildTaskRelevantComponentPack,
  renderTaskRelevantComponentPack,
} from '../services/api/src/component-intelligence/component-pack';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { componentPackRunSummary } from '../services/api/src/routes/chat-stream/run-context';
import { patchState, resetState } from '../services/api/src/state-store';

test('0114 B6.2.6 resolves source-backed variants, props, imports, and excludes divergence', async () => {
  const root = await createResolutionWorkspace();
  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-generation',
    userRequest: 'Show the paid state with success tone.',
    screenStructurePlan: resolutionPlan(),
  });

  const candidate = pack.candidates.find((item) => item.componentId === 'status-chip');
  expect(candidate).toBeDefined();
  expect(candidate?.publicImport).toEqual({
    name: 'StatusChip',
    module: '@acme/ui',
    verified: true,
    evidence: 'confirmed-usage',
  });
  expect(candidate?.variantHints).toEqual(['state: paid | pending', 'tone: success | warning']);
  expect(candidate?.requiredProps).toEqual(['state', 'label']);
  expect(candidate?.snippet?.sourcePath).toBe('src/screens/Payments.tsx');
  expect(candidate?.snippet?.code).not.toContain('danger');

  const resolution = candidate?.resolution;
  expect(resolution).toMatchObject({
    status: 'resolved',
    chosenVariants: [
      {
        prop: 'state',
        value: 'paid',
        allowedBy: 'source-type',
        selectedBy: 'task-intent',
      },
      {
        prop: 'tone',
        value: 'success',
        allowedBy: 'source-type',
        selectedBy: 'task-intent',
      },
    ],
    divergedFields: ['variantGuidance', 'requiredProps', 'canonicalSnippets'],
    excludedAuthoredFacts: [
      'descriptionLayer.variantGuidance',
      'descriptionLayer.requiredProps',
      'descriptionLayer.canonicalSnippets',
    ],
  });
  expect(resolution?.criticalProps).toContainEqual({
    name: 'state',
    required: true,
    value: 'paid',
    evidence: 'source-type',
    evidenceRef: 'Matched run intent for state.',
  });
  expect(resolution?.criticalProps).toContainEqual({
    name: 'label',
    required: true,
    value: 'Paid',
    evidence: 'source-type',
    evidenceRef: 'src/screens/Payments.tsx',
  });
  expect(resolution?.criticalProps.some((prop) => prop.name === 'ghost')).toBe(false);
  expect(pack.selectionPlan?.resolutions).toEqual([resolution]);

  const rendered = renderTaskRelevantComponentPack(pack);
  expect(rendered).toContain('resolved public import: `StatusChip` from `@acme/ui`');
  expect(rendered).toContain('chosen variant: state=`paid`');
  expect(rendered).toContain('chosen variant: tone=`success`');
  expect(rendered).toContain('diverged authored facts excluded:');
  expect(rendered).not.toContain('tone=`danger`');
  expect(rendered).not.toContain('ghost (required)');

  resetState();
  try {
    patchState({ projectName: 'Resolution fixture', workspacePath: root, canvasView: 'screen' });
    const api = await buildSystemPrompt({
      taskKind: 'screen-generation',
      userRequest: 'Show the paid state with success tone.',
      componentPack: pack,
      screenStructurePlan: resolutionPlan(),
    });
    expect(api.text).toContain('chosen variant: state=`paid`');
    expect(api.text).toContain('resolved public import: `StatusChip` from `@acme/ui`');
  } finally {
    resetState();
  }

  resetAgentKitCache();
  const kit = await loadAgentKit();
  const cli = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [{ role: 'user', content: 'Show the paid state with success tone.' }],
    state: { projectName: 'Resolution fixture', workspacePath: root, canvasView: 'screen' },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-0114-component-resolution',
    componentPack: pack,
    screenStructurePlan: resolutionPlan(),
  });
  expect(cli.prompt).toContain('chosen variant: tone=`success`');
  expect(cli.prompt).toContain('diverged authored facts excluded:');

  expect(componentPackRunSummary(pack)).toMatchObject({
    workspaceFreshness: pack.stale ? 'stale' : 'current',
    selectedCount: 1,
    hydratedCount: 1,
    resolvedComponentCount: 1,
    partialResolutionCount: 0,
    unverifiedResolutionCount: 0,
    selections: [
      {
        role: 'status-badge',
        componentId: 'status-chip',
        componentName: 'StatusChip',
        reason: expect.any(String),
        regionIds: ['summary'],
        required: true,
        hydrated: true,
        hydrationBatchIds: expect.any(Array),
        resolutionStatus: 'resolved',
        variants: ['state=paid', 'tone=success'],
      },
    ],
  });

  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Resolution fixture',
    workspacePath: root,
    userGoal: 'Show the paid state with success tone.',
  });
  await recordComponentPack({ workspacePath: root, runId: run.runId, componentPack: pack });
  const receiptRoot = join(root, '.sber-designer', 'runs', run.runId, 'receipts');
  const receiptNames = await readdir(receiptRoot);
  const receipt = JSON.parse(await readFile(join(receiptRoot, receiptNames[0]!), 'utf8'));
  expect(receipt.metadata).toMatchObject({
    componentResolutionCount: 1,
    resolvedComponentCount: 1,
    partialResolutionCount: 0,
    unverifiedResolutionCount: 0,
  });
  expect(receipt.metadata.componentResolutions[0]).toMatchObject({
    componentId: 'status-chip',
    chosenVariants: [
      { prop: 'state', value: 'paid' },
      { prop: 'tone', value: 'success' },
    ],
  });
});

async function createResolutionWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0114-component-resolution-'));
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });
  await mkdir(join(root, 'src', 'components', 'StatusChip'), { recursive: true });
  await mkdir(join(root, 'src', 'screens'), { recursive: true });
  await writeFile(
    join(root, 'src', 'components', 'StatusChip', 'StatusChip.tsx'),
    [
      'export interface StatusChipProps {',
      "  state: 'paid' | 'pending';",
      "  tone?: 'success' | 'warning';",
      '  label: string;',
      '}',
      'export function StatusChip(props: StatusChipProps) {',
      '  return <span>{props.label}</span>;',
      '}',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'StatusChip', 'index.ts'),
    "export { StatusChip } from './StatusChip';\n",
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'screens', 'Payments.tsx'),
    [
      "import { StatusChip } from '@acme/ui';",
      'export function Payments() {',
      '  return <StatusChip state="paid" tone="success" label="Paid" />;',
      '}',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    JSON.stringify({
      id: 'status-chip',
      title: 'Atoms/StatusChip',
      shortName: 'StatusChip',
      filePath: 'src/components/StatusChip/index.ts',
      source: 'react-index',
      storyCount: 0,
      stories: [],
      description: 'Operational status badge state indicator.',
      descriptionLayer: {
        purpose: 'Operational status badge state indicator.',
        anatomy: ['root', 'label'],
        usage: [{ title: 'Status', when: 'Use for payment status.' }],
        agentGuidance: ['Use for compact operational statuses.'],
        variantGuidance: [
          {
            prop: 'tone',
            values: [{ value: 'danger', meaning: 'Authored but absent from source.' }],
          },
        ],
        requiredProps: ['ghost'],
        canonicalSnippets: [{ code: '<StatusChip state="failed" tone="danger" ghost="true" />' }],
      },
      tags: ['status', 'badge', 'state', 'indicator'],
      groupIds: [],
      noteCount: 0,
      confidence: 'high',
    }),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.usageCards),
    JSON.stringify({
      componentId: 'status-chip',
      publicImport: { name: 'StatusChip', module: 'src/components/StatusChip/index.ts' },
      purpose: 'Operational status badge state indicator.',
      whenToUse: ['Use for payment status.'],
      whenNotToUse: [],
      variantGuidance: [
        {
          prop: 'state',
          values: [
            { value: 'paid', meaning: '' },
            { value: 'pending', meaning: '' },
          ],
          source: 'ts-union',
        },
        {
          prop: 'tone',
          values: [
            { value: 'success', meaning: '' },
            { value: 'warning', meaning: '' },
            { value: 'danger', meaning: 'Authored overlay absent from source.' },
          ],
          source: 'ts-union',
        },
      ],
      propsThatMatter: [
        { name: 'state', note: 'required prop' },
        { name: 'label', note: 'required prop' },
        { name: 'ghost', note: 'required prop' },
      ],
      snippets: [
        {
          code: '<StatusChip state="failed" tone="danger" ghost="true" />',
          sourcePath: '.sber-designer/components/status-chip.md',
          label: 'diverged authored snippet',
          source: 'description-layer',
        },
        {
          code: '<StatusChip state="paid" tone="success" label="Paid" />',
          sourcePath: 'src/screens/Payments.tsx',
          label: 'screen usage · 3x',
          source: 'mined-usage',
        },
      ],
      pairsWith: [],
      usageCount: 3,
      visualRefs: [],
      facts: [],
    }),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.screens),
    JSON.stringify({
      id: 'payments',
      name: 'Payments',
      implementationPath: 'src/screens/Payments.tsx',
    }),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.diagnostics),
    JSON.stringify({
      diagnostics: [
        {
          level: 'warning',
          filePath: 'src/components/StatusChip/index.ts',
          message:
            'description-diverged: status-chip has divergent variantGuidance, requiredProps, canonicalSnippets between sidecar and design-system surface. Sidecar layer is used.',
        },
      ],
    }),
    'utf8',
  );
  return root;
}

function resolutionPlan(): ScreenStructurePlan {
  return {
    version: 1,
    taskKind: 'screen-generation',
    source: 'request',
    intent: 'Show the paid payment state with success tone.',
    regions: [
      {
        id: 'summary',
        label: 'Payment summary',
        purpose: 'Show a paid operational status.',
        uiRoles: ['status-badge'],
        required: true,
      },
    ],
    data: [],
    actions: [],
    states: [{ id: 'success', state: 'success', regionId: 'summary', source: 'request' }],
    constraints: [],
    assumptions: [],
  };
}
