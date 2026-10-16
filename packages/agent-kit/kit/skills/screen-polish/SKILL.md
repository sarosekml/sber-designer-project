---
name: screen-polish
description: Run a final polish pass on an already-working screen using craft references, quality score signals, and project tokens.
compatibility: sber-designer
sd:
  profile:
    - react-storybook
    - react
    - html-css
  craft:
    requires:
      - craft-typography
      - craft-color
      - craft-a11y-baseline
      - craft-laws-of-ux
---

# Screen Polish

Use this skill after the screen renders and the structure is stable. The polish
pass tightens typography, color, contrast, density, state affordances, and
component fidelity without changing product intent.

Treat the project index quality score as a signal, not a decoration. If the
quality score calls out weak token coverage, missing usage cards, or shallow
description coverage, inspect the relevant source before making visual choices.

## Load first

Call `read_agent_knowledge` for these ids before following the runbook:

- `design-mode-contract`
- `project-index-anatomy`
- `frontend-ui-rules`
- `craft-typography`
- `craft-color`
- `craft-a11y-baseline`
- `craft-laws-of-ux`

## When to use vs when to defer

Use this skill when:

- A screen already exists, renders, and needs a craft pass.
- The user asks to make a screen feel more finished, crisp, dense, balanced, or
  product-native.
- Index quality score warnings suggest token, contrast, or component-source
  decisions need extra verification before final styling.

Defer to another skill when:

- The brief still needs layout discovery; use `screen-wireframe`.
- A new screen must be created or structurally rebuilt; use
  `product-screen-generation`.
- Only one selected element needs a small text, prop, token, or class edit; use
  `visual-design-editing`.

Anti-examples:

- Do not replace stable product structure just to make a prettier composition.
- Do not invent colors, icons, images, or metrics when indexed project records
  are missing.
- Do not make a marketing-style hero for an operational SaaS workflow.

## Runbook

1. Confirm the screen renders and identify the implementation file.
2. Read the project index status, quality score, and relevant component/token
   records before changing visuals.
3. Check typography hierarchy: headings, labels, numeric values, body copy, and
   truncation in compact containers.
4. Check color usage: prefer project tokens or CSS variables, avoid raw hex
   drift, and keep contrast accessible.
5. Check component fidelity: reuse documented component roles/classes and avoid
   anonymous wrappers when a project component expresses the same job.
6. Check states and affordances: loading, empty, error, disabled, selected,
   hover/focus, and destructive actions where applicable.
7. Run the smallest validation path for the screen and summarize the concrete
   polish changes.

## Tool call examples

Read project quality and context:

```jsonc
{ "tool": "get_project_index_status", "input": {} }
```

Resolve exact token or component records before styling:

```jsonc
{
  "tool": "search_project_index",
  "input": { "query": "primary button color token table status badge", "limit": 8 },
}
```

Validate the polished screen:

```jsonc
{ "tool": "validate_design_screen", "input": { "storyId": "example--default" } }
```
