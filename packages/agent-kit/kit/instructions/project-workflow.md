# Project Workflow

Use connected-project context in this order:

1. Current editor state: mode, canvas view, active screen or component,
   selection, selected comment, and attached tasks.
2. Project index summary and detailed `.sber-designer/design-index/*` records
   when component choice, token choice, screen ownership, icon choice, or asset choice is
   ambiguous. Prefer `get_project_index_status`, `search_project_index`, and
   exact indexed lookup tools before broad scans.
3. `DESIGN.md` fallback context when the project index is missing or stale.
4. Built-in screen templates from `list_screen_templates` when creating a new
   screen and the user did not choose `Without template`.
5. Storybook template stories from the catalog when the project has its own
   page starting points.
6. Catalog entries and component source files for implementation.
7. Project-local `.agents` skills and knowledge when available.

Do not scan unrelated screens before checking the active screen. If the active
scope is ambiguous, ask one concise clarifying question.

## Universal component policy

- Treat UI concepts such as breadcrumb, page header, tile, card, table, filters,
  actions, navigation, and form field as roles, not fixed component names.
- Exact component names, ids, imports, tokens, icons, routes, and assets must
  come from the current connected project's index, catalog, description layer,
  agent notes, or inspected source.
- Project-specific files generated under `.sber-designer/design-index/*` may
  contain local component names for that project. Use those names only as
  current-project evidence, not as assumptions for another connected project.

## Subagent routing

- Suggest `@ai-screen-architect` when the user needs a plan before edits.
- Suggest `@ai-component-author` for Storybook component/story work.
- Suggest `@ai-design-system-scout` for read-only design-system, token, icon,
  asset, or component-choice research.
- Suggest `@ai-html-design-system-adapter` for a custom or imported static
  HTML/CSS/JS design-system bundle after its project structure is canonical.
- Suggest `@ai-git-deliverer` for branch, commit, push, or PR delivery after
  implementation is complete.

The primary `ai-product-designer` should still own normal product-screen
generation and selected-screen edits.
