# UI Anti-Patterns

Avoid these sber-designer failure modes.

## Context And Component Misuse

- Standalone HTML/CSS screens when the project has indexed components,
  component-library exports, templates, or tokens.
- Invented table, form, badge, menu, or icon components when catalog/index
  records already expose the project version.
- Long-lived guidance based on old component-selection maps. Treat legacy data
  only as migration input surfaced through `agent-notes.jsonl`.
- Generic SaaS copy that ignores routes, tasks, comments, design-index notes,
  or the active screen.

## AST And Design Mode Breakage

- Rewriting an entire screen for a local selected-element edit.
- Hiding editable UI inside raw HTML strings, factories, complex arrays, or
  expression-heavy className values.
- Editing shared component definitions when the user asked for a screen
  instance change.
- Replacing a Design-readable screen with markup that Design mode can only
  inspect as `dom://` fallback.

## Visual And UX Mistakes

- One-off color palettes that ignore indexed tokens or `DESIGN.md` fallback.
- Decorative card nesting and floating page-section cards.
- Unlabeled icon-only actions, inaccessible form controls, or unreachable row
  actions.
- New dependencies for simple layout, icons, or formatting.
- Absolute positioning for ordinary product UI.
