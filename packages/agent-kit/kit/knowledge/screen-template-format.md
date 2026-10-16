# Screen Template Format

Use this sber-designer knowledge when choosing or following a screen template
for a new generated screen.

Screen templates are layout recipes, not TSX source files, not a component
library, and not files copied into the connected project. They describe screen
grammar for the agent: intent, an ASCII block layout, and the component roles
to resolve against the current project.

## Sources

Templates come from two first-class sources, merged behind
`list_screen_templates` and tagged by `source`:

- **built-in** — universal recipes that ship with the product in
  `packages/agent-kit/kit/screen-templates/*.screen.md`. They reference component **roles**,
  never concrete component names.
- **project** — team-authored files in the connected project at
  `<project>/.sber-designer/screen-templates/*.screen.md`. These are
  project-owned, git-reviewable, and may name real project components.

A built-in and a project template can share an id; both are returned and are
selectable by the `{ id, source }` pair.

> The old `.sber-designer/templates/*.md` flat path is superseded. The current,
> supported project path is `.sber-designer/screen-templates/*.screen.md`.

## File format (`*.screen.md`)

YAML frontmatter + markdown body.

Frontmatter: `name` and `description` are required; optional `id` (defaults to
the file name), `kind`, `tags`, `status`, `version`, `states`, and
`componentRoles` (a list of `{ role, intent }`). There is no `fidelity` field —
sber-designer produces hi-fi screens from real components.

Body sections: `## Intent`, `## Layout` (one fenced ASCII schema), `## Regions`
(one bullet per region: purpose → role → content), and optional
`## Component guidance`, `## States`, `## Notes for the agent`.

The ASCII schema uses box-drawing characters to delimit regions; each region's
label matches a `## Regions` entry and, in built-in templates, names a universal
role (`PageHeader`, `Filters`, `Table`, `RightRail`, `Tabs`, …).

## Discovery

Call `list_screen_templates` before generating a new screen when the editor
state does not already include a selected template.

```jsonc
{ "tool": "list_screen_templates", "input": {} }
```

The response includes built-in templates such as `dashboard`, `list-table`,
`detail`, `form`, `settings`, plus any project templates. To pull one
template's full body (including its ASCII layout schema) on demand:

```jsonc
{ "tool": "read_screen_template", "input": { "id": "deal", "source": "project" } }
```

If the editor state or prompt says `Without template`, do not force a template.
Use the user instruction, project index, catalog components, and existing
screens to choose structure.

## Adherence

When a template is selected, treat its layout schema and regions as the
intended block arrangement:

- Build the regions in order and resolve each labelled role to a real project
  component via `search_project_index` / `list_components`.
- Improvise only as a last resort, when a region genuinely does not fit the
  screen's logic, and state any deviation in your final summary.
- Never silently ignore the template or invent an unrelated layout.

The selected template's full body is also injected into the new-screen run
prompt, so its ASCII schema is already in context.

## Composition rules

- Treat templates as grammar, not as exhaustive UI.
- Pair every template with `search_project_index` and `list_components` before
  choosing imports.
- Prefer real project components and token records over raw markup.
- Keep generated screens Design-readable: implementation file first, thin
  Storybook wrapper when relevant, literal editable text/props/classes where
  safe.
- Templates are assistant context only. Do not render template explanations in
  the product UI, and cite the template in reasoning only.

## Project starting points beyond templates

Concrete, fully-built project screens can also be pinned from Storybook through
the `From Storybook` flow (for example `Templates / Dashboard shell`). That is a
complementary path: `From Storybook` materializes a real story; screen templates
provide layout grammar for fresh generation.
