import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ComponentCatalog } from '@sber-designer/shared-types';

import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';
import { ALL_TOOLS } from '../services/api/src/agent/toolset';
import type { ToolContext } from '../services/api/src/agent/types';
import {
  clearProjectIndexJobs,
  getProjectIndexJob,
} from '../services/api/src/project-index/job-store';
import { getProject, resetProject, saveProject } from '../services/api/src/project-store';

test('project index tools expose status and search without mutating the workspace', async () => {
  const root = await createWorkspaceWithIndex();
  const before = await stat(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  const ctx = toolContext(root);

  const status = (await findTool('get_project_index_status').handler({}, ctx)) as {
    status: string;
    counts: { components: number; screens: number; tokens: number; icons: number };
    projectSystem: {
      freshness: string;
      nextAction: string;
      contextItems: { id: string; status: string; count: number }[];
    };
  };
  const search = (await findTool('search_project_index').handler(
    { query: 'approval table surface', types: ['component', 'token', 'screen'], limit: 10 },
    ctx,
  )) as {
    results: { type: string; id: string; title: string }[];
  };

  expect(['valid', 'warning', 'stale']).toContain(status.status);
  expect(status.counts.components).toBe(1);
  expect(status.counts.screens).toBeGreaterThanOrEqual(1);
  expect(status.counts.tokens).toBeGreaterThanOrEqual(1);
  expect(status.counts.icons).toBeGreaterThan(100);
  expect(['ready', 'stale', 'needs-attention']).toContain(status.projectSystem.freshness);
  expect(['ready', 'reindex-project', 'review-diagnostics']).toContain(
    status.projectSystem.nextAction,
  );
  expect(status.projectSystem.contextItems).toContainEqual(
    expect.objectContaining({
      id: 'components',
      status: 'ready',
      count: 1,
    }),
  );
  expect(search.results).toContainEqual(
    expect.objectContaining({
      type: 'component',
      id: 'components-data-table',
      title: 'Components/DataTable',
    }),
  );
  expect(search.results).toContainEqual(
    expect.objectContaining({
      type: 'token',
      title: 'surface-default',
    }),
  );
  expect(search.results.some((item) => item.type === 'screen')).toBe(true);

  const after = await stat(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  expect(after.mtimeMs).toBe(before.mtimeMs);
});

test('project index tools fetch indexed component, token, icon and screens by id', async () => {
  const root = await createWorkspaceWithIndex();
  const ctx = toolContext(root);

  const component = (await findTool('get_indexed_component').handler(
    { id: 'components-data-table' },
    ctx,
  )) as { component: { shortName: string; filePath: string } };
  const token = (await findTool('get_indexed_token').handler(
    { idOrName: 'surface-default' },
    ctx,
  )) as { token: { name: string; value: string } };
  const icon = (await findTool('get_indexed_icon').handler({ idOrName: 'search' }, ctx)) as {
    icon: { importName: string };
    source: string;
  };
  const screens = (await findTool('list_indexed_screens').handler({}, ctx)) as {
    screens: { implementationPath: string; designReadableStatus: string }[];
  };

  expect(component.component).toMatchObject({
    shortName: 'DataTable',
    filePath: 'src/components/DataTable.tsx',
  });
  expect(token.token).toMatchObject({ name: 'surface-default', value: '#ffffff' });
  expect(icon.source).toBe('lucide-fallback');
  expect(icon.icon.importName).toBe('Search');
  expect(screens.screens).toContainEqual(
    expect.objectContaining({
      implementationPath: 'src/app/dashboard/page.tsx',
      designReadableStatus: 'candidate',
    }),
  );
});

test('search_project_index returns component match evidence from description layers and agent notes', async () => {
  const root = await createWorkspaceWithSemanticComponents();
  const ctx = toolContext(root);

  const breadcrumbSearch = (await findTool('search_project_index').handler(
    { query: 'breadcrumb trail', types: ['component'], limit: 5 },
    ctx,
  )) as {
    results: {
      id: string;
      score: number;
      confidence: string;
      recordConfidence: string;
      matchedFields: string[];
      matchReason: string;
      recommendedStoryId?: string;
    }[];
  };
  const breadcrumb = breadcrumbSearch.results.find((item) => item.id === 'molecules-breadcrumbs');

  expect(breadcrumb).toBeTruthy();
  expect(breadcrumb).toMatchObject({
    confidence: 'high',
    recordConfidence: 'high',
    recommendedStoryId: 'molecules-breadcrumbs--default',
  });
  expect(breadcrumb?.score).toBeGreaterThan(0);
  expect(breadcrumb?.matchedFields).toContain('descriptionLayer.purpose');
  expect(breadcrumb?.matchReason).toContain('descriptionLayer.purpose');

  const tileSearch = (await findTool('search_project_index').handler(
    { query: 'content panel tile', types: ['component'], limit: 5 },
    ctx,
  )) as {
    results: {
      id: string;
      recordConfidence: string;
      matchedFields: string[];
      matchReason: string;
    }[];
  };
  const tile = tileSearch.results.find((item) => item.id === 'molecules-tiles-tile');

  expect(tile).toBeTruthy();
  expect(tile).toMatchObject({
    recordConfidence: 'low',
  });
  expect(tile?.matchedFields).toContain('agentNotes.note');
  expect(tile?.matchReason).toContain('agentNotes.note');

  // 0083 R8: a component is findable by its authored keywords, not just its name.
  const keywordSearch = (await findTool('search_project_index').handler(
    { query: 'wayfinding', types: ['component'], limit: 5 },
    ctx,
  )) as { results: { id: string; matchedFields: string[] }[] };
  const byKeyword = keywordSearch.results.find((item) => item.id === 'molecules-breadcrumbs');
  expect(byKeyword?.matchedFields).toContain('descriptionLayer.keywords');
});

test('get_indexed_icon falls back to any Lucide icon with warning when no name matches', async () => {
  const root = await createWorkspaceWithIndex();
  const ctx = toolContext(root);

  const icon = (await findTool('get_indexed_icon').handler(
    { idOrName: 'totally-not-real-risk-glyph' },
    ctx,
  )) as {
    icon: { importName: string };
    source: string;
    warning?: boolean;
    reason?: string;
  };

  expect(icon.source).toBe('lucide-fallback');
  expect(icon.icon.importName).toBeTruthy();
  expect(icon.warning).toBe(true);
  expect(icon.reason).toContain('totally-not-real-risk-glyph');
});

test('project index icon tools prefer project iconName contracts before Lucide fallback', async () => {
  const root = await createWorkspaceWithIndex();
  const ctx = toolContext(root);

  const projectIcon = (await findTool('get_indexed_icon').handler(
    { idOrName: 'RiskAlert' },
    ctx,
  )) as {
    icon: {
      name: string;
      source: string;
      validFor: string[];
      componentName?: string;
      propName?: string;
    };
    source: string;
    usage?: { jsx?: string };
  };
  const fallbackIcon = (await findTool('get_indexed_icon').handler(
    { idOrName: 'Search' },
    ctx,
  )) as {
    icon: { name: string; source: string; validFor: string[] };
    source: string;
    warning?: boolean;
    reason?: string;
  };
  const search = (await findTool('search_project_index').handler(
    { query: 'RiskAlert', types: ['icon'], limit: 5 },
    ctx,
  )) as {
    results: { type: string; id: string; source: string; validFor?: string[] }[];
  };

  expect(projectIcon.source).toBe('project-icon-prop');
  expect(projectIcon.icon).toMatchObject({
    name: 'RiskAlert',
    source: 'project-icon-prop',
    validFor: ['project-icon-prop'],
    componentName: 'Icon',
    propName: 'iconName',
  });
  expect(projectIcon.usage?.jsx).toBe('<Icon iconName="RiskAlert" />');
  expect(fallbackIcon.source).toBe('lucide-fallback');
  expect(fallbackIcon.icon.validFor).toEqual(['lucide-import']);
  expect(fallbackIcon.warning).toBe(true);
  expect(fallbackIcon.reason).toContain('not valid for project Icon iconName');
  expect(search.results).toContainEqual(
    expect.objectContaining({
      type: 'icon',
      source: 'project-icon-prop',
      validFor: ['project-icon-prop'],
    }),
  );
});

test('get_indexed_icon suggests fuzzy project iconName candidates before Lucide fallback', async () => {
  const root = await createWorkspaceWithIndex({
    iconNames: ['Approved', 'RiskAlert', 'MoreDots', 'MoreDotsHorizontal'],
  });
  const ctx = toolContext(root);

  const icon = (await findTool('get_indexed_icon').handler({ idOrName: 'MoreVertical' }, ctx)) as {
    icon: {
      name: string;
      source: string;
      validFor: string[];
      componentName?: string;
      propName?: string;
    };
    source: string;
    warning?: boolean;
    reason?: string;
    usage?: { jsx?: string };
  };

  expect(icon.source).toBe('project-icon-prop');
  expect(icon.icon).toMatchObject({
    name: 'MoreDots',
    source: 'project-icon-prop',
    validFor: ['project-icon-prop'],
    componentName: 'Icon',
    propName: 'iconName',
  });
  expect(icon.warning).toBeUndefined();
  expect(icon.reason).toBeUndefined();
  expect(icon.usage?.jsx).toBe('<Icon iconName="MoreDots" />');
});

test('get_indexed_icon returns exact project common icon names without Lucide warning', async () => {
  const root = await createWorkspaceWithIndex({
    iconNames: ['Approved', 'RiskAlert', 'PaymentClock', 'Search', 'Folder', 'Calendar'],
  });
  const ctx = toolContext(root);

  for (const idOrName of ['Search', 'Folder', 'Calendar']) {
    const icon = (await findTool('get_indexed_icon').handler({ idOrName }, ctx)) as {
      icon: {
        name: string;
        source: string;
        validFor: string[];
        componentName?: string;
        propName?: string;
      };
      source: string;
      warning?: boolean;
      reason?: string;
      usage?: { jsx?: string };
    };

    expect(icon.source).toBe('project-icon-prop');
    expect(icon.icon).toMatchObject({
      name: idOrName,
      source: 'project-icon-prop',
      validFor: ['project-icon-prop'],
      componentName: 'Icon',
      propName: 'iconName',
    });
    expect(icon.warning).toBeUndefined();
    expect(icon.reason).toBeUndefined();
    expect(icon.usage?.jsx).toBe(`<Icon iconName="${idOrName}" />`);
  }
});

test('screen_create does not turn unmatched icon fallback into automated review health', async () => {
  const root = await createWorkspaceWithIndex();
  resetProject();
  try {
    await saveProject({
      version: 1,
      name: 'Fallback Icon Project',
      workspacePath: root,
      screens: [],
      flow: [],
    });
    const ctx = toolContext(root);

    await findTool('get_indexed_icon').handler({ idOrName: 'totally-not-real-risk-glyph' }, ctx);
    const created = (await findTool('screen_create').handler(
      {
        name: 'Risk metrics',
        storyId: 'screens-risk-metrics--default',
        filePath: 'src/stories/screens/2026-05-29/RiskMetrics.stories.tsx',
        implementationFilePath: 'src/screens/2026-05-29/RiskMetrics.tsx',
        folder: '2026-05-29',
      },
      ctx,
    )) as { id: string };

    const project = getProject();
    expect(project.screens.find((screen) => screen.id === created.id)?.health).toBeUndefined();
  } finally {
    resetProject();
  }
});

test('screen_create registers html page screens without a Storybook story id', async () => {
  const root = await createWorkspaceWithIndex();
  resetProject();
  try {
    await saveProject({
      version: 1,
      name: 'HTML Page Project',
      workspacePath: root,
      screens: [],
      flow: [],
    });
    const ctx = toolContext(root);

    const created = (await findTool('screen_create').handler(
      {
        kind: 'page',
        name: 'Landing page',
        filePath: 'site/index.html',
        implementationFilePath: 'site/index.html',
        folder: 'Static',
      },
      ctx,
    )) as { id: string };

    const screen = getProject().screens.find((candidate) => candidate.id === created.id);
    expect(screen).toMatchObject({
      name: 'Landing page',
      kind: 'page',
      filePath: 'site/index.html',
      implementationFilePath: 'site/index.html',
      folder: 'Static',
    });
    expect(screen?.storyId).toBeUndefined();
  } finally {
    resetProject();
  }
});

test('request_project_reindex starts a background job and is idempotent while it is active', async () => {
  clearProjectIndexJobs();
  const root = await createWorkspaceWithIndex();

  const first = (await findTool('request_project_reindex').handler(
    { reason: 'Catalog changed' },
    toolContext(root),
  )) as {
    started: boolean;
    alreadyRunning: boolean;
    jobId: string;
    statusEndpoint: string;
    reason: string;
  };
  const second = (await findTool('request_project_reindex').handler(
    { reason: 'Catalog changed again' },
    toolContext(root),
  )) as {
    started: boolean;
    alreadyRunning: boolean;
    jobId: string;
    statusEndpoint: string;
    reason: string;
  };

  expect(first.started).toBe(true);
  expect(first.alreadyRunning).toBe(false);
  expect(first.jobId).toMatch(/^idxjob-/);
  expect(first.statusEndpoint).toBe(`/api/project/design-index/jobs/${first.jobId}`);
  expect(first.reason).toBe('Catalog changed');
  expect(getProjectIndexJob(first.jobId)?.workspaceRoot).toBe(root);
  expect(second.started).toBe(false);
  expect(second.alreadyRunning).toBe(true);
  expect(second.jobId).toBe(first.jobId);
  expect(second.statusEndpoint).toBe(first.statusEndpoint);
  await waitForProjectIndexJob(first.jobId);
});

test('rebuild_design_system_preview regenerates managed preview and keeps description sections by default', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-rebuild-ds-tool-'));
  await mkdir(join(root, 'design-system'), { recursive: true });
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
  await writeFile(
    join(root, 'design-system/Design.md'),
    '# Design\n\n## 1. Theme\nTool preview.\n',
    'utf8',
  );
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });
  await mkdir(join(root, '.sber-designer', 'components'), { recursive: true });
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    `${JSON.stringify({
      id: 'css-catalog-button',
      title: 'Button',
      shortName: 'Button',
      filePath: 'design-system/components.css',
      source: 'css-catalog',
      storyCount: 0,
      stories: [],
      requiredClasses: ['button'],
      docsAnchor: 'button',
      tags: [],
      groupIds: [],
      noteCount: 0,
      confidence: 'high',
    })}\n`,
    'utf8',
  );
  await writeFile(
    join(root, '.sber-designer', 'components', 'css-catalog-button.md'),
    [
      '## Description for AI',
      '',
      '**Purpose:** Main action trigger.',
      '**Canonical usage:**',
      '```html',
      '<button class="button">Save</button>',
      '```',
    ].join('\n'),
    'utf8',
  );

  const result = (await findTool('rebuild_design_system_preview').handler(
    {},
    toolContext(root),
  )) as {
    changedFiles: string[];
    tokenCount: number;
    componentClassCount: number;
    descriptionSections: { keepDescriptions: boolean; restored: number };
  };
  const html = await readFile(join(root, 'design-system/index.html'), 'utf8');

  expect(result.changedFiles).toEqual(['design-system/index.html']);
  expect(result.tokenCount).toBe(1);
  expect(result.componentClassCount).toBe(1);
  expect(result.descriptionSections).toMatchObject({ keepDescriptions: true, restored: 1 });
  expect(html).toContain('data-sd-description-for="button"');
  expect(html).toContain('Main action trigger.');
});

async function waitForProjectIndexJob(id: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const job = getProjectIndexJob(id);
    if (job?.stage === 'complete' || job?.stage === 'failed') return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for project index job ${id}`);
}

function findTool(name: string) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

function toolContext(workspacePath: string): ToolContext {
  return {
    user: 'test-user',
    projectName: 'Project Index Tool Project',
    activeScreen: null,
    workspacePath,
    canvasUrl: null,
  };
}

async function createWorkspaceWithIndex(input?: { iconNames?: string[] }): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-project-index-tools-'));
  await mkdir(join(root, 'src', 'app', 'dashboard'), { recursive: true });
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await mkdir(join(root, 'src', 'components', 'Icon'), { recursive: true });
  await mkdir(join(root, 'src', 'styles'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify(
      {
        scripts: { dev: 'vite --host 0.0.0.0' },
        dependencies: { react: '^19.0.0', vite: '^latest' },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, 'DESIGN.md'),
    [
      '---',
      'name: Tool CRM',
      '---',
      '',
      '# Tool CRM',
      '',
      '## Overview',
      'Operational approval workspace.',
      '',
      '## Components',
      'Use DataTable for approval queues.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'app', 'dashboard', 'page.tsx'),
    'export default function DashboardPage() { return <main><h1>Approvals</h1></main>; }',
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'DataTable.tsx'),
    'export function DataTable() { return <table />; }',
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'Icon', 'Icon.const.ts'),
    [
      `export const ICON_NAMES = ${JSON.stringify(input?.iconNames ?? ['Approved', 'RiskAlert', 'PaymentClock'])} as const;`,
      'export type IconName = (typeof ICON_NAMES)[number];',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'Icon', 'Icon.tsx'),
    [
      "import { type IconName } from './Icon.const';",
      'export function Icon(props: { iconName: IconName }) {',
      '  return <span data-icon={props.iconName} />;',
      '}',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'styles', 'tokens.css'),
    ':root { --surface-default: #ffffff; --spacing-md: 16px; }',
    'utf8',
  );
  await generateProjectDesignIndexFiles(root, {
    projectName: 'Tool CRM',
    catalog: catalogFixture(),
  });
  return root;
}

function catalogFixture(): ComponentCatalog {
  return {
    source: 'static',
    generatedAt: Date.now(),
    components: [
      {
        id: 'components-data-table',
        title: 'Components/DataTable',
        shortName: 'DataTable',
        filePath: 'src/components/DataTable.tsx',
        description: 'Sortable approval table.',
        stories: [{ id: 'components-data-table--default', name: 'Default' }],
      },
    ],
  };
}

async function createWorkspaceWithSemanticComponents(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-project-index-semantic-tools-'));
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await mkdir(join(root, '.sber-designer/design-index'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ scripts: { dev: 'vite --host 0.0.0.0' } }, null, 2),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'BreadCrumbs.tsx'),
    'export function BreadCrumbs() { return <nav />; }',
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'Tile.tsx'),
    'export function Tile() { return <section />; }',
    'utf8',
  );
  await generateProjectDesignIndexFiles(root, {
    projectName: 'Semantic Component Project',
    catalog: {
      source: 'static',
      generatedAt: Date.now(),
      components: [
        {
          id: 'molecules-breadcrumbs',
          title: 'Molecules/BreadCrumbs',
          shortName: 'BreadCrumbs',
          filePath: 'src/components/BreadCrumbs.tsx',
          descriptionLayer: {
            purpose: 'Breadcrumb trail for page hierarchy and navigation context.',
            anatomy: ['root nav', 'link items', 'current page item'],
            usage: [
              {
                title: 'Page breadcrumb',
                when: 'Use before a page header to show current location.',
              },
            ],
            agentGuidance: ['Use BreadCrumbs before creating raw breadcrumb text.'],
            keywords: ['wayfinding', 'location indicator'],
          },
          stories: [{ id: 'molecules-breadcrumbs--default', name: 'Default' }],
        },
        {
          id: 'molecules-tiles-tile',
          title: 'Molecules/Tiles/Tile',
          shortName: 'Tile',
          filePath: 'src/components/Tile.tsx',
          stories: [{ id: 'molecules-tiles-tile--default', name: 'Default' }],
        },
      ],
    },
  });
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.agentNotes),
    [
      JSON.stringify({
        id: 'note-tile-usage',
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
  return root;
}
