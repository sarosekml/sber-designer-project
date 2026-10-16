import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'bun:test';
import type { ComponentCatalog } from '@sber-designer/shared-types';
import { CANONICAL_DESIGN_INDEX_PATHS } from '@sber-designer/design-indexer';

import { generateProjectDesignContextFiles } from '../services/api/src/design-context/generate';
import { loadProjectDesignContext } from '../services/api/src/design-context/load';
import { validateProjectDesignContext } from '../services/api/src/design-context/validate';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { patchState, resetState } from '../services/api/src/state-store';

test('loads DESIGN.md and component-selection-map.md into a compact prompt summary', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-context-'));
  await writeFile(
    join(root, 'DESIGN.md'),
    [
      '---',
      'version: alpha',
      'name: Test Design System',
      'description: "Compact institutional UI"',
      'colors:',
      '  primary: "#00AA9B"',
      '---',
      '',
      '# Test Design System',
      '',
      '## Overview',
      '',
      'The product is dense, calm, and desktop-first.',
      '',
      '## Components',
      '',
      'Use tables for large datasets and cards for summaries.',
      '',
      "## Do's and Don'ts",
      '',
      '- Do use tokens.',
      '- Do not invent colors.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'component-selection-map.md'),
    [
      '# Component selection map',
      '',
      '## Data tables',
      '',
      '- Use `DataTable` for sortable and filterable datasets.',
      '- Use `StatusBadge` inside status cells.',
    ].join('\n'),
    'utf8',
  );

  const context = await loadProjectDesignContext(root);

  expect(context.design.exists).toBe(true);
  expect(context.componentSelectionMap.exists).toBe(true);
  expect(context.promptSummary).toContain('Test Design System');
  expect(context.promptSummary).toContain('dense, calm');
  expect(context.promptSummary).toContain('DataTable');
  expect(context.promptSummary).not.toContain('primary: "#00AA9B"');
  expect(context.diagnostics.some((item) => item.level === 'error')).toBe(false);
});

test('uses .sber-designer/component-selection-map.md as fallback', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-context-fallback-'));
  await mkdir(join(root, '.sber-designer'), { recursive: true });
  await writeFile(
    join(root, 'DESIGN.md'),
    ['---', 'name: Fallback DS', '---', '', '# Fallback DS', '', '## Overview', 'Small.'].join(
      '\n',
    ),
    'utf8',
  );
  await writeFile(
    join(root, '.sber-designer', 'component-selection-map.md'),
    '# Component selection map\n\nUse `ToolbarButton` for toolbar actions.',
    'utf8',
  );

  const context = await loadProjectDesignContext(root);

  expect(context.componentSelectionMap.exists).toBe(true);
  expect(context.componentSelectionMap.filePath).toBe('.sber-designer/component-selection-map.md');
  expect(context.promptSummary).toContain('ToolbarButton');
});

test('system prompt includes unified project index before catalog guidance', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-context-prompt-'));
  await writeFile(
    join(root, 'DESIGN.md'),
    [
      '---',
      'name: Prompt DS',
      '---',
      '',
      '# Prompt DS',
      '',
      '## Overview',
      'Use quiet density.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'component-selection-map.md'),
    '# Component selection map\n\nUse `DenseTable` for large datasets.',
    'utf8',
  );

  resetState();
  patchState({ workspacePath: root, projectName: 'Prompt project' });
  const prompt = await buildSystemPrompt();
  resetState();

  expect(prompt.text).toContain('## Project index');
  expect(prompt.text).toContain('Prompt DS');
  expect(prompt.text).toContain('DenseTable');
  expect(prompt.text).not.toContain('## Design index v2');
  expect(prompt.text).not.toContain('## Design system context');
  expect(prompt.text.indexOf('## Project index')).toBeLessThan(prompt.text.indexOf('## Catalog'));
});

test('system prompt exposes project system context shelf from the index', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-project-system-prompt-'));
  await generateProjectDesignContextFiles(root, {
    projectName: 'Context Shelf CRM',
    catalog: {
      source: 'static',
      generatedAt: Date.now(),
      components: [
        {
          id: 'components-data-table',
          title: 'Components/DataTable',
          shortName: 'DataTable',
          filePath: 'src/components/DataTable.tsx',
          description: 'Approval queue table with filters.',
          stories: [],
        },
      ],
    },
    include: 'both',
    overwrite: false,
  });

  resetState();
  patchState({ workspacePath: root, projectName: 'Context Shelf CRM' });
  const prompt = await buildSystemPrompt();
  resetState();

  expect(prompt.text).toContain('### Project System');
  expect(prompt.text).toContain('projectSystemFreshness:');
  expect(prompt.text).toContain('projectSystemNextAction:');
  expect(prompt.text).toContain('contextShelf:');
  expect(prompt.text).toContain('Components: ready');
  expect(prompt.text).toContain('.sber-designer/design-index/components.jsonl');
});

test('validate persists a design-context fingerprint and detects stale component changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-context-stale-'));
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await writeFile(
    join(root, 'DESIGN.md'),
    [
      '---',
      'version: alpha',
      'name: Stable DS',
      '---',
      '',
      '# Stable DS',
      '',
      '## Overview',
      'A compact system.',
      '',
      '## Components',
      'Use Button for actions.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'component-selection-map.md'),
    '# Component selection map\n\nUse `Button` for actions.',
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'Button.tsx'),
    'export const Button = () => null;',
  );

  const validated = await validateProjectDesignContext(root);
  expect(validated.validation.stale).toBe(false);
  expect(validated.validation.status).toBe('valid');

  await writeFile(
    join(root, 'src', 'components', 'Button.tsx'),
    'export const Button = () => "changed";',
  );

  const stale = await loadProjectDesignContext(root);
  expect(stale.validation.stale).toBe(true);
  expect(stale.validation.status).toBe('stale');
  expect(
    stale.diagnostics.some((item) => item.message.includes('changed since last validation')),
  ).toBe(true);
});

test('generates DESIGN.md and unified project index from catalog context', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-context-generate-'));
  const catalog: ComponentCatalog = {
    source: 'static',
    generatedAt: Date.now(),
    components: [
      {
        id: 'components-button',
        title: 'Components/Button',
        shortName: 'Button',
        filePath: 'src/components/Button.tsx',
        description: 'Primary, secondary, and destructive actions.',
        stories: [
          { id: 'components-button--primary', name: 'Primary', previewUrl: 'http://example' },
        ],
      },
      {
        id: 'components-data-table',
        title: 'Components/DataTable',
        shortName: 'DataTable',
        filePath: 'src/components/DataTable.tsx',
        description: 'Sortable data grids with filters and row actions.',
        stories: [],
      },
    ],
  };

  const result = await generateProjectDesignContextFiles(root, {
    projectName: 'Generated CRM',
    catalog,
    include: 'both',
    overwrite: false,
  });

  expect(result.changedFiles).toContain('DESIGN.md');
  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.manifest);
  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.promptSummary);
  expect(result.changedFiles).not.toContain('component-selection-map.md');
  expect(result.context.design.exists).toBe(true);
  expect(result.context.componentSelectionMap.exists).toBe(true);
  expect(result.context.validation.stale).toBe(false);

  const design = await readFile(join(root, 'DESIGN.md'), 'utf8');
  const summary = await readFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.promptSummary), 'utf8');
  expect(design).toContain('version: alpha');
  expect(design).toContain('# Generated CRM Design Brief');
  expect(design).toContain('## Components');
  expect(summary).toContain('Components/DataTable');
  expect(summary).toContain('Tables and lists');
});

test('generation falls back to workspace component files when catalog is sparse', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-context-discover-'));
  await mkdir(join(root, 'src', 'components', 'organisms', 'Tables'), { recursive: true });
  await writeFile(
    join(root, 'src', 'components', 'organisms', 'Tables', 'DataTable.tsx'),
    'export const DataTable = () => null;',
    'utf8',
  );

  const result = await generateProjectDesignContextFiles(root, {
    projectName: 'Discoverable DS',
    include: 'component-map',
    overwrite: false,
    catalog: {
      source: 'static',
      generatedAt: Date.now(),
      components: [],
    },
  });

  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.components);
  expect(result.changedFiles).not.toContain('component-selection-map.md');
  const components = await readFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.components), 'utf8');
  expect(components).toContain('organisms/Tables/DataTable');
  expect(components).toContain('src/components/organisms/Tables/DataTable.tsx');
});
