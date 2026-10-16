---
name: design-system-distill
description: Distill repeated static HTML/CSS pages into evidence-backed design-system proposal files.
compatibility: sber-designer
sd:
  profile:
    - html-css
---

# Design System Distill

Use this skill when an HTML-first project has prototype pages but no connected
design system, and the user asks to extract a reusable design system from those
pages.

The goal is a proposal bundle, not a final rewrite. Every proposed token,
component class, and design rule must be backed by real values found in the
project pages or CSS. Do not invent a palette, typography scale, spacing scale,
component names, or usage rationale.

## Load first

Call `read_agent_knowledge` for these ids before following the runbook:

- `project-index-anatomy`
- `frontend-ui-rules`
- `product-ui-patterns`

## When to use vs when to defer

Use this skill when:

- The project profile is `html-css` / HTML-first.
- There are 2-3 pages or more with repeated visual values, class patterns, or
  inline styles.
- The design-system status is missing, or the canonical package is missing
  `design-system/Design.md`, `design-system/tokens.css`, or
  `design-system/components.css`.
- The user asks to distill, extract, draft, or propose a design system.

Defer to another skill when:

- The user already has connected design-system sources; use
  `design-system-context`.
- The user wants to create another page first; use `product-screen-generation`
  or `screen-wireframe`.
- The user asks to apply an accepted proposal to existing pages; that is the
  post-accept refactor flow, not this proposal skill.

Anti-examples:

- Do not invent colors, spacing, typography, shadows, or component names that
  are not traceable to current project files.
- Do not overwrite canonical files under `design-system/`; write reviewable
  proposal files and use the accept flow.
- Do not edit prototype pages while drafting the proposal.
- Do not treat a one-off value as a token without frequency or role evidence.

## Required output

Create or return a proposal bundle for:

```text
design/proposals/<timestamp>/
  Design.md
  tokens.css
  components.css
  extraction-report.md
```

In external CLI runtimes that are allowed to edit non-screen files, write those
files directly. In the in-product read-only scout, return the exact same file
paths and file contents in the final answer so the product accept flow can write
them later.

## Runbook

1. Read the compact project-index context and confirm `designContext:
bootstrap` or missing HTML design-system sources.
2. Call `get_project_index_status` to understand whether indexed screens,
   routes, tokens, and diagnostics are fresh enough.
3. Read `.sber-designer/design-index/html-css-catalog-manifest.json` and use
   its `distillation` object first. It contains machine-prepared value
   frequencies, class frequencies, and inline-style findings.
4. Call `list_indexed_screens` or `search_project_index` for HTML pages. Prefer
   2-3 pages with the highest visual overlap.
5. Read only the relevant page files and linked CSS files when the manifest
   evidence is insufficient. Keep broad grep-like exploration bounded to files
   referenced by those pages.
6. Extract or refine real values into evidence tables:
   - colors: hex/rgb/hsl values, CSS variables, text/background/border roles,
     and frequency;
   - typography: font families, sizes, weights, line-heights, and frequency;
   - spacing/radius/shadow: repeated numeric values and where they occur;
   - classes/structures: repeated class clusters and repeated DOM sections;
   - inline-style violations: values that should become tokens or component
     classes.
7. Detect conflicts. A conflict is two or more values competing for the same
   semantic role, for example two different primary colors, heading scales, or
   button radii.
8. Draft `tokens.css` with CSS custom properties only for repeated or clearly
   role-backed values. Keep names semantic and compact.
9. Draft `components.css` with reusable classes for repeated structures only.
   Keep page-specific one-offs out of this file.
10. Draft `Design.md` as the human contract: token roles, component rules,
    layout density, accessibility notes, and known gaps.
11. Draft `extraction-report.md` with frequency tables, source file paths, class
    clusters, conflicts, rejected one-offs, and a short explanation for every
    proposed token/component.
12. Finish by stating whether the proposal is ready for accept/reject and which
    page values should be refactored after acceptance.

## Proposal quality bar

- The proposal uses real values from current project files.
- Every token/component in `tokens.css` or `components.css` is explained in
  `extraction-report.md`.
- `extraction-report.md` contains frequency counts and source paths.
- Conflicts are named instead of silently choosing one value.
- One-off values are listed as rejected or left page-local.
- The proposal is deterministic enough that a reviewer can verify it from the
  2-3 pages without trusting model taste.

## Tool call examples

Check whether the project is still in bootstrap mode:

```jsonc
{ "tool": "get_project_index_status", "input": {} }
```

Search indexed pages before reading broad source:

```jsonc
{
  "tool": "search_project_index",
  "input": {
    "query": "html pages repeated cards buttons inline styles",
    "types": ["screen", "route", "token"],
    "limit": 8,
  },
}
```

Read the selected pages and their linked CSS:

```jsonc
{
  "tool": "read_file",
  "input": { "path": "pages/pricing.html" },
}
```

Read the machine-prepared distillation summary before opening broad source:

```jsonc
{
  "tool": "read_file",
  "input": { "path": ".sber-designer/design-index/html-css-catalog-manifest.json" },
}
```

External CLI write example for the proposal bundle:

```jsonc
{
  "tool": "write_file",
  "input": {
    "path": "design/proposals/2026-07-05-1420/tokens.css",
    "contentsLines": [":root {", "  --color-brand: #14532d;", "  --space-card: 24px;", "}"],
  },
}
```
