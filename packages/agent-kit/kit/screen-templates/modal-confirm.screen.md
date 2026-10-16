---
id: modal-confirm
name: Modal · Confirm
description: A short confirmation dialog — delete, discard, or approve an action.
kind: custom
surface: modal
modalDefaults:
  width: 420px
  height: auto
  longContent: scroll
tags: [modal, dialog, confirm, destructive]
states: [loading, error]
componentRoles:
  - role: modal-header
    intent: optional short title, close control
  - role: modal-body
    intent: one clear sentence stating the consequence
  - role: modal-footer
    intent: pinned actions — confirm and cancel; confirm styled by severity
---

## Intent

Use for a short confirmation before a consequential action: delete, discard,
approve. The screen is a `modal` surface — it renders its own backdrop and a
small centered dialog, and flow edges into it default to `overlay`. Keep it to
one question and two actions.

## Layout

```text
        ░░░░░░░░░ Backdrop (scrim over viewport) ░░░░░░░░░
        ░  ┌─ Window ───────────────────────────────┐  ░
        ░  │ Delete file?                     [ ✕ ]  │  ░  ← header (optional)
        ░  ├────────────────────────────────────────┤  ░
        ░  │ This permanently removes the file.      │  ░  ← body
        ░  ├────────────────────────────────────────┤  ░
        ░  │                   [Cancel]  [Delete ▸]  │  ░  ← footer (pinned)
        ░  └────────────────────────────────────────┘  ░
        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

## Regions

- **Backdrop** — the viewport-filling scrim + centering. Single
  `data-sd-screen-root`, carries `data-sd-modal-backdrop`; page/body background
  transparent so the underlay shows through in overlay.
- **Window** — the dialog box. Carries `data-sd-modal-window`, the size
  variables `--sd-modal-width` / `--sd-modal-height`, and
  `data-sd-modal-content="scroll"`. `role="alertdialog"` or `role="dialog"`,
  `aria-modal="true"`, an accessible name, and a focus trap.
- **Header** — `data-sd-modal-region="header"`, role `modal-header` (optional
  for a bare confirm): short title and a close control.
- **Body** — `data-sd-modal-region="body"`, role `modal-body`, the elastic
  region (`flex: 1; min-height: 0; overflow-y: auto`): one plain sentence
  naming the consequence.
- **Footer** — `data-sd-modal-region="footer"`, role `modal-footer`. Pinned:
  a secondary cancel and a primary confirm; style the confirm by severity
  (destructive for delete).

## Component guidance

- Prefer the project's dialog/alert-dialog and button components. Do not
  hardcode a concrete component name here.
- Confirm copy states the outcome, not just "Are you sure?".
- Size lives on the window in the contract CSS variables so it stays editable
  from the Design panel; page background stays transparent.

## States

- Loading (while the action runs) and error (if it fails) when relevant.
