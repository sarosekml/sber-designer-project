import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { expect, test } from 'bun:test';
import type { ComponentCatalog } from '@sber-designer/shared-types';

import {
  CANONICAL_DESIGN_INDEX_PATHS,
  DESIGN_INDEX_PATHS,
  loadDesignIndex,
} from '../packages/design-indexer/src';
import { generateProjectDesignContextFiles } from '../services/api/src/design-context/generate';
import { loadProjectDesignContext } from '../services/api/src/design-context/load';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';

test('unified project index writes canonical artifacts and migrates legacy component map', async () => {
  const root = await createIndexableWorkspace();

  const result = await generateProjectDesignIndexFiles(root, {
    projectName: 'Unified CRM',
    catalog: catalogFixture(),
  });

  expect(result.changedFiles).toContain('DESIGN.md');
  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.manifest);
  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.projectProfile);
  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.designBrief);
  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.routes);
  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.screens);
  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.storybook);
  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.iconCandidates);
  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.iconCatalog);
  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.agentNotes);
  expect(result.changedFiles).not.toContain('component-selection-map.md');
  expect(await exists(join(root, DESIGN_INDEX_PATHS.legacyManifest))).toBe(false);

  const manifest = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest));
  expect(manifest.projectName).toBe('Unified CRM');
  expect(manifest.artifacts.manifest).toBe(CANONICAL_DESIGN_INDEX_PATHS.manifest);
  expect(manifest.artifacts.projectProfile).toBe(CANONICAL_DESIGN_INDEX_PATHS.projectProfile);
  expect(manifest.counts.routes).toBeGreaterThanOrEqual(1);
  expect(manifest.counts.screens).toBeGreaterThanOrEqual(1);
  expect(manifest.counts.agentNotes).toBeGreaterThanOrEqual(1);
  expect(manifest.counts.iconCandidates).toBeGreaterThan(100);
  expect(manifest.counts.projectIconContracts).toBeGreaterThanOrEqual(3);
  expect(manifest.counts.fallbackIcons).toBeGreaterThan(100);

  const profile = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.projectProfile));
  expect(profile.packageManager).toBe('bun');
  expect(profile.frameworks).toContain('vite');
  expect(profile.frameworks).toContain('react');
  expect(profile.aliases['@/*']).toEqual(['src/*']);

  const routes = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.routes));
  expect(routes.routes).toContainEqual(
    expect.objectContaining({
      routePath: '/dashboard',
      filePath: 'src/app/dashboard/page.tsx',
    }),
  );

  const screens = await readJsonl(join(root, CANONICAL_DESIGN_INDEX_PATHS.screens));
  expect(screens).toContainEqual(
    expect.objectContaining({
      id: 'screen-src-app-dashboard-page-tsx',
      implementationPath: 'src/app/dashboard/page.tsx',
    }),
  );
  expect(screens).toContainEqual(
    expect.objectContaining({
      id: 'screen-approval-queue',
      name: 'Approval queue',
      implementationPath: 'src/screens/payments/ApprovalQueueScreen.tsx',
      storyPath: 'src/stories/screens/payments/ApprovalQueueScreen.stories.tsx',
      source: 'project-file',
    }),
  );
  expect(
    screens.filter(
      (screen) =>
        screen.implementationPath ===
        'src/stories/screens/payments/ApprovalQueueScreen.stories.tsx',
    ),
  ).toHaveLength(0);

  const storybook = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.storybook));
  expect(storybook.configPaths).toContain('.storybook/main.ts');

  const tokens = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.tokens));
  expect(tokens.tokens).toContainEqual(
    expect.objectContaining({
      name: 'surface-default',
      value: '#ffffff',
      source: 'css',
    }),
  );

  const agentNotes = await readJsonl(join(root, CANONICAL_DESIGN_INDEX_PATHS.agentNotes));
  expect(agentNotes.some((note) => String(note.note).includes('DataTable'))).toBe(true);

  const iconCandidates = await readJsonl(join(root, CANONICAL_DESIGN_INDEX_PATHS.iconCandidates));
  expect(iconCandidates).toContainEqual(
    expect.objectContaining({
      name: 'RiskAlert',
      source: 'project-icon-prop',
      validFor: ['project-icon-prop'],
      componentName: 'Icon',
      propName: 'iconName',
    }),
  );
  expect(iconCandidates).toContainEqual(
    expect.objectContaining({
      name: 'Payment clock',
      source: 'project-asset',
      validFor: ['asset-import'],
    }),
  );
  expect(iconCandidates).toContainEqual(
    expect.objectContaining({
      name: 'Search',
      source: 'lucide-fallback',
      validFor: ['lucide-import'],
    }),
  );

  const iconCatalog = await readFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.iconCatalog), 'utf8');
  expect(iconCatalog).toContain('Icon resolution order');
  expect(iconCatalog).toContain('project-icon-prop');
  expect(iconCatalog).toContain('get_indexed_icon');

  const designBrief = await readFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.designBrief), 'utf8');
  expect(designBrief).toContain('# Unified CRM Design Brief');
  expect(designBrief).toContain('DataTable');
});

test('legacy design-index index.json remains readable during migration', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-project-index-legacy-'));
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });
  await writeFile(
    join(root, DESIGN_INDEX_PATHS.legacyManifest),
    JSON.stringify(
      {
        version: 2,
        generatedAt: Date.now(),
        projectName: 'Legacy Index',
        sources: {
          storybookCatalog: false,
          staticScan: true,
          designMd: false,
          componentNotes: false,
          lucideFallback: false,
        },
        counts: {
          components: 0,
          componentGroups: 0,
          tokens: 0,
          icons: 0,
          examples: 0,
          notes: 0,
          diagnostics: 0,
        },
        fingerprint: 'legacy',
        artifacts: { manifest: DESIGN_INDEX_PATHS.legacyManifest },
      },
      null,
      2,
    ),
    'utf8',
  );

  const context = await loadDesignIndex(root);

  expect(context.manifest?.projectName).toBe('Legacy Index');
  expect(context.diagnostics.some((item) => item.message.includes('legacy index.json'))).toBe(true);
});

test('legacy design context generation delegates to unified index without writing component map', async () => {
  const root = await createIndexableWorkspace();

  const result = await generateProjectDesignContextFiles(root, {
    projectName: 'Delegated CRM',
    catalog: catalogFixture(),
    include: 'both',
    overwrite: true,
  });

  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.manifest);
  expect(result.changedFiles).not.toContain('component-selection-map.md');
  const context = await loadProjectDesignContext(root);
  expect(context.componentSelectionMap.filePath).toBe(CANONICAL_DESIGN_INDEX_PATHS.promptSummary);
  expect(context.promptSummary).toContain('Project index');
  expect(context.promptSummary).toContain('Delegated CRM');
});

async function createIndexableWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-project-index-'));
  await mkdir(join(root, 'src', 'app', 'dashboard'), { recursive: true });
  await mkdir(join(root, 'src', 'assets', 'icons'), { recursive: true });
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await mkdir(join(root, 'src', 'components', 'Icon'), { recursive: true });
  await mkdir(join(root, 'src', 'screens', 'payments'), { recursive: true });
  await mkdir(join(root, 'src', 'stories', 'screens', 'payments'), { recursive: true });
  await mkdir(join(root, 'src', 'styles'), { recursive: true });
  await mkdir(join(root, '.sber-designer'), { recursive: true });
  await mkdir(join(root, '.storybook'), { recursive: true });
  await writeFile(join(root, 'bun.lock'), '', 'utf8');
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify(
      {
        scripts: { dev: 'vite --host 0.0.0.0', storybook: 'storybook dev -p 6006' },
        dependencies: { '@vitejs/plugin-react': '^latest', react: '^19.0.0', vite: '^latest' },
        devDependencies: { storybook: '^8.0.0', tailwindcss: '^4.0.0' },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { paths: { '@/*': ['src/*'] } } }, null, 2),
    'utf8',
  );
  await writeFile(
    join(root, 'DESIGN.md'),
    [
      '---',
      'version: alpha',
      'name: Unified CRM',
      '---',
      '',
      '# Unified CRM',
      '',
      '## Overview',
      'Dense operational CRM.',
      '',
      '## Components',
      'Use DataTable for queues.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'component-selection-map.md'),
    '# Component selection map\n\n- Use `DataTable` for approval queues.',
    'utf8',
  );
  await writeFile(
    join(root, '.storybook', 'main.ts'),
    "export default { stories: ['../src/**/*.stories.@(ts|tsx)'] };",
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'app', 'dashboard', 'page.tsx'),
    'export default function DashboardPage() { return <main><h1>Dashboard</h1></main>; }',
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
      "export const ICON_NAMES = ['Approved', 'RiskAlert', 'PaymentClock'] as const;",
      'export type IconName = (typeof ICON_NAMES)[number];',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'Icon', 'Icon.tsx'),
    [
      "import { ICON_NAMES, type IconName } from './Icon.const';",
      'export function Icon(props: { iconName: IconName; title?: string }) {',
      '  return <span data-icon={props.iconName}>{props.iconName}</span>;',
      '}',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'assets', 'icons', 'payment-clock.svg'),
    '<svg viewBox="0 0 16 16" role="img"><path d="M8 1v7l4 2" /></svg>',
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'screens', 'payments', 'ApprovalQueueScreen.tsx'),
    'export function ApprovalQueueScreen() { return <main><h1>Approval queue</h1></main>; }',
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'stories', 'screens', 'payments', 'ApprovalQueueScreen.stories.tsx'),
    [
      "import type { Meta, StoryObj } from '@storybook/react-vite';",
      "import { ApprovalQueueScreen } from '../../../screens/payments/ApprovalQueueScreen';",
      'const meta = { title: "Screens/Payments/Approval queue", component: ApprovalQueueScreen } satisfies Meta<typeof ApprovalQueueScreen>;',
      'export default meta;',
      'type Story = StoryObj<typeof meta>;',
      'export const Default: Story = {};',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'styles', 'tokens.css'),
    ':root { --surface-default: #ffffff; --spacing-md: 16px; }',
    'utf8',
  );
  await writeFile(
    join(root, '.sber-designer', 'project.sdproj'),
    JSON.stringify(
      {
        version: 1,
        name: 'Unified CRM',
        workspacePath: root,
        screens: [
          {
            id: 'screen-approval-queue',
            name: 'Approval queue',
            kind: 'story',
            storyId: 'screens-payments-approval-queue--default',
            filePath: 'src/stories/screens/payments/ApprovalQueueScreen.stories.tsx',
            implementationFilePath: 'src/screens/payments/ApprovalQueueScreen.tsx',
          },
        ],
        flow: [],
      },
      null,
      2,
    ),
    'utf8',
  );
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
        description: 'Sortable data grid for queues.',
        stories: [{ id: 'components-data-table--default', name: 'Default' }],
      },
      {
        id: 'screens-payments-approval-queue',
        title: 'Screens/Payments/Approval queue',
        shortName: 'Approval queue',
        filePath: 'src/stories/screens/payments/ApprovalQueueScreen.stories.tsx',
        description: 'Screen wrapper for the payments queue.',
        stories: [{ id: 'screens-payments-approval-queue--default', name: 'Default' }],
      },
    ],
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readJsonl(path: string): Promise<any[]> {
  const contents = await readFile(path, 'utf8');
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
