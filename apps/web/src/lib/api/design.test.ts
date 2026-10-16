import { afterEach, expect, test } from 'bun:test';

import type { DesignTarget } from '@/lib/design-types';

import { inspectDesignSelection } from './design';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('inspect strips target-only fields when a recovered target becomes the next selection', async () => {
  const recoveredTarget: DesignTarget = {
    id: 'screen-button',
    loc: 'src/screens/DealScreen.tsx:42:7',
    filePath: 'src/screens/DealScreen.tsx',
    line: 42,
    column: 7,
    sourceKind: 'react-source',
    tagName: 'BUTTON',
    componentName: 'MuiButtonBaseRoot',
    componentLoc: 'src/screens/DealScreen.tsx:42:7',
    rect: { x: 10, y: 20, width: 120, height: 40 },
  };
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = (async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  await inspectDesignSelection({
    workspacePath: '/workspace',
    selection: recoveredTarget,
    activeScreen: {
      id: 'deal-screen',
      implementationFilePath: 'src/screens/DealScreen.tsx',
    },
  });

  expect(requestBody).toEqual({
    workspacePath: '/workspace',
    selection: {
      loc: 'src/screens/DealScreen.tsx:42:7',
      tagName: 'BUTTON',
      rect: { x: 10, y: 20, width: 120, height: 40 },
      sourceKind: 'react-source',
      componentName: 'MuiButtonBaseRoot',
      componentLoc: 'src/screens/DealScreen.tsx:42:7',
    },
    activeScreen: {
      id: 'deal-screen',
      implementationFilePath: 'src/screens/DealScreen.tsx',
    },
  });
});
