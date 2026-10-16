import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const dialogPath = 'apps/web/src/components/home/HomeSettingsDialog.tsx';

test('home settings use the complete System group without project sections', async () => {
  const source = await readFile(dialogPath, 'utf8');

  expect(source).toContain('useConfigLoader();');
  expect(source).toContain('scope="system"');
  expect(source).not.toContain('scope="all"');
});
