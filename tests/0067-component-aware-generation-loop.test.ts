import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ComponentCatalog } from '@sber-designer/shared-types';

import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import { buildAgentKitHandoff } from '../services/api/src/agent-runtimes/agent-kit-handoff';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';
import {
  buildTaskRelevantComponentPack,
  renderTaskRelevantComponentPack,
} from '../services/api/src/component-intelligence/component-pack';
import { validateScreenCraft } from '../services/api/src/screen-craft';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { patchState, resetState } from '../services/api/src/state-store';

test('component pack selects task-relevant project components from index records and seed notes', async () => {
  const root = await createComponentPackWorkspace();

  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'image-to-screen',
    userRequest:
      'Recreate the administration page with breadcrumb, page header, sections, and white panels.',
  });

  expect(pack).toMatchObject({
    status: 'ready',
    source: 'design-index',
    stale: true,
    taskKind: 'image-to-screen',
  });
  expect(pack.candidates.map((candidate) => candidate.componentId)).toEqual(
    expect.arrayContaining([
      'molecules-breadcrumbs',
      'molecules-pagebar',
      'atoms-header-dashboardgroupheader',
      'molecules-tiles-tile',
    ]),
  );
  expect(pack.candidates).toContainEqual(
    expect.objectContaining({
      role: 'breadcrumb',
      componentId: 'molecules-breadcrumbs',
      confidence: 'high',
      recommendedStoryId: 'molecules-breadcrumbs--default',
    }),
  );
  expect(pack.candidates).toContainEqual(
    expect.objectContaining({
      role: 'content-panel',
      componentId: 'molecules-tiles-tile',
      confidence: 'low',
    }),
  );

  const rendered = renderTaskRelevantComponentPack(pack);
  expect(rendered).toContain('## Task-Relevant Component Pack');
  expect(rendered).toContain('Use these project components before creating raw markup');
  expect(rendered).toContain('BreadCrumbs');
  expect(rendered).toContain('PageBar');
  expect(rendered).toContain('DashboardGroupHeader');
  expect(rendered).toContain('Tile');
  expect(rendered).toContain('Inspect the active implementation file');
});

test('component pack prioritizes dense workflow components for registry screens', async () => {
  const root = await createComponentPackWorkspace();

  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-generation',
    userRequest:
      'Generate a dense funds list with filters, mass actions, data table rows, and side preview.',
  });

  expect(pack.candidates).toContainEqual(
    expect.objectContaining({
      role: 'data-table',
      componentId: 'organisms-data-grid',
      confidence: 'high',
    }),
  );
  expect(pack.candidates).toContainEqual(
    expect.objectContaining({
      role: 'filters',
      componentId: 'molecules-filter-bar',
      confidence: 'high',
    }),
  );
  expect(pack.candidates).toContainEqual(
    expect.objectContaining({
      role: 'mass-actions',
      componentId: 'molecules-bulk-action-bar',
      confidence: 'high',
    }),
  );
  expect(pack.candidates).toContainEqual(
    expect.objectContaining({
      role: 'side-preview',
      componentId: 'organisms-side-preview',
      confidence: 'high',
    }),
  );
});

test('0114 structured brief requires positive components and excludes forbidden ones', async () => {
  const root = await createComponentPackWorkspace();
  await mkdir(join(root, 'src', 'screens'), { recursive: true });
  await writeFile(
    join(root, 'src', 'screens', 'RequiredTile.tsx'),
    [
      "import { Card } from '../components/Card';",
      'export function RequiredTile() {',
      '  return <main><Card><h2>Клиент</h2></Card></main>;',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeScreenIndex(root, {
    id: 'required-tile',
    name: 'Required Tile',
    implementationPath: 'src/screens/RequiredTile.tsx',
  });

  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-generation',
    userRequest: 'Создай экран сделки с карточками.',
    designBrief: {
      version: 1,
      source: 'mini-form',
      axes: {
        constraints: ['Используй компонент Tile для карточек', 'Не используй компонент DataGrid'],
      },
    },
  });
  const tile = pack.candidates.find((candidate) => candidate.shortName === 'Tile');
  expect(tile).toMatchObject({ userRequired: true });
  expect(pack.candidates.some((candidate) => candidate.shortName === 'DataGrid')).toBe(false);
  expect(pack.diagnostics).toContain('Explicit user constraint excludes component: DataGrid.');

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'required-tile' },
    componentPack: pack,
  });
  expect(result.status).toBe('blocked');
  expect(result.findings).toContainEqual(
    expect.objectContaining({
      severity: 'blocking',
      ruleId: 'craft.component-reuse.required-component-missing',
    }),
  );
});

test('0114 component pack does not expose screen-derived references when the brief forbids them', async () => {
  const root = await createComponentPackWorkspace();
  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-generation',
    userRequest: 'Создай новый экран сделки.',
    designBrief: {
      version: 1,
      source: 'mini-form',
      axes: { constraints: ['Не используй текущие экраны проекта'] },
    },
  });

  expect(pack.screenReferencePolicy).toBe('forbidden');
  expect(pack.importConventions).toBeUndefined();
  expect(pack.candidates.every((candidate) => candidate.snippet === undefined)).toBe(true);
  const rendered = renderTaskRelevantComponentPack(pack);
  expect(rendered).toContain('do not inspect or derive layout');
  expect(rendered).not.toContain('one nearby example');
});

test('component pack prefers public barrel component names over internal implementation aliases', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-0067-public-barrel-'));
  await mkdir(join(root, '.sber-designer/design-index'), { recursive: true });
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    [
      JSON.stringify({
        id: 'static-src-components-molecules-SectionHeader-index-ts-SectionHeader',
        title: 'Molecules/SectionHeader',
        shortName: 'SectionHeader',
        filePath: 'src/components/molecules/SectionHeader/index.ts',
        storyCount: 1,
        stories: [{ id: 'molecules-section-header--default', name: 'Default' }],
        tags: ['section', 'header'],
        groupIds: [],
        noteCount: 0,
        confidence: 'high',
        descriptionLayer: {
          purpose: 'Section header group header dashboard group content section label divider.',
          anatomy: ['root', 'title'],
          usage: [{ title: 'SectionHeader', when: 'Use for section headers.' }],
          agentGuidance: ['Use SectionHeader for section labels.'],
        },
      }),
      JSON.stringify({
        id: 'static-src-components-molecules-Card-Card-tsx-BaseCard',
        title: 'Molecules/Card/BaseCard',
        shortName: 'BaseCard',
        filePath: 'src/components/molecules/Card/Card.tsx',
        storyCount: 1,
        stories: [{ id: 'molecules-card--default', name: 'Default' }],
        tags: ['card', 'surface'],
        groupIds: [],
        noteCount: 0,
        confidence: 'low',
        descriptionLayer: {
          purpose: 'Implementation-local card surface.',
          anatomy: ['root'],
          usage: [{ title: 'BaseCard', when: 'Card surface' }],
          agentGuidance: ['Implementation source for the card surface.'],
        },
      }),
      JSON.stringify({
        id: 'static-src-components-molecules-Card-index-ts-Card',
        title: 'Molecules/Card',
        shortName: 'Card',
        filePath: 'src/components/molecules/Card/index.ts',
        storyCount: 1,
        stories: [{ id: 'molecules-card--default', name: 'Default' }],
        tags: ['card', 'surface', 'panel'],
        groupIds: [],
        noteCount: 0,
        confidence: 'medium',
        descriptionLayer: {
          purpose: 'White panel content surface card tile.',
          anatomy: ['root', 'content'],
          usage: [{ title: 'Card', when: 'Use for card and panel surfaces.' }],
          agentGuidance: ['Use Card for reusable panel surfaces.'],
        },
      }),
      '',
    ].join('\n'),
    'utf8',
  );

  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-generation',
    userRequest: 'Generate a DCM deal card with white content panels.',
  });

  expect(pack.candidates).toContainEqual(
    expect.objectContaining({
      componentId: 'static-src-components-molecules-Card-index-ts-Card',
      shortName: 'Card',
    }),
  );
  expect(pack.candidates).not.toContainEqual(
    expect.objectContaining({
      componentId: 'static-src-components-molecules-Card-Card-tsx-BaseCard',
    }),
  );

  const rendered = renderTaskRelevantComponentPack(pack);
  expect(rendered).toContain('Public import contract');
  expect(rendered).toContain('`Card`');
  expect(rendered).toContain('src/components/molecules/Card/index.ts');
});

test('component pack covers common screen roles beyond the first five candidates', async () => {
  const root = await createComponentPackWorkspace();

  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-edit',
    userRequest: 'Repair badges, action buttons, body text, and links in the active screen.',
  });

  expect(pack.candidates).toContainEqual(
    expect.objectContaining({
      role: 'actions',
      componentId: 'atoms-button',
      confidence: 'high',
    }),
  );
  expect(pack.candidates).toContainEqual(
    expect.objectContaining({
      role: 'status-badge',
      componentId: 'atoms-status-badge',
      confidence: 'high',
    }),
  );
  expect(pack.candidates).toContainEqual(
    expect.objectContaining({
      role: 'typography',
      componentId: 'atoms-text',
      confidence: 'high',
    }),
  );
  expect(pack.candidates).toContainEqual(
    expect.objectContaining({
      role: 'link',
      componentId: 'atoms-link',
      confidence: 'high',
    }),
  );
});

test('API system prompt includes the task-relevant component pack from the connected project', async () => {
  const root = await createComponentPackWorkspace();
  resetState();
  try {
    patchState({
      projectName: 'IBP UI Kit Fixture',
      workspacePath: root,
      canvasView: 'screen',
    });

    const prompt = await buildSystemPrompt({ taskKind: 'image-to-screen' });

    expect(prompt.text).toContain('## Task-Relevant Component Pack');
    expect(prompt.text).toContain('BreadCrumbs');
    expect(prompt.text).toContain('PageBar');
    expect(prompt.text).toContain('DashboardGroupHeader');
    expect(prompt.text).toContain('Tile');
  } finally {
    resetState();
  }
});

test('external CLI handoff includes the same task-relevant component pack inline', async () => {
  const root = await createComponentPackWorkspace();
  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'image-to-screen',
    userRequest: 'Recreate the administration page from the attached image.',
  });
  resetAgentKitCache();
  const kit = await loadAgentKit();

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [{ role: 'user', content: 'Recreate the administration page from the image.' }],
    state: {
      projectName: 'IBP UI Kit Fixture',
      workspacePath: root,
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-0067',
    componentPack: pack,
  });

  expect(result.prompt).toContain('## Task-Relevant Component Pack');
  expect(result.prompt).toContain('Use these project components before creating raw markup');
  expect(result.prompt).toContain('BreadCrumbs');
  expect(result.prompt).toContain('PageBar');
  expect(result.prompt).toContain('DashboardGroupHeader');
  expect(result.prompt).toContain('Tile');
});

test('screen craft flags primitive-heavy output when task-relevant components are missing', async () => {
  const root = await createComponentPackWorkspace();
  await mkdir(join(root, 'src', 'screens'), { recursive: true });
  await writeFile(
    join(root, 'src', 'screens', 'Administration.tsx'),
    [
      'import { Paper } from "../components/Paper";',
      'import { SxBox } from "../components/SxBox";',
      '',
      'export function Administration() {',
      '  return (',
      '    <main>',
      '      <SxBox>Главная</SxBox>',
      '      <h1>Администрирование</h1>',
      '      <Paper>',
      '        <h2>Справочники</h2>',
      '        <h3>Сотрудники</h3>',
      '        <a>Департаменты</a>',
      '      </Paper>',
      '      <Paper>',
      '        <h2>Бизнес-данные</h2>',
      '        <a>Города</a>',
      '      </Paper>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.screens),
    [
      JSON.stringify({
        id: 'admin',
        name: 'Administration',
        implementationPath: 'src/screens/Administration.tsx',
        designReadableStatus: 'candidate',
        source: 'project-file',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'image-to-screen',
    userRequest: 'Recreate the administration page from the attached image.',
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'admin' },
    componentPack: pack,
  });

  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.component-reuse.missing-breadcrumb' }),
  );
  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.component-reuse.missing-page-header' }),
  );
  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.component-reuse.missing-section-header' }),
  );
  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.component-reuse.missing-tile' }),
  );
  expect(result.componentReuse).toMatchObject({
    expected: expect.arrayContaining(['BreadCrumbs', 'PageBar', 'DashboardGroupHeader', 'Tile']),
    used: expect.arrayContaining(['Paper', 'SxBox']),
    missing: expect.arrayContaining(['BreadCrumbs', 'PageBar', 'DashboardGroupHeader', 'Tile']),
  });
});

test('screen craft flags partial component reuse when semantic page components are missing', async () => {
  const root = await createComponentPackWorkspace();
  await mkdir(join(root, 'src', 'screens'), { recursive: true });
  await writeFile(
    join(root, 'src', 'screens', 'PaymentPage.tsx'),
    [
      'import { Button } from "../components/Button";',
      'import { Card } from "../components/Card";',
      'import { IconButton } from "../components/IconButton";',
      'import { Text } from "../components/Text";',
      '',
      'export function PaymentPage() {',
      '  return (',
      '    <main>',
      '      <Text>Главная / Реестр платежей / Платеж от 30.07.2024</Text>',
      '      <div>',
      '        <h1>Платеж от 30.07.2024</h1>',
      '        <Button>В реестр</Button>',
      '        <IconButton aria-label="More actions" />',
      '      </div>',
      '      <Card><h2>Сумма</h2><Text>5 792 800,29 руб.</Text></Card>',
      '      <Card><h2>Контрагент</h2><Text>ООО "Ромашка"</Text></Card>',
      '      <Card><h2>Документы</h2><Text>Договор № 3764</Text></Card>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeScreenIndex(root, {
    id: 'payment',
    name: 'Payment page',
    implementationPath: 'src/screens/PaymentPage.tsx',
  });
  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'image-to-screen',
    userRequest: 'Recreate the payment page from the attached image.',
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'payment' },
    componentPack: pack,
  });

  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.component-reuse.missing-breadcrumb' }),
  );
  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.component-reuse.missing-page-header' }),
  );
  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.component-reuse.missing-section-header' }),
  );
  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.component-reuse.missing-tile' }),
  );
  expect(result.componentReuse).toMatchObject({
    expected: expect.arrayContaining(['BreadCrumbs', 'PageBar', 'DashboardGroupHeader', 'Tile']),
    used: expect.arrayContaining(['Button', 'Card', 'IconButton', 'Text']),
    missing: expect.arrayContaining(['BreadCrumbs', 'PageBar', 'DashboardGroupHeader', 'Tile']),
    score: {
      earned: 0.5,
      total: 4,
      label: '0.5/4',
    },
    substituted: [
      expect.objectContaining({
        role: 'content-panel',
        expected: 'Tile',
        used: ['Card'],
      }),
    ],
    skipped: expect.arrayContaining([
      expect.objectContaining({ role: 'breadcrumb', expected: 'BreadCrumbs' }),
      expect.objectContaining({ role: 'page-header', expected: 'PageBar' }),
      expect.objectContaining({ role: 'section-header', expected: 'DashboardGroupHeader' }),
    ]),
  });
});

test('screen craft accepts screens that use task-relevant semantic components', async () => {
  const root = await createComponentPackWorkspace();
  await mkdir(join(root, 'src', 'screens'), { recursive: true });
  await writeFile(
    join(root, 'src', 'screens', 'PaymentPageSemantic.tsx'),
    [
      'import { BreadCrumbs } from "../components/BreadCrumbs";',
      'import { PageBar } from "../components/PageBar";',
      'import { DashboardGroupHeader } from "../components/DashboardGroupHeader";',
      'import { Tile } from "../components/Tile";',
      '',
      'export function PaymentPageSemantic() {',
      '  return (',
      '    <main>',
      '      <BreadCrumbs />',
      '      <PageBar title="Платеж от 30.07.2024" />',
      '      <DashboardGroupHeader title="Сумма" />',
      '      <Tile />',
      '      <DashboardGroupHeader title="Документы" />',
      '      <Tile />',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeScreenIndex(root, {
    id: 'payment-semantic',
    name: 'Payment page semantic',
    implementationPath: 'src/screens/PaymentPageSemantic.tsx',
  });
  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'image-to-screen',
    userRequest: 'Recreate the payment page from the attached image.',
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'payment-semantic' },
    componentPack: pack,
  });

  expect(result.findings).not.toContainEqual(
    expect.objectContaining({ ruleId: expect.stringContaining('craft.component-reuse') }),
  );
  expect(result.componentReuse).toMatchObject({
    expected: expect.arrayContaining(['BreadCrumbs', 'PageBar', 'DashboardGroupHeader', 'Tile']),
    used: expect.arrayContaining(['BreadCrumbs', 'PageBar', 'DashboardGroupHeader', 'Tile']),
    missing: [],
    score: {
      earned: 4,
      total: 4,
      label: '4/4',
    },
    exact: expect.arrayContaining(['BreadCrumbs', 'PageBar', 'DashboardGroupHeader', 'Tile']),
    substituted: [],
    skipped: [],
  });
});

test('screen craft flags raw dense table markup when indexed table components are available', async () => {
  const root = await createComponentPackWorkspace();
  await mkdir(join(root, 'src', 'screens'), { recursive: true });
  await writeFile(
    join(root, 'src', 'screens', 'FundsList.tsx'),
    [
      'export function FundsList() {',
      '  const rows = ["Fund A", "Fund B", "Fund C"];',
      '  return (',
      '    <main>',
      '      <h1>Funds list</h1>',
      '      <div className="filters">',
      '        <input placeholder="Search funds" />',
      '        <button>Apply filters</button>',
      '      </div>',
      '      <div className="flex flex-col">',
      '        {rows.map((row) => (',
      '          <div className="flex row" key={row}>',
      '            <span>{row}</span>',
      '            <span>Assets</span>',
      '            <button>Open preview</button>',
      '          </div>',
      '        ))}',
      '      </div>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeScreenIndex(root, {
    id: 'funds-list',
    name: 'Funds list',
    implementationPath: 'src/screens/FundsList.tsx',
  });
  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-generation',
    userRequest:
      'Generate a dense funds list with filters, mass actions, data table rows, and side preview.',
  });

  const result = await validateScreenCraft({
    workspaceRoot: root,
    screen: { screenId: 'funds-list' },
    componentPack: pack,
  });

  expect(result.findings).toContainEqual(
    expect.objectContaining({ ruleId: 'craft.component-family.missing-data-table' }),
  );
  expect(result.componentReuse).toMatchObject({
    expected: expect.arrayContaining(['DataGrid', 'FilterBar', 'BulkActionBar', 'SidePreview']),
    missing: expect.arrayContaining(['DataGrid']),
  });
});

test('component pack prefers table organisms over layout grids for dense screen-edit requests', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-0067-dense-pack-'));
  await mkdir(join(root, '.sber-designer/design-index'), { recursive: true });
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    [
      JSON.stringify({
        id: 'atoms-gridtiles-grid',
        title: 'Atoms/GridTiles/Grid',
        shortName: 'Grid',
        filePath: 'src/components/atoms/gridTiles/Grid/Grid.stories.tsx',
        description: 'Layout grid for tile cards and responsive rows.',
        tags: ['table', 'grid', 'rows'],
        groupIds: ['tables-lists'],
        stories: [{ id: 'atoms-gridtiles-grid--default', name: 'Default' }],
        noteCount: 0,
        confidence: 'high',
      }),
      JSON.stringify({
        id: 'organisms-table-basic',
        title: 'Organisms/Tables/Basic',
        shortName: 'Basic',
        filePath: 'src/components/organisms/Tables/Table.stories.tsx',
        description: 'Table organism for rows, columns, sorting, and pagination.',
        tags: ['table', 'columns', 'pagination'],
        groupIds: ['organisms', 'tables'],
        stories: [{ id: 'organisms-table-basic--default', name: 'Default' }],
        noteCount: 0,
        confidence: 'high',
      }),
      JSON.stringify({
        id: 'atoms-dictionarybadge',
        title: 'Atoms/DictionaryBadge',
        shortName: 'DictionaryBadge',
        filePath: 'src/components/atoms/DictionaryBadge/DictionaryBadge.stories.tsx',
        description: 'Dictionary status badge chip marker for workflow statuses.',
        tags: ['status', 'badge', 'chip'],
        groupIds: ['badges'],
        stories: [{ id: 'atoms-dictionarybadge--default', name: 'Default' }],
        noteCount: 0,
        confidence: 'high',
      }),
      JSON.stringify({
        id: 'molecules-bulk-action-bar',
        title: 'Molecules/BulkActionBar',
        shortName: 'BulkActionBar',
        filePath: 'src/components/molecules/BulkActionBar/BulkActionBar.stories.tsx',
        description: 'Mass actions bulk action bar for selected table rows.',
        tags: ['mass actions', 'bulk actions', 'selected rows'],
        groupIds: ['toolbar'],
        stories: [{ id: 'molecules-bulk-action-bar--default', name: 'Default' }],
        noteCount: 0,
        confidence: 'high',
      }),
      '',
    ].join('\n'),
    'utf8',
  );

  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-edit',
    userRequest:
      'Generate payment schedule registry with table rows, filters, status chips, and pagination.',
  });
  const dataTable = pack.candidates.find((candidate) => candidate.role === 'data-table');
  const statusBadge = pack.candidates.find((candidate) => candidate.role === 'status-badge');
  const massActions = pack.candidates.find((candidate) => candidate.role === 'mass-actions');

  expect(dataTable?.componentId).toBe('organisms-table-basic');
  expect(statusBadge?.componentId).toBe('atoms-dictionarybadge');
  expect(massActions?.componentId).toBe('molecules-bulk-action-bar');
});

async function createComponentPackWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0067-component-pack-'));
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await mkdir(join(root, '.sber-designer/design-index'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ scripts: { dev: 'vite --host 0.0.0.0' } }, null, 2),
    'utf8',
  );
  for (const name of [
    'BreadCrumbs',
    'PageBar',
    'DashboardGroupHeader',
    'Tile',
    'DataGrid',
    'FilterBar',
    'BulkActionBar',
    'SidePreview',
    'Button',
    'StatusBadge',
    'Text',
    'Link',
    'Navigation',
    'Tabs',
  ]) {
    await writeFile(
      join(root, 'src', 'components', `${name}.tsx`),
      `export function ${name}() { return null; }`,
      'utf8',
    );
  }
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.agentNotes),
    [
      JSON.stringify({
        id: 'note-tile-seed',
        targetType: 'component',
        targetId: 'molecules-tiles-tile',
        note: 'Use Tile for white content panel surfaces before creating raw Paper or SxBox panels.',
        intent: 'prefer',
        source: 'agent',
        createdAt: 1,
        updatedAt: 1,
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  await generateProjectDesignIndexFiles(root, {
    projectName: 'IBP UI Kit Fixture',
    catalog: componentCatalogFixture(),
  });
  return root;
}

async function writeScreenIndex(
  root: string,
  screen: { id: string; name: string; implementationPath: string },
): Promise<void> {
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.screens),
    [
      JSON.stringify({
        id: screen.id,
        name: screen.name,
        implementationPath: screen.implementationPath,
        designReadableStatus: 'candidate',
        source: 'project-file',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
}

function componentCatalogFixture(): ComponentCatalog {
  return {
    source: 'static',
    generatedAt: Date.now(),
    components: [
      componentWithDescriptionLayer({
        id: 'molecules-breadcrumbs',
        title: 'Molecules/BreadCrumbs',
        shortName: 'BreadCrumbs',
        filePath: 'src/components/BreadCrumbs.tsx',
        storyId: 'molecules-breadcrumbs--default',
        purpose: 'Breadcrumb trail for page hierarchy and navigation context.',
        guidance: 'Use BreadCrumbs before creating raw breadcrumb text.',
      }),
      componentWithDescriptionLayer({
        id: 'molecules-pagebar',
        title: 'Molecules/PageBar',
        shortName: 'PageBar',
        filePath: 'src/components/PageBar.tsx',
        storyId: 'molecules-pagebar--default',
        purpose: 'Page header with page title, subtitle, and primary actions.',
        guidance: 'Use PageBar for page title/action regions.',
      }),
      componentWithDescriptionLayer({
        id: 'atoms-header-dashboardgroupheader',
        title: 'Atoms/Header/DashboardGroupHeader',
        shortName: 'DashboardGroupHeader',
        filePath: 'src/components/DashboardGroupHeader.tsx',
        storyId: 'atoms-header-dashboardgroupheader--default',
        purpose: 'Section header for dashboard groups and content sections.',
        guidance: 'Use DashboardGroupHeader for section labels before content blocks.',
      }),
      {
        id: 'molecules-tiles-tile',
        title: 'Molecules/Tiles/Tile',
        shortName: 'Tile',
        filePath: 'src/components/Tile.tsx',
        stories: [{ id: 'molecules-tiles-tile--default', name: 'Default' }],
      },
      componentWithDescriptionLayer({
        id: 'organisms-data-grid',
        title: 'Organisms/DataGrid',
        shortName: 'DataGrid',
        filePath: 'src/components/DataGrid.tsx',
        storyId: 'organisms-data-grid--default',
        purpose: 'Dense data table grid for registry list rows and column scanning.',
        guidance: 'Use DataGrid for funds, assets, registries, and row-heavy operational tables.',
      }),
      componentWithDescriptionLayer({
        id: 'molecules-filter-bar',
        title: 'Molecules/FilterBar',
        shortName: 'FilterBar',
        filePath: 'src/components/FilterBar.tsx',
        storyId: 'molecules-filter-bar--default',
        purpose: 'Filter and search controls for dense registry screens.',
        guidance: 'Use FilterBar before creating raw search inputs and filter buttons.',
      }),
      componentWithDescriptionLayer({
        id: 'molecules-bulk-action-bar',
        title: 'Molecules/BulkActionBar',
        shortName: 'BulkActionBar',
        filePath: 'src/components/BulkActionBar.tsx',
        storyId: 'molecules-bulk-action-bar--default',
        purpose: 'Mass actions toolbar for selected table rows.',
        guidance: 'Use BulkActionBar for multi-select row actions and batch operations.',
      }),
      componentWithDescriptionLayer({
        id: 'organisms-side-preview',
        title: 'Organisms/SidePreview',
        shortName: 'SidePreview',
        filePath: 'src/components/SidePreview.tsx',
        storyId: 'organisms-side-preview--default',
        purpose: 'Side preview rail for selected list or table row details.',
        guidance: 'Use SidePreview for master-detail table workflows.',
      }),
      componentWithDescriptionLayer({
        id: 'atoms-button',
        title: 'Atoms/Button',
        shortName: 'Button',
        filePath: 'src/components/Button.tsx',
        storyId: 'atoms-button--default',
        purpose: 'Action button for primary and secondary screen actions.',
        guidance: 'Use Button for visible action commands before raw button markup.',
      }),
      componentWithDescriptionLayer({
        id: 'atoms-status-badge',
        title: 'Atoms/StatusBadge',
        shortName: 'StatusBadge',
        filePath: 'src/components/StatusBadge.tsx',
        storyId: 'atoms-status-badge--default',
        purpose: 'Status badge tag chip state indicator for workflow status labels.',
        guidance: 'Use StatusBadge for semantic states before raw colored spans.',
      }),
      componentWithDescriptionLayer({
        id: 'atoms-text',
        title: 'Atoms/Text',
        shortName: 'Text',
        filePath: 'src/components/Text.tsx',
        storyId: 'atoms-text--default',
        purpose: 'Text typography body caption title heading label.',
        guidance: 'Use Text for body copy, captions, labels, and compact headings.',
      }),
      componentWithDescriptionLayer({
        id: 'atoms-link',
        title: 'Atoms/Link',
        shortName: 'Link',
        filePath: 'src/components/Link.tsx',
        storyId: 'atoms-link--default',
        purpose: 'Link anchor text navigation link for inline navigation.',
        guidance: 'Use Link for textual navigation and related record links.',
      }),
      componentWithDescriptionLayer({
        id: 'organisms-navigation',
        title: 'Organisms/Navigation',
        shortName: 'Navigation',
        filePath: 'src/components/Navigation.tsx',
        storyId: 'organisms-navigation--default',
        purpose: 'Navigation sidebar menu for primary application sections.',
        guidance: 'Use Navigation for sidebars and menu regions before raw lists.',
      }),
      componentWithDescriptionLayer({
        id: 'molecules-tabs',
        title: 'Molecules/Tabs',
        shortName: 'Tabs',
        filePath: 'src/components/Tabs.tsx',
        storyId: 'molecules-tabs--default',
        purpose: 'Tabs segmented navigation for switching page sections.',
        guidance: 'Use Tabs for segmented navigation instead of raw link rows.',
      }),
    ],
  };
}

function componentWithDescriptionLayer(input: {
  id: string;
  title: string;
  shortName: string;
  filePath: string;
  storyId: string;
  purpose: string;
  guidance: string;
}): ComponentCatalog['components'][number] {
  return {
    id: input.id,
    title: input.title,
    shortName: input.shortName,
    filePath: input.filePath,
    descriptionLayer: {
      purpose: input.purpose,
      anatomy: ['root', 'content'],
      usage: [{ title: input.shortName, when: input.purpose }],
      agentGuidance: [input.guidance],
    },
    stories: [{ id: input.storyId, name: 'Default' }],
  };
}
