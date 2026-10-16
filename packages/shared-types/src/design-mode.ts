/** Design mode protocol (task 0015). */
import type { ComponentParam } from './component-params';

export type DesignSourceKind = 'react-source' | 'sd-loc' | 'dom-fallback';
export type DesignPanelTab = 'inspect' | 'component' | 'options' | 'style' | 'insert' | 'layers';
export type DesignProjectSupportLevel = 'baseline-selection' | 'design-readable' | 'unknown';
export type DesignSourceScope =
  | 'screen-instance'
  | 'storybook-wrapper'
  | 'component-definition'
  | 'unknown';
export type DesignTargetCapabilityStatus = 'editable' | 'assistant-only' | 'read-only' | 'unmapped';
export type DesignTokenMode = 'prefer-tokens' | 'strict-tokens' | 'allow-raw';
export type DesignModeDiagnosticLevel = 'info' | 'warning' | 'error';

export interface DesignRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesignSelection {
  loc: string;
  sourceKind?: DesignSourceKind;
  tagName: string;
  text?: string;
  selector?: string;
  componentName?: string;
  componentLoc?: string;
  attributes?: Record<string, string>;
  rect: DesignRect;
  domPath?: string;
  componentPath?: string[];
  /** User-facing note when the click was resolved to a nearby source-backed ancestor. */
  selectionNotice?: string;
  inspectId?: string;
  computedStyles?: Record<string, string>;
}

export interface DesignTarget extends DesignSelection {
  id: string;
  filePath: string | null;
  line: number | null;
  column: number | null;
  sourceKind: DesignSourceKind;
}

export interface DesignPropInfo {
  name: string;
  value: string | null;
  kind: 'string' | 'number' | 'boolean' | 'expression' | 'spread' | 'unknown';
  editable: boolean;
  reason?: string;
}

export interface DesignTargetCapability {
  status: DesignTargetCapabilityStatus;
  operations: string[];
  reason?: string;
  policy?: DesignTokenMode;
}

/**
 * The catalog-component usage site behind a selection (task 0133).
 *
 * A click on a library component lands inside the component's own source, so
 * the element target is not where props can be edited. The instance points at
 * the JSX usage in the edited screen — `<Button variant="primary">` — and pairs
 * the params the component declares with the props this usage actually passes.
 */
export interface DesignComponentInstance {
  /** `file:line:column` of the usage site, as reported by the source scan. */
  loc: string;
  /** Workspace-relative file holding the usage site. */
  filePath: string;
  line: number;
  column: number;
  /** JSX tag at the usage site, e.g. `Button`. */
  tagName: string;
  componentName: string;
  /** Catalog/design-index component id when the component was matched. */
  componentId?: string;
  matchedBy?: 'source-path' | 'name';
  /** Workspace-relative file the component is defined in, when resolved. */
  definitionFilePath?: string;
  /** Params the component declares (schema for the controls). */
  params: ComponentParam[];
  /** Props this usage currently passes (current values for the controls). */
  props: DesignPropInfo[];
  /** False when the usage lives outside the edited screen — see `reason`. */
  editable: boolean;
  reason?: string;
  scope: DesignSourceScope;
  /** Conflict guard for writes against the instance file. */
  baseline?: {
    filePath: string;
    hash: string;
  };
}

export interface DesignModeDiagnostic {
  level: DesignModeDiagnosticLevel;
  code: string;
  message: string;
  path?: string;
}

export interface DesignInspectResult {
  target: DesignTarget;
  /** Legacy UI bridge while VisualDesignPanel moves to capabilities. */
  editable: boolean;
  reason?: string;
  projectSupport: DesignProjectSupportLevel;
  sourceScope: DesignSourceScope;
  capabilities: {
    text: DesignTargetCapability;
    props: DesignTargetCapability;
    style: DesignTargetCapability;
    className: DesignTargetCapability;
    insert: DesignTargetCapability;
  };
  diagnostics: DesignModeDiagnostic[];
  baseline?: {
    filePath: string;
    hash: string;
  };
  jsx?: {
    tagName: string;
    isComponent: boolean;
    props: DesignPropInfo[];
    childrenText?: string;
    childrenEditable?: boolean;
    childrenReason?: string;
    selfClosing: boolean;
  };
  styles?: {
    className?: string;
    classNameEditable?: boolean;
    classNameReason?: string;
    styleObject?: Record<string, string>;
    styleEditable?: boolean;
    styleReason?: string;
  };
  component?: {
    name: string;
    filePath?: string;
    catalogId?: string;
    description?: string;
  };
  /** Catalog-component usage site behind this selection (task 0133). */
  componentInstance?: DesignComponentInstance;
}

export type VisualChange =
  | {
      kind: 'set-prop';
      targetId: string;
      filePath: string;
      loc: { line: number; column: number };
      name: string;
      value: string;
      label: string;
    }
  | {
      kind: 'remove-prop';
      targetId: string;
      filePath: string;
      loc: { line: number; column: number };
      name: string;
      label: string;
    }
  | {
      kind: 'set-children-text';
      targetId: string;
      filePath: string;
      loc: { line: number; column: number };
      text: string;
      label: string;
    }
  | {
      kind: 'set-style';
      targetId: string;
      filePath: string;
      loc: { line: number; column: number };
      property: string;
      value: string;
      label: string;
    }
  | {
      kind: 'remove-style';
      targetId: string;
      filePath: string;
      loc: { line: number; column: number };
      property: string;
      label: string;
    }
  | {
      kind: 'set-class-token';
      targetId: string;
      filePath: string;
      loc: { line: number; column: number };
      tokenGroup: string;
      previousClass?: string;
      nextClass: string;
      label: string;
    };

export interface VisualDraft {
  targetId: string;
  changes: VisualChange[];
}

export interface DesignToken {
  id: string;
  name: string;
  value: string;
  source: string;
}

export interface DesignTokens {
  colors: DesignToken[];
  spacing: DesignToken[];
  typography: DesignToken[];
  radius: DesignToken[];
  shadows: DesignToken[];
}

export interface LayerNode {
  id: string;
  tagName: string;
  componentName?: string;
  loc?: string;
  sourceKind?: DesignSourceKind;
  sourceScope?: DesignSourceScope;
  selector?: string;
  text?: string;
  domPath?: string;
  componentPath?: string[];
  attributes?: Record<string, string>;
  rect: DesignRect;
  children: LayerNode[];
}
