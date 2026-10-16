import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { scanComponentUsage } from '../packages/design-indexer/src/usage-scanner';
import type { IndexedComponentRecord } from '../packages/design-indexer/src/types';

function record(partial: Partial<IndexedComponentRecord> & { id: string }): IndexedComponentRecord {
  return {
    title: partial.id,
    shortName: partial.id,
    filePath: 'src/unknown.tsx',
    storyCount: 0,
    stories: [],
    tags: [],
    groupIds: [],
    noteCount: 0,
    confidence: 'low',
    ...partial,
  } as IndexedComponentRecord;
}

async function write(root: string, filePath: string, contents: string): Promise<void> {
  await mkdir(join(root, filePath, '..'), { recursive: true });
  await writeFile(join(root, filePath), contents);
}

async function createMuiStyleWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-usage-scan-mui-'));
  await write(
    root,
    'src/components/atoms/Button/Button.tsx',
    [
      "import React from 'react';",
      "export interface ButtonProps { variant?: 'outlined' | 'contained'; children?: React.ReactNode }",
      'export function Button(props: ButtonProps) { return <button>{props.children}</button>; }',
    ].join('\n'),
  );
  await write(root, 'src/components/atoms/Button/index.ts', "export * from './Button';\n");
  await write(
    root,
    'src/components/molecules/StatusChip/StatusChip.tsx',
    'export function StatusChip(props: { kind: string; label?: string }) { return <span>{props.kind}</span>; }\n',
  );
  await write(
    root,
    'src/screens/PaymentsPage.tsx',
    [
      "import { Button } from '../components/atoms/Button';",
      "import { StatusChip } from '../components/molecules/StatusChip/StatusChip';",
      'export function PaymentsPage() {',
      '  return (',
      '    <div>',
      '      <Button variant="outlined" startIcon={<i />}>Export</Button>',
      '      <Button variant="outlined" startIcon={<i />}>Filter</Button>',
      '      <Button variant="contained">Add payment</Button>',
      '      <StatusChip kind="success" label="Paid" />',
      '    </div>',
      '  );',
      '}',
    ].join('\n'),
  );
  await write(
    root,
    'src/components/atoms/Button/Button.stories.tsx',
    [
      "import { Button } from './Button';",
      'export default { title: "Atoms/Button", component: Button };',
      'export const Contained = () => <Button variant="contained">Save</Button>;',
    ].join('\n'),
  );
  return root;
}

const MUI_COMPONENTS = [
  record({
    id: 'atoms-button',
    title: 'Atoms/Button',
    shortName: 'Button',
    filePath: 'src/components/atoms/Button/index.ts',
  }),
  record({
    id: 'molecules-statuschip',
    title: 'Molecules/StatusChip',
    shortName: 'StatusChip',
    filePath: 'src/components/molecules/StatusChip/StatusChip.tsx',
  }),
];

test('mines usages, clusters by prop shape, and reads literal props', async () => {
  const root = await createMuiStyleWorkspace();
  const result = await scanComponentUsage({ workspaceRoot: root, components: MUI_COMPONENTS });

  const buttonSnippets = result.snippets.filter((s) => s.componentId === 'atoms-button');
  expect(buttonSnippets.length).toBeGreaterThanOrEqual(2);
  const outlined = buttonSnippets.find((s) => s.propsPreview.variant === 'outlined');
  expect(outlined).toBeDefined();
  expect(outlined?.count).toBe(2);
  expect(outlined?.propNames).toEqual(['startIcon', 'variant']);
  expect(outlined?.origin).toBe('screen');
  expect(outlined?.code).toContain('<Button variant="outlined"');
  expect(outlined?.code).toContain('</Button>');

  const stats = result.stats.find((s) => s.componentId === 'atoms-button');
  expect(stats?.totalCount).toBe(4);
  expect(stats?.pairsWith).toContainEqual({ componentId: 'molecules-statuschip', count: 1 });
});

test('flat named-export stack (no Storybook anywhere) is mined the same way', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-usage-scan-flat-'));
  await write(
    root,
    'components/ui/badge.tsx',
    'export function Badge({ tone }: { tone?: string }) { return <em>{tone}</em>; }\n',
  );
  await write(
    root,
    'app/page.tsx',
    [
      "import { Badge } from '../components/ui/badge';",
      'export default function Page() {',
      '  return <main><Badge tone="success" /><Badge tone="success" /></main>;',
      '}',
    ].join('\n'),
  );
  const result = await scanComponentUsage({
    workspaceRoot: root,
    components: [
      record({ id: 'ui-badge', shortName: 'Badge', filePath: 'components/ui/badge.tsx' }),
    ],
  });
  const badge = result.snippets.find((s) => s.componentId === 'ui-badge');
  expect(badge?.count).toBe(2);
  expect(badge?.propsPreview.tone).toBe('success');
  expect(badge?.origin).toBe('screen');
});

test('ambiguous short names without import evidence are skipped; path evidence resolves them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-usage-scan-ambiguous-'));
  await write(
    root,
    'src/views/Detail.tsx',
    [
      "import { Link } from '../components/atoms/Link/Link';",
      'export const Detail = () => <Link href="/a">a</Link>;',
    ].join('\n'),
  );
  await write(
    root,
    'src/views/NoImport.tsx',
    'export const NoImport = () => <Link href="/b">b</Link>;\n',
  );
  const components = [
    record({ id: 'atoms-link', shortName: 'Link', filePath: 'src/components/atoms/Link/Link.tsx' }),
    record({ id: 'nav-link', shortName: 'Link', filePath: 'src/components/nav/Link/Link.tsx' }),
  ];
  const result = await scanComponentUsage({ workspaceRoot: root, components });
  const atoms = result.stats.find((s) => s.componentId === 'atoms-link');
  const nav = result.stats.find((s) => s.componentId === 'nav-link');
  expect(atoms?.totalCount).toBe(1);
  expect(nav).toBeUndefined();
});

test('usages inside the component own directory are marked internal', async () => {
  const root = await createMuiStyleWorkspace();
  const result = await scanComponentUsage({ workspaceRoot: root, components: MUI_COMPONENTS });
  const storySnippet = result.snippets.find(
    (s) => s.componentId === 'atoms-button' && s.sourcePath.includes('.stories.'),
  );
  expect(storySnippet?.origin).toBe('story');
});

test('corpus roots are mined and prefixed; scan is deterministic', async () => {
  const root = await createMuiStyleWorkspace();
  const corpus = await mkdtemp(join(tmpdir(), 'sd-usage-scan-corpus-'));
  await write(
    corpus,
    'src/App.tsx',
    [
      "import { Button } from 'ui-kit/src/components/atoms/Button';",
      'export const App = () => <Button variant="outlined" size="small">Go</Button>;',
    ].join('\n'),
  );
  const first = await scanComponentUsage({
    workspaceRoot: root,
    components: MUI_COMPONENTS,
    corpusRoots: [corpus],
  });
  const second = await scanComponentUsage({
    workspaceRoot: root,
    components: MUI_COMPONENTS,
    corpusRoots: [corpus],
  });
  expect(second).toEqual(first);
  const corpusUsage = first.snippets.find((s) => s.origin === 'corpus');
  expect(corpusUsage).toBeDefined();
  expect(corpusUsage?.sourcePath.endsWith('src/App.tsx')).toBe(true);

  const stats = first.stats.find((s) => s.componentId === 'atoms-button');
  expect(stats?.totalCount).toBe(5);
});

test('long elements are trimmed to a budgeted snippet', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-usage-scan-trim-'));
  const rows = Array.from({ length: 30 }, (_, i) => `      <tr key={${i}}><td>r${i}</td></tr>`);
  await write(
    root,
    'src/screens/Big.tsx',
    [
      "import { DataTable } from '../components/DataTable/DataTable';",
      'export const Big = () => (',
      '  <DataTable dense>',
      ...rows,
      '  </DataTable>',
      ');',
    ].join('\n'),
  );
  const result = await scanComponentUsage({
    workspaceRoot: root,
    components: [
      record({
        id: 'datatable',
        shortName: 'DataTable',
        filePath: 'src/components/DataTable/DataTable.tsx',
      }),
    ],
  });
  const snippet = result.snippets[0];
  expect(snippet).toBeDefined();
  expect(snippet.code.split('\n').length).toBeLessThanOrEqual(15);
  expect(snippet.code).toContain('{/* … */}');
  expect(snippet.code.trim().endsWith('</DataTable>')).toBe(true);
});
