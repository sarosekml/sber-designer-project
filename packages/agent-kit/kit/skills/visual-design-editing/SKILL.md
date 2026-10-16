---
name: visual-design-editing
description: Apply token-aware visual edits to the selected DOM/source node without rewriting unrelated screen structure.
compatibility: sber-designer
---

# Visual Design Editing

Use this skill for Design mode edits such as spacing, className, token, style,
text, or component-swap changes.

## Load first

Call `read_agent_knowledge` for these ids when they are relevant before
following the runbook:

- `design-mode-contract`
- `project-index-anatomy`
- `catalog-response-shape`
- `apply-patch-recipes`
- `frontend-ui-rules`
- `icon-usage`
- `ui-anti-patterns`

## When to use vs when to defer

Use this skill when:

- The user selects an element in Design mode and asks for a local visual or
  copy edit.
- The Design inspector returns source-backed capabilities for text, props,
  style, class tokens, insertion, or removal.
- The selection is only a `dom://` fallback but the active screen source can be
  inspected to make a narrow change.

Defer to another skill when:

- The request changes the whole screen structure or creates a new screen; use
  `product-screen-generation`.
- The request requires choosing unfamiliar design-system primitives; load the
  design-system context first.
- The request is only about branch, commit, push, or PR delivery.

Anti-examples:

- Do not rewrite the entire JSX tree to change a selected button label.
- Do not edit unrelated screens because a DOM fallback selector is ambiguous.

## Inspector language

Design mode has two useful levels:

- `baseline-selection`: any connected project can provide selected DOM context
  and send the user task to the agent. This may include a `dom://` location,
  selector, text, role, classes, and bounding rect, but direct visual controls
  may be unavailable.
- `Design-readable`: generated or repaired screens should expose source-backed
  `projectSupport`, `sourceScope`, and `capabilities` so future changes can use
  deterministic AST patches.

Use `sourceScope` to decide where a change belongs:

- `screen-instance`: edit the screen implementation file.
- `storybook-wrapper`: keep wrapper edits thin; move durable UI changes into the
  implementation file when possible.
- `component-definition`: edit the reusable component only if the user wants a
  component-wide change.
- `unknown`: treat the selection as baseline context and resolve from the active
  screen before editing.

## Shared operation names

Use the 0015 shared VisualChange names when drafting or explaining visual
changes:

- `set-children-text`
- `set-prop`
- `remove-prop`
- `set-style`
- `remove-style`
- `set-class-token`

Prefer the operation that matches the inspector `capabilities`. If a capability
is unavailable, explain the fallback and use the narrowest source edit.

## Runbook

1. Treat the selected DOM/source element as the default target.
2. Use inspector `projectSupport`, `sourceScope`, and `capabilities` as the
   operation contract. If ownership is unclear, call `list_indexed_screens` or
   `search_project_index` before scanning unrelated source files.
3. If the target has a real file path and location, read that file and patch the
   smallest JSX region.
4. If the target is `dom://`, start from the active screen implementation or
   indexed screen/story ownership. Match by text, selector, component path,
   role, classes, and nearby siblings. Ask one concise question only when
   several matches remain equally plausible.
5. Choose an operation:
   - text content -> `set-children-text`;
   - component option -> `set-prop` or `remove-prop`;
   - tokenized class change -> `set-class-token`;
   - inline style repair -> `set-style` or `remove-style`.
6. Use `apply_patch` for the final source change. Keep the patch scoped to the
   target file and location.
7. After applying edits, let the user review in Interact mode when useful.

## Tool call examples

Fetch the selected target before planning a local edit:

```jsonc
{ "tool": "get_selection", "input": {} }
```

Text edit on a source-backed selection:

```jsonc
{
  "kind": "set-children-text",
  "targetId": "src/screens/Approvals.tsx:42:9|button|Approve",
  "filePath": "src/screens/Approvals.tsx",
  "loc": { "line": 42, "column": 9 },
  "previousText": "Approve",
  "nextText": "Approve payment",
  "label": "Button text",
}
```

Token-aware class edit:

```jsonc
{
  "kind": "set-class-token",
  "targetId": "src/screens/Approvals.tsx:58:7|StatusBadge|Pending",
  "filePath": "src/screens/Approvals.tsx",
  "loc": { "line": 58, "column": 7 },
  "tokenGroup": "className",
  "previousClass": "rounded-md bg-muted px-3",
  "nextClass": "rounded-md bg-surface-default px-3",
  "label": "Class name",
}
```

Prop edit:

```jsonc
{
  "kind": "set-prop",
  "targetId": "src/screens/Approvals.tsx:61:11|Button|Approve",
  "filePath": "src/screens/Approvals.tsx",
  "loc": { "line": 61, "column": 11 },
  "propName": "variant",
  "previousValue": "secondary",
  "nextValue": "primary",
  "label": "Button variant",
}
```

DOM fallback resolution:

```jsonc
{
  "tool": "apply_patch",
  "input": {
    "ops": [
      {
        "kind": "set-children-text",
        "file": "src/screens/Approvals.tsx",
        "loc": { "line": 42, "column": 9 },
        "text": "Approve payment",
      },
    ],
  },
  "resolution": {
    "selection": {
      "sourceKind": "dom-fallback",
      "loc": "dom://button:nth-of-type(2)",
      "text": "Approve",
      "selector": "main [data-testid='approval-actions'] button:nth-of-type(2)",
    },
    "resolutionPath": [
      "Read active screen implementation file",
      "Match text and selector against JSX",
      "Patch the matched JSX element only",
    ],
  },
}
```

VisualChange draft for Design mode UI:

```jsonc
{
  "selection": {
    "sourceKind": "dom-fallback",
    "loc": "dom://button:nth-of-type(2)",
    "text": "Approve",
    "selector": "main [data-testid='approval-actions'] button:nth-of-type(2)",
  },
  "resolutionPath": [
    "Read active screen implementation file",
    "Match text and selector against JSX",
    "Patch the matched JSX element only",
  ],
}
```
