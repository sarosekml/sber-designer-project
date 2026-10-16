---
id: settings
name: Settings
description: Preferences, account/admin configuration, permissions, and integration setup.
kind: settings
tags: [settings, preferences, admin, permissions]
states: [success, error, disabled]
componentRoles:
  - role: settings-nav
    intent: grouped sidebar or section navigation when present
  - role: settings-section
    intent: compact section with title and save/reset
  - role: control
    intent: toggle, segmented control, select, or key/value row
  - role: permission-table
    intent: permission or role matrix when relevant
---

## Intent

Use for preferences, account/admin configuration, permissions, and integration
setup. Settings screens should feel dense, calm, and operational, not like a
marketing hero.

## Layout

```text
┌──────────────────────────────────────────────┐
│ AppShell (project shell if present)           │
├───────────────┬──────────────────────────────┤
│ SettingsNav   │ Section: General             │
│ • General     │  [label]   [toggle controls] │
│ • Members     │  [label]            [select] │
│ • Security    ├──────────────────────────────┤
│ • Billing     │ Section: Security            │
│               │  PermissionTable / key-value │
│               │  [Reset]            [Save ▸] │
└───────────────┴──────────────────────────────┘
```

## Regions

- **SettingsNav** — switch sections. Role: `settings-nav`. Content:
  grouped sidebar when the project has a matching pattern.
- **Section** — the settings panel. Role: `settings-section`. Content: compact
  sections with clear titles and save/reset affordances.
- **Controls** — the inputs. Role: `control`. Content: toggles, segmented
  controls, select menus, key/value rows.
- **Permission table** — access matrix. Role: `permission-table`. Content:
  permission tables when appropriate.

## Component guidance

- Prefer the current project's settings rows, inputs, toggles, buttons, tables,
  badges, and alert components.
- Keep labels concise and make destructive or security-sensitive actions
  explicit.
- Avoid marketing-style hero layouts; settings screens should feel dense, calm,
  and operational.

## States

- Success confirmation after save, unsaved changes, disabled, and error states.
