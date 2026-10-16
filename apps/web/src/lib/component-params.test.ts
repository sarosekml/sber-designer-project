/** 0133 track 2: Component tab model — controls, values, ordering, guards. */
import { describe, expect, test } from 'bun:test';
import type { DesignComponentInstance } from '@sber-designer/shared-types';

import {
  buildComponentParamsModel,
  canResetComponentParam,
  componentParamChange,
  effectiveParamValue,
  encodeParamValue,
  isValidNumberParamValue,
  isParamValueChanged,
} from './component-params';

function instance(overrides: Partial<DesignComponentInstance> = {}): DesignComponentInstance {
  return {
    loc: 'src/screens/Deal.tsx:6:7',
    filePath: 'src/screens/Deal.tsx',
    line: 6,
    column: 7,
    tagName: 'ActionButton',
    componentName: 'ActionButton',
    componentId: 'atoms-action-button',
    definitionFilePath: 'src/components/ActionButton.tsx',
    params: [
      {
        prop: 'variant',
        control: 'enum',
        options: [{ value: 'primary', meaning: 'Main action.' }, { value: 'secondary' }],
        defaultValue: 'secondary',
        required: false,
        source: 'ts-props',
      },
      { prop: 'disabled', control: 'boolean', required: false, source: 'ts-props' },
      { prop: 'label', control: 'string', required: true, source: 'ts-props' },
    ],
    props: [
      { name: 'variant', value: 'primary', kind: 'string', editable: true },
      { name: 'label', value: 'Save', kind: 'string', editable: true },
    ],
    editable: true,
    scope: 'screen-instance',
    ...overrides,
  };
}

describe('buildComponentParamsModel', () => {
  test('fills control values from the props the usage passes', () => {
    const model = buildComponentParamsModel(instance());
    const rows = new Map(model.rows.map((row) => [row.prop, row]));
    expect(model.status).toBe('ready');
    expect(rows.get('variant')?.value).toBe('primary');
    expect(rows.get('label')?.value).toBe('Save');
    expect(rows.get('disabled')?.value).toBeNull();
  });

  test('keeps the component default as a hint, not as a value', () => {
    const rows = new Map(buildComponentParamsModel(instance()).rows.map((row) => [row.prop, row]));
    expect(rows.get('variant')?.defaultValue).toBe('secondary');
    expect(rows.get('disabled')?.defaultValue).toBeUndefined();
  });

  test('exposes the effective boolean default without materializing the prop', () => {
    const withDefault = instance({
      params: [
        {
          prop: 'expanded',
          control: 'boolean',
          defaultValue: 'true',
          required: false,
          source: 'ts-props',
        },
      ],
      props: [],
    });
    const row = buildComponentParamsModel(withDefault).rows[0]!;
    expect(row.value).toBeNull();
    expect(effectiveParamValue(row)).toBe('true');
  });

  test('orders required first, then documented params, then alphabetically', () => {
    expect(buildComponentParamsModel(instance()).rows.map((row) => row.prop)).toEqual([
      'label',
      'variant',
      'disabled',
    ]);
  });

  test('applies optimistic overrides while a write is in flight', () => {
    const model = buildComponentParamsModel(instance(), { variant: 'secondary', label: null });
    const rows = new Map(model.rows.map((row) => [row.prop, row]));
    expect(rows.get('variant')?.value).toBe('secondary');
    expect(rows.get('label')?.value).toBeNull();
  });

  test('locks a prop written as an expression', () => {
    const model = buildComponentParamsModel(
      instance({
        props: [
          {
            name: 'variant',
            value: 'tone',
            kind: 'expression',
            editable: false,
            reason: 'Expression props are read-only in Visual Design MVP.',
          },
        ],
      }),
    );
    const row = model.rows.find((item) => item.prop === 'variant');
    expect(row?.locked).toBe(true);
    expect(row?.lockedReason).toContain('Expression');
  });

  test('warns about a spread without locking the controls', () => {
    const model = buildComponentParamsModel(
      instance({
        props: [{ name: '{...spread}', value: null, kind: 'spread', editable: false }],
      }),
    );
    expect(model.hasSpread).toBe(true);
    expect(model.rows.every((row) => !row.locked)).toBe(true);
    expect(model.rows[0]?.lockedReason).toContain('spread');
  });

  test('lists code props the schema does not describe', () => {
    const model = buildComponentParamsModel(
      instance({
        props: [
          { name: 'variant', value: 'primary', kind: 'string', editable: true },
          { name: 'data-testid', value: 'save', kind: 'string', editable: true },
        ],
      }),
    );
    expect(model.otherProps.map((prop) => prop.name)).toEqual(['data-testid']);
  });

  test('reports a shared usage as locked with its reason', () => {
    const model = buildComponentParamsModel(
      instance({ editable: false, reason: 'This usage lives in src/components/Toolbar.tsx' }),
    );
    expect(model.status).toBe('locked');
    expect(model.reason).toContain('Toolbar.tsx');
  });

  test('reports a known component without readable params', () => {
    expect(buildComponentParamsModel(instance({ params: [] })).status).toBe('no-params');
  });

  test('reports no selection as unavailable', () => {
    const model = buildComponentParamsModel(undefined);
    expect(model.status).toBe('unavailable');
    expect(model.rows).toEqual([]);
  });
});

describe('componentParamChange', () => {
  test('targets the usage site, not the selected element', () => {
    const change = componentParamChange({
      instance: instance(),
      targetId: 'target-1',
      prop: 'variant',
      control: 'enum',
      value: 'secondary',
    });
    expect(change.kind).toBe('set-prop');
    expect(change.filePath).toBe('src/screens/Deal.tsx');
    expect(change.loc).toEqual({ line: 6, column: 7 });
    expect(change).toMatchObject({ name: 'variant', value: '"secondary"' });
  });

  test('resetting a param removes the prop instead of writing the default', () => {
    const change = componentParamChange({
      instance: instance(),
      targetId: 'target-1',
      prop: 'variant',
      control: 'enum',
      value: null,
    });
    expect(change.kind).toBe('remove-prop');
  });

  test('writes the Storybook label control to JSX children, not a children prop', () => {
    const change = componentParamChange({
      instance: instance(),
      targetId: 'target-1',
      prop: 'children',
      control: 'string',
      value: 'Send',
    });
    expect(change).toEqual({
      kind: 'set-children-text',
      targetId: 'target-1',
      filePath: 'src/screens/Deal.tsx',
      loc: { line: 6, column: 7 },
      text: 'Send',
      label: 'ActionButton.children',
    });
  });
});

describe('encodeParamValue', () => {
  test('encodes each control kind as a JSX literal', () => {
    expect(encodeParamValue('enum', 'ghost')).toBe('"ghost"');
    expect(encodeParamValue('string', 'Save now')).toBe('"Save now"');
    expect(encodeParamValue('boolean', 'true')).toBe('true');
    expect(encodeParamValue('boolean', 'anything-else')).toBe('false');
    expect(encodeParamValue('number', '12')).toBe('12');
  });

  test('rejects invalid and intermediate number drafts instead of writing zero', () => {
    expect(isValidNumberParamValue('12.5')).toBe(true);
    expect(isValidNumberParamValue('-')).toBe(false);
    expect(isValidNumberParamValue('1e')).toBe(false);
    expect(isValidNumberParamValue('0x10')).toBe(false);
    expect(isValidNumberParamValue('')).toBe(false);
    expect(() => encodeParamValue('number', 'abc')).toThrow('Invalid finite number');
  });
});

describe('canResetComponentParam', () => {
  test('never removes a required prop', () => {
    const required = buildComponentParamsModel(instance()).rows.find(
      (row) => row.prop === 'label',
    )!;
    expect(required.value).toBe('Save');
    expect(canResetComponentParam(required)).toBe(false);
  });

  test('allows an explicitly set optional prop to return to its default', () => {
    const optional = buildComponentParamsModel(instance()).rows.find(
      (row) => row.prop === 'variant',
    )!;
    expect(canResetComponentParam(optional)).toBe(true);
  });
});

test('isParamValueChanged ignores no-op edits', () => {
  const row = buildComponentParamsModel(instance()).rows.find((item) => item.prop === 'variant')!;
  expect(isParamValueChanged(row, 'primary')).toBe(false);
  expect(isParamValueChanged(row, 'secondary')).toBe(true);
  expect(isParamValueChanged(row, null)).toBe(true);
});
