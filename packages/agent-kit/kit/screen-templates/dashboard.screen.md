---
id: dashboard
name: Dashboard
description: Overview, command center, analytics, and KPI-heavy screens.
kind: dashboard
tags: [dashboard, overview, analytics, kpi]
states: [loading, empty, error]
componentRoles:
  - role: app-shell
    intent: project shell or navigation when present
  - role: page-header
    intent: title, short subtitle, primary and secondary actions
  - role: kpi-card
    intent: compact metric tile, 3-5 across
  - role: chart-or-worklist
    intent: large primary analytical block
  - role: right-rail
    intent: optional supporting column
---

## Intent

Use for overview, command center, analytics, and KPI-heavy screens. The first
viewport should summarise the state of the system and surface the few numbers
and the one primary block the user came to see.

## Layout

```text
┌──────────────────────────────────────────────┐
│ AppShell (project shell if present)           │
├──────────────────────────────────────────────┤
│ PageHeader: title · subtitle      [Primary ▸] │
├───────────────┬───────────────┬──────────────┤
│ KPI           │ KPI           │ KPI          │
├───────────────┴───────────────┴──────────────┤
│ ┌─────────────────────────┐ ┌──────────────┐ │
│ │ Main (chart / worklist) │ │ RightRail    │ │
│ │ (loading/empty/error)   │ │ (optional)   │ │
│ └─────────────────────────┘ └──────────────┘ │
└──────────────────────────────────────────────┘
```

## Regions

- **AppShell** — project shell or app shell, if the project has one.
  Role: `app-shell`.
- **PageHeader** — orient + actions. Role: `page-header`. Content: title, short
  subtitle, primary/secondary actions.
- **KPI** — headline numbers. Role: `kpi-card`. Content: a row of 3-5 compact
  KPI cards.
- **Main** — the primary block (chart / worklist). Role: `chart-or-worklist`.
  Content: a large chart, table, or work queue, with an optional right rail.
- **Right rail** — supporting column. Role: `right-rail`. Optional; stacks below
  the main block on narrow widths.

## Component guidance

- Prefer the current project's exported layout, card, table, chart, badge,
  button, tabs, and form components.
- If a matching component is missing, use a small semantic placeholder and keep
  its styles local to the generated screen.
- Keep content domain-specific; avoid generic marketing copy.
- Preserve responsive behavior with fluid grid/flex layout and project spacing
  tokens when available.

## States

- Loading, empty, and error states whenever the screen represents data.
