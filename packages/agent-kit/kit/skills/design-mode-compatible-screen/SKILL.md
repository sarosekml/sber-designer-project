---
name: design-mode-compatible-screen
description: Use when validating, repairing, or explaining whether a generated or edited screen can be safely inspected and patched by sber-designer Design mode.
compatibility: sber-designer
---

# Design Mode Compatible Screen

Use this skill before handing back a generated screen, after a substantial
legacy-screen repair, or when `validate_design_screen` reports missing,
needs-review, or unsafe patterns.

## Load first

Call `read_agent_knowledge` for these ids when they are relevant before
following the runbook:

- `design-mode-contract`
- `project-index-format`
- `project-index-anatomy`
- `catalog-response-shape`
- `apply-patch-recipes`
- `product-ui-patterns`
- `frontend-ui-rules`

## Compatibility levels

Design mode has two levels of support:

- `baseline-selection`: any rendered connected project may provide a selected
  DOM element, selector, text, rect, safe attributes, and a `dom://` fallback.
  The user can still ask the agent to work on the selected element even when
  direct visual controls are locked.
- `Design-readable`: generated and substantially repaired screens should map
  visible UI back to safe source targets with stable `projectSupport`,
  `sourceScope`, and `capabilities`.

Do not reject an arbitrary existing project just because it only has
`baseline-selection`. Do make new or repaired output Design-readable.

## Required project context

Use the unified project index before broad source guessing:

- `.sber-designer/design-index/screens.jsonl`
- `.sber-designer/design-index/components.jsonl`
- `.sber-designer/design-index/tokens.json`
- `.sber-designer/design-index/assets.jsonl`
- `.sber-designer/design-index/project-profile.json`
- built-in screen templates when this is a generated screen and the active
  screen context

Search the index for the screen implementation file, Storybook wrapper,
component catalog records, tokens, assets, routes, and source ownership.

## Runbook

1. Resolve the target screen from the active screen, `screens.jsonl`, route, or
   selected element context.
2. Prefer the screen implementation file as the durable edit target. Keep a
   thin Storybook wrapper for stories, args, decorators, providers, and sample
   data only.
3. Run `validate_design_screen` with `screenId` or
   `implementationFilePath`.
4. If the screen is compatible, summarize the result and keep changes focused.
5. If the screen needs review or the source is missing, inspect the reported
   files and diagnostics before editing.
6. Patch only the implementation file when possible. Use `apply_patch` for
   source edits and `screen_create` only after a new implementation file
   exists.
7. Re-run `validate_design_screen` before final handoff.

## Generation and repair rules

Prefer:

- real React, TSX, or JSX source for editable UI;
- indexed components, icons, assets, tokens, and selected built-in templates before
  custom markup;
- plain text children or string props for editable copy;
- string, number, and boolean literal props for first-pass controls;
- literal `className` values when Design mode should edit classes;
- narrow object literal `style` values only when needed;
- stable helper attributes such as `data-sd-flow-id`, project-conventional
  `data-testid`, and `aria-label`.

Avoid:

- `dangerouslySetInnerHTML`, raw HTML strings, or whole-screen HTML templates;
- huge computed `className` expressions on first-pass editable elements;
- computed `style` values that hide the editable AST target;
- putting the primary editable UI only in a Storybook wrapper;
- changing a shared component definition unless the user asks for a
  component-wide change;
- replacing unrelated screen structure to fix one selected element.

## Fallback behavior

When the user starts from a `dom://` selection, preserve the baseline context:
selector, visible text, role, rect, source hint, component path, and nearby
siblings. Use that context to find the smallest plausible source target. If the
requested result generates or repairs screen code, the touched output should
then satisfy the Design-readable rules above.
