import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ScreenStructurePlan } from '@sber-designer/shared-types';
import { Project } from 'ts-morph';

import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import { buildAgentKitHandoff } from '../services/api/src/agent-runtimes/agent-kit-handoff';
import {
  buildTaskRelevantComponentPack,
  renderTaskRelevantComponentPack,
  type TaskRelevantComponentPack,
} from '../services/api/src/component-intelligence/component-pack';
import {
  recordComponentPack,
  recordScreenStructurePlan,
} from '../services/api/src/agent/run-record/evidence';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import {
  buildScreenStructurePlan,
  renderScreenStructurePlan,
} from '../services/api/src/screen-planning/screen-structure-plan';
import {
  buildRunScreenStructurePlan,
  resolveTaskRelevantComponentTaskKind,
} from '../services/api/src/routes/chat-stream/run-context';
import { patchState, resetState } from '../services/api/src/state-store';
import { analyzeComponentReuse } from '../services/api/src/screen-craft-reuse';

test('0114 B6.2.2 direction-picker continues the original template structure plan', () => {
  const request = `[act-mode] Create a new production-quality screen named "Payments".

User instruction:
Build a compact payment registry with status, filters, and row actions.

Selected template:
## Regions

- **PageHeader** — orient + actions. Role: \`page-header\`. Content: title and create/export actions.
- **Filters** — narrow the set. Role: \`filters\`. Content: search and status controls.
- **Table** — the work surface. Role: \`data-table\`. Content: dense rows with status and row actions.

## States

- Loading: preserve the header.
- Empty: explain how to broaden filters.
- Error: offer retry.`;
  const designBrief = {
    version: 1 as const,
    source: 'direction-picker' as const,
    axes: {
      layout: 'Information-rich overview with clear comparison and status regions',
      density: 'compact' as const,
      constraints: ['Do not use existing screens as layout references.'],
    },
  };
  const directionSelection = {
    version: 1 as const,
    optionId: '2' as const,
    label: 'Operational overview',
    summary: 'Expose status and decision context together.',
  };
  const plan = buildScreenStructurePlan({
    taskKind: 'screen-generation',
    userRequest: request,
    designBrief,
    directionSelection,
    target: {
      screenId: 'screen-payments',
      screenName: 'Payments',
      files: ['src/pages/Payments.tsx'],
    },
  });

  expect(plan).not.toBeNull();
  expect(plan).toMatchObject({
    taskKind: 'screen-generation',
    source: 'direction-picker',
    intent: 'Build a compact payment registry with status, filters, and row actions.',
    target: {
      screenId: 'screen-payments',
      files: ['src/pages/Payments.tsx'],
    },
    constraints: ['Do not use existing screens as layout references.'],
    directionSelection,
  });
  expect(plan?.regions.map((region) => [region.id, region.uiRoles])).toEqual([
    ['pageheader', ['page-header']],
    ['filters', ['filters']],
    ['table', ['data-table']],
  ]);
  expect(plan?.data.some((item) => item.kind === 'collection')).toBe(true);
  expect(plan?.actions.some((item) => item.priority === 'primary')).toBe(true);
  expect(plan?.states.map((item) => item.state)).toEqual(['loading', 'empty', 'error']);
  expect(renderScreenStructurePlan(plan)).toContain(
    'mandatory information-architecture checkpoint',
  );
});

test('modal generation plan carries the managed size and seeds dialog regions', () => {
  const plan = buildScreenStructurePlan({
    taskKind: 'screen-generation',
    userRequest: 'Create a delete confirmation modal.',
    modal: { width: '420px', height: 'auto', longContent: 'scroll' },
  });

  expect(plan).toMatchObject({
    surface: 'modal',
    modal: { width: '420px', height: 'auto', longContent: 'scroll' },
  });
  expect(plan?.regions.map((region) => region.label)).toEqual([
    'Modal header',
    'Modal body',
    'Modal footer actions',
  ]);
  expect(plan?.actions.map((action) => action.priority)).toEqual(['primary', 'secondary']);
  expect(renderScreenStructurePlan(plan)).toContain('- surface: modal');
  expect(renderScreenStructurePlan(plan)).toContain('- modal width: 420px');
});

test('0114 B6.2.2 fill-generated-screen preserves screen-generation task kind', () => {
  const state = {
    canvasView: 'screen' as const,
    activeScreen: {
      id: 'screen-payments',
      name: 'Payments',
      kind: 'story' as const,
      filePath: 'src/stories/screens/Payments.stories.tsx',
      implementationFilePath: 'src/pages/Payments.tsx',
    },
    assistantTaskIntent: {
      kind: 'fill-generated-screen' as const,
      targetScreenId: 'screen-payments',
      targetName: 'Payments',
      targetFolder: 'Payments',
      targetStoryFilePath: 'src/stories/screens/Payments.stories.tsx',
      targetImplementationFilePath: 'src/pages/Payments.tsx',
      targetStoryId: 'screens-payments--default',
    },
  };
  const messages = [{ role: 'user', content: 'Create a payments registry table.' }];
  const taskKind = resolveTaskRelevantComponentTaskKind(state, [], messages[0]!.content);
  const plan = buildRunScreenStructurePlan({
    state,
    messages,
    promptAttachments: [],
    taskKind,
  });

  expect(taskKind).toBe('screen-generation');
  expect(plan).toMatchObject({
    taskKind: 'screen-generation',
    target: {
      screenId: 'screen-payments',
      screenName: 'Payments',
      files: ['src/stories/screens/Payments.stories.tsx', 'src/pages/Payments.tsx'],
    },
  });
});

test('0114 B6.2.2 direction resume recovers screen-generation after transient intent clears', () => {
  const state = {
    canvasView: 'storybook' as const,
    activeScreen: {
      id: 'screen-payment-detail',
      name: 'Payment detail',
      kind: 'story' as const,
      filePath: 'src/stories/screens/PaymentDetail.stories.tsx',
      implementationFilePath: 'src/screens/PaymentDetail.tsx',
    },
    assistantTaskIntent: null,
  };
  const request = `[act-mode] Create a new production-quality screen named "Payment detail".

Target Storybook story:
- storyId: screens-payment-detail--default
- implementation file: src/screens/PaymentDetail.tsx

User instruction:
Create a compact payment detail screen.`;
  const messages = [
    { role: 'user', content: request },
    { role: 'assistant', content: 'Choose one direction.' },
    { role: 'user', content: 'Use direction 2: Operational overview' },
  ];
  const taskKind = resolveTaskRelevantComponentTaskKind(state, [], request);
  const plan = buildRunScreenStructurePlan({
    state,
    messages,
    promptAttachments: [],
    designBrief: {
      version: 1,
      source: 'direction-picker',
      axes: { layout: 'Compact payment detail', mood: '', density: 'compact', constraints: [] },
    },
    directionSelection: {
      version: 1,
      optionId: '2',
      label: 'Operational overview',
      summary: 'Expose decision context.',
    },
    taskKind,
  });

  expect(taskKind).toBe('screen-generation');
  expect(plan).toMatchObject({
    taskKind: 'screen-generation',
    source: 'direction-picker',
    target: { screenId: 'screen-payment-detail', screenName: 'Payment detail' },
  });
  expect(plan?.regions.map((region) => region.id)).toContain('record-summary');
  expect(plan?.regions.flatMap((region) => region.uiRoles)).not.toContain('form-section');
});

test('0114 B6.2.3 dense collection needs become structure-plan roles', () => {
  const plan = buildScreenStructurePlan({
    taskKind: 'screen-generation',
    userRequest:
      'Create a dense registry table with bulk actions for selected rows and a side preview rail.',
  });
  const roles = plan?.regions.flatMap((region) => region.uiRoles) ?? [];

  expect(roles).toContain('mass-actions');
  expect(roles).toContain('side-preview');
});

test('0114 B6.2.3 collection planning requires an explicit row-action cue', () => {
  const statusOnly = buildScreenStructurePlan({
    taskKind: 'screen-generation',
    userRequest: 'Создай компактный реестр договоров со статусами и пагинацией.',
  });
  const withRowActions = buildScreenStructurePlan({
    taskKind: 'screen-generation',
    userRequest: 'Создай компактный реестр договоров со статусами и действиями в строке.',
  });

  expect(statusOnly?.regions.flatMap((region) => region.uiRoles)).toContain('status-badge');
  expect(statusOnly?.regions.flatMap((region) => region.uiRoles)).not.toContain('row-actions');
  expect(withRowActions?.regions.flatMap((region) => region.uiRoles)).toContain('row-actions');
});

test('0114 B6.2.4 negative Grid mention does not invent collection structure', () => {
  const plan = buildScreenStructurePlan({
    taskKind: 'screen-generation',
    userRequest: 'Создай простой профиль клиента. Не используй Grid.',
  });
  const roles = plan?.regions.flatMap((region) => region.uiRoles) ?? [];

  expect(roles).not.toContain('data-table');
  expect(roles).not.toContain('mass-actions');
  expect(roles).not.toContain('side-preview');
});

test('0114 B6.2.2 structure plan is durable run evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0114-structure-plan-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Planning fixture',
    workspacePath: workspace,
    userGoal: 'Create a payments registry.',
  });
  const plan = registryPlan();

  await recordScreenStructurePlan({ workspacePath: workspace, runId: run.runId, plan });

  const runRoot = join(workspace, '.sber-designer', 'runs', run.runId);
  const artifact = JSON.parse(await readFile(join(runRoot, 'screen-structure-plan.json'), 'utf8'));
  expect(artifact).toEqual(plan);
  const receipts = await readdir(join(runRoot, 'receipts'));
  expect(receipts).toHaveLength(1);
  const receipt = JSON.parse(await readFile(join(runRoot, 'receipts', receipts[0]!), 'utf8'));
  expect(receipt).toMatchObject({
    tool: 'screen_structure_plan',
    status: 'ok',
    metadata: {
      path: 'screen-structure-plan.json',
      taskKind: 'screen-generation',
      regionCount: 3,
      actionCount: 2,
      stateCount: 3,
    },
  });
});

test('0114 B6.2.2 API and CLI prompts order map, structure plan, then hydration', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0114-structure-prompt-'));
  const plan = registryPlan();
  const componentPack = componentPackFixture();

  resetState();
  try {
    patchState({ projectName: 'Planning fixture', workspacePath: workspace, canvasView: 'screen' });
    const api = await buildSystemPrompt({
      taskKind: 'screen-generation',
      userRequest: 'Create a payments registry.',
      componentPack,
      screenStructurePlan: plan,
    });
    expectOrderedPlanningSections(api.text);
  } finally {
    resetState();
  }

  resetAgentKitCache();
  const kit = await loadAgentKit();
  const cli = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [{ role: 'user', content: 'Create a payments registry.' }],
    state: { projectName: 'Planning fixture', workspacePath: workspace, canvasView: 'screen' },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-0114-screen-structure-plan',
    componentPack,
    screenStructurePlan: plan,
  });
  expectOrderedPlanningSections(cli.prompt);
  expect(cli.screenStructurePlan).toEqual(plan);
});

test('0114 B6.2.3 structure roles drive uncapped selection and explicit DS gaps', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0114-uncapped-selection-'));
  const indexRoot = join(workspace, '.sber-designer', 'design-index');
  await mkdir(indexRoot, { recursive: true });
  const roleComponents = Array.from({ length: 15 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    return {
      id: `need-${number}`,
      title: `Fixture/Need${number}`,
      shortName: `Need${number}`,
      filePath: `src/components/Need${number}.tsx`,
      source: 'react-index',
      storyCount: 0,
      stories: [],
      description: `Purpose for need ${number}.`,
      tags: [`need-${number}`],
      groupIds: [],
      noteCount: 0,
      confidence: 'high',
    };
  });
  const button = {
    id: 'button',
    title: 'Fixture/Button',
    shortName: 'Button',
    filePath: 'src/components/Button.tsx',
    source: 'react-index',
    storyCount: 0,
    stories: [],
    description: 'Explicit user action control.',
    tags: ['button', 'action'],
    groupIds: [],
    noteCount: 0,
    confidence: 'high',
  };
  await writeFile(
    join(indexRoot, 'components.jsonl'),
    [...roleComponents, button].map((component) => JSON.stringify(component)).join('\n'),
    'utf8',
  );
  const plan: ScreenStructurePlan = {
    version: 1,
    taskKind: 'screen-generation',
    source: 'request',
    intent: 'Build a role-heavy operational screen.',
    regions: [
      ...Array.from({ length: 15 }, (_, index) => {
        const number = String(index + 1).padStart(2, '0');
        return {
          id: `region-${number}`,
          label: `Region ${number}`,
          purpose: `Purpose for need ${number}.`,
          uiRoles: [`need-${number}`],
          required: true,
        };
      }),
      {
        id: 'missing-region',
        label: 'Missing role',
        purpose: 'No matching project control exists.',
        uiRoles: ['missing-special'],
        required: true,
      },
    ],
    data: [],
    actions: [],
    states: [],
    constraints: [],
    assumptions: [],
  };

  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: workspace,
    taskKind: 'screen-generation',
    userRequest: 'Use component Button. Build the planned operational screen.',
    screenStructurePlan: plan,
  });

  expect(pack.candidates).toHaveLength(16);
  expect(pack.candidates.length).toBeGreaterThan(12);
  expect(pack.candidates[0]).toMatchObject({ shortName: 'Button', userRequired: true });
  expect(pack.selectionPlan).toMatchObject({
    source: 'screen-structure-plan',
    plannedRoles: [
      'need-01',
      'need-02',
      'need-03',
      'need-04',
      'need-05',
      'need-06',
      'need-07',
      'need-08',
      'need-09',
      'need-10',
      'need-11',
      'need-12',
      'need-13',
      'need-14',
      'need-15',
      'missing-special',
    ],
    gaps: [{ role: 'missing-special', regionIds: ['missing-region'] }],
  });
  expect(pack.status).toBe('weak');
  const usedSource = `export function ComplexScreen() { return <main><Button />${Array.from(
    { length: 15 },
    (_, index) => `<Need${String(index + 1).padStart(2, '0')} />`,
  ).join('')}</main>; }`;
  const usedFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(
    'ComplexScreen.tsx',
    usedSource,
  );
  const reuse = analyzeComponentReuse(usedSource, usedFile, 'src/ComplexScreen.tsx', pack);
  expect(reuse.summary.usedComponentIds.length).toBeGreaterThan(12);
  expect(reuse.summary.usedComponentIds).toEqual(
    expect.arrayContaining(roleComponents.map((component) => component.id)),
  );
  const rendered = renderTaskRelevantComponentPack(pack);
  expect(rendered).toContain('selectionSource: screen-structure-plan');
  expect(rendered).toContain('designSystemGapCount: 1');
  expect(rendered).toContain('missing-special; regions: missing-region');

  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Uncapped selection fixture',
    workspacePath: workspace,
    userGoal: 'Build the planned operational screen.',
  });
  await recordComponentPack({ workspacePath: workspace, runId: run.runId, componentPack: pack });
  const receipts = await readdir(join(workspace, '.sber-designer', 'runs', run.runId, 'receipts'));
  const receipt = JSON.parse(
    await readFile(
      join(workspace, '.sber-designer', 'runs', run.runId, 'receipts', receipts[0]!),
      'utf8',
    ),
  );
  expect(receipt).toMatchObject({
    tool: 'task_relevant_component_pack',
    metadata: {
      candidateCount: 16,
      selectionSource: 'screen-structure-plan',
      plannedRoleCount: 16,
      gapCount: 1,
      gapRoles: ['missing-special'],
    },
  });
});

function expectOrderedPlanningSections(prompt: string): void {
  const mapIndex = prompt.indexOf('## Project Component Selection Map');
  const planIndex = prompt.indexOf('## Screen Structure Plan');
  const packIndex = prompt.indexOf('## Task-Relevant Component Pack');
  expect(mapIndex).toBeGreaterThanOrEqual(0);
  expect(planIndex).toBeGreaterThan(mapIndex);
  expect(packIndex).toBeGreaterThan(planIndex);
}

function registryPlan(): ScreenStructurePlan {
  return {
    version: 1,
    taskKind: 'screen-generation',
    source: 'request',
    intent: 'Create a payments registry.',
    regions: [
      {
        id: 'page-header',
        label: 'Page header',
        purpose: 'Orient the user and carry collection actions.',
        uiRoles: ['page-header'],
        required: true,
      },
      {
        id: 'filters',
        label: 'Filters',
        purpose: 'Search and narrow the payment set.',
        uiRoles: ['filters'],
        required: true,
      },
      {
        id: 'collection',
        label: 'Collection',
        purpose: 'Scan payment rows, statuses, and row actions.',
        uiRoles: ['data-table', 'status-badge', 'row-actions'],
        required: true,
      },
    ],
    data: [
      {
        id: 'collection-data',
        regionId: 'collection',
        kind: 'collection',
        description: 'Payment rows and status.',
        source: 'request',
      },
    ],
    actions: [
      {
        id: 'page-primary',
        regionId: 'page-header',
        label: 'Create payment',
        priority: 'primary',
        source: 'request',
      },
      {
        id: 'row-action',
        regionId: 'collection',
        label: 'Open payment',
        priority: 'row',
        source: 'request',
      },
    ],
    states: ['loading', 'empty', 'error'].map((state) => ({
      id: `state-${state}`,
      state: state as 'loading' | 'empty' | 'error',
      regionId: 'collection',
      source: 'request' as const,
    })),
    constraints: [],
    assumptions: [],
  };
}

function componentPackFixture(): TaskRelevantComponentPack {
  return {
    status: 'ready',
    source: 'design-index',
    stale: false,
    taskKind: 'screen-generation',
    diagnostics: [],
    selectionMap: {
      version: 1,
      generatedAt: 123,
      indexFingerprint: 'planning-fixture',
      counts: { indexed: 1, described: 1, diverged: 0 },
      source: 'artifact',
      stale: false,
      entries: [
        {
          componentId: 'data-table',
          publicName: 'DataTable',
          title: 'Organisms/DataTable',
          sourcePath: 'src/components/DataTable.tsx',
          source: 'react-index',
          purpose: 'Dense collection work surface.',
          roles: ['data-table'],
          capabilities: ['sorting'],
          keywords: ['table', 'registry'],
          whenToUse: ['Use for operational collections.'],
          whenNotToUse: [],
          descriptionStatus: 'authored',
          evidenceConfidence: 'high',
          variantAxes: [],
        },
      ],
    },
    candidates: [
      {
        role: 'data-table',
        componentId: 'data-table',
        title: 'Organisms/DataTable',
        shortName: 'DataTable',
        confidence: 'high',
        recordConfidence: 'high',
        score: 20,
        reason: 'Matched the planned collection region.',
        guidance: ['Use for operational collections.'],
      },
    ],
  };
}
