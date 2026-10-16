import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'bun:test';

import {
  CANONICAL_DESIGN_INDEX_PATHS,
  type ComponentDescriptionMapEntry,
  type ComponentUsageCard,
  type IndexedComponentRecord,
  type ProjectProfileFile,
  type TokenRecord,
} from '../packages/design-indexer/src';
import { indexFromStaticAst, indexFromStorybook } from '../packages/storybook-indexer/src';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(TEST_DIR, 'fixtures', 'project-index');

test('standard Storybook fixture indexes stories and component metadata', async () => {
  const root = await copyProjectFixture('storybook-standard');
  const catalog = await indexFromStorybook('http://storybook.local', {
    workspaceRoot: root,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          v: 5,
          entries: {
            'components-statusbadge--default': {
              id: 'components-statusbadge--default',
              type: 'story',
              name: 'Default',
              title: 'Components/StatusBadge',
              importPath: './src/components/StatusBadge.stories.tsx',
            },
            'components-statusbadge--warning': {
              id: 'components-statusbadge--warning',
              type: 'story',
              name: 'Warning',
              title: 'Components/StatusBadge',
              importPath: './src/components/StatusBadge.stories.tsx',
            },
          },
        }),
        { status: 200 },
      ),
  });

  expect(catalog.source).toBe('storybook');
  expect(catalog.components).toContainEqual(
    expect.objectContaining({
      shortName: 'StatusBadge',
      description: expect.stringContaining('workflow state'),
    }),
  );

  const result = await generateProjectDesignIndexFiles(root, {
    projectName: 'Storybook Standard Fixture',
    catalog,
  });

  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.components);
  const manifest = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  expect(manifest.sources.storybookCatalog).toBe(true);
  expect(manifest.sources.staticScan).toBe(false);

  const storybook = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.storybook));
  expect(storybook.configPaths).toContain('.storybook/main.ts');

  const components = await readJsonl<IndexedComponentRecord>(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
  );
  const statusBadge = components.find((component) => component.shortName === 'StatusBadge');
  expect(statusBadge).toMatchObject({
    storyCount: 2,
    confidence: 'medium',
    description: expect.stringContaining('workflow state'),
  });
  expect(statusBadge?.stories.map((story) => story.name)).toEqual(['Default', 'Warning']);

  const examples = await readJsonl(join(root, CANONICAL_DESIGN_INDEX_PATHS.usageExamples));
  expect(examples).toContainEqual(
    expect.objectContaining({
      componentId: 'components-statusbadge',
      title: 'Default',
      when: 'Use for positive states in compact tables.',
      source: 'storybook',
    }),
  );
});

test('no-Storybook fixture falls back to static scan and still creates component groups', async () => {
  const root = await copyProjectFixture('no-storybook-static');
  const catalog = await indexFromStaticAst(root);

  expect(catalog.source).toBe('static');
  expect(catalog.components.map((component) => component.shortName)).toEqual([
    'DataTable',
    'EmptyState',
  ]);

  await generateProjectDesignIndexFiles(root, {
    projectName: 'No Storybook Static Fixture',
    catalog,
  });

  const manifest = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  expect(manifest.sources.storybookCatalog).toBe(false);
  expect(manifest.sources.staticScan).toBe(true);

  const storybook = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.storybook));
  expect(storybook.source).toBe('not-found');

  const components = await readJsonl<IndexedComponentRecord>(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
  );
  expect(components).toContainEqual(
    expect.objectContaining({
      shortName: 'DataTable',
      storyCount: 0,
      description: expect.stringContaining('dense approval queues'),
      groupIds: expect.arrayContaining(['tables-lists']),
    }),
  );

  const groups = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.componentGroups));
  expect(groups.groups).toContainEqual(
    expect.objectContaining({
      id: 'tables-lists',
      componentIds: expect.arrayContaining([
        expect.stringContaining('src-components-DataTable-tsx-DataTable'),
      ]),
    }),
  );
});

test('barrel-export fixture proves named exports and index files are handled', async () => {
  const root = await copyProjectFixture('barrel-exports');
  const catalog = await indexFromStaticAst(root);

  expect(catalog.components).toContainEqual(
    expect.objectContaining({
      shortName: 'IconButton',
      filePath: 'src/components/buttons/index.ts',
    }),
  );

  await generateProjectDesignIndexFiles(root, {
    projectName: 'Barrel Export Fixture',
    catalog,
  });

  const components = await readJsonl<IndexedComponentRecord>(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
  );
  expect(components).toContainEqual(
    expect.objectContaining({
      shortName: 'IconButton',
      filePath: 'src/components/buttons/index.ts',
      groupIds: expect.arrayContaining(['actions']),
    }),
  );
});

test('custom-token fixture indexes tokens without relying on DESIGN.md', async () => {
  const root = await copyProjectFixture('custom-token-system');
  const catalog = await indexFromStaticAst(root);

  await generateProjectDesignIndexFiles(root, {
    projectName: 'Custom Token Fixture',
    catalog,
  });

  const manifest = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  expect(manifest.sources.designMd).toBe(false);

  const tokens = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.tokens));
  expect(tokens.tokens).toContainEqual(
    expect.objectContaining({
      name: 'brandPrimary',
      value: '#0f766e',
      source: 'tailwind',
    }),
  );
  expect(tokens.tokens).toContainEqual(
    expect.objectContaining({
      name: 'radiusLg',
      value: '12px',
      source: 'theme',
    }),
  );
  expect(tokens.tokens).toContainEqual(
    expect.objectContaining({
      name: 'chart-accent',
      value: '#f97316',
      source: 'css',
    }),
  );
});

test('legacy component-map fixture migrates guidance into agent notes', async () => {
  const root = await copyProjectFixture('legacy-component-map');
  const catalog = await indexFromStaticAst(root);

  const result = await generateProjectDesignIndexFiles(root, {
    projectName: 'Legacy Component Map Fixture',
    catalog,
  });

  expect(result.changedFiles).not.toContain('component-selection-map.md');
  const manifest = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  expect(manifest.sources.legacyComponentSelectionMap).toBe(true);

  const notes = await readJsonl(join(root, CANONICAL_DESIGN_INDEX_PATHS.agentNotes));
  expect(notes).toContainEqual(
    expect.objectContaining({
      source: 'legacy-component-selection-map',
      note: expect.stringContaining('ApprovalQueue'),
    }),
  );
});

test('project profile contract distinguishes Storybook, React, HTML/CSS, and empty projects', async () => {
  const cases: {
    fixture: string;
    projectName: string;
    expected: Pick<ProjectProfileFile, 'kind' | 'screenUnit' | 'componentModel' | 'renderProbe'>;
    frameworks: string[];
  }[] = [
    {
      fixture: 'storybook-standard',
      projectName: 'Storybook Profile Fixture',
      expected: {
        kind: 'react-storybook',
        screenUnit: {
          sourceGlob: 'src/**/*.{tsx,jsx}',
          storyRequired: true,
          rootMarker: 'data-sd-screen-root',
        },
        componentModel: 'react-index',
        renderProbe: 'storybook',
      },
      frameworks: ['react', 'storybook', 'vite'],
    },
    {
      fixture: 'no-storybook-static',
      projectName: 'React Profile Fixture',
      expected: {
        kind: 'react',
        screenUnit: {
          sourceGlob: 'src/**/*.{tsx,jsx}',
          storyRequired: false,
          rootMarker: 'data-sd-screen-root',
        },
        componentModel: 'react-index',
        renderProbe: 'static-html',
      },
      frameworks: ['react', 'vite'],
    },
    {
      fixture: 'html-css-site',
      projectName: 'HTML CSS Profile Fixture',
      expected: {
        kind: 'html-css',
        screenUnit: {
          sourceGlob: '{pages,screens,public,site}/**/*.html',
          storyRequired: false,
          rootMarker: 'data-sd-screen-root',
        },
        componentModel: 'css-catalog',
        renderProbe: 'static-html',
      },
      frameworks: ['css', 'html'],
    },
    {
      fixture: 'empty-project',
      projectName: 'Empty Profile Fixture',
      expected: {
        kind: 'empty',
        screenUnit: {
          sourceGlob: 'src/**/*.{tsx,jsx}',
          storyRequired: false,
          rootMarker: 'data-sd-screen-root',
        },
        componentModel: 'react-index',
        renderProbe: 'static-html',
      },
      frameworks: [],
    },
  ];

  for (const item of cases) {
    const root = await copyProjectFixture(item.fixture);
    await generateProjectDesignIndexFiles(root, {
      projectName: item.projectName,
      catalog: null,
    });

    const profile = (await readJson(
      join(root, CANONICAL_DESIGN_INDEX_PATHS.projectProfile),
    )) as ProjectProfileFile;
    expect(profile).toMatchObject({
      ...item.expected,
      frameworks: item.frameworks,
    });
    if (item.fixture === 'storybook-standard') {
      expect(profile.allowedUiPackages).toEqual(
        expect.arrayContaining(['@storybook/react-vite', 'react']),
      );
    }

    const manifest = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
    expect(manifest.projectProfile).toMatchObject({
      kind: item.expected.kind,
      screenUnit: item.expected.screenUnit,
      componentModel: item.expected.componentModel,
      renderProbe: item.expected.renderProbe,
    });
    if (item.fixture === 'storybook-standard') {
      expect(manifest.projectProfile.allowedUiPackages).toEqual(
        expect.arrayContaining(['@storybook/react-vite', 'react']),
      );
    }
  }
});

test('html/css fixture indexes tokens and css-catalog components', async () => {
  const root = await copyProjectFixture('html-css-site');

  await generateProjectDesignIndexFiles(root, {
    projectName: 'HTML CSS Index Fixture',
    catalog: null,
  });

  const manifest = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  expect(manifest.sources.staticScan).toBe(true);
  expect(manifest.projectProfile).toMatchObject({
    kind: 'html-css',
    componentModel: 'css-catalog',
  });
  expect(manifest.artifacts.htmlCssCatalogManifest).toBe(
    CANONICAL_DESIGN_INDEX_PATHS.htmlCssCatalogManifest,
  );
  expect(manifest.counts.components).toBeGreaterThanOrEqual(3);
  expect(manifest.counts.tokens).toBeGreaterThanOrEqual(4);
  const qualityScore = manifest.quality.score;
  const qualityCheckIds = manifest.quality.checks.map((check: { id: string }) => check.id);
  expect(manifest.quality).toMatchObject({
    score: expect.any(Number),
    violations: expect.any(Array),
  });
  expect(qualityCheckIds).toContain('prompt-summary');
  expect(qualityCheckIds).toContain('html-design-system');
  expect(qualityCheckIds).not.toContain('description-coverage');
  expect(qualityCheckIds).not.toContain('usage-cards');
  expect(qualityScore).toBeGreaterThanOrEqual(0);
  expect(qualityScore).toBeLessThanOrEqual(1);

  const tokens = (await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.tokens)))
    .tokens as TokenRecord[];
  expect(tokens).toContainEqual(
    expect.objectContaining({
      name: 'color-brand',
      value: '#14532d',
      source: 'css',
      filePath: 'site/styles.css',
      kind: 'color',
    }),
  );
  expect(tokens).toContainEqual(
    expect.objectContaining({
      name: 'color-brand@dark',
      value: '#bbf7d0',
      source: 'css',
      filePath: 'site/styles.css',
      kind: 'color',
    }),
  );

  const components = await readJsonl<IndexedComponentRecord>(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
  );
  expect(components).toContainEqual(
    expect.objectContaining({
      id: 'css-catalog-card',
      shortName: 'Card',
      source: 'css-catalog',
      requiredClasses: expect.arrayContaining(['card', 'card__header', 'card__body']),
      modifiers: expect.arrayContaining(['card--featured']),
      canonicalHtml: expect.stringContaining('class="card card--featured"'),
    }),
  );
  expect(components).toContainEqual(
    expect.objectContaining({
      id: 'css-catalog-primary-action',
      shortName: 'PrimaryAction',
      source: 'css-catalog',
      requiredClasses: expect.arrayContaining(['primary-action']),
      modifiers: expect.arrayContaining(['primary-action--danger']),
    }),
  );
  expect(
    components.flatMap((component) => [...component.requiredClasses, ...component.modifiers]),
  ).not.toContainEqual(expect.stringMatching(/["'=]/u));

  const cssCatalogManifest = await readJson(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.htmlCssCatalogManifest),
  );
  expect(cssCatalogManifest).toMatchObject({
    version: 1,
    source: 'html-css-catalog',
    counts: {
      components: expect.any(Number),
      classes: expect.any(Number),
      selectors: expect.any(Number),
      tokensDeclared: expect.any(Number),
    },
  });
  expect(cssCatalogManifest.classes).toEqual(
    expect.arrayContaining(['card', 'card__header', 'primary-action']),
  );
  expect(cssCatalogManifest.tokenNames).toEqual(expect.arrayContaining(['color-brand']));
  const manifestComponentIds = new Set(
    cssCatalogManifest.components.map((component: { id: string }) => component.id),
  );
  expect(
    components
      .filter((component) => component.source === 'css-catalog')
      .every((component) => manifestComponentIds.has(component.id)),
  ).toBe(true);

  const descriptionMap = (await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.descriptionMap)))
    .entries as ComponentDescriptionMapEntry[];
  expect(descriptionMap).toContainEqual(
    expect.objectContaining({
      componentId: 'css-catalog-card',
      shortName: 'Card',
      docsRef: expect.objectContaining({
        sourcePath: 'site/components.html',
        anchor: 'card',
      }),
    }),
  );

  const promptSummary = await readFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.promptSummary),
    'utf8',
  );
  expect(promptSummary).toContain('## Component groups');
  expect(promptSummary).toContain('## CSS catalog manifest');
  expect(promptSummary).toContain('tokens declared');
  expect(promptSummary).toContain('## Token hints');
  expect(promptSummary).toContain('Card');
});

test('html/css fixture adopts component description sidecars into css-catalog usage cards', async () => {
  const root = await copyProjectFixture('html-css-site');

  await generateProjectDesignIndexFiles(root, {
    projectName: 'HTML CSS Description Fixture',
    catalog: null,
  });

  const manifest = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  expect(manifest.counts.describedComponents).toBeGreaterThanOrEqual(1);

  const components = await readJsonl<IndexedComponentRecord>(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
  );
  const cardComponent = components.find((component) => component.id === 'css-catalog-card');
  expect(cardComponent?.descriptionLayer).toMatchObject({
    purpose: 'Reusable surface for highlighted content groups in static HTML pages.',
    status: 'confirmed',
    requiredProps: ['card', 'card__header', 'card__body'],
  });

  const descriptionMap = (await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.descriptionMap)))
    .entries as ComponentDescriptionMapEntry[];
  expect(descriptionMap).toContainEqual(
    expect.objectContaining({
      componentId: 'css-catalog-card',
      status: 'authored',
      keywords: expect.arrayContaining(['surface', 'card']),
    }),
  );

  const usageCards = await readJsonl<ComponentUsageCard>(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.usageCards),
  );
  const card = usageCards.find((entry) => entry.componentId === 'css-catalog-card');
  expect(card).toMatchObject({
    purpose: 'Reusable surface for highlighted content groups in static HTML pages.',
    requiredClasses: expect.arrayContaining(['card', 'card__header', 'card__body']),
    modifiers: expect.arrayContaining(['card--featured']),
    whenToUse: expect.arrayContaining(['featured content block', 'static page summary']),
    usageCount: 0,
  });
  expect(card?.variantGuidance).toContainEqual(
    expect.objectContaining({
      prop: 'modifier',
      values: expect.arrayContaining([
        expect.objectContaining({
          value: 'card--featured',
          meaning: 'adds emphasis for a highlighted card.',
        }),
      ]),
    }),
  );
  expect(card?.propsThatMatter.map((prop) => prop.name)).toEqual(
    expect.arrayContaining(['card', 'card__header', 'card__body']),
  );
  expect(card?.snippets[0]?.code).toContain('class="card card--featured"');
});

test('html/css catalog indexes reusable blocks declared only in components.css', async () => {
  const root = await copyProjectFixture('html-css-site');
  await writeFile(
    join(root, 'design-system/components.css'),
    [
      '.chart-card { padding: var(--space-card); }',
      '.chart-card__header { display: flex; }',
      '.chart-card--compact { gap: var(--space-2); }',
      '',
    ].join('\n'),
    'utf8',
  );

  await generateProjectDesignIndexFiles(root, {
    projectName: 'HTML CSS-only Components Fixture',
    catalog: null,
  });

  const components = await readJsonl<IndexedComponentRecord>(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
  );
  expect(components).toContainEqual(
    expect.objectContaining({
      id: 'css-catalog-chart-card',
      filePath: 'design-system/components.css',
      source: 'css-catalog',
      requiredClasses: expect.arrayContaining(['chart-card', 'chart-card__header']),
      modifiers: expect.arrayContaining(['chart-card--compact']),
      canonicalHtml: '',
    }),
  );
});

test('html/css fixture imports design-system description sections without sidecars', async () => {
  const root = await copyProjectFixture('html-css-site');

  await generateProjectDesignIndexFiles(root, {
    projectName: 'HTML CSS Surface Description Fixture',
    catalog: null,
  });

  const manifest = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  expect(manifest.counts.describedComponents).toBeGreaterThanOrEqual(2);

  const components = await readJsonl<IndexedComponentRecord>(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
  );
  const actionComponent = components.find(
    (component) => component.id === 'css-catalog-primary-action',
  );
  expect(actionComponent?.descriptionLayer).toMatchObject({
    purpose: 'Primary call-to-action button for static HTML pages.',
    status: 'confirmed',
    requiredProps: ['primary-action'],
    keywords: expect.arrayContaining(['action', 'button']),
  });

  const descriptionMap = (await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.descriptionMap)))
    .entries as ComponentDescriptionMapEntry[];
  expect(descriptionMap).toContainEqual(
    expect.objectContaining({
      componentId: 'css-catalog-primary-action',
      status: 'authored',
      keywords: expect.arrayContaining(['action', 'button']),
    }),
  );

  const usageCards = await readJsonl<ComponentUsageCard>(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.usageCards),
  );
  const card = usageCards.find((entry) => entry.componentId === 'css-catalog-primary-action');
  expect(card).toMatchObject({
    purpose: 'Primary call-to-action button for static HTML pages.',
    requiredClasses: expect.arrayContaining(['primary-action']),
    modifiers: expect.arrayContaining(['primary-action--danger']),
    whenToUse: expect.arrayContaining(['destructive action', 'form submit']),
    usageCount: 0,
  });
  expect(card?.variantGuidance).toContainEqual(
    expect.objectContaining({
      prop: 'modifier',
      values: expect.arrayContaining([
        expect.objectContaining({
          value: 'primary-action--danger',
          meaning: 'destructive action state',
        }),
      ]),
    }),
  );
  expect(card?.snippets[0]?.code).toContain('class="primary-action primary-action--danger"');
});

test('html/css fixture ignores page-local description sections outside design-system preview', async () => {
  const root = await copyProjectFixture('html-css-site');
  const indexPagePath = join(root, 'site', 'index.html');
  await writeFile(
    indexPagePath,
    `${await readFile(indexPagePath, 'utf8')}

<section data-sd-description-for="hero">
  <h2>Description for AI</h2>
  <p><strong>Purpose:</strong> Page-local description that should not become canonical.</p>
  <p><strong>Required props:</strong> <code>hero</code></p>
</section>
`,
    'utf8',
  );

  await generateProjectDesignIndexFiles(root, {
    projectName: 'HTML CSS Page-local Description Fixture',
    catalog: null,
  });

  const components = await readJsonl<IndexedComponentRecord>(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
  );
  const hero = components.find((component) => component.id === 'css-catalog-hero');
  expect(hero).toBeDefined();
  expect(hero?.descriptionLayer).toBeUndefined();

  const descriptionMap = (await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.descriptionMap)))
    .entries as ComponentDescriptionMapEntry[];
  expect(descriptionMap).not.toContainEqual(
    expect.objectContaining({
      componentId: 'css-catalog-hero',
      status: 'authored',
    }),
  );
});

test('html/css fixture reports divergence when sidecar and design-system section disagree', async () => {
  const root = await copyProjectFixture('html-css-site');
  const designSystemPath = join(root, 'design-system/index.html');
  await writeFile(
    designSystemPath,
    `${await readFile(designSystemPath, 'utf8')}
<section data-sd-description-for="card">
  <h2>Description for AI</h2>
  <p><strong>Purpose:</strong> Conflicting surface-only card description.</p>
</section>
`,
    'utf8',
  );

  await generateProjectDesignIndexFiles(root, {
    projectName: 'HTML CSS Divergence Fixture',
    catalog: null,
  });

  const components = await readJsonl<IndexedComponentRecord>(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
  );
  const cardComponent = components.find((component) => component.id === 'css-catalog-card');
  expect(cardComponent?.descriptionLayer?.purpose).toBe(
    'Reusable surface for highlighted content groups in static HTML pages.',
  );

  const diagnostics = (await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.diagnostics)))
    .diagnostics as { message: string }[];
  expect(diagnostics).toContainEqual(
    expect.objectContaining({
      message: expect.stringContaining('description-diverged: css-catalog-card'),
    }),
  );
  expect(diagnostics.some((diagnostic) => diagnostic.message.includes('purpose'))).toBe(true);
});

test('html/css catalog emits distillation prep data for prototype pages', async () => {
  const root = await copyProjectFixture('html-css-site');
  const indexPath = join(root, 'site', 'index.html');
  const stylesPath = join(root, 'site', 'styles.css');
  await writeFile(
    indexPath,
    `${await readFile(indexPath, 'utf8')}
<section class="metric-card card" style="background: #ffffff; padding: 24px; color: #14532d">
  <a class="primary-action" style="border-radius: 12px; color: #14532d">Open report</a>
</section>
`,
    'utf8',
  );
  await writeFile(
    stylesPath,
    `${await readFile(stylesPath, 'utf8')}
.metric-card {
  background: #ffffff;
  padding: 24px;
  border-radius: 12px;
}
`,
    'utf8',
  );

  await generateProjectDesignIndexFiles(root, {
    projectName: 'HTML CSS Distillation Fixture',
    catalog: null,
  });

  const cssCatalogManifest = await readJson(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.htmlCssCatalogManifest),
  );

  expect(cssCatalogManifest.distillation.values).toContainEqual(
    expect.objectContaining({
      category: 'color',
      value: '#14532d',
      count: expect.any(Number),
    }),
  );
  expect(
    cssCatalogManifest.distillation.values.find(
      (item: { category: string; value: string; count: number }) =>
        item.category === 'spacing' && item.value === '24px',
    )?.count,
  ).toBeGreaterThanOrEqual(2);
  expect(cssCatalogManifest.distillation.classFrequencies).toContainEqual(
    expect.objectContaining({ className: 'card', count: expect.any(Number) }),
  );
  expect(cssCatalogManifest.distillation.inlineStyleViolations).toContainEqual(
    expect.objectContaining({
      filePath: 'site/index.html',
      property: 'background',
      value: '#ffffff',
      category: 'color',
    }),
  );

  const promptSummary = await readFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.promptSummary),
    'utf8',
  );
  expect(promptSummary).toContain('Distillation prep');
  expect(promptSummary).toContain('#14532d');
  expect(promptSummary).toContain('inline styles');
});

test('html-first generated design-system preview does not inflate page token discipline', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-project-index-html-preview-quality-'));
  await mkdir(join(root, '.sber-designer'), { recursive: true });
  await mkdir(join(root, 'design-system'), { recursive: true });
  await writeFile(
    join(root, '.sber-designer', 'project.sdproj'),
    JSON.stringify(
      {
        version: 1,
        name: 'Preview quality',
        workspacePath: root,
        projectKind: 'html-first',
        screens: [],
        flow: [],
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, 'design-system/Design.md'),
    [
      '# Preview Quality DS',
      '',
      '## 1. Theme',
      'Quiet dashboard.',
      '',
      '## 2. Color',
      'Use project tokens.',
      '',
      '## 3. Typography',
      'Use Inter.',
      '',
      '## 4. Spacing',
      'Use the spacing scale.',
      '',
      '## 5. Layout',
      'Use static pages.',
      '',
      '## 6. Components',
      'Use components.css classes.',
      '',
      '## 7. Motion',
      'Minimal.',
      '',
      '## 8. Voice',
      'Concise.',
      '',
      '## 9. Anti-patterns',
      'Avoid inline values.',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'design-system/tokens.css'),
    ':root { --color-brand: #14532d; --space-4: 16px; }\n[data-theme="dark"] { --color-brand: #bbf7d0; }\n',
    'utf8',
  );
  await writeFile(
    join(root, 'design-system/components.css'),
    '.button { color: var(--color-brand); padding: var(--space-4); }\n',
    'utf8',
  );
  await writeFile(
    join(root, 'index.html'),
    '<main data-sd-screen-root><section style="background: #ffffff; padding: 24px"><button class="button">Go</button></section></main>\n',
    'utf8',
  );
  await writeFile(
    join(root, 'design-system/index.html'),
    '<main data-sd-screen-root data-sd-managed-design-system-preview class="dsp-shell"><section class="dsp-preview" style="color: var(--color-brand)">Preview</section></main>\n',
    'utf8',
  );

  await generateProjectDesignIndexFiles(root, {
    projectName: 'Preview quality',
    catalog: null,
  });

  const manifest = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  const tokenUsageCheck = manifest.quality.checks.find(
    (check: { id: string }) => check.id === 'html-design-system-token-usage',
  );
  expect(tokenUsageCheck).toMatchObject({
    detail: '0 of 1 pages use tokens or avoid raw inline color/spacing values.',
  });

  const components = await readJsonl<IndexedComponentRecord>(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
  );
  expect(components).not.toContainEqual(expect.objectContaining({ id: 'css-catalog-dsp-shell' }));
  expect(components).not.toContainEqual(expect.objectContaining({ id: 'css-catalog-dsp-preview' }));
});

test('html/css fixture registers html pages as page screen units', async () => {
  const root = await copyProjectFixture('html-css-site');

  await generateProjectDesignIndexFiles(root, {
    projectName: 'HTML CSS Screen Fixture',
    catalog: null,
  });

  const screens = await readJsonl(join(root, CANONICAL_DESIGN_INDEX_PATHS.screens));
  expect(screens).toContainEqual(
    expect.objectContaining({
      id: 'screen-site-index-html',
      name: 'Index',
      implementationPath: 'site/index.html',
      routePath: '/site/index.html',
      designReadableStatus: 'candidate',
      source: 'file-system',
    }),
  );
  expect(screens).not.toContainEqual(
    expect.objectContaining({
      implementationPath: 'site/components.html',
    }),
  );
});

test('html-first design-system-only project is healthy without component descriptions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-project-index-html-ds-only-'));
  await mkdir(join(root, '.sber-designer'), { recursive: true });
  await mkdir(join(root, 'design-system'), { recursive: true });
  await writeFile(
    join(root, '.sber-designer', 'project.sdproj'),
    JSON.stringify(
      {
        version: 1,
        name: 'HTML DS only',
        workspacePath: root,
        projectKind: 'html-first',
        screens: [],
        flow: [],
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, 'design-system/Design.md'),
    [
      '# HTML DS',
      '',
      '## 1. Theme and product mood',
      'Quiet enterprise dashboard.',
      '',
      '## 2. Color tokens and palette',
      'Use the brand tokens.',
      '',
      '## 3. Typography scale',
      'Compact readable text.',
      '',
      '## 4. Spacing rhythm',
      'Use the spacing scale.',
      '',
      '## 5. Layout rules',
      'Static pages use semantic sections.',
      '',
      '## 6. Components and patterns',
      'Reusable HTML patterns live in the canonical design-system package.',
      '',
      '## 7. Motion policy',
      'Minimal transitions.',
      '',
      '## 8. Voice and copy',
      'Operational and concise.',
      '',
      '## 9. Anti-patterns and forbidden moves',
      'Avoid inline hex values.',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'design-system/tokens.css'),
    ':root { --color-brand: #14532d; --space-4: 16px; }\n[data-theme="dark"] { --color-brand: #bbf7d0; }\n',
    'utf8',
  );
  await writeFile(
    join(root, 'design-system/components.css'),
    '.button { color: var(--color-brand); padding: var(--space-4); }\n',
    'utf8',
  );
  await writeFile(
    join(root, 'design-system/index.html'),
    '<section data-sd-managed-design-system-preview><button class="button">Action</button></section>\n',
    'utf8',
  );

  await generateProjectDesignIndexFiles(root, {
    projectName: 'HTML DS only',
    catalog: null,
  });

  const manifest = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  expect(manifest.projectProfile).toMatchObject({
    kind: 'html-css',
    componentModel: 'css-catalog',
    htmlDesignSystem: { status: 'canonical' },
  });
  expect(manifest.quality.checks).not.toContainEqual(
    expect.objectContaining({ id: 'description-coverage' }),
  );
  expect(manifest.quality.checks).not.toContainEqual(
    expect.objectContaining({ id: 'usage-cards' }),
  );
  expect(manifest.quality.violations).not.toContainEqual(
    expect.objectContaining({ id: 'description-coverage' }),
  );
  expect(manifest.quality.violations).not.toContainEqual(
    expect.objectContaining({ id: 'usage-cards' }),
  );

  const diagnostics = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.diagnostics));
  expect(diagnostics.diagnostics).not.toContainEqual(
    expect.objectContaining({ message: 'No components were indexed.' }),
  );
  expect(diagnostics.diagnostics).not.toContainEqual(
    expect.objectContaining({
      message: 'Component catalog is unavailable; index contains only document-level context.',
    }),
  );
  expect(diagnostics.diagnostics).not.toContainEqual(
    expect.objectContaining({
      filePath: 'DESIGN.md',
      message: 'DESIGN.md is missing; token and visual-language context is limited.',
    }),
  );

  const promptSummary = await readFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.promptSummary),
    'utf8',
  );
  expect(promptSummary).toContain('## HTML design system');
  expect(promptSummary).toContain('### Color');
  expect(promptSummary).toContain('Use the brand tokens.');
  expect(promptSummary).toContain('### Components');
  expect(promptSummary).toContain(
    'Reusable HTML patterns live in the canonical design-system package.',
  );
  expect(promptSummary).toContain('### Anti-patterns');
  expect(promptSummary).toContain('Avoid inline hex values.');

  const passedCheckIds = manifest.quality.checks
    .filter((check: { status: string }) => check.status === 'passed')
    .map((check: { id: string }) => check.id);
  expect(passedCheckIds).toContain('html-design-system-tokens');
  expect(passedCheckIds).toContain('html-design-system-theme');
  expect(passedCheckIds).toContain('html-design-system-components');
  expect(passedCheckIds).toContain('html-design-system-token-usage');
  expect(manifest.quality.violations).not.toContainEqual(
    expect.objectContaining({ id: 'html-design-system-tokens' }),
  );
});

test('html-css catalog emits design-system health signals for quality scoring', async () => {
  const root = await copyProjectFixture('html-css-site');

  await generateProjectDesignIndexFiles(root, {
    projectName: 'HTML CSS Signals Fixture',
    catalog: null,
  });

  const cssCatalogManifest = await readJson(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.htmlCssCatalogManifest),
  );
  const signals = cssCatalogManifest.designSystemSignals;
  expect(signals.rootTokenCount).toBe(4);
  expect(signals.themeOverride).toBe(true);
  expect(signals.themeOverrideSelectors).toContain('[data-theme="dark"]');
  expect(signals.componentClassCount).toBeGreaterThan(0);
  expect(signals.pagesTotal).toBeGreaterThanOrEqual(1);
  expect(signals.pagesWithInlineHardcodes).toBe(0);
  expect(signals.pagesOnTokens).toBe(signals.pagesTotal);
});

test('html-first bootstrap pages report design-system quality violations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-project-index-html-quality-'));
  await mkdir(join(root, '.sber-designer'), { recursive: true });
  await writeFile(
    join(root, '.sber-designer', 'project.sdproj'),
    JSON.stringify(
      {
        version: 1,
        name: 'HTML quality',
        workspacePath: root,
        projectKind: 'html-first',
        screens: [],
        flow: [],
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, 'index.html'),
    [
      '<!doctype html>',
      '<html lang="en">',
      '  <body data-sd-screen-root>',
      '    <main style="background: #ffffff; padding: 32px; color: #14532d">',
      '      <h1 style="color: #dc2626">Prototype</h1>',
      '    </main>',
      '  </body>',
      '</html>',
      '',
    ].join('\n'),
    'utf8',
  );

  await generateProjectDesignIndexFiles(root, {
    projectName: 'HTML quality',
    catalog: null,
  });

  const manifest = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  const violationIds = manifest.quality.violations.map((violation: { id: string }) => violation.id);
  expect(violationIds).toContain('html-design-system-tokens');
  expect(violationIds).toContain('html-design-system-components');
  expect(violationIds).toContain('html-design-system-token-usage');

  const cssCatalogManifest = await readJson(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.htmlCssCatalogManifest),
  );
  expect(cssCatalogManifest.designSystemSignals.pagesWithInlineHardcodes).toBe(1);
  expect(cssCatalogManifest.designSystemSignals.rootTokenCount).toBe(0);
});

test('html-first bootstrap project does not warn about missing Storybook components', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-project-index-html-bootstrap-'));
  await mkdir(join(root, '.sber-designer'), { recursive: true });
  await writeFile(
    join(root, '.sber-designer', 'project.sdproj'),
    JSON.stringify(
      {
        version: 1,
        name: 'HTML bootstrap',
        workspacePath: root,
        projectKind: 'html-first',
        screens: [],
        flow: [],
      },
      null,
      2,
    ),
    'utf8',
  );

  await generateProjectDesignIndexFiles(root, {
    projectName: 'HTML bootstrap',
    catalog: null,
  });

  const diagnostics = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.diagnostics));
  expect(diagnostics.diagnostics).not.toContainEqual(
    expect.objectContaining({ message: 'No components were indexed.' }),
  );
  expect(diagnostics.diagnostics).toContainEqual(
    expect.objectContaining({
      filePath: 'DESIGN.md',
      message: 'DESIGN.md is missing; token and visual-language context is limited.',
    }),
  );
});

test('html-first malformed Design.md reports section quality violation without failing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-project-index-html-malformed-design-'));
  await mkdir(join(root, '.sber-designer'), { recursive: true });
  await mkdir(join(root, 'design-system'), { recursive: true });
  await writeFile(
    join(root, '.sber-designer', 'project.sdproj'),
    JSON.stringify(
      {
        version: 1,
        name: 'Malformed HTML DS',
        workspacePath: root,
        projectKind: 'html-first',
        screens: [],
        flow: [],
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, 'design-system/Design.md'),
    [
      '# Broken design system',
      '',
      'A prose-only note is useful for humans, but it does not expose the',
      'HTML-first design-system sections that agents prune and reuse.',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'design-system/tokens.css'),
    ':root { --color-brand: #14532d; }\n',
    'utf8',
  );
  await writeFile(
    join(root, 'design-system/components.css'),
    '.button { color: var(--color-brand); }\n',
    'utf8',
  );

  await generateProjectDesignIndexFiles(root, {
    projectName: 'Malformed HTML DS',
    catalog: null,
  });

  const manifest = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  expect(manifest.quality.violations).toContainEqual(
    expect.objectContaining({
      id: 'html-design-system-sections',
    }),
  );

  const diagnostics = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.diagnostics));
  expect(diagnostics.diagnostics).toContainEqual(
    expect.objectContaining({
      level: 'warning',
      filePath: 'design-system/Design.md',
      message: expect.stringContaining('Design.md is missing HTML-first sections'),
    }),
  );
});

async function copyProjectFixture(name: string): Promise<string> {
  const tempRoot = await mkdtemp(join(tmpdir(), `sd-project-index-${name}-`));
  const workspaceRoot = join(tempRoot, name);
  await cp(join(FIXTURES_ROOT, name), workspaceRoot, { recursive: true });
  return workspaceRoot;
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readJsonl<T = any>(path: string): Promise<T[]> {
  return (await readFile(path, 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
