import { expect, test } from 'bun:test';

import {
  normalizeLayerTree,
  stableLayerId,
  type LayerSnapshotNode,
} from '../apps/web/src/lib/layer-tree';
import { resolveInsertPolicy } from '../apps/web/src/lib/insert-policy';
import type { ProjectScreen } from '../packages/shared-types/src';

const screen: ProjectScreen = {
  id: 'payments',
  name: 'Payments',
  kind: 'page',
  filePath: 'src/screens/Payments.tsx',
  implementationFilePath: 'src/screens/Payments.tsx',
};

test('normalizes bridge layer snapshots with stable ids and source ownership', () => {
  const snapshot: LayerSnapshotNode = {
    tagName: 'MAIN',
    loc: 'src/screens/Payments.tsx:5:5',
    sourceKind: 'react-source',
    domPath: 'html > body > main',
    rect: { x: 0, y: 0, width: 960, height: 640 },
    children: [
      {
        tagName: 'Button',
        componentName: 'Button',
        loc: 'src/components/Button.tsx:12:3',
        sourceKind: 'react-source',
        domPath: 'html > body > main > button',
        selector: 'button[aria-label="Approve"]',
        rect: { x: 32, y: 48, width: 140, height: 40 },
        text: 'Approve',
        children: [],
      },
    ],
  };

  const tree = normalizeLayerTree(snapshot, { activeScreen: screen });

  expect(tree?.id).toBe('source:react-source:src/screens/Payments.tsx:5:5');
  expect(tree?.sourceScope).toBe('screen-instance');
  expect(tree?.children[0]?.id).toBe('source:react-source:src/components/Button.tsx:12:3');
  expect(tree?.children[0]?.sourceScope).toBe('component-definition');
});

test('dom fallback layer ids stay stable across snapshots through dom path or selector', () => {
  expect(
    stableLayerId({
      tagName: 'BUTTON',
      sourceKind: 'dom-fallback',
      domPath: 'html > body > main > button:nth-of-type(1)',
      selector: 'button[aria-label="Approve"]',
      rect: { x: 0, y: 0, width: 100, height: 32 },
    }),
  ).toBe('selector:button[aria-label="Approve"]');

  expect(
    stableLayerId({
      tagName: 'BUTTON',
      sourceKind: 'dom-fallback',
      domPath: 'html > body > main > button:nth-of-type(1)',
      rect: { x: 0, y: 0, width: 100, height: 32 },
    }),
  ).toBe('dom:html > body > main > button:nth-of-type(1)');
});

test('insert policy keeps direct inserts primitive-only and catalog inserts assistant-assisted', () => {
  expect(resolveInsertPolicy({ kind: 'primitive', tagName: 'section' })).toEqual(
    expect.objectContaining({
      mode: 'direct',
      operations: ['insert-primitive'],
    }),
  );
  expect(resolveInsertPolicy({ kind: 'primitive', tagName: 'script' })).toEqual(
    expect.objectContaining({
      mode: 'blocked',
      operations: [],
    }),
  );
  expect(
    resolveInsertPolicy({
      kind: 'catalog-component',
      componentName: 'DataTable',
      filePath: 'src/components/DataTable.tsx',
    }),
  ).toEqual(
    expect.objectContaining({
      mode: 'assistant',
      operations: ['insert-component-request'],
    }),
  );
});
