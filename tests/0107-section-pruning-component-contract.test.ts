import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import type { ComponentCatalog } from '@sber-designer/shared-types';
import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import type { LoadedAgentKit } from '../services/api/src/agent-kit/loader';
import { buildAgentKitHandoff } from '../services/api/src/agent-runtimes/agent-kit-handoff';
import {
  buildTaskRelevantComponentPack,
  renderTaskRelevantComponentPack,
  type TaskRelevantComponentPack,
} from '../services/api/src/component-intelligence/component-pack';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { patchState, resetState } from '../services/api/src/state-store';

const kit: LoadedAgentKit = {
  defaultAgent: {
    name: 'ai-product-designer',
    description: 'Design production screens.',
    mode: 'primary',
    hidden: false,
    path: 'packages/agent-kit/kit/agents/ai-product-designer.md',
    source: 'default',
    body: 'Use project components and the design index before inventing markup.',
    permissionPolicy: {
      tools: { allow: ['*'], deny: [] },
      skills: { allow: ['*'], deny: [] },
    },
    permission: {},
  },
  agents: [],
  skills: [],
  knowledge: [],
  scripts: [],
  instructions: [],
  diagnostics: [],
};

const catalog: ComponentCatalog = {
  source: 'static',
  generatedAt: Date.now(),
  components: [
    {
      id: 'atoms-status-chip',
      title: 'Atoms/StatusChip',
      shortName: 'StatusChip',
      filePath: 'src/components/StatusChip.tsx',
      description: 'Payment status chip.',
      stories: [],
    },
  ],
};

const promptSummary = [
  '## Design system context',
  '',
  '### DESIGN.md',
  '',
  '#### Typography',
  'Use compact labels and tabular figures.',
  '',
  '#### Color',
  'Status chips use semantic success and warning tokens.',
  '',
  '#### Marketing Hero',
  'Use billboard-scale immersive imagery and campaign copy.',
  '',
  '### component-selection-map.md',
  '',
  '#### Tables',
  'Registry screens should start with DataTable and FilterBar.',
].join('\n');

const descriptionMap = {
  entries: [
    {
      componentId: 'atoms-status-chip',
      shortName: 'StatusChip',
      keywords: ['status', 'chip', 'payments'],
      status: 'authored',
      docsRef: { sourcePath: 'src/components/StatusChip.tsx' },
      coverageScore: 0.83,
    },
    {
      componentId: 'organisms-marketing-hero',
      shortName: 'MarketingHero',
      keywords: ['marketing', 'hero', 'campaign'],
      status: 'authored',
      docsRef: { sourcePath: 'src/components/MarketingHero.tsx' },
      coverageScore: 1,
    },
  ],
};

async function createD3IndexedWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0107-d3-'));
  await generateProjectDesignIndexFiles(root, {
    projectName: 'Payments Console',
    catalog,
  });
  await writeFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.promptSummary), promptSummary, 'utf8');
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.descriptionMap),
    `${JSON.stringify(descriptionMap, null, 2)}\n`,
    'utf8',
  );
  return root;
}

test('D3 handoff prunes project index summary to task-relevant design sections', () => {
  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [
      {
        role: 'user',
        content:
          'Create a dense payments registry screen with table rows, filters, and status chips.',
      },
    ],
    state: {
      projectName: 'Payments Console',
      workspacePath: '/workspace',
      activeScreen: {
        id: 'screen-payments',
        name: 'Payments',
        kind: 'story',
        filePath: 'src/screens/Payments.stories.tsx',
        implementationFilePath: 'src/screens/Payments.tsx',
      },
    },
    kit,
    agentRunId: 'run-d3',
    projectIndex: {
      status: 'valid',
      stale: false,
      promptSummary: [
        '## Design system context',
        '',
        '### DESIGN.md',
        '',
        '#### Typography',
        'Use compact labels and tabular figures.',
        '',
        '#### Color',
        'Status chips use semantic success and warning tokens.',
        '',
        '#### Marketing Hero',
        'Use billboard-scale immersive imagery and campaign copy.',
        '',
        '### component-selection-map.md',
        '',
        '#### Tables',
        'Registry screens should start with DataTable and FilterBar.',
      ].join('\n'),
      counts: {
        components: 12,
        usageCards: 8,
        describedComponents: 4,
      },
      artifacts: [
        '.sber-designer/design-index/description-map.json',
        '.sber-designer/design-index/usage-cards.jsonl',
      ],
      descriptionMap: [
        {
          componentId: 'atoms-status-chip',
          shortName: 'StatusChip',
          keywords: ['status', 'chip', 'payments'],
          status: 'authored',
          docsRef: { sourcePath: 'src/components/StatusChip.tsx' },
          coverageScore: 0.83,
        },
        {
          componentId: 'organisms-marketing-hero',
          shortName: 'MarketingHero',
          keywords: ['marketing', 'hero', 'campaign'],
          status: 'authored',
          docsRef: { sourcePath: 'src/components/MarketingHero.tsx' },
          coverageScore: 1,
        },
      ],
    },
  });

  expect(result.prompt).toContain('### Project Index Summary (Task-Relevant Sections)');
  expect(result.prompt).toContain('#### Typography');
  expect(result.prompt).toContain('#### Color');
  expect(result.prompt).toContain('#### Tables');
  expect(result.prompt).not.toContain('#### Marketing Hero');
  expect(result.prompt).not.toContain('billboard-scale immersive imagery');
  expect(result.prompt).toContain('### Component Description Map (Task-Relevant)');
  expect(result.prompt).toContain('StatusChip');
  expect(result.prompt).toContain('src/components/StatusChip.tsx');
  expect(result.prompt).not.toContain('MarketingHero');
  expect(result.prompt).toContain('.sber-designer/design-index/description-map.json');
});

test('D3 API system prompt uses the same task-relevant project index context', async () => {
  const root = await createD3IndexedWorkspace();
  resetState();
  try {
    patchState({
      projectName: 'Payments Console',
      workspacePath: root,
      canvasView: 'screen',
      activeScreen: {
        id: 'screen-payments',
        name: 'Payments',
        kind: 'story',
        filePath: 'src/screens/Payments.stories.tsx',
        implementationFilePath: 'src/screens/Payments.tsx',
      },
    });

    const result = await buildSystemPrompt({
      taskKind: 'screen-generation',
      userRequest: 'Create a dense payments registry screen with table rows and status chips.',
    });

    expect(result.text).toContain('### Project Index Summary (Task-Relevant Sections)');
    expect(result.text).toContain('#### Typography');
    expect(result.text).toContain('#### Tables');
    expect(result.text).not.toContain('#### Marketing Hero');
    expect(result.text).toContain('### Component Description Map (Task-Relevant)');
    expect(result.text).toContain('StatusChip');
    expect(result.text).not.toContain('MarketingHero');
  } finally {
    resetState();
  }
});

test('D3 section pruning maps Russian task terms to matching project-index sections', () => {
  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [
      {
        role: 'user',
        content: 'Сделай экран списка сделок с таблицей, фильтрами и статусами.',
      },
    ],
    state: {
      projectName: 'Investment CRM',
      workspacePath: '/workspace',
      activeScreen: {
        id: 'screen-deals',
        name: 'Deals',
        kind: 'story',
        filePath: 'src/screens/Deals.stories.tsx',
        implementationFilePath: 'src/screens/Deals.tsx',
      },
    },
    kit,
    agentRunId: 'run-d3-ru',
    projectIndex: {
      status: 'valid',
      stale: false,
      promptSummary: [
        '## Design system context',
        '',
        '### DESIGN.md',
        '',
        '#### Typography',
        'Use compact labels and tabular figures.',
        '',
        '#### Deals',
        'Deal pages use pipeline stage, issuer, client and documents sections.',
        '',
        '#### Tables',
        'Registry screens should start with DataTable and FilterBar.',
        '',
        '#### Marketing Hero',
        'Use billboard-scale campaign copy.',
      ].join('\n'),
      descriptionMap: [
        {
          componentId: 'organisms-deal-table',
          shortName: 'DealTable',
          keywords: ['deal', 'table', 'status', 'filter'],
          status: 'authored',
          docsRef: { sourcePath: 'src/components/DealTable.tsx' },
          coverageScore: 1,
        },
        {
          componentId: 'organisms-marketing-hero',
          shortName: 'MarketingHero',
          keywords: ['marketing', 'hero', 'campaign'],
          status: 'authored',
          docsRef: { sourcePath: 'src/components/MarketingHero.tsx' },
          coverageScore: 1,
        },
      ],
    },
  });

  expect(result.prompt).toContain('#### Deals');
  expect(result.prompt).toContain('#### Tables');
  expect(result.prompt).toContain('DealTable');
  expect(result.prompt).not.toContain('#### Marketing Hero');
  expect(result.prompt).not.toContain('MarketingHero');
});

test('D3 component pack renderer promotes prop contracts and canonical snippets', () => {
  const pack: TaskRelevantComponentPack = {
    status: 'ready',
    source: 'design-index',
    stale: false,
    taskKind: 'screen-generation',
    diagnostics: [],
    candidates: [
      {
        role: 'status-badge',
        componentId: 'atoms-status-chip',
        title: 'StatusChip',
        shortName: 'StatusChip',
        importHint: 'src/components/status/index.ts',
        confidence: 'high',
        recordConfidence: 'high',
        score: 42,
        reason: 'Matched status-badge via roleFit.',
        guidance: ['Use for operational payment status only.'],
        variantHints: ['tone: success (paid) | warning (pending) | danger (failed)'],
        requiredProps: ['status', 'tone'],
        snippet: {
          sourcePath: 'src/screens/Payments.tsx',
          code: '<StatusChip status="paid" tone="success">Paid</StatusChip>',
        },
      },
    ],
  };

  const rendered = renderTaskRelevantComponentPack(pack);

  expect(rendered).toContain(
    'prop contract: status and tone are mandatory; do not instantiate without these props.',
  );
  expect(rendered).toContain('canonical usage contract from this project');
  expect(rendered).toContain('<StatusChip status="paid" tone="success">Paid</StatusChip>');
});

test('D7.5 component pack renderer promotes css-catalog class and HTML contracts', () => {
  const pack: TaskRelevantComponentPack = {
    status: 'ready',
    source: 'design-index',
    stale: false,
    taskKind: 'screen-generation',
    diagnostics: [],
    candidates: [
      {
        role: 'content-panel',
        componentId: 'css-catalog-card',
        title: 'CSS/Card',
        shortName: 'Card',
        confidence: 'high',
        recordConfidence: 'high',
        score: 40,
        reason: 'Matched content-panel via css catalog.',
        guidance: ['Use .card for content panels.'],
        requiredClasses: ['card', 'card__header', 'card__body'],
        modifiers: ['card--featured'],
        canonicalHtml:
          '<article class="card card--featured"><header class="card__header"></header><div class="card__body"></div></article>',
      } as any,
    ],
  };

  const rendered = renderTaskRelevantComponentPack(pack);

  expect(rendered).toContain('required classes: card, card__header, card__body');
  expect(rendered).toContain('modifiers: card--featured');
  expect(rendered).toContain('canonical HTML contract');
  expect(rendered).toContain('```html');
  expect(rendered).toContain('class="card card--featured"');
});

test('D4 component pack renderer warns that RowsConfig data keys need matching cells', () => {
  const pack: TaskRelevantComponentPack = {
    status: 'ready',
    source: 'design-index',
    stale: false,
    taskKind: 'screen-generation',
    diagnostics: [],
    candidates: [
      {
        role: 'data-table',
        componentId: 'organisms-table',
        title: 'Organisms/Table',
        shortName: 'Table',
        importHint: 'src/components/organisms/Tables/index.ts',
        confidence: 'high',
        recordConfidence: 'high',
        score: 44,
        reason: 'Matched data-table via roleFit.',
        guidance: ['Use for grouped registry rows with sorting and fixed row actions.'],
        snippet: {
          sourcePath: 'src/screens/DcmDraftDealPage.tsx',
          code: [
            'type PotentialRow = { product: string; amount: string; rate: string; maturity: string };',
            'const rows: RowsConfig<PotentialRow>[] = [',
            '  {',
            "    data: { product: 'Кредит', amount: '20', rate: '23 %', maturity: '15.09.2026' },",
            '    cells: {',
            '      product: ({ data }) => <Text>{data.product}</Text>,',
            '      amount: ({ data }) => <Text>{data.amount}</Text>,',
            '    },',
            '  },',
            '];',
            '<Table rows={rows} columns={columns} />',
          ].join('\n'),
        },
      },
    ],
  };

  const rendered = renderTaskRelevantComponentPack(pack);

  expect(rendered).toContain(
    'table row contract: every key in each row data object must have a matching cells renderer/key',
  );
  expect(rendered).toContain('RowsConfig<PotentialRow>');
});

test('D4 component pack reserves the explicitly requested replacement target component', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-0107-d4-tile-pack-'));
  await mkdir(join(root, '.sber-designer/design-index'), { recursive: true });
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    [
      componentRecord({
        id: 'atoms-grid',
        title: 'Atoms/Grid',
        shortName: 'Grid',
        filePath: 'src/components/atoms/Grid/index.ts',
        description: 'Low level layout grid primitive.',
        tags: ['grid', 'layout'],
      }),
      componentRecord({
        id: 'molecules-tile',
        title: 'Molecules/Tiles/Tile',
        shortName: 'Tile',
        filePath: 'src/components/molecules/Tiles/index.ts',
        description: 'Tile content panel with gridSizes layout contract.',
        tags: ['tile', 'card', 'content-panel'],
      }),
      componentRecord({
        id: 'organisms-table',
        title: 'Organisms/Table',
        shortName: 'Table',
        filePath: 'src/components/organisms/Tables/index.ts',
        description: 'Dense data table.',
        tags: ['table', 'rows'],
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.usageCards),
    [
      JSON.stringify({
        componentId: 'molecules-tile',
        publicImport: { name: 'Tile', module: '@/components/molecules/Tiles' },
        purpose: 'Content panel layout tile.',
        whenToUse: ['Use Tile instead of Grid for card-like screen regions.'],
        whenNotToUse: [],
        variantGuidance: [],
        propsThatMatter: [{ name: 'gridSizes', note: 'required prop' }],
        snippets: [
          {
            sourcePath: 'src/screens/DcmDraftDealPage.tsx',
            code: '<Tile gridSizes={{ xs: 12, md: 6 }} title="Клиент">...</Tile>',
          },
        ],
        pairsWith: [],
        usageCount: 3,
        visualRefs: [],
        facts: [],
      }),
      '',
    ].join('\n'),
    'utf8',
  );

  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-edit',
    userRequest: 'Replace every Grid component with Tile components.',
  });
  const rendered = renderTaskRelevantComponentPack(pack);

  expect(pack.candidates[0]).toMatchObject({
    role: 'requested-component-tile',
    shortName: 'Tile',
  });
  expect(rendered).toContain('canonical usage contract from this project');
  expect(rendered).toContain('<Tile gridSizes={{ xs: 12, md: 6 }}');
  expect(rendered.indexOf('requested-component-tile')).toBeLessThan(rendered.indexOf('data-table'));
});

function componentRecord(input: {
  id: string;
  title: string;
  shortName: string;
  filePath: string;
  description: string;
  tags: string[];
}): string {
  return JSON.stringify({
    id: input.id,
    title: input.title,
    shortName: input.shortName,
    filePath: input.filePath,
    storyCount: 1,
    stories: [{ id: `${input.id}--default`, name: 'Default' }],
    description: input.description,
    tags: input.tags,
    groupIds: [],
    noteCount: 0,
    confidence: 'high',
  });
}
