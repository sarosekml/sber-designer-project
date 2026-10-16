---
name: prototype-wiring
description: Wire existing screens into an executable sber-designer prototype with profile-aware click/link/on-mount flow edges.
compatibility: sber-designer
sd:
  profile:
    - react-storybook
    - react
    - html-css
---

# Prototype Wiring

Use this skill when the user asks to make screens clickable, connect a flow,
wire a prototype, or turn existing screens into an executable scenario.

## Load first

Call `read_agent_knowledge` for these ids when they are relevant before
following the runbook:

- `interactive-prototype`
- `project-index-anatomy`
- `design-mode-contract`

## When to use vs when to defer

Use this skill when:

- The requested screens already exist and need navigation between them.
- The user says prototype, clickable, scenario, flow, transition, next/back, or
  demo path.
- An html-first project needs real `<a href>` page links plus mirrored flow
  edges.

Defer to another skill when:

- The user asks to create a new screen before wiring; use
  `product-screen-generation` first.
- The user only asks for a visual edit inside one selected element; use
  `visual-design-editing`.
- The user asks to inspect or author reusable components; use
  `storybook-component-work` or `html-component-work`.
- The task is only branch, commit, push, or PR delivery; use
  `git-pr-workflow`.

Anti-examples:

- Do not create new screens unless the user explicitly asks.
- Do not rewrite page content while adding prototype navigation.
- Do not call `screen_create` for an existing screen.
- Do not remove flow edges unless the user asks to replace or delete existing
  wiring.

## Runbook

1. Read the current project screens with `list_indexed_screens` or the project
   context already in the prompt. Identify exact screen ids and implementation
   files before editing.
2. If the scenario is ambiguous, ask for the path first: source screen, target
   screen, and trigger label/link.
3. For React or Storybook screens, prefer `flow_add_edge` with a stable click
   trigger (`selector` when a stable selector exists, otherwise `label`).
4. For html-first screens, add or repair the real page link in the source HTML
   first. Keep edits scoped to the anchor or navigation control.
5. Mirror html-first page links with `flow_add_edge` using
   `trigger.kind = "link"` and a workspace-relative href such as
   `pages/checkout.html`.
6. Use `presentation: "overlay"` only when the user asks for an overlay or modal
   transition; otherwise leave navigation as the default.
7. Final response names changed page files, edge ids/count, and any screens that
   still need a trigger.

## Tool call examples

Find existing screens:

```jsonc
{ "tool": "list_indexed_screens", "input": {} }
```

Patch a real html-first link before adding the edge:

```jsonc
{
  "tool": "apply_patch",
  "input": {
    "ops": [
      {
        "kind": "replace-text",
        "file": "pages/dashboard.html",
        "find": "<button>Checkout</button>",
        "replace": "<a href=\"./checkout.html\">Checkout</a>",
      },
    ],
  },
}
```

Mirror the link into the project flow:

```jsonc
{
  "tool": "flow_add_edge",
  "input": {
    "fromScreenId": "dashboard",
    "toScreenId": "checkout",
    "trigger": { "kind": "link", "href": "pages/checkout.html" },
    "label": "Checkout",
  },
}
```

Add a Storybook/React click transition:

```jsonc
{
  "tool": "flow_add_edge",
  "input": {
    "fromScreenId": "dashboard",
    "toScreenId": "detail",
    "trigger": { "kind": "click", "label": "Open details" },
  },
}
```
