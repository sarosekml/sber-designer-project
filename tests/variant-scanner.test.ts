import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { scanComponentVariants } from '../packages/design-indexer/src/variant-scanner';
import type { IndexedComponentRecord } from '../packages/design-indexer/src/types';

function record(partial: Partial<IndexedComponentRecord> & { id: string }): IndexedComponentRecord {
  return {
    title: partial.id,
    shortName: partial.id,
    filePath: 'src/unknown.tsx',
    storyCount: 0,
    stories: [],
    tags: [],
    groupIds: [],
    noteCount: 0,
    confidence: 'low',
    ...partial,
  } as IndexedComponentRecord;
}

async function write(root: string, filePath: string, contents: string): Promise<void> {
  await mkdir(join(root, filePath, '..'), { recursive: true });
  await writeFile(join(root, filePath), contents);
}

test('extracts union-typed props from interfaces, aliases, and inline props', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-variants-ts-'));
  await write(
    root,
    'src/components/Button/Button.tsx',
    [
      "export type ButtonColor = 'primary' | 'secondary' | 'danger';",
      'export interface ButtonProps {',
      "  variant?: 'outlined' | 'contained';",
      '  color?: ButtonColor;',
      '  size?:',
      "    | 'small'",
      "    | 'medium'",
      "    | 'large';",
      '  disabled?: boolean;',
      '  label: string;',
      '}',
      'export function Button(props: ButtonProps) { return null; }',
    ].join('\n'),
  );
  await write(root, 'src/components/Button/index.ts', "export * from './Button';\n");
  await write(
    root,
    'src/components/Chip.tsx',
    "export function Chip({ tone }: { tone?: 'info' | 'warning' }) { return null; }\n",
  );

  const result = await scanComponentVariants({
    workspaceRoot: root,
    components: [
      record({ id: 'button', shortName: 'Button', filePath: 'src/components/Button/index.ts' }),
      record({ id: 'chip', shortName: 'Chip', filePath: 'src/components/Chip.tsx' }),
    ],
  });

  const button = result.find((r) => r.componentId === 'button');
  expect(button).toBeDefined();
  const byProp = Object.fromEntries(button!.props.map((p) => [p.prop, p]));
  expect(byProp.variant.values.map((v) => v.value)).toEqual(['outlined', 'contained']);
  expect(byProp.color.values.map((v) => v.value)).toEqual(['primary', 'secondary', 'danger']);
  expect(byProp.size.values.map((v) => v.value)).toEqual(['small', 'medium', 'large']);
  expect(byProp.disabled).toBeUndefined();
  expect(byProp.label).toBeUndefined();
  expect(byProp.variant.source).toBe('ts-union');

  const chip = result.find((r) => r.componentId === 'chip');
  expect(chip?.props[0].prop).toBe('tone');
  expect(chip?.props[0].values.map((v) => v.value)).toEqual(['info', 'warning']);
});

test('argTypes options enrich props the TS pass did not resolve', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-variants-args-'));
  await write(
    root,
    'src/components/Alert/Alert.tsx',
    [
      "import type { Severity } from '../../theme/types';",
      'export interface AlertProps { severity?: Severity; title: string }',
      'export function Alert(props: AlertProps) { return null; }',
    ].join('\n'),
  );
  await write(
    root,
    'src/components/Alert/Alert.stories.tsx',
    [
      "import { Alert } from './Alert';",
      'export default {',
      "  title: 'Feedback/Alert',",
      '  component: Alert,',
      '  argTypes: {',
      "    severity: { options: ['success', 'warning', 'error'], control: 'select' },",
      '  },',
      '};',
    ].join('\n'),
  );

  const result = await scanComponentVariants({
    workspaceRoot: root,
    components: [
      record({ id: 'alert', shortName: 'Alert', filePath: 'src/components/Alert/Alert.tsx' }),
    ],
  });
  const alert = result.find((r) => r.componentId === 'alert');
  expect(alert).toBeDefined();
  expect(alert?.props[0]).toMatchObject({ prop: 'severity', source: 'argtypes' });
  expect(alert?.props[0].values.map((v) => v.value)).toEqual(['success', 'warning', 'error']);
});

test('story-indexed components read sibling types for variant guidance', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-variants-story-siblings-'));
  await write(
    root,
    'src/components/DictionaryBadge/DictionaryBadge.types.ts',
    [
      "export type BadgeStyleVariant = 'filled' | 'outlined' | 'transparent';",
      "export type BadgeComponent = 'Marker' | 'Chip';",
      'export interface DictionaryBadgeProps {',
      '  variant?: BadgeStyleVariant;',
      '  component: BadgeComponent;',
      '  label: string;',
      '}',
    ].join('\n'),
  );
  await write(
    root,
    'src/components/DictionaryBadge/DictionaryBadge.stories.tsx',
    [
      "import { DictionaryBadge } from './DictionaryBadge';",
      "export default { title: 'Atoms/DictionaryBadge', component: DictionaryBadge };",
      'export const Default = {};',
    ].join('\n'),
  );

  const result = await scanComponentVariants({
    workspaceRoot: root,
    components: [
      record({
        id: 'atoms-dictionarybadge',
        shortName: 'DictionaryBadge',
        filePath: 'src/components/DictionaryBadge/DictionaryBadge.stories.tsx',
      }),
    ],
  });
  const badge = result.find((r) => r.componentId === 'atoms-dictionarybadge');
  const byProp = Object.fromEntries((badge?.props ?? []).map((prop) => [prop.prop, prop]));

  expect(byProp.variant.values.map((value) => value.value)).toEqual([
    'filled',
    'outlined',
    'transparent',
  ]);
  expect(byProp.component.values.map((value) => value.value)).toEqual(['Marker', 'Chip']);
});

test('no Storybook and no unions yields no records, without errors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-variants-empty-'));
  await write(
    root,
    'components/ui/box.tsx',
    'export function Box(props: { children?: unknown }) { return null; }\n',
  );
  const result = await scanComponentVariants({
    workspaceRoot: root,
    components: [record({ id: 'box', shortName: 'Box', filePath: 'components/ui/box.tsx' })],
  });
  expect(result).toEqual([]);
});

test('extracts required props from *Props and same-file extends (0082 Track 2)', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-variants-required-'));
  await write(
    root,
    'src/components/Field/Field.tsx',
    [
      'interface BaseProps { id: string; children?: unknown }',
      'export interface FieldProps extends BaseProps {',
      '  label: string;',
      "  variant?: 'a' | 'b';",
      '  disabled?: boolean;',
      '  onChange: () => void;',
      '}',
      'export function Field(props: FieldProps) { return null; }',
    ].join('\n'),
  );
  const result = await scanComponentVariants({
    workspaceRoot: root,
    components: [
      record({ id: 'field', shortName: 'Field', filePath: 'src/components/Field/Field.tsx' }),
    ],
  });
  const field = result.find((r) => r.componentId === 'field');
  expect(field).toBeDefined();
  // required (no `?`): label, onChange, and id from the extended interface;
  // optional (variant/disabled) and children are excluded.
  expect([...(field?.requiredProps ?? [])].sort()).toEqual(['id', 'label', 'onChange']);
  // variant is still captured as a union.
  expect(field?.props.map((p) => p.prop)).toContain('variant');
});

test("R6: does not pull a sibling component's required props in a mixed folder", async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-variants-mixed-'));
  await write(
    root,
    'src/widgets/Button.tsx',
    [
      'export interface ButtonProps { onClick: () => void; label?: string }',
      'export function Button(props: ButtonProps) { return null; }',
    ].join('\n'),
  );
  await write(
    root,
    'src/widgets/Field.tsx',
    [
      'export interface FieldProps { name: string; value?: string }',
      'export function Field(props: FieldProps) { return null; }',
    ].join('\n'),
  );
  // Story reads sibling sources → both *Props end up in the same chunk.
  await write(
    root,
    'src/widgets/Button.stories.tsx',
    [
      "import { Button } from './Button';",
      "export default { title: 'Widgets/Button', component: Button };",
      'export const Default = {};',
    ].join('\n'),
  );

  const result = await scanComponentVariants({
    workspaceRoot: root,
    components: [
      record({ id: 'button', shortName: 'Button', filePath: 'src/widgets/Button.stories.tsx' }),
    ],
  });
  const button = result.find((r) => r.componentId === 'button');
  // Only Button's own required prop — never Field's `name`.
  expect(button?.requiredProps).toEqual(['onClick']);
});
