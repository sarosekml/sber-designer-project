/**
 * Public AST patch types. Mirrored as a zod schema in `schema.ts` so the
 * api can validate untrusted input before passing into ts-morph.
 *
 * `loc` is "line:column" (1-based for both, matching React Fiber's
 * `_debugSource`). `value` in set-prop is a TS expression *as a string*
 * — the caller is responsible for quoting strings ("ghost" → '"ghost"').
 *
 * See ADR-0013.
 */

export interface SourceLocation {
  /** 1-based line. */
  line: number;
  /** 1-based column. */
  column: number;
}

export type Op =
  | SetPropOp
  | RemovePropOp
  | SetStylePropOp
  | RemoveStylePropOp
  | SetClassNameOp
  | AddImportOp
  | SwapComponentOp
  | WrapWithOp
  | SetChildrenTextOp
  | ReplaceTextOp;

export interface SetPropOp {
  kind: 'set-prop';
  /** Workspace-relative path to the file. */
  file: string;
  /** Source position of the JSX opening element. */
  loc: SourceLocation;
  /** Attribute name. */
  name: string;
  /** TS expression as a string. e.g. `"\"ghost\""`, `"24"`, `"true"`, `"() => alert('x')"`. */
  value: string;
}

export interface RemovePropOp {
  kind: 'remove-prop';
  file: string;
  loc: SourceLocation;
  name: string;
}

export interface SetStylePropOp {
  kind: 'set-style-prop';
  file: string;
  loc: SourceLocation;
  /** React style property, e.g. `backgroundColor`, `padding`, or `--brand-color`. */
  name: string;
  /** TS expression as a string. String CSS values must already be quoted. */
  value: string;
}

export interface RemoveStylePropOp {
  kind: 'remove-style-prop';
  file: string;
  loc: SourceLocation;
  /** React style property to remove. */
  name: string;
}

export interface SetClassNameOp {
  kind: 'set-class-name';
  file: string;
  loc: SourceLocation;
  /** Full className string. MVP refuses expression-based className. */
  value: string;
}

export interface AddImportOp {
  kind: 'add-import';
  /** Workspace-relative path. */
  file: string;
  /** Module specifier, e.g. `@/components/Button`. */
  source: string;
  /** Imported binding name. */
  name: string;
  /** When true, register as a default import (`import Foo from '...'`). */
  default?: boolean;
}

/** Rename the JSX tag at `loc` (and its closing tag if present). */
export interface SwapComponentOp {
  kind: 'swap-component';
  file: string;
  loc: SourceLocation;
  /** New tag name. PascalCase for components, lowercase for HTML. */
  newName: string;
}

/** Wrap the JSX element at `loc` with `<wrapperName>`. */
export interface WrapWithOp {
  kind: 'wrap-with';
  file: string;
  loc: SourceLocation;
  /** Wrapper tag name. */
  wrapperName: string;
  /**
   * Attributes to set on the wrapper, as raw JSX strings.
   * e.g. `['variant="ghost"', 'onClick={() => {}}']`. Empty for no props.
   */
  wrapperAttrs?: string[];
}

/**
 * Replace the entire children of the JSX element at `loc` with a single
 * text node. Expands a self-closing element to an opening/closing pair.
 */
export interface SetChildrenTextOp {
  kind: 'set-children-text';
  file: string;
  loc: SourceLocation;
  text: string;
}

export interface ReplaceTextOp {
  kind: 'replace-text';
  file: string;
  oldText: string;
  newText: string;
}

export interface ApplyPatchInput {
  /** Absolute path. */
  workspaceRoot: string;
  ops: Op[];
}

export interface ApplyPatchResult {
  ok: true;
  /** Workspace-relative paths actually written to disk. */
  changedFiles: string[];
  /** Per-op outcome, in input order — useful for surfacing partial info. */
  ops: AppliedOpResult[];
}

export interface AppliedOpResult {
  kind: Op['kind'];
  file: string;
  /** Workspace-relative target path; equal to op.file but normalised. */
  message?: string;
}
