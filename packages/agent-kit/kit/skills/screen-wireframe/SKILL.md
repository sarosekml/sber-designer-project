---
name: screen-wireframe
description: Create a greybox first screen structure before visual polish, using project index roles, layout recipes, and craft constraints.
compatibility: sber-designer
sd:
  profile:
    - react-storybook
    - react
    - html-css
  craft:
    requires:
      - craft-anti-slop
      - craft-state-coverage
---

# Screen Wireframe

Use this skill when the screen brief is broad, ambiguous, image-led, or likely
to collapse under a one-shot visual implementation. The goal is greybox first:
prove the information architecture, responsive regions, and state coverage
before choosing final color, imagery, or ornament.

This skill intentionally carries `sd.craft.requires` in frontmatter so the
runtime can inject the anti-slop and state-coverage craft references alongside
the runbook.

## Load first

Call `read_agent_knowledge` for these ids before following the runbook:

- `design-mode-contract`
- `project-index-anatomy`
- `product-ui-patterns`
- `layout-recipes`
- `craft-anti-slop`
- `craft-state-coverage`

## When to use vs when to defer

Use this skill when:

- The user asks for a new screen and the hierarchy is still unclear.
- A screenshot, mockup, or long BRD needs section mapping before final styling.
- The safest next step is to establish layout, content density, and states
  without committing to a final visual language.

Defer to another skill when:

- The layout and implementation are already stable; use `screen-polish`.
- The user asks for the final production screen in one pass; use
  `product-screen-generation` and keep this as a preparatory checklist.
- The request is a selected-node edit; use `visual-design-editing`.

Anti-examples:

- Do not present a greybox as finished product UI.
- Do not use placeholder filler metrics, fake tables, or invented nav items.
- Do not hide missing states behind visual polish.

## Runbook

1. Identify the screen unit: Storybook story, React route/page, or HTML page.
2. Read the project index and existing screen/template records before writing.
3. Map the brief into named regions: header, navigation, primary work area,
   secondary rail, supporting section, and state slots.
4. Bind every region to project roles, classes, components, or tokens that
   actually exist in the index. Leave unresolved items as explicit TODO data,
   not fake product facts.
5. Keep the wireframe neutral: stable spacing, clear hierarchy, simple borders,
   and semantic labels. Avoid final palette decisions unless the token contract
   is already known.
6. Include loading, empty, and error affordances for the main interaction.
7. Validate the screen contract before handing off to `screen-polish` or
   `product-screen-generation`.

## Tool call examples

Read the current index before shaping regions:

```jsonc
{ "tool": "get_project_index_status", "input": {} }
```

Search for reusable layout and component roles:

```jsonc
{
  "tool": "search_project_index",
  "input": { "query": "dashboard summary table empty state", "limit": 8 },
}
```

Validate the generated wireframe screen:

```jsonc
{ "tool": "validate_design_screen", "input": { "storyId": "example--default" } }
```
