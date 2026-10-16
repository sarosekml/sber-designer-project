/**
 * 0082 Track 1: story files documenting the same component (same CSF
 * `component:` + import source) collapse into one catalog entry keyed by the
 * public component identity, instead of one fake "component" per story title.
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { indexFromStorybook } from '../packages/storybook-indexer/src';

async function write(root: string, filePath: string, contents: string): Promise<void> {
  await mkdir(join(root, filePath, '..'), { recursive: true });
  await writeFile(join(root, filePath), contents);
}

function tableStory(title: string): string {
  return [
    "import { Table } from '@/components/organisms/Tables';",
    'export default {',
    `  title: '${title}',`,
    '  component: Table,',
    '};',
    'export const Default = {};',
  ].join('\n');
}

function indexJson(entries: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ v: 5, entries }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0082-identity-'));
  await write(
    root,
    'src/components/organisms/Tables/stories/Table.Basic.stories.tsx',
    tableStory('Organisms/Table/Basic'),
  );
  await write(
    root,
    'src/components/organisms/Tables/stories/Table.Configuration.stories.tsx',
    tableStory('Organisms/Table/Configuration'),
  );
  await write(
    root,
    'src/components/atoms/Button/Button.stories.tsx',
    [
      "import { Button } from '@/components/atoms/Button';",
      "export default { title: 'Atoms/Button', component: Button };",
      'export const Primary = {};',
    ].join('\n'),
  );
  return root;
}

const ENTRIES = {
  'organisms-table-basic--default': {
    id: 'organisms-table-basic--default',
    type: 'story',
    name: 'Default',
    title: 'Organisms/Table/Basic',
    importPath: './src/components/organisms/Tables/stories/Table.Basic.stories.tsx',
  },
  'organisms-table-configuration--default': {
    id: 'organisms-table-configuration--default',
    type: 'story',
    name: 'Default',
    title: 'Organisms/Table/Configuration',
    importPath: './src/components/organisms/Tables/stories/Table.Configuration.stories.tsx',
  },
  'atoms-button--primary': {
    id: 'atoms-button--primary',
    type: 'story',
    name: 'Primary',
    title: 'Atoms/Button',
    importPath: './src/components/atoms/Button/Button.stories.tsx',
  },
};

test('story files sharing one CSF component collapse into a single public entry', async () => {
  const root = await createWorkspace();
  const catalog = await indexFromStorybook('http://localhost:6006', {
    fetchImpl: async () => indexJson(ENTRIES),
    workspaceRoot: root,
  });

  // Two Table story files + one Button -> two components, not three.
  expect(catalog.components).toHaveLength(2);

  const table = catalog.components.find((component) => component.shortName === 'Table');
  expect(table).toBeDefined();
  // Public identity, common title prefix, merged stories from both files.
  expect(table?.title).toBe('Organisms/Table');
  expect(table?.id).toBe('organisms-table');
  expect(table?.stories).toHaveLength(2);

  // The standalone single-story component is untouched.
  const button = catalog.components.find((component) => component.shortName === 'Button');
  expect(button?.title).toBe('Atoms/Button');
  expect(button?.id).toBe('atoms-button');
  expect(button?.stories).toHaveLength(1);

  // No fragmented story-name pseudo-components survive.
  expect(catalog.components.map((component) => component.shortName)).not.toContain('Configuration');
});

test('different components with the same local name from different sources do not merge', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-0082-collision-'));
  await write(
    root,
    'src/a/Card.stories.tsx',
    [
      "import { Card } from '@/components/a/Card';",
      "export default { title: 'A/Card', component: Card };",
      'export const D = {};',
    ].join('\n'),
  );
  await write(
    root,
    'src/b/Card.stories.tsx',
    [
      "import { Card } from '@/components/b/Card';",
      "export default { title: 'B/Card', component: Card };",
      'export const D = {};',
    ].join('\n'),
  );
  const catalog = await indexFromStorybook('http://localhost:6006', {
    fetchImpl: async () =>
      indexJson({
        'a-card--d': {
          id: 'a-card--d',
          type: 'story',
          name: 'D',
          title: 'A/Card',
          importPath: './src/a/Card.stories.tsx',
        },
        'b-card--d': {
          id: 'b-card--d',
          type: 'story',
          name: 'D',
          title: 'B/Card',
          importPath: './src/b/Card.stories.tsx',
        },
      }),
    workspaceRoot: root,
  });
  // Same local name `Card`, different import sources -> two distinct entries.
  expect(catalog.components).toHaveLength(2);
  expect(catalog.components.map((c) => c.title).sort()).toEqual(['A/Card', 'B/Card']);
});

test('without source access (no workspaceRoot) grouping falls back to title', async () => {
  const catalog = await indexFromStorybook('http://localhost:6006', {
    fetchImpl: async () => indexJson(ENTRIES),
  });
  // No metadata -> per-title grouping: three separate entries.
  expect(catalog.components).toHaveLength(3);
  expect(catalog.components.map((c) => c.shortName).sort()).toEqual([
    'Basic',
    'Button',
    'Configuration',
  ]);
});
