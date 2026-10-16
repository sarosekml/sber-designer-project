import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { DesignInspectResult } from '@sber-designer/shared-types';

import { inspectDesignTarget } from '../services/api/src/design-inspector';

test('inspects simple JSX props, text, className and style object', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-inspect-'));
  const source = [
    'export function Demo() {',
    '  return <button className="primary" style={{ backgroundColor: "green", borderRadius: "8px" }} aria-label="Add note">Add note</button>;',
    '}',
    '',
  ].join('\n');
  await writeFile(join(root, 'Demo.tsx'), source, 'utf8');
  const loc = locOf(source, '<button');

  const result = await inspectDesignTarget({
    workspaceRoot: root,
    selection: {
      loc: `Demo.tsx:${loc.line}:${loc.column}`,
      sourceKind: 'react-source',
      tagName: 'BUTTON',
      text: 'Add note',
      rect: { x: 0, y: 0, width: 100, height: 32 },
    },
  });

  expect(result.editable).toBe(true);
  expectSharedDesignProtocol(result);
  expect(result.projectSupport).toBe('design-readable');
  expect(result.sourceScope).toBe('screen-instance');
  expect(result.capabilities.text).toMatchObject({
    status: 'editable',
    operations: ['set-children-text'],
  });
  expect(result.capabilities.props.operations).toContain('set-prop');
  expect(result.capabilities.props.operations).toContain('remove-prop');
  expect(result.capabilities.style.operations).toContain('set-style');
  expect(result.capabilities.className.operations).toContain('set-class-token');
  expect(result.target.filePath).toBe('Demo.tsx');
  expect(result.jsx?.childrenText).toBe('Add note');
  expect(result.jsx?.props).toContainEqual({
    name: 'aria-label',
    value: 'Add note',
    kind: 'string',
    editable: true,
  });
  expect(result.styles?.className).toBe('primary');
  expect(result.styles?.styleObject).toMatchObject({
    backgroundColor: 'green',
    borderRadius: '8px',
  });
  expect(result.baseline?.hash).toHaveLength(64);
});

test('marks spread props and mixed children read-only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-inspect-complex-'));
  const source = [
    'export function Demo(props: { label: string }) {',
    '  return <Button {...props}>Save <strong>now</strong></Button>;',
    '}',
    '',
  ].join('\n');
  await writeFile(join(root, 'Demo.tsx'), source, 'utf8');
  const loc = locOf(source, '<Button');

  const result = await inspectDesignTarget({
    workspaceRoot: root,
    selection: {
      loc: `Demo.tsx:${loc.line}:${loc.column}`,
      sourceKind: 'react-source',
      tagName: 'BUTTON',
      rect: { x: 0, y: 0, width: 100, height: 32 },
    },
  });

  expect(result.jsx?.props[0]).toMatchObject({ kind: 'spread', editable: false });
  expect(result.jsx?.childrenEditable).toBe(false);
  expect(result.jsx?.childrenReason).toContain('Mixed JSX children');
  expect(result.capabilities.text.status).toBe('assistant-only');
  expect(result.capabilities.text.reason).toContain('Mixed JSX children');
  expect(result.capabilities.props.status).toBe('assistant-only');
});

test('returns non-editable metadata for dom fallback selection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-inspect-dom-'));
  const result = await inspectDesignTarget({
    workspaceRoot: root,
    selection: {
      loc: 'dom://main > button',
      sourceKind: 'dom-fallback',
      tagName: 'BUTTON',
      text: 'Pay now',
      selector: 'main > button.primary',
      attributes: { 'aria-label': 'Pay now' },
      rect: { x: 0, y: 0, width: 100, height: 32 },
    },
  });

  expect(result.editable).toBe(false);
  expect(result.projectSupport).toBe('baseline-selection');
  expect(result.sourceScope).toBe('unknown');
  expect(result.target.text).toBe('Pay now');
  expect(result.target.selector).toBe('main > button.primary');
  expect(result.capabilities.text.status).toBe('unmapped');
  expect(result.capabilities.props.status).toBe('unmapped');
  expect(result.reason).toContain('no safe React source location');
});

test('does not guess a source target when generated screen controls are ambiguous', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-inspect-ambiguous-'));
  const source = [
    'export function Demo() {',
    '  return (',
    '    <main>',
    '      <Button>Approve</Button>',
    '      <Button>Approve</Button>',
    '    </main>',
    '  );',
    '}',
    '',
  ].join('\n');
  await mkdir(join(root, 'src/screens'), { recursive: true });
  await writeFile(join(root, 'src/screens/Demo.tsx'), source, 'utf8');

  const result = await inspectDesignTarget({
    workspaceRoot: root,
    activeScreen: {
      id: 'demo',
      implementationFilePath: 'src/screens/Demo.tsx',
    },
    selection: {
      loc: 'dom://main > button:nth-of-type(1)',
      sourceKind: 'dom-fallback',
      tagName: 'BUTTON',
      text: 'Approve',
      componentName: 'Button',
      rect: { x: 0, y: 0, width: 100, height: 32 },
    },
  });

  expect(result.editable).toBe(false);
  expect(result.target.sourceKind).toBe('dom-fallback');
  expect(result.diagnostics[0]?.code).toBe('design.baseline.dom-fallback');
});

test('derives source scope from active screen source ownership', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-scope-'));
  const screenSource = [
    'export function DemoScreen() {',
    '  return <main>Screen</main>;',
    '}',
  ].join('\n');
  const storySource = [
    'export const DemoStory = () => <DemoScreen />;',
    'export const Wrapper = () => <section>Story</section>;',
  ].join('\n');
  const componentSource = [
    'export function Button() {',
    '  return <button>Shared</button>;',
    '}',
  ].join('\n');
  await mkdir(join(root, 'src/screens'), { recursive: true });
  await mkdir(join(root, 'src/stories'), { recursive: true });
  await mkdir(join(root, 'src/components'), { recursive: true });
  await writeFile(join(root, 'src/screens/DemoScreen.tsx'), screenSource, { encoding: 'utf8' });
  await writeFile(join(root, 'src/stories/Demo.stories.tsx'), storySource, { encoding: 'utf8' });
  await writeFile(join(root, 'src/components/Button.tsx'), componentSource, { encoding: 'utf8' });

  const activeScreen = {
    id: 'demo',
    filePath: 'src/stories/Demo.stories.tsx',
    implementationFilePath: 'src/screens/DemoScreen.tsx',
  };

  const screenLoc = locOf(screenSource, '<main');
  const storyLoc = locOf(storySource, '<section');
  const componentLoc = locOf(componentSource, '<button');

  const screen = await inspectDesignTarget({
    workspaceRoot: root,
    activeScreen,
    selection: {
      loc: `src/screens/DemoScreen.tsx:${screenLoc.line}:${screenLoc.column}`,
      sourceKind: 'react-source',
      tagName: 'MAIN',
      rect: { x: 0, y: 0, width: 100, height: 32 },
    },
  });
  const story = await inspectDesignTarget({
    workspaceRoot: root,
    activeScreen,
    selection: {
      loc: `src/stories/Demo.stories.tsx:${storyLoc.line}:${storyLoc.column}`,
      sourceKind: 'react-source',
      tagName: 'SECTION',
      rect: { x: 0, y: 0, width: 100, height: 32 },
    },
  });
  const component = await inspectDesignTarget({
    workspaceRoot: root,
    activeScreen,
    selection: {
      loc: `src/components/Button.tsx:${componentLoc.line}:${componentLoc.column}`,
      sourceKind: 'react-source',
      tagName: 'BUTTON',
      rect: { x: 0, y: 0, width: 100, height: 32 },
    },
  });

  expect(screen.sourceScope).toBe('screen-instance');
  expect(story.sourceScope).toBe('storybook-wrapper');
  expect(component.sourceScope).toBe('component-definition');
});

function expectSharedDesignProtocol(result: DesignInspectResult): void {
  expect(result.target.id).toBeTruthy();
}

function locOf(source: string, needle: string): { line: number; column: number } {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`Missing ${needle}`);
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1]!.length + 1 };
}
