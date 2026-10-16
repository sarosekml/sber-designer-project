# Frontend UI Rules

Use this sber-designer knowledge when generating or repairing TSX/JSX screens.
The goal is production-feasible code that remains readable by Design mode.

## Component And Token Use

- Prefer indexed project components, component-library exports discovered in
  the current project, Storybook stories, and component descriptions before raw
  markup.
- Treat common UI concepts such as breadcrumb, page header, tile, card, table,
  filters, actions, navigation, and form field as roles for search. Use exact
  component names and imports only after discovering them in the current project
  index, catalog, description layer, agent notes, or source.
- Prefer tokens from `.sber-designer/design-index/tokens.json`, CSS variables,
  Tailwind config, or `DESIGN.md` fallback before literal colors or spacing.
- Keep imports workspace-relative or project-alias based; do not invent package
  names or add dependencies for simple layout.
- If a component is uncertain, call `search_project_index` and read the source
  before using it.

## Accessibility

- Use semantic landmarks and controls: `main`, `section`, `nav`, `button`,
  `table`, `form`, `label`, `input`, `select`, `textarea`.
- Icon-only controls need `aria-label` or a visible tooltip pattern already
  present in the project.
- Form fields need labels, validation text, disabled/loading states, and clear
  submit/cancel behavior.
- Tables need meaningful headers and row actions that are keyboard reachable.

## State Handling

- Include loading, empty, error, disabled, and success states when the screen
  represents data or mutation.
- Keep mock data local to the generated screen/story until the project provides
  a data layer.
- Avoid brittle async side effects in generated screens unless an existing
  project pattern shows how to wire them.

## Responsive Layout

- Prefer Flexbox and CSS Grid over absolute positioning.
- Keep fixed-format UI stable with `minmax`, `max-width`, `aspect-ratio`, and
  predictable grid tracks.
- Ensure text fits at mobile and desktop sizes without scaling font size from
  viewport width.
- Do not hide key actions on mobile unless the project already has an overflow
  menu pattern.
