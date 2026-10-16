---
id: modal-form
name: Modal · Form
description: A form inside a modal dialog — create/edit records, invite, settings.
kind: form
surface: modal
modalDefaults:
  width: 560px
  height: auto
  longContent: scroll
tags: [modal, dialog, form, data-entry, edit]
states: [loading, error, success, disabled]
componentRoles:
  - role: modal-header
    intent: dialog title, optional short description, close control
  - role: form-section
    intent: grouped fields with labels, helper text, validation
  - role: field
    intent: input, select, checkbox, radio, switch, textarea
  - role: inline-feedback
    intent: field errors and async validation messages
  - role: modal-footer
    intent: pinned actions — primary submit and secondary cancel
---

## Intent

Use for a form presented as an overlay dialog: create/edit a record, invite a
person, quick settings. The screen is a `modal` surface — it renders its own
backdrop and a centered dialog window, and flow edges into it default to
`overlay` presentation.

## Layout

```text
        ░░░░░░░░░░░░ Backdrop (scrim over viewport) ░░░░░░░░░░░
        ░  ┌─ Window ─────────────────────────────────────┐  ░
        ░  │ Header: title · description          [ ✕ ]    │  ░  ← pinned
        ░  ├──────────────────────────────────────────────┤  ░
        ░  │ Body (scrolls):                              ▲│  ░
        ░  │  FormSection: Group A                        ││  ░
        ░  │   [label] [field]   inline feedback          ││  ░
        ░  │   [label] [field]                            ││  ░
        ░  │  FormSection: Group B                        ▼│  ░
        ░  ├──────────────────────────────────────────────┤  ░
        ░  │ Footer:                    [Cancel] [Save ▸]  │  ░  ← pinned
        ░  └──────────────────────────────────────────────┘  ░
        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

## Regions

- **Backdrop** — the viewport-filling scrim + centering. It is the single
  `data-sd-screen-root` and carries `data-sd-modal-backdrop`. The page/body
  background stays transparent so an underlay screen shows through in overlay.
- **Window** — the dialog box. Carries `data-sd-modal-window`, the size
  variables `--sd-modal-width` / `--sd-modal-height`, and
  `data-sd-modal-content` (`scroll` by default). `role="dialog"`,
  `aria-modal="true"`, an accessible name, and a focus trap.
- **Header** — `data-sd-modal-region="header"`, role `modal-header`. Pinned at
  the top: title, optional description, and a visible close control.
- **Body** — `data-sd-modal-region="body"`, the only elastic region
  (`flex: 1; min-height: 0; overflow-y: auto`). Holds the form: grouped
  sections (role `form-section`) with their fields (role `field`) and inline
  validation (role `inline-feedback`); long content scrolls here while header
  and footer stay put.
- **Footer** — `data-sd-modal-region="footer"`, role `modal-footer`. Pinned at
  the bottom with the primary submit and a secondary cancel; never scrolls away.

## Component guidance

- Prefer the current project's dialog/modal, field, select, checkbox, button,
  and alert components. Do not hardcode any concrete component name here.
- Put the size on the window via the contract CSS variables, not raw widths in
  classes, so the size stays editable from the Design panel.
- Keep the page background transparent; the scrim uses a design-system overlay
  token.

## States

- Loading (submitting), error (form-level + inline), success, and disabled
  states when relevant.
