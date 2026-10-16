---
name: screen-redesign
description: Redesign or substantially restyle an existing app screen while preserving its information architecture, business facts, data fields, actions, states, routes, and source identity. Use for broad requests such as redesign, restyle, recompose, change density, or make an existing screen compact; do not use for a new screen or a selected-element tweak.
compatibility: sber-designer
sd:
  critique:
    policy: opt-in
  profile:
    - react-storybook
    - react
    - html-css
  craft:
    requires:
      - craft-anti-slop
      - craft-state-coverage
      - craft-layout-spacing
      - craft-data-density
---

# Screen Redesign

Redesign the active screen without silently turning the task into new-screen
generation. Change composition, density, token use, and component choices only
after recording what the existing product surface must preserve.

## Load first

Call `read_agent_knowledge` for these ids before following the runbook:

- `design-mode-contract`
- `project-index-anatomy`
- `product-ui-patterns`
- `layout-recipes`
- `craft-anti-slop`
- `craft-state-coverage`
- `craft-layout-spacing`
- `craft-data-density`

## When to use vs when to defer

Use this skill when:

- An existing screen needs a broad redesign, restyle, density shift, or new
  composition.
- The user wants a different visual direction while keeping the same workflow
  and product content.
- Several regions must move or change component families together.

Defer to another skill when:

- The task creates a separate screen; use `product-screen-generation`.
- The structure is stable and only needs final craft polish; use
  `screen-polish`.
- One selected element needs text, prop, token, or class changes; use
  `visual-design-editing`.

Anti-examples:

- Do not create a replacement screen or story and leave the active screen
  unchanged.
- Do not delete sections, fields, actions, states, or routes to make the new
  composition easier.
- Do not translate, rename, summarize away, or invent business facts.
- Do not preserve accidental wrapper markup when a project component can express
  the same role without losing content or behavior.

## Runbook

1. Resolve and read the active screen implementation file. Keep its registered
   story/page identity and write scope.
2. Build a preservation inventory before editing:
   - section order, headings, labels, and navigation;
   - data fields, exact names, amounts, dates, identifiers, and statuses;
   - actions, validation, loading, empty, error, selected, and disabled states;
   - route targets, links, and interaction affordances.
3. Read the task-relevant component pack, indexed tokens, and layout recipes.
   Read one or two comparable project screens only when the run's design brief
   permits existing-screen references. Do not infer component APIs.
4. State the redesign delta: what changes in composition, density, hierarchy,
   and visual treatment, and what remains fixed by the preservation inventory.
5. Edit the active implementation in bounded passes. Reuse project component
   roles and tokens; keep the Storybook wrapper thin and stable.
6. Compare the result with the preservation inventory. Restore any missing
   product fact, section, action, state, or route before polish.
7. Run `validate_design_screen` and `validate_screen_craft`. Treat blocking
   findings as unfinished work and report unresolved should-fix findings.
8. Summarize changed composition separately from preserved content.

The harness records the preservation inventory before the runtime starts and
runs a terminal redesign-fidelity comparison after source changes. A redesign
must both change composition and preserve every inventoried section, business
fact, action, state, and route; otherwise the run remains `needs_review`.

## Tool call examples

Read the active implementation:

```jsonc
{
  "tool": "read_file",
  "input": { "path": "src/screens/Payments.tsx", "startLine": 1, "limit": 240 },
}
```

Load task-relevant components before recomposing:

```jsonc
{ "tool": "get_task_relevant_components", "input": {} }
```

Validate preservation-safe output:

```jsonc
{
  "tool": "validate_design_screen",
  "input": { "implementationFilePath": "src/screens/Payments.tsx" },
}
```

```jsonc
{
  "tool": "validate_screen_craft",
  "input": { "implementationFilePath": "src/screens/Payments.tsx" },
}
```
