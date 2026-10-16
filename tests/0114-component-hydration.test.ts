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
import { patchState, resetState } from '../services/api/src/state-store';

test('0114 B6.2.5 selected contracts hydrate in region-aware byte batches', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-0114-component-hydration-'));
  const indexRoot = join(root, '.sber-designer', 'design-index');
  await mkdir(indexRoot, { recursive: true });
  const components = Array.from({ length: 8 }, (_, index) => componentRecord(index + 1));
  const cards = Array.from({ length: 8 }, (_, index) => usageCard(index + 1));
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    components.map((record) => JSON.stringify(record)).join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.usageCards),
    cards.map((record) => JSON.stringify(record)).join('\n'),
    'utf8',
  );
  const plan = hydrationPlan();
  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-generation',
    userRequest: 'Build the planned multi-region workspace.',
    screenStructurePlan: plan,
    hydrationBatchByteBudget: 3_000,
  });

  expect(pack.candidates).toHaveLength(8);
  expect(pack.candidates.every((candidate) => candidate.regionIds?.length === 1)).toBe(true);
  const hydration = pack.hydrationManifest!;
  expect(hydration).toMatchObject({
    strategy: 'region-byte-batches',
    batchBudgetBytes: 3_000,
    hydratedComponentIds: components.map((component) => component.id),
  });
  expect(hydration.batches.length).toBeGreaterThanOrEqual(4);
  expect(hydration.batches.every((batch) => batch.regionIds.length === 1)).toBe(true);
  expect(hydration.batches.every((batch) => batch.byteSize <= 3_000 && !batch.oversized)).toBe(
    true,
  );
  expect(hydration.totalBytes).toBe(
    hydration.batches.reduce((total, batch) => total + batch.byteSize, 0),
  );
  const rendered = renderTaskRelevantComponentPack(pack);
  expect(rendered).toContain('strategy: region-byte-batches');
  expect(rendered).toContain('hydrationBatchBudgetBytes: 3000');
  expect(rendered).toContain('contract-01');
  expect(rendered).toContain('contract-08');

  resetState();
  try {
    patchState({ projectName: 'Hydration fixture', workspacePath: root, canvasView: 'screen' });
    const api = await buildSystemPrompt({
      taskKind: 'screen-generation',
      userRequest: 'Build the planned multi-region workspace.',
      componentPack: pack,
      screenStructurePlan: plan,
    });
    expect(api.text).toContain('hydration-region-4');
    expect(api.text).toContain('contract-08');
  } finally {
    resetState();
  }

  resetAgentKitCache();
  const kit = await loadAgentKit();
  const cli = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [{ role: 'user', content: 'Build the planned multi-region workspace.' }],
    state: { projectName: 'Hydration fixture', workspacePath: root, canvasView: 'screen' },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-0114-component-hydration',
    componentPack: pack,
    screenStructurePlan: plan,
  });
  expect(cli.prompt).toContain('hydration-region-4');
  expect(cli.prompt).toContain('contract-08');

  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Hydration fixture',
    workspacePath: root,
    userGoal: 'Build the planned multi-region workspace.',
  });
  await recordComponentPack({ workspacePath: root, runId: run.runId, componentPack: pack });
  const receiptRoot = join(root, '.sber-designer', 'runs', run.runId, 'receipts');
  const receiptNames = await readdir(receiptRoot);
  const receipt = JSON.parse(await readFile(join(receiptRoot, receiptNames[0]!), 'utf8'));
  expect(receipt).toMatchObject({
    tool: 'task_relevant_component_pack',
    metadata: {
      hydrationStrategy: 'region-byte-batches',
      hydrationBatchBudgetBytes: 3_000,
      hydratedCount: 8,
      hydrationBatchCount: hydration.batches.length,
      hydrationBytes: hydration.totalBytes,
    },
  });
  expect(receipt.metadata.hydrationBatches).toHaveLength(hydration.batches.length);
});

function componentRecord(index: number) {
  const number = String(index).padStart(2, '0');
  return {
    id: `need-${number}`,
    title: `Fixture/Need${number}`,
    shortName: `Need${number}`,
    filePath: `src/components/Need${number}.tsx`,
    source: 'react-index',
    storyCount: 0,
    stories: [],
    description: `Detailed component for need ${number}.`,
    tags: [`need-${number}`],
    groupIds: [],
    noteCount: 0,
    confidence: 'high',
  };
}

function usageCard(index: number) {
  const number = String(index).padStart(2, '0');
  const publicName = `Need${number}`;
  return {
    componentId: `need-${number}`,
    publicImport: { name: publicName, module: '@/components' },
    purpose: `Detailed contract for need ${number}.`,
    whenToUse: [`Use ${publicName} for the need ${number} region.`],
    whenNotToUse: ['Do not substitute unrelated raw markup.'],
    variantGuidance: [],
    propsThatMatter: [{ name: 'value', note: 'required prop' }],
    snippets: [
      {
        code: `<${publicName} value="contract-${number}">\n  {/* ${'x'.repeat(700)} */}\n</${publicName}>`,
        sourcePath: `src/examples/${publicName}Example.tsx`,
        label: `contract-${number}`,
        source: 'mined-usage',
      },
    ],
    pairsWith: [],
    usageCount: 1,
    visualRefs: [],
    facts: [],
  };
}

function hydrationPlan(): ScreenStructurePlan {
  return {
    version: 1,
    taskKind: 'screen-generation',
    source: 'request',
    intent: 'Build a multi-region operational workspace.',
    regions: Array.from({ length: 4 }, (_, regionIndex) => {
      const first = String(regionIndex * 2 + 1).padStart(2, '0');
      const second = String(regionIndex * 2 + 2).padStart(2, '0');
      return {
        id: `region-${regionIndex + 1}`,
        label: `Region ${regionIndex + 1}`,
        purpose: `Carry needs ${first} and ${second}.`,
        uiRoles: [`need-${first}`, `need-${second}`],
        required: true,
      };
    }),
    data: [],
    actions: [],
    states: [],
    constraints: [],
    assumptions: [],
  };
}
