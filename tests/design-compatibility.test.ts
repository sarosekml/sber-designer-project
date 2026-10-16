import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import {
  validateDesignScreenCompatibility,
  type DesignCompatibilityResult,
} from '../services/api/src/design-compatibility';
import { designRouter } from '../services/api/src/routes/design';
import { ALL_TOOLS } from '../services/api/src/agent/toolset';
import type { ToolContext } from '../services/api/src/agent/types';

test('compatibility validator marks generated TSX screens as Design-readable', async () => {
  const root = await createCompatibilityWorkspace({
    screenSource: [
      'export function PaymentsScreen() {',
      '  return (',
      '    <main className="space-y-4 bg-surface-default p-6">',
      '      <header><h1>Payment Approvals</h1><p>Review queued payments.</p></header>',
      '      <DataTable variant="compact" />',
      '      <Button variant="primary">Approve</Button>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
  });

  const result = await validateDesignScreenCompatibility({
    workspaceRoot: root,
    screen: { screenId: 'payments' },
  });

  expect(result.status).toBe('compatible');
  expect(result.projectSupport).toBe('design-readable');
  expect(result.target.filePath).toBe('src/screens/PaymentsScreen.tsx');
  expect(result.target.sourceScope).toBe('screen-instance');
  expect(result.summary.jsxElements).toBeGreaterThan(4);
  expect(result.summary.inspectableElements).toBeGreaterThan(3);
  expect(result.summary.indexedComponentsUsed).toContain('DataTable');
  expect(result.summary.indexedTokensUsed).toContain('surface-default');
  expect(result.diagnostics.some((item) => item.level === 'error')).toBe(false);
});

test('compatibility validator flags raw HTML hidden from Design mode', async () => {
  const root = await createCompatibilityWorkspace({
    screenSource: [
      'export function PaymentsScreen() {',
      '  const raw = "<button>Approve</button>";',
      '  return <main dangerouslySetInnerHTML={{ __html: raw }} />;',
      '}',
      '',
    ].join('\n'),
  });

  const result = await validateDesignScreenCompatibility({
    workspaceRoot: root,
    screen: { implementationFilePath: 'src/screens/PaymentsScreen.tsx' },
  });

  expect(result.status).toBe('needs-review');
  expect(result.projectSupport).toBe('baseline-selection');
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      level: 'error',
      code: 'design.raw-html',
    }),
  );
});

test('compatibility validator warns about complex className and style expressions', async () => {
  const root = await createCompatibilityWorkspace({
    screenSource: [
      'export function PaymentsScreen({ active, computedStyle }: { active: boolean; computedStyle: React.CSSProperties }) {',
      '  return <main className={active ? "bg-surface-default" : "bg-muted"} style={computedStyle}><h1>Payments</h1></main>;',
      '}',
      '',
    ].join('\n'),
  });

  const result = await validateDesignScreenCompatibility({
    workspaceRoot: root,
    screen: { filePath: 'src/screens/PaymentsScreen.tsx' },
  });

  expect(result.status).toBe('needs-review');
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ level: 'warning', code: 'design.complex-className' }),
  );
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ level: 'warning', code: 'design.complex-style' }),
  );
});

test('compatibility validator reports missing source files without throwing', async () => {
  const root = await createCompatibilityWorkspace({
    screenSource: 'export function PaymentsScreen() { return <main />; }',
  });

  const result = await validateDesignScreenCompatibility({
    workspaceRoot: root,
    screen: { implementationFilePath: 'src/screens/MissingScreen.tsx' },
  });

  expect(result.status).toBe('missing');
  expect(result.projectSupport).toBe('baseline-selection');
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ level: 'error', code: 'design.source-missing' }),
  );
});

test('compatibility validator reports unresolved named workspace imports', async () => {
  const root = await createCompatibilityWorkspace({
    screenSource: [
      "import { BaseCard } from '@/components/molecules';",
      '',
      'export function PaymentsScreen() {',
      '  return <main><BaseCard>Deal</BaseCard></main>;',
      '}',
      '',
    ].join('\n'),
  });
  await mkdir(join(root, 'src', 'components', 'molecules', 'Card'), { recursive: true });
  await writeFile(
    join(root, 'src', 'components', 'molecules', 'index.ts'),
    "export * from './Card';\n",
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'molecules', 'Card', 'index.ts'),
    "export { BaseCard as Card } from './Card';\n",
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'molecules', 'Card', 'Card.tsx'),
    'export const BaseCard = () => null;\n',
    'utf8',
  );

  const result = await validateDesignScreenCompatibility({
    workspaceRoot: root,
    screen: { screenId: 'payments' },
  });

  expect(result.status).toBe('needs-review');
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      level: 'error',
      code: 'design.workspace-imports',
      message: expect.stringContaining('has no named export BaseCard'),
    }),
  );
});

test('compatibility route and agent tool expose the same validator result', async () => {
  const root = await createCompatibilityWorkspace({
    screenSource: [
      'export function PaymentsScreen() {',
      '  return <main className="bg-surface-default"><h1>Payments</h1></main>;',
      '}',
    ].join('\n'),
  });

  const routeResponse = await designRouter.request('http://localhost/compatibility', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      workspacePath: root,
      screen: { screenId: 'payments' },
    }),
  });
  const routeBody = (await routeResponse.json()) as DesignCompatibilityResult;

  const toolBody = (await findTool('validate_design_screen').handler(
    { screenId: 'payments' },
    toolContext(root),
  )) as DesignCompatibilityResult;

  expect(routeResponse.status).toBe(200);
  expect(routeBody.status).toBe('compatible');
  expect(toolBody.status).toBe(routeBody.status);
  expect(toolBody.target.filePath).toBe(routeBody.target.filePath);
});

async function createCompatibilityWorkspace(input: { screenSource: string }): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-compat-'));
  await mkdir(join(root, 'src', 'screens'), { recursive: true });
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await mkdir(join(root, '.sber-designer/design-index'), { recursive: true });
  await writeFile(join(root, 'src', 'screens', 'PaymentsScreen.tsx'), input.screenSource, 'utf8');
  await writeFile(
    join(root, 'src', 'components', 'DataTable.tsx'),
    'export function DataTable() { return <table />; }',
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'Button.tsx'),
    'export function Button() { return <button />; }',
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.screens),
    [
      JSON.stringify({
        id: 'payments',
        name: 'Payments',
        implementationPath: 'src/screens/PaymentsScreen.tsx',
        storyPath: 'src/stories/PaymentsScreen.stories.tsx',
        routePath: '/payments',
        designReadableStatus: 'candidate',
        source: 'route',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    [
      JSON.stringify({
        id: 'components-data-table',
        title: 'Components/DataTable',
        shortName: 'DataTable',
        filePath: 'src/components/DataTable.tsx',
        storyCount: 1,
        stories: [{ id: 'components-data-table--default', name: 'Default' }],
        tags: [],
        groupIds: [],
        noteCount: 0,
        confidence: 'high',
      }),
      JSON.stringify({
        id: 'components-button',
        title: 'Components/Button',
        shortName: 'Button',
        filePath: 'src/components/Button.tsx',
        storyCount: 1,
        stories: [{ id: 'components-button--default', name: 'Default' }],
        tags: [],
        groupIds: [],
        noteCount: 0,
        confidence: 'high',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.tokens),
    JSON.stringify(
      {
        tokens: [
          {
            id: 'css:src/styles/tokens.css:surface-default',
            name: 'surface-default',
            value: '#ffffff',
            source: 'css',
            filePath: 'src/styles/tokens.css',
            kind: 'color',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.projectProfile),
    JSON.stringify(
      {
        packageManager: 'bun',
        frameworks: ['react'],
        sourceRoots: ['src'],
        styling: ['tailwind'],
        aliases: {},
        packageScripts: {},
      },
      null,
      2,
    ),
    'utf8',
  );
  return root;
}

function findTool(name: string) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

function toolContext(workspacePath: string): ToolContext {
  return {
    user: 'test-user',
    projectName: 'Compatibility Project',
    activeScreen: null,
    workspacePath,
    canvasUrl: null,
  };
}
