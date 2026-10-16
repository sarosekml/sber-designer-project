import { expect, test } from 'bun:test';

import { shouldMarkStorybookReloadPending } from '../services/api/src/storybook-reload';

test('storybook reload marker tracks storybook and build config changes', () => {
  expect(shouldMarkStorybookReloadPending('src/stories/Button.stories.tsx', false)).toBe(true);
  expect(shouldMarkStorybookReloadPending('.storybook/preview.ts', false)).toBe(true);
  expect(shouldMarkStorybookReloadPending('vite.config.ts', false)).toBe(true);
  expect(shouldMarkStorybookReloadPending('tailwind.config.js', false)).toBe(true);
  expect(shouldMarkStorybookReloadPending('package.json', false)).toBe(true);
});

test('storybook reload marker treats new files as reload-worthy', () => {
  expect(shouldMarkStorybookReloadPending('src/components/NewComponent.tsx', true)).toBe(true);
});

test('storybook reload marker ignores ordinary existing source edits', () => {
  expect(shouldMarkStorybookReloadPending('src/components/Button.tsx', false)).toBe(false);
  expect(shouldMarkStorybookReloadPending('src/pages/Dashboard.tsx', false)).toBe(false);
});
