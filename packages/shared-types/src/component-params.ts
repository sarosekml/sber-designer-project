/**
 * Declared parameters of a catalog component (task 0133).
 *
 * The schema describes what a component *accepts* — read from its own TS props
 * plus Storybook `argTypes`/`args` enrichment — as opposed to `DesignPropInfo`,
 * which reports what a single JSX instance currently *passes*. The Design
 * panel's Component tab pairs the two: schema renders the controls, instance
 * props fill in the current values.
 */

export type ComponentParamControl = 'enum' | 'boolean' | 'string' | 'number';

/**
 * Where a param fact came from. Code wins over Storybook: `ts-props` and `cva`
 * are authoritative, `argtypes`/`story-args` only fill gaps, and
 * `description-layer` contributes human meaning for enum values.
 */
export type ComponentParamSource =
  | 'ts-props'
  | 'cva'
  | 'argtypes'
  | 'story-args'
  | 'description-layer';

export interface ComponentParamOption {
  value: string;
  /** Human meaning from the description layer, shown as a control hint. */
  meaning?: string;
}

export interface ComponentParam {
  /** Prop name as written in JSX, e.g. `variant`. */
  prop: string;
  /** Optional control label from Storybook, e.g. `children` displayed as `label`. */
  label?: string;
  control: ComponentParamControl;
  /** Allowed values for `enum` controls. */
  options?: ComponentParamOption[];
  /**
   * Best-effort default from destructuring defaults, `defaultVariants`, or
   * story args. Shown as a placeholder hint; never written into source.
   */
  defaultValue?: string;
  required: boolean;
  description?: string;
  source: ComponentParamSource;
}

export interface ComponentParamSchema {
  /** Catalog/index component id the params belong to. */
  componentId?: string;
  /** Component export name the props were resolved for. */
  componentName: string;
  params: ComponentParam[];
}
