# Product UI Patterns

Use this sber-designer knowledge when `ai-product-designer` is composing a
screen from built-in screen templates, catalog components, and
`.sber-designer/design-index/*` records.

## Source Order

1. Start with editor task intent. If the user selected a built-in template, use
   it. If no template is selected, call `list_screen_templates` only when a
   broad layout recipe would help; do not force a template when the user chose
   `Without template`.
2. Use `get_project_index_status` and `search_project_index` to find matching
   component groups, routes, screens, tokens, icons, and notes.
3. Use `list_components` only after the product pattern is clear, then read the
   exact component records or source files you need.
4. If Storybook is missing, keep the same screen grammar and use static
   components or semantic placeholders until indexing improves.

## Patterns

- **Dashboard or command center:** project shell, page header, compact KPI row,
  primary work queue or chart, optional right rail. Prefer indexed card, table,
  chart, badge, tabs, and action components.
- **List or queue:** title/action header, search and filters, dense table or
  card list, row actions, status badges, pagination. Optimize for scanning,
  comparison, and repeated work.
- **Detail or review:** breadcrumbs/path, entity header, status and ownership
  metadata, tabbed body, related records, timeline or risk rail.
- **Form or setup flow:** grouped fields, validation states, inline help,
  sticky footer actions, success/error confirmation. Keep data entry predictable
  before adding decorative layout.
- **AI workspace:** prompt area, generation/progress state, source/context list,
  result preview, version history, explicit apply/revert affordances.

## Output Rules

- Generated screens must be Design-readable output: real TSX/JSX source, thin
  Storybook wrapper when relevant, literal editable props/classes where safe,
  and `screen_create` registration.
- Use project copy, domain objects, and realistic states. Do not ship generic
  lorem ipsum, marketing heroes, or standalone demo HTML.
- Keep operational tools calm and information-dense. Page sections are layout
  bands or semantic regions; cards are for individual repeated items or framed
  tools.
