---
name: design-system-context
description: Read and apply DESIGN.md, design-index records, screen templates, component descriptions, tokens, icons, assets, and usage examples.
compatibility: sber-designer
---

# Design System Context

Use this skill when component choice, tokens, icons, assets, density, or layout grammar
matter.

## Load first

Call `read_agent_knowledge` for these ids when they are relevant before
following the runbook:

- `project-index-anatomy`
- `catalog-response-shape`
- `icon-usage`
- `layout-recipes`
- `product-ui-patterns`
- `frontend-ui-rules`

## When to use vs when to defer

Use this skill when:

- The user asks which component, token, icon, asset, density, or layout recipe should
  be used.
- A screen task needs design-system facts before code changes.
- Project index diagnostics, DESIGN.md, or component descriptions may affect
  the right implementation path.

Defer to another skill when:

- The user asks to create or broadly compose a screen; use
  `product-screen-generation` after gathering context.
- The user selected one element and asks for a local visual edit; use
  `visual-design-editing`.
- The task is only branch, commit, push, or PR delivery; use `git-pr-workflow`.

Anti-examples:

- Do not invent colors, spacing, component variants, icon names, or asset
  imports when indexed project records exist.
- Do not scan broad source files before checking project-index and catalog
  records.

## Runbook

1. Read the compact design context already in the prompt.
2. Call `get_project_index_status` when freshness, counts, or diagnostics could
   change the answer.
3. Call `search_project_index` for component, token, icon, asset, screen, route, or
   note lookups before broad source scans.
4. Use `get_indexed_component`, `get_indexed_token`, `get_indexed_asset`,
   `get_indexed_icon`, and `list_indexed_screens` for exact records.
5. Use legacy `list_design_context` only when the project index is missing or
   diagnostics say old DESIGN.md context must be inspected directly.
6. Prefer `.sber-designer/design-index/*` details over guessing.
7. Use indexed project assets/icons first; use built-in fallback icons only
   when the project has no icon source.

## Tool call examples

Check index freshness before making a design-system recommendation:

```jsonc
{ "tool": "get_project_index_status", "input": {} }
```

Search by product intent before guessing a component:

```jsonc
{
  "tool": "search_project_index",
  "input": {
    "query": "approval queue table with status filters",
    "types": ["component"],
    "limit": 5,
  },
}
```

Read the exact component record and matching agent notes:

```jsonc
{
  "tool": "get_indexed_component",
  "input": { "id": "components-approval-table" },
}
```

Resolve a token by indexed id or name:

```jsonc
{
  "tool": "get_indexed_token",
  "input": { "idOrName": "color.surface.default" },
}
```

Resolve a project icon before using a fallback:

```jsonc
{
  "tool": "get_indexed_icon",
  "input": { "idOrName": "status-warning" },
}
```

Resolve a project illustration or image before inventing a placeholder:

```jsonc
{
  "tool": "get_indexed_asset",
  "input": { "idOrName": "empty-payments" },
}
```

Use legacy design context only as a fallback:

```jsonc
{ "tool": "list_design_context", "input": {} }
```
