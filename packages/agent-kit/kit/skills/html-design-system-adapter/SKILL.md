---
name: html-design-system-adapter
description: Adapt a foreign static HTML/CSS/JS design-system bundle through a thin canonical facade while preserving its original structure and source contracts.
compatibility: sber-designer
sd:
  profile:
    - html-css
---

# HTML Design System Adapter

Use this skill when a connected html-first project already contains a design
system exported from another tool, copied from another repository, or organized
in a project-specific HTML/CSS/JS format.

## Load first

Call `read_agent_knowledge` for:

- `project-index-anatomy`
- `frontend-ui-rules`
- `product-ui-patterns`

## Contract

The imported bundle is valid evidence, not disposable boilerplate. Preserve its
folders, manifests, catalog pages, specifications, templates, scripts, fonts,
assets, and naming. sber-designer adds a stable facade instead of requiring the
bundle to adopt one internal implementation format:

- `design-system/Design.md` maps concepts and agent entrypoints to real source;
- `design-system/tokens.css` imports the bundle's token/foundation entrypoints;
- `design-system/components.css` imports the bundle's component entrypoint;
- `design-system/index.html` remains a managed, rebuildable preview;
- the original catalog remains project-owned reference evidence and is indexed
  recursively.

CSS imports may be nested. The managed preview resolves a bounded graph of local
imports, while external URLs and paths outside the workspace are ignored.

## Runbook

1. Call `get_project_structure_report`. If it is not canonical, stop and route
   restructuring to `@ai-project-restructurer` before adapting.
2. Call `get_project_index_status`. Read compact entrypoints first: a manifest,
   component index, cheatsheet, or README. Avoid huge generated bundles and
   one-line icon registries unless an exact lookup is required.
3. Identify, with file evidence:
   - global/token CSS entrypoints;
   - the component CSS entrypoint or ordered imports;
   - component specs or catalog pages;
   - screen templates and required runtime scripts;
   - fonts, icons, and assets;
   - source-specific guardrails worth preserving.
4. Patch only the three canonical facade sources. Use local `@import` statements
   instead of copying foreign CSS. In `Design.md`, record exact entrypoints,
   component categories, template/runtime requirements, accessibility rules,
   and anti-patterns. Do not invent missing facts.
5. Rebuild `design-system/index.html` with
   `rebuild_design_system_preview({ keepDescriptions: true })`.
6. Request exactly one project reindex.
7. Search the refreshed index for representative foundation, atom, molecule,
   and organism records. Verify that canonical HTML and required classes point
   to real imported examples.
8. Report source format, preserved paths, facade imports, indexed counts,
   diagnostics, and any parts requiring human review.

## Boundaries

- Do not move files; use `@ai-project-restructurer` for structure changes.
- Do not hand-edit the managed preview or root Screens Index.
- Do not flatten or duplicate the bundle into `components.css`.
- Do not introduce React, Storybook, a package manager, or a build step into a
  static bundle.
- Do not treat screenshots or uploads as writable implementation files.
- Do not assume Claude Design, a particular component vocabulary, or a fixed
  token naming scheme in universal logic. Those are detected project facts.

## Claude Design exports

When present, `_ds_manifest.json`, `specs/_index.md`,
`specs/_cheatsheet.md`, `ds.css`, `_template/Screen.html`, and component catalog
pages are strong entrypoints. They are examples of useful evidence, not a
required schema. Preserve any export-specific agent rules as project context.
