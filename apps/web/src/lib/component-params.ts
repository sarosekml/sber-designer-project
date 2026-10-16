/**
 * Component tab model (task 0133): pairs the params a component declares with
 * the props its usage on the screen actually passes, and turns a control edit
 * into a source change addressed at that usage site.
 *
 * Pure on purpose — the tab renders this, the store applies it.
 */
import type {
  ComponentParam,
  ComponentParamControl,
  ComponentParamOption,
  DesignComponentInstance,
  DesignPropInfo,
  VisualChange,
} from '@sber-designer/shared-types';

export type ComponentParamsStatus = 'ready' | 'no-params' | 'unavailable' | 'locked';

export interface ComponentParamRow {
  prop: string;
  /** Display name from Storybook; writes still use `prop`. */
  label?: string;
  control: ComponentParamControl;
  options: ComponentParamOption[];
  required: boolean;
  description?: string;
  /** Value written at the usage site; `null` when the prop is not passed. */
  value: string | null;
  /** Component default, shown as a placeholder — never written to source. */
  defaultValue?: string;
  /** Written as an expression or covered by a spread: not control-editable. */
  locked: boolean;
  lockedReason?: string;
}

export interface ComponentParamsModel {
  status: ComponentParamsStatus;
  componentName: string;
  componentId?: string;
  definitionFilePath?: string;
  instanceFilePath?: string;
  rows: ComponentParamRow[];
  /** Props written in code that the schema does not describe. */
  otherProps: DesignPropInfo[];
  hasSpread: boolean;
  /** Why controls are unavailable, for `unavailable` and `locked`. */
  reason?: string;
}

const UNAVAILABLE_MODEL: ComponentParamsModel = {
  status: 'unavailable',
  componentName: '',
  rows: [],
  otherProps: [],
  hasSpread: false,
  reason:
    'Select a component from your library on the canvas. Plain elements are edited through Options and Style.',
};

export function buildComponentParamsModel(
  instance: DesignComponentInstance | undefined,
  overrides: Record<string, string | null> = {},
): ComponentParamsModel {
  if (!instance) return UNAVAILABLE_MODEL;

  const propsByName = new Map(instance.props.map((prop) => [prop.name, prop]));
  const hasSpread = instance.props.some((prop) => prop.kind === 'spread');
  const rows = instance.params
    .map((param) => buildRow(param, propsByName.get(param.prop), overrides, hasSpread))
    .sort(compareRows);
  const described = new Set(instance.params.map((param) => param.prop));
  const otherProps = instance.props.filter(
    (prop) => prop.kind !== 'spread' && !described.has(prop.name),
  );

  return {
    status: instance.editable ? (rows.length > 0 ? 'ready' : 'no-params') : 'locked',
    componentName: instance.componentName,
    ...(instance.componentId ? { componentId: instance.componentId } : {}),
    ...(instance.definitionFilePath ? { definitionFilePath: instance.definitionFilePath } : {}),
    instanceFilePath: instance.filePath,
    rows,
    otherProps,
    hasSpread,
    ...(instance.editable ? {} : { reason: instance.reason ?? 'This usage is not editable here.' }),
  };
}

function buildRow(
  param: ComponentParam,
  written: DesignPropInfo | undefined,
  overrides: Record<string, string | null>,
  hasSpread: boolean,
): ComponentParamRow {
  const override = Object.prototype.hasOwnProperty.call(overrides, param.prop)
    ? overrides[param.prop]
    : undefined;
  const value = override !== undefined ? override : (written?.value ?? null);
  const locked = override === undefined && written !== undefined && !written.editable;
  return {
    prop: param.prop,
    ...(param.label ? { label: param.label } : {}),
    control: param.control,
    options: param.options ?? [],
    required: param.required,
    ...(param.description ? { description: param.description } : {}),
    value,
    ...(param.defaultValue !== undefined ? { defaultValue: param.defaultValue } : {}),
    locked,
    ...(locked
      ? { lockedReason: written?.reason ?? 'This prop is set from an expression in code.' }
      : hasSpread
        ? { lockedReason: 'A spread on this usage may override this prop at runtime.' }
        : {}),
  };
}

/** Required first, then params carrying documented meanings, then alphabetical. */
function compareRows(a: ComponentParamRow, b: ComponentParamRow): number {
  if (a.required !== b.required) return a.required ? -1 : 1;
  const aDocumented = hasMeaning(a) ? 0 : 1;
  const bDocumented = hasMeaning(b) ? 0 : 1;
  if (aDocumented !== bDocumented) return aDocumented - bDocumented;
  return a.prop.localeCompare(b.prop);
}

function hasMeaning(row: ComponentParamRow): boolean {
  return row.options.some((option) => Boolean(option.meaning));
}

/**
 * Source change for one control edit. `null` resets the prop: the component
 * default takes over, so the prop is removed rather than written out.
 */
export function componentParamChange(input: {
  instance: DesignComponentInstance;
  targetId: string;
  prop: string;
  control: ComponentParamControl;
  value: string | null;
}): VisualChange {
  const base = {
    targetId: input.targetId,
    filePath: input.instance.filePath,
    loc: { line: input.instance.line, column: input.instance.column },
    label: `${input.instance.componentName}.${input.prop}`,
  };
  if (input.prop === 'children') {
    return { kind: 'set-children-text', ...base, text: input.value ?? '' };
  }
  const propBase = { ...base, name: input.prop };
  if (input.value === null) return { kind: 'remove-prop', ...propBase };
  return {
    kind: 'set-prop',
    ...propBase,
    value: encodeParamValue(input.control, input.value),
  };
}

/** JSX literal for a control value: `variant="ghost"`, `count={3}`, `open={true}`. */
export function encodeParamValue(control: ComponentParamControl, value: string): string {
  if (control === 'boolean') return value === 'true' ? 'true' : 'false';
  if (control === 'number') {
    const numeric = Number(value);
    if (!isValidNumberParamValue(value)) {
      throw new Error(`Invalid finite number: ${JSON.stringify(value)}`);
    }
    return String(numeric);
  }
  return JSON.stringify(value);
}

/** Empty and intermediate numeric drafts (`-`, `1e`) must never reach source. */
export function isValidNumberParamValue(value: string): boolean {
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(trimmed)) return false;
  return Number.isFinite(Number(trimmed));
}

/** Effective runtime value used to render controls without materializing defaults. */
export function effectiveParamValue(row: ComponentParamRow): string | null {
  return row.value ?? row.defaultValue ?? null;
}

/** Removing a required prop would make a typed usage invalid. */
export function canResetComponentParam(row: ComponentParamRow): boolean {
  return row.value !== null && !row.locked && !row.required;
}

/** Whether an edit would change the source at all. */
export function isParamValueChanged(row: ComponentParamRow, next: string | null): boolean {
  return (row.value ?? null) !== next;
}
