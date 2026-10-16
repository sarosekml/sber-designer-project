import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { scanProjectIconContracts } from '../packages/design-indexer/src/icon-contract-scanner';

test('scanProjectIconContracts extracts string literal iconName contracts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-icon-contracts-'));
  await mkdir(join(root, 'src', 'components', 'Icon'), { recursive: true });
  await writeFile(
    join(root, 'src', 'components', 'Icon', 'Icon.const.ts'),
    [
      "export const ICON_NAMES = ['Approved', 'RiskAlert', 'PaymentClock'] as const;",
      'export type IconName = (typeof ICON_NAMES)[number];',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'Icon', 'Icon.tsx'),
    [
      "import { ICON_NAMES, type IconName } from './Icon.const';",
      'export function Icon(props: { iconName: IconName; title?: string }) {',
      '  return <span data-icon={props.iconName}>{props.iconName}</span>;',
      '}',
    ].join('\n'),
    'utf8',
  );

  const records = await scanProjectIconContracts(root);

  expect(records).toContainEqual(
    expect.objectContaining({
      id: 'icon-candidate-project-icon-prop-approved',
      name: 'Approved',
      source: 'project-icon-prop',
      componentName: 'Icon',
      propName: 'iconName',
      validFor: ['project-icon-prop'],
      confidence: 'high',
      filePath: 'src/components/Icon/Icon.const.ts',
    }),
  );
  expect(records.map((record) => record.name)).toContain('RiskAlert');
  expect(records.map((record) => record.name)).toContain('PaymentClock');
});

test('scanProjectIconContracts extracts ES6 shorthand icon-map keys (task 9999 C1)', async () => {
  // Mirrors ibp-ui-kit: `iconsMap = { Add, Search, ... }` (no colons) +
  // `IconName = keyof typeof iconsMap`. Before the fix these shorthand keys
  // were skipped, so valid project icons fell back to Lucide with a warning.
  const root = await mkdtemp(join(tmpdir(), 'sd-icon-shorthand-'));
  await mkdir(join(root, 'src', 'components', 'Icon'), { recursive: true });
  await writeFile(
    join(root, 'src', 'components', 'Icon', 'Icon.const.ts'),
    [
      "import { Add, Search, Folder, ChevronDown } from './icons';",
      'export const iconsMap = {',
      '  Add,',
      '  Search,',
      '  Folder,',
      '  ChevronDown,',
      '};',
      'export type IconName = keyof typeof iconsMap;',
    ].join('\n'),
    'utf8',
  );

  const names = (await scanProjectIconContracts(root)).map((record) => record.name);
  expect(names).toContain('Search');
  expect(names).toContain('Folder');
  expect(names).toContain('ChevronDown');
  expect(names).toContain('Add');
});
