/**
 * 0133 tracks 1 and 3: resolving the catalog-component usage behind a selection
 * and writing props to that usage site instead of the component's own source.
 */
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { applyDesignChanges } from '../services/api/src/design-apply';
import { inspectDesignTarget, resolveTarget } from '../services/api/src/design-inspector';
import { resetIndexedComponentsCacheForTests } from '../services/api/src/design-inspector-component';

const BUTTON_SOURCE = [
  'export interface ActionButtonProps {',
  '  /** Visual emphasis. */',
  "  variant?: 'primary' | 'secondary';",
  '  disabled?: boolean;',
  '  label: string;',
  '}',
  '',
  "export function ActionButton({ variant = 'secondary', disabled, label }: ActionButtonProps) {",
  '  return <button disabled={disabled}>{label}</button>;',
  '}',
  '',
].join('\n');

const SCREEN_SOURCE = [
  "import { ActionButton } from '../components/ActionButton';",
  '',
  'export function DealScreen() {',
  '  return (',
  '    <section>',
  '      <ActionButton variant="primary" label="Save" />',
  '    </section>',
  '  );',
  '}',
  '',
].join('\n');

async function makeWorkspace(options: { withCatalog: boolean }): Promise<{
  root: string;
  screenPath: string;
  buttonPath: string;
}> {
  resetIndexedComponentsCacheForTests();
  const root = await mkdtemp(join(tmpdir(), 'sd-component-instance-'));
  await mkdir(join(root, 'src/components'), { recursive: true });
  await mkdir(join(root, 'src/screens'), { recursive: true });
  await writeFile(join(root, 'src/components/ActionButton.tsx'), BUTTON_SOURCE, 'utf8');
  await writeFile(join(root, 'src/screens/DealScreen.tsx'), SCREEN_SOURCE, 'utf8');
  if (options.withCatalog) {
    await mkdir(join(root, '.sber-designer/design-index'), { recursive: true });
    await writeFile(
      join(root, '.sber-designer/design-index/components.jsonl'),
      `${JSON.stringify({
        id: 'atoms-action-button',
        title: 'Atoms/ActionButton',
        shortName: 'ActionButton',
        filePath: 'src/components/ActionButton.tsx',
        storyCount: 1,
        stories: [{ id: 'atoms-action-button--primary', name: 'Primary' }],
        descriptionLayer: {
          purpose: 'Primary screen action.',
          anatomy: [],
          usage: [],
          agentGuidance: [],
          variantGuidance: [
            {
              prop: 'variant',
              values: [
                { value: 'primary', meaning: 'Main action of the screen.' },
                { value: 'secondary', meaning: 'Supporting action.' },
              ],
            },
          ],
        },
        tags: [],
        groupIds: [],
        noteCount: 0,
        confidence: 'high',
      })}\n`,
      'utf8',
    );
  }
  return {
    root,
    screenPath: 'src/screens/DealScreen.tsx',
    buttonPath: 'src/components/ActionButton.tsx',
  };
}

/** A click on the rendered `<button>`: source lands inside the component. */
function selectionInsideComponent(root: string) {
  const buttonLine = BUTTON_SOURCE.split('\n').findIndex((line) => line.includes('<button')) + 1;
  const usageLine =
    SCREEN_SOURCE.split('\n').findIndex((line) => line.includes('<ActionButton')) + 1;
  const usageColumn = (SCREEN_SOURCE.split('\n')[usageLine - 1]?.indexOf('<ActionButton') ?? 0) + 1;
  return {
    loc: `${join(root, 'src/components/ActionButton.tsx')}:${buttonLine}:10`,
    sourceKind: 'react-source' as const,
    tagName: 'BUTTON',
    componentName: 'ActionButton',
    componentLoc: `${join(root, 'src/screens/DealScreen.tsx')}:${usageLine}:${usageColumn}`,
    rect: { x: 0, y: 0, width: 80, height: 32 },
  };
}

test('resolves the screen usage site behind a click inside a library component', async () => {
  const workspace = await makeWorkspace({ withCatalog: true });
  const result = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    selection: selectionInsideComponent(workspace.root),
    activeScreen: { id: 'screen-1', implementationFilePath: workspace.screenPath },
  });

  const instance = result.componentInstance;
  expect(instance).toBeTruthy();
  expect(instance?.filePath).toBe(workspace.screenPath);
  expect(instance?.tagName).toBe('ActionButton');
  expect(instance?.componentId).toBe('atoms-action-button');
  expect(instance?.definitionFilePath).toBe(workspace.buttonPath);
  expect(instance?.editable).toBe(true);

  // Element target stays inside the component; only the instance moves.
  expect(result.target.filePath).toBe(workspace.buttonPath);
});

test('pairs declared params with the props the usage passes', async () => {
  const workspace = await makeWorkspace({ withCatalog: true });
  const result = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    selection: selectionInsideComponent(workspace.root),
    activeScreen: { id: 'screen-1', implementationFilePath: workspace.screenPath },
  });
  const params = new Map(result.componentInstance?.params.map((param) => [param.prop, param]));

  expect(params.get('variant')?.control).toBe('enum');
  expect(params.get('variant')?.defaultValue).toBe('secondary');
  expect(params.get('disabled')?.control).toBe('boolean');
  expect(params.get('label')?.required).toBe(true);

  // Description-layer meanings enrich the enum options.
  expect(
    params.get('variant')?.options?.find((option) => option.value === 'primary')?.meaning,
  ).toBe('Main action of the screen.');

  const props = new Map(result.componentInstance?.props.map((prop) => [prop.name, prop.value]));
  expect(props.get('variant')).toBe('primary');
  expect(props.get('label')).toBe('Save');
  expect(props.has('disabled')).toBe(false);
});

test('marks a usage outside the active screen as not editable', async () => {
  const workspace = await makeWorkspace({ withCatalog: true });
  const result = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    selection: selectionInsideComponent(workspace.root),
    activeScreen: { id: 'screen-2', implementationFilePath: 'src/screens/OtherScreen.tsx' },
  });

  expect(result.componentInstance?.editable).toBe(false);
  expect(result.componentInstance?.reason).toContain('DealScreen.tsx');
});

test('writes a prop to the usage site, not to the component source', async () => {
  const workspace = await makeWorkspace({ withCatalog: true });
  const inspected = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    selection: selectionInsideComponent(workspace.root),
    activeScreen: { id: 'screen-1', implementationFilePath: workspace.screenPath },
  });
  const instance = inspected.componentInstance!;

  const result = await applyDesignChanges({
    workspaceRoot: workspace.root,
    target: inspected.target,
    changes: [
      {
        kind: 'set-prop',
        targetId: inspected.target.id,
        filePath: instance.filePath,
        loc: { line: instance.line, column: instance.column },
        name: 'variant',
        value: JSON.stringify('secondary'),
        label: 'variant',
      },
    ],
    ...(instance.baseline ? { baseline: instance.baseline } : {}),
  });

  expect(result.changedFiles).toEqual([workspace.screenPath]);
  const screen = await readFile(join(workspace.root, workspace.screenPath), 'utf8');
  expect(screen).toContain('variant="secondary"');
  const button = await readFile(join(workspace.root, workspace.buttonPath), 'utf8');
  expect(button).toBe(BUTTON_SOURCE);
});

test('rewrites an existing prop in place, keeping attribute order', async () => {
  const workspace = await makeWorkspace({ withCatalog: true });
  const inspected = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    selection: selectionInsideComponent(workspace.root),
    activeScreen: { id: 'screen-1', implementationFilePath: workspace.screenPath },
  });
  const instance = inspected.componentInstance!;

  await applyDesignChanges({
    workspaceRoot: workspace.root,
    target: inspected.target,
    changes: [
      {
        kind: 'set-prop',
        targetId: inspected.target.id,
        filePath: instance.filePath,
        loc: { line: instance.line, column: instance.column },
        name: 'variant',
        value: JSON.stringify('secondary'),
        label: 'variant',
      },
    ],
  });

  // Flipping a param must read as a one-token diff, not a reshuffled line.
  const screen = await readFile(join(workspace.root, workspace.screenPath), 'utf8');
  expect(screen).toContain('<ActionButton variant="secondary" label="Save" />');
});

test('removes a prop when the control resets to the component default', async () => {
  const workspace = await makeWorkspace({ withCatalog: true });
  const inspected = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    selection: selectionInsideComponent(workspace.root),
    activeScreen: { id: 'screen-1', implementationFilePath: workspace.screenPath },
  });
  const instance = inspected.componentInstance!;

  await applyDesignChanges({
    workspaceRoot: workspace.root,
    target: inspected.target,
    changes: [
      {
        kind: 'remove-prop',
        targetId: inspected.target.id,
        filePath: instance.filePath,
        loc: { line: instance.line, column: instance.column },
        name: 'variant',
        label: 'variant',
      },
    ],
  });

  const screen = await readFile(join(workspace.root, workspace.screenPath), 'utf8');
  expect(screen).not.toContain('variant=');
  expect(screen).toContain('label="Save"');
});

test('still rejects a change pointing at an unrelated location', async () => {
  const workspace = await makeWorkspace({ withCatalog: true });
  const target = resolveTarget(workspace.root, selectionInsideComponent(workspace.root));

  await expect(
    applyDesignChanges({
      workspaceRoot: workspace.root,
      target,
      changes: [
        {
          kind: 'set-prop',
          targetId: target.id,
          filePath: 'src/screens/DealScreen.tsx',
          loc: { line: 999, column: 1 },
          name: 'variant',
          value: JSON.stringify('secondary'),
          label: 'variant',
        },
      ],
    }),
  ).rejects.toThrow('no longer matches');
});

test('works without a design index by reading the component source directly', async () => {
  const workspace = await makeWorkspace({ withCatalog: false });
  const result = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    selection: selectionInsideComponent(workspace.root),
    activeScreen: { id: 'screen-1', implementationFilePath: workspace.screenPath },
  });

  expect(result.componentInstance?.componentId).toBeUndefined();
  expect(result.componentInstance?.params.map((param) => param.prop)).toContain('variant');
});

test('refreshes a same-length component-index update without restarting', async () => {
  const workspace = await makeWorkspace({ withCatalog: true });
  const first = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    selection: selectionInsideComponent(workspace.root),
    activeScreen: { id: 'screen-1', implementationFilePath: workspace.screenPath },
  });
  expect(first.componentInstance?.componentId).toBe('atoms-action-button');

  const indexPath = join(workspace.root, '.sber-designer/design-index/components.jsonl');
  const before = await readFile(indexPath, 'utf8');
  const after = before.replace('atoms-action-button', 'atoms-action-toggle');
  expect(after.length).toBe(before.length);
  await writeFile(indexPath, after, 'utf8');

  const second = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    selection: selectionInsideComponent(workspace.root),
    activeScreen: { id: 'screen-1', implementationFilePath: workspace.screenPath },
  });
  expect(second.componentInstance?.componentId).toBe('atoms-action-toggle');
});
