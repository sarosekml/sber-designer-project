---
name: Display name shown in the dropdown
description: One line — what this screen is and when to reach for it
kind: custom
# kind: dashboard | list-table | detail | form | settings | custom
#
# Optional fields — uncomment and fill what you need. Keep one value per line
# and do not put "# comments" after a value on the same line.
#
# id: stable-slug
# tags: [tag-a, tag-b]
# status: stable
# status: draft | stable | deprecated
# version: 1
# states: [loading, empty, error]
# componentRoles:
#   - role: page-header
#     intent: what it carries
#   - role: data-table
#     intent: what it carries
#
# PROJECT templates only (never in built-ins — universality rule). Bindings
# resolve roles to real indexed components and compile into the project's
# pattern index, so the assistant retrieves them for matching tasks:
#
# componentBindings:
#   - role: data-table
#     components: [molecules-table]
#     preset: sortable columns, sticky header, footer totals row
# evidence: [reference-screens/payments/schedule.png]
# viewport: 1920
---

<!--
This is the authoring skeleton for a screen template. Copy it to
`<project>/.sber-designer/screen-templates/<your-id>.screen.md` (or, for a
product built-in, `packages/agent-kit/kit/screen-templates/<your-id>.screen.md`) and fill it
in. This `TEMPLATE.screen.md` file itself is ignored by the resolver.

Required frontmatter: `name` and `description`. The `id` defaults to the file
name (minus `.screen.md`). Built-in templates must describe component ROLES,
not concrete component names. Project templates may name real components.
-->

## Intent

One short paragraph: when a designer should pick this template, and the single
most important thing the screen must get right.

## Layout

<!--
Naming rule (enforced by validate_screen_template): every box in this ASCII
sketch MUST be labelled with the exact Region name used under `## Regions`
below, and every Region below must appear here. Lead each box with the Region
name, then illustrate its content after a colon. Same vocabulary in both
places — otherwise a human gets confused and the model may map a region to the
wrong place.

  Good:  │ Header: title · [Primary ▸]        │   (region "Header" + content)
  Bad:   │ Some title and a button            │   (no region label → mismatch)
-->

```text
┌──────────────────────────────────────────────┐
│ Header: title · actions                       │
├───────────────────────────┬──────────────────┤
│ Main: primary content     │ Side: support     │
└───────────────────────────┴──────────────────┘
```

## Regions

<!--
Every region listed here must appear as a labelled box in the ASCII layout
above, using the same name (here: Header, Main, Side).
-->

- **Header** — purpose. Role: `role`. Content: what goes here.
- **Main** — purpose. Role: `role`. Content: what goes here.
- **Side** — purpose. Role: `role`. Content: what goes here.

## Component guidance

- Resolve each role to a real project component via `search_project_index` /
  `list_components` before composing; do not hardcode markup when a catalog
  component exists.
- If a role has no matching component, use the smallest local placeholder and
  call out the gap in the run summary.

## States

- Loading: …
- Empty: …
- Error: …

## Notes for the agent

- Responsive behavior, anti-patterns, anything easy to get wrong.
