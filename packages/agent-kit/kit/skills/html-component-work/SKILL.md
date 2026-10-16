---
name: html-component-work
description: Inspect, add, or update reusable CSS catalog components in html-first projects without editing product pages by hand.
compatibility: sber-designer
sd:
  profile:
    - html-css
---

# HTML Component Work

Use this skill when the connected project is html-first and the user asks to
inspect, add, update, or document reusable CSS components, modifiers, or
component examples. The canonical implementation targets are
`design-system/tokens.css` and `design-system/components.css`;
`design-system/index.html` is a managed preview rebuilt from those sources.

## Load first

Call `read_agent_knowledge` for these ids when they are relevant before
following the runbook:

- `project-index-anatomy`
- `catalog-response-shape`
- `apply-patch-recipes`
- `frontend-ui-rules`
- `ui-anti-patterns`

## When to use vs when to defer

Use this skill when:

- The request names a reusable HTML/CSS component, modifier, component class, or
  `components.css`.
- The task is to add a catalog pattern that future screens should reuse.
- The active page shows an example, but the real requested output is a reusable
  component source.
- A `Description for AI` section should be kept or restored while rebuilding the
  managed preview.

Defer to another skill when:

- The user asks to compose or repair a product page; use
  `product-screen-generation`.
- The user asks to describe components through the interview; use
  `component-description-interview` or the `ai-description-layer` agent.
- The user asks to extract a design system from screenshots, Pixso, or repeated
  pages; use `design-system-distill`.
- The request is only branch, commit, push, or PR delivery; use
  `git-pr-workflow`.

Anti-examples:

- Do not hand-edit `design-system/index.html`. Rebuild it with
  `rebuild_design_system_preview`.
- Do not patch product pages such as `index.html` or `pages/*.html` while
  working on reusable component sources.
- Do not add project dependencies, frameworks, or build tooling for a CSS
  component task.
- Do not invent a catalog API without checking `search_project_index`,
  `get_indexed_component`, `components.css`, and real page usage first.

## Runbook

1. Confirm the project is html-first with `get_project_index_status` and inspect
   existing component records through `search_project_index`.
2. Read `design-system/components.css` before editing. Read
   `design-system/tokens.css` when the component
   needs a token, color, radius, shadow, typography, or spacing value.
3. Search for existing page usage only as evidence. Use it to learn real class
   names and modifiers, not as the default write target.
4. Patch `design-system/components.css` for the reusable block and modifiers.
   Patch `design-system/tokens.css` only when a reusable token is missing and the component cannot
   reasonably use an existing one.
5. Rebuild the managed preview with `rebuild_design_system_preview`. Keep
   `keepDescriptions` true unless the user explicitly asks for a clean preview.
6. Request index refresh with `request_project_reindex` after source changes so
   `components.jsonl`, usage cards, and description maps catch up.
7. If a new or changed component needs durable guidance for weaker models,
   propose a follow-up description pass via `ai-description-layer`.
8. If the user wants the new design system applied to pages, propose the
   existing html design-system apply flow after the reusable source is indexed.

## Tool call examples

Check index freshness and component records:

```jsonc
{ "tool": "get_project_index_status", "input": {} }
```

Search for an existing catalog pattern before adding a new one:

```jsonc
{
  "tool": "search_project_index",
  "input": {
    "query": "pricing card reusable css component",
    "types": ["component", "token"],
    "limit": 8,
  },
}
```

Read the reusable CSS source:

```jsonc
{ "tool": "read_file", "input": { "path": "design-system/components.css" } }
```

Patch only the reusable CSS source:

```jsonc
{
  "tool": "apply_patch",
  "input": {
    "ops": [
      {
        "kind": "replace-text",
        "file": "design-system/components.css",
        "find": ".pricing-card {",
        "replace": ".pricing-card {",
      },
    ],
  },
}
```

Rebuild the managed preview and keep descriptions:

```jsonc
{
  "tool": "rebuild_design_system_preview",
  "input": { "keepDescriptions": true },
}
```

Refresh derived index artifacts after source changes:

```jsonc
{
  "tool": "request_project_reindex",
  "input": { "reason": "Updated html-first reusable component CSS." },
}
```
