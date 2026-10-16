import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { inspectDesignTarget } from '../services/api/src/design-inspector';

test('design inspector resolves source ownership from indexed screens without active screen state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-inspect-index-'));
  const screenSource = [
    'export function DashboardScreen() {',
    '  return <main>Dashboard</main>;',
    '}',
  ].join('\n');
  const storySource = [
    'export const Dashboard = () => <DashboardScreen />;',
    'export const Wrapper = () => <section>Story wrapper</section>;',
  ].join('\n');
  const componentSource = [
    'export function SharedButton() {',
    '  return <button>Shared</button>;',
    '}',
  ].join('\n');

  await mkdir(join(root, 'src/screens'), { recursive: true });
  await mkdir(join(root, 'src/stories'), { recursive: true });
  await mkdir(join(root, 'src/components'), { recursive: true });
  await mkdir(join(root, '.sber-designer/design-index'), { recursive: true });
  await writeFile(join(root, 'src/screens/DashboardScreen.tsx'), screenSource, 'utf8');
  await writeFile(join(root, 'src/stories/Dashboard.stories.tsx'), storySource, 'utf8');
  await writeFile(join(root, 'src/components/SharedButton.tsx'), componentSource, 'utf8');
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.screens),
    [
      JSON.stringify({
        id: 'dashboard',
        name: 'Dashboard',
        implementationPath: 'src/screens/DashboardScreen.tsx',
        storyPath: 'src/stories/Dashboard.stories.tsx',
        designReadableStatus: 'compatible',
        source: 'catalog-story',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.projectProfile),
    JSON.stringify(
      {
        packageManager: 'bun',
        frameworks: ['react'],
        sourceRoots: ['src'],
        styling: ['css'],
        aliases: {},
        packageScripts: {},
      },
      null,
      2,
    ),
    'utf8',
  );

  const screenLoc = locOf(screenSource, '<main');
  const storyLoc = locOf(storySource, '<section');
  const componentLoc = locOf(componentSource, '<button');

  const screen = await inspectDesignTarget({
    workspaceRoot: root,
    selection: {
      loc: `src/screens/DashboardScreen.tsx:${screenLoc.line}:${screenLoc.column}`,
      sourceKind: 'react-source',
      tagName: 'MAIN',
      rect: { x: 0, y: 0, width: 100, height: 32 },
    },
  });
  const story = await inspectDesignTarget({
    workspaceRoot: root,
    selection: {
      loc: `src/stories/Dashboard.stories.tsx:${storyLoc.line}:${storyLoc.column}`,
      sourceKind: 'react-source',
      tagName: 'SECTION',
      rect: { x: 0, y: 0, width: 100, height: 32 },
    },
  });
  const component = await inspectDesignTarget({
    workspaceRoot: root,
    selection: {
      loc: `src/components/SharedButton.tsx:${componentLoc.line}:${componentLoc.column}`,
      sourceKind: 'react-source',
      tagName: 'BUTTON',
      rect: { x: 0, y: 0, width: 100, height: 32 },
    },
  });

  expect(screen.sourceScope).toBe('screen-instance');
  expect(story.sourceScope).toBe('storybook-wrapper');
  expect(component.sourceScope).toBe('component-definition');
});

function locOf(source: string, needle: string): { line: number; column: number } {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`Missing ${needle}`);
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1]!.length + 1 };
}
