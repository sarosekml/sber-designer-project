# Layout Recipes

Use this sber-designer knowledge after loading `screen-template-format`.
Recipes describe screen grammar; the exact component ids must come from
`search_project_index`, `get_indexed_component`, or `list_components`.

## App Shell

- Use the existing project shell when indexed routes or source files expose one.
- Keep navigation, top bar, and main scrolling area outside repeated content
  cards.
- If no shell exists, create a minimal semantic shell inside the screen
  implementation file and keep it easy to replace later.

## Dashboard

- Template: `dashboard`.
- Typical catalog groups: layout, card, metric, chart, table, badge, tabs.
- Structure: page header, filters/actions, KPI row, primary analysis/work area,
  optional right rail.
- States: loading skeleton, empty insight state, and error banner when data is
  implied.

## List Or Queue

- Template: `list-table`.
- Typical catalog groups: table, search, form field, button, menu, badge,
  pagination.
- Structure: title/action row, search/filter row, dense results body, row
  actions, pagination.
- Keep batch actions and filters close to the table; do not bury them in
  decorative cards.

## Detail Or Review

- Template: `detail`.
- Typical catalog groups: breadcrumbs, tabs, card, status, timeline, documents,
  related records.
- Structure: path line, entity header, status metadata, primary details, right
  rail for activity/risk/next steps.

## Form Flow

- Use project form, field, validation, button, and layout components.
- Group fields by task, not by visual decoration.
- Use a sticky or persistent action area only when the page is long.
- Generated forms should remain Design-readable: labels and editable copy
  should be plain strings where possible.
