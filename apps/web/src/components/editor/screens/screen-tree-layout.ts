/**
 * Shared screen-tree label geometry (0138 A2).
 *
 * The permanent Screens panel and the Screens dropdown are different
 * interactive containers (a list row vs a DropdownMenuItem), but the label
 * inside them follows one layout contract so the screen-name axis cannot
 * drift apart again:
 *
 * - the screen name starts at `SCREEN_TREE_NAME_AXIS_PX` (28px = `pl-7`)
 *   from the row's left edge — the child indent, not the folder-name axis;
 * - the name is the only stretching slot and truncates; the full display
 *   path stays in the row tooltip;
 * - conditional metadata (modal / running / health / linked tasks) sits
 *   after the name and never occupies the leading indent;
 * - trailing controls (visibility, actions, active check) never shift it.
 *
 * Both rows already carry 8px of horizontal row padding (`px-2` on the panel
 * row, the DropdownMenuItem base). The dropdown replaces it with the full
 * `pl-7`; the panel row keeps its `px-2` and applies the remainder
 * (`pl-5`, 20px) so both land on the same 28px axis.
 */
export const SCREEN_TREE_NAME_AXIS_PX = 28;

/** Full child indent for rows without their own left padding (dropdown items). */
export const SCREEN_TREE_CHILD_INDENT = 'pl-7';

/** Indent inside a panel screen row whose `<li>` already applies `px-2`. */
export const SCREEN_TREE_CHILD_INDENT_IN_ROW = 'pl-5';

/** Name slot: the only stretching column; truncates long names. */
export const SCREEN_TREE_NAME_SLOT = 'min-w-0 flex-1 truncate';

/** Conditional metadata slot after the name (badges, run indicators). */
export const SCREEN_TREE_META_SLOT = 'inline-flex shrink-0 items-center';

/** Trailing slot: active check / visibility / overflow actions. */
export const SCREEN_TREE_TRAILING_SLOT = 'ml-auto inline-flex shrink-0 items-center gap-0.5';
