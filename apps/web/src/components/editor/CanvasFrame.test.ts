import { expect, test } from 'bun:test';

import { canvasFrameWarningFromSnapshot, hasCanvasScreenRoot } from './CanvasFrame';

test('canvas warning is shown for a loaded blank iframe without screen root', () => {
  expect(
    canvasFrameWarningFromSnapshot({
      rootFound: false,
      bodyText: '',
      url: 'http://localhost:6006/iframe.html?id=screens-dcm2--default',
    }),
  ).toEqual({
    message: 'Canvas loaded without a screen root.',
    detail:
      'The iframe finished loading, but the selected story did not expose data-sd-screen-root. Reload or restart Storybook.',
  });
});

test('0108.4.3 static HTML page blank-canvas warning is page-centric, not Storybook', () => {
  const warning = canvasFrameWarningFromSnapshot({
    rootFound: false,
    bodyText: '',
    url: 'http://localhost:4123/pages/deal.html',
  });
  expect(warning?.detail).toContain('static HTML preview');
  expect(warning?.detail).not.toContain('Storybook');
});

test('canvas warning is not shown when a screen root is present', () => {
  expect(
    canvasFrameWarningFromSnapshot({
      rootFound: true,
      bodyText: '',
      url: 'http://localhost:6006/iframe.html?id=screens-dcm2--default',
    }),
  ).toBeNull();
});

test('canvas root detection accepts the attribute regardless of value', () => {
  const queried: string[] = [];
  const root = {
    querySelector: (selector: string) => {
      queried.push(selector);
      return selector === '[data-sd-screen-root]' ? {} : null;
    },
  } as unknown as ParentNode;

  expect(hasCanvasScreenRoot(root)).toBe(true);
  expect(queried).toEqual(['[data-sd-screen-root]']);
});
