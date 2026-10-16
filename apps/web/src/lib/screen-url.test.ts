import { expect, test } from 'bun:test';

import { screenPreviewUrl } from './screen-url';

test('Design system preview targets the managed catalog and component anchor', () => {
  const url = screenPreviewUrl(null, 'http://127.0.0.1:4173', '/fallback', 'design-system', {
    id: 'css-catalog-button',
    title: 'Button',
    shortName: 'Button',
    filePath: 'design-system/components.css',
    docsAnchor: 'button',
    stories: [],
  });

  expect(url).toEndWith('/api/preview/design-system/index.html#button');
});

test('Design system preview can open a user-owned reference page', () => {
  const url = screenPreviewUrl(
    null,
    'http://127.0.0.1:4173',
    '/fallback',
    'design-system',
    null,
    'design-system/refs/pricing.html',
  );

  expect(url).toEndWith('/api/preview/design-system/refs/pricing.html');
});
