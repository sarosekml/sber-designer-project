import { expect, test } from 'bun:test';

import { shouldShowDesignSystemBootstrap } from './html-design-system-bootstrap';

test('bootstrap card is limited to missing HTML design systems in Design system view', () => {
  expect(shouldShowDesignSystemBootstrap('design-system', 'missing')).toBe(true);
  expect(shouldShowDesignSystemBootstrap('design-system', 'bootstrap')).toBe(true);
  expect(shouldShowDesignSystemBootstrap('design-system', 'canonical')).toBe(false);
  expect(shouldShowDesignSystemBootstrap('screen', 'missing')).toBe(false);
});
