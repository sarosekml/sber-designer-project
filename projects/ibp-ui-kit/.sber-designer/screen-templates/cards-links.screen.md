---
id: cards-links
name: Cards — links
description: Navigation hub / index — labelled columns of cards, each holding grouped lists of links to sub-sections.
kind: custom
tags: [cards, links, hub, navigation, admin, index, landing]
status: stable
version: 1
states: [empty]
componentRoles:
  - role: app-shell
    intent: left navigation rail — Organisms/Navigation
  - role: breadcrumbs
    intent: short path, usually just Home — Molecules/BreadCrumbs
  - role: page-header
    intent: section title only, no actions — Atoms/Typography/Title
  - role: column-header
    intent: label above each column of cards — Atoms/Header/DashboardGroupHeader
  - role: link-card
    intent: a card grouping a titled list of navigation links — Molecules/Card, Atoms/Link/Link
---

## Intent

Use for a landing/index that routes the user onward — an Administration hub, a
module home, a directory of sub-sections. The screen is purely navigational:
several labelled columns, each stacking cards, each card a short titled list of
links. No data, no forms, no actions beyond following a link.

## Layout

```text
┌────┬─────────────────────────────────────────┐
│Nav │ Breadcrumbs: Home                       │
│    ├─────────────────────────────────────────┤
│    │ PageHeader: <section>                   │
│    ├─────────────────────────────────────────┤
│    │ Columns (of Link cards):                │
│    ├──────────────┬──────────────┬───────────┤
│    │ Column       │ Column       │ Column     │
│    │ ┌──────────┐ │ ┌──────────┐ │ ┌────────┐ │
│    │ │Card      │ │ │Card      │ │ │Card    │ │
│    │ │ • link   │ │ │ • link   │ │ │ • link │ │
│    │ └──────────┘ │ └──────────┘ │ └────────┘ │
└────┴──────────────┴──────────────┴────────────┘
```

## Regions

- **Nav** — global left rail. Role: `app-shell`. `Organisms/Navigation`.
- **Breadcrumbs** — locate the hub. Role: `breadcrumbs`. Usually just `Home`
  (`Molecules/BreadCrumbs`).
- **PageHeader** — name the section. Role: `page-header`. A single large title
  (`Atoms/Typography/Title`); no buttons — this page only navigates.
- **Columns** — top-level grouping. Role: `column-header`. 2–4 columns, each
  introduced by `Atoms/Header/DashboardGroupHeader` with a thin rule.
- **Link cards** — the navigation units. Role: `link-card`. `Molecules/Card`s
  stacked within a column. Each card has a short heading, an optional one-line
  description (`Atoms/Typography/Text`, muted), and a vertical list of
  `Atoms/Link/Link` items routing to sub-sections.

## Component guidance

- Group links by domain exactly as the source does (e.g. Directories,
  Employees, Tasks under one column; Settings, Notifications, Documents under
  another) — the columns are the information architecture.
- Links are `Atoms/Link/Link`, not buttons; keep them in the brand link color.
- A card may show a live count or status line (e.g. "Services 29/29") as a
  muted `Atoms/Typography/Text` line under the heading — that is fine; do not
  turn it into a chart.

## States

- Empty: if a column has no available sections, omit the column rather than
  showing an empty card.

## Notes for the agent

- No KPI cards, charts, or tables — this is a router, not a dashboard.
- Keep columns balanced; let cards flow top-to-bottom within each column.
- Below `md`, stack columns vertically, each with its header then its cards.
- A decorative background illustration (as in the product) is optional and must
  never overlap the links.
