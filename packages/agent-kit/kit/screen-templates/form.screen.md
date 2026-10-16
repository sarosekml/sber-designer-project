---
id: form
name: Form
description: Data entry, setup flows, request forms, and edit screens.
kind: form
tags: [form, data-entry, setup, edit]
states: [loading, error, success, disabled]
componentRoles:
  - role: page-header
    intent: title, short explanation, optional status
  - role: form-section
    intent: grouped fields with labels, helper text, validation
  - role: field
    intent: input, select, checkbox, radio, switch, textarea
  - role: inline-feedback
    intent: field errors and async validation messages
  - role: action-bar
    intent: anchored primary submit and secondary cancel/back
---

## Intent

Use for data entry, setup flows, request forms, and edit screens. Keep fields
predictable and scannable before adding decorative layout.

## Layout

```text
┌──────────────────────────────────────────────┐
│ AppShell (project shell if present)           │
├──────────────────────────────────────────────┤
│ PageHeader: title · explanation               │
├──────────────────────────────────────────────┤
│ FormSection: Group A                          │
│  [label] [field]   inline feedback (errors)   │
│  [label] [field]                              │
├──────────────────────────────────────────────┤
│ FormSection: Group B                          │
│  [label] [field]                              │
├──────────────────────────────────────────────┤
│ ActionBar (sticky)      [Cancel]  [Submit ▸]  │
└──────────────────────────────────────────────┘
```

## Regions

- **PageHeader** — orient. Role: `page-header`. Content: title, short
  explanation, optional status metadata.
- **FormSection** — grouped inputs. Role: `form-section`. Content: clear
  labels, helper text, validation, and required states.
- **Inline feedback** — validation. Role: `inline-feedback`. Content: field
  errors and async checks shown next to the field.
- **ActionBar** — commit. Role: `action-bar`. Content: sticky or clearly
  anchored area with primary submit and secondary cancel/back.

## Component guidance

- Prefer the current project's field, select, checkbox, radio, switch, textarea,
  button, alert, and form-layout components.
- Keep fields predictable and scannable before adding decorative layout.
- Use project validation and spacing conventions when indexed.

## States

- Success, error, disabled, and loading states when relevant.
