import { expect, test } from 'bun:test';

import { shouldCopyDuplicateEntry } from '../services/api/src/projects-registry';

const sourceRoot = '/Users/dev/Work Dev/demo-project';

test('duplicate copy filter skips project-level generated output', () => {
  expect(shouldCopyDuplicateEntry(sourceRoot, sourceRoot)).toBe(true);
  expect(
    shouldCopyDuplicateEntry(sourceRoot, `${sourceRoot}/src/stories/Screens.stories.tsx`),
  ).toBe(true);
  expect(shouldCopyDuplicateEntry(sourceRoot, `${sourceRoot}/.sber-designer/project.sdproj`)).toBe(
    true,
  );
  expect(shouldCopyDuplicateEntry(sourceRoot, `${sourceRoot}/dist`)).toBe(false);
  expect(shouldCopyDuplicateEntry(sourceRoot, `${sourceRoot}/storybook-static`)).toBe(false);
});

test('duplicate copy filter skips dependency folders and git metadata', () => {
  expect(
    shouldCopyDuplicateEntry(sourceRoot, `${sourceRoot}/node_modules/storybook/dist/preview.js`),
  ).toBe(false);
  expect(shouldCopyDuplicateEntry(sourceRoot, `${sourceRoot}/.git/config`)).toBe(false);
  expect(shouldCopyDuplicateEntry(sourceRoot, `${sourceRoot}/.pnpm-store/v3/files/index`)).toBe(
    false,
  );
  expect(shouldCopyDuplicateEntry(sourceRoot, `${sourceRoot}/.yarn/cache/storybook-npm.zip`)).toBe(
    false,
  );
});

test('duplicate copy filter skips dependency caches', () => {
  expect(
    shouldCopyDuplicateEntry(sourceRoot, `${sourceRoot}/node_modules/.cache/storybook/index.json`),
  ).toBe(false);
  expect(
    shouldCopyDuplicateEntry(sourceRoot, `${sourceRoot}/node_modules/.vite/deps/react.js`),
  ).toBe(false);
});
