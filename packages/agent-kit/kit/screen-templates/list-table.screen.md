---
id: list-table
name: List / table
description: Directories, table views, search results, queues, and worklists.
kind: list-table
tags: [list, table, queue, worklist, search]
states: [loading, empty, error]
componentRoles:
  - role: app-shell
    intent: project shell or navigation when present
  - role: page-header
    intent: title, count/summary, create and export actions
  - role: filters
    intent: search and filter bar with chips or segmented controls
  - role: data-table
    intent: dense table or card-list with row actions and status
  - role: pagination
    intent: pager or load-more affordance
---

## Intent

Use for directories, table views, search results, queues, and worklists.
Optimize the first viewport for scanning, comparison, and repeated operational
use rather than presentation.

## Layout

```text
┌──────────────────────────────────────────────┐
│ AppShell (project shell if present)           │
├──────────────────────────────────────────────┤
│ PageHeader: title · count       [Create][⬇]   │
├──────────────────────────────────────────────┤
│ Filters: [search]  [status ▾] [segment ▾]     │
├──────────────────────────────────────────────┤
│ Table (filters applied, ~10 rows)             │
│  • row: name · status · owner · date · [⋯]    │
│  • loading / empty / error states             │
├──────────────────────────────────────────────┤
│ Pagination (page ▸ / load more)               │
└──────────────────────────────────────────────┘
```

## Regions

- **AppShell** — project shell or app shell, if present. Role: `app-shell`.
- **PageHeader** — orient + actions. Role: `page-header`. Content: title,
  count/summary, create/export actions.
- **Filters** — narrow the set. Role: `filters`. Content: search and filter bar
  with chips, segmented controls, or compact form fields when available.
- **Table** — the work surface. Role: `data-table`. Content: dense table or
  card list with clear row actions and status indicators.
- **Pagination** — handle long sets. Role: `pagination`. Content: pagination or
  "load more" when the data set is long.

## Component guidance

- Prefer the current project's table, list, field, button, badge, menu, and
  pagination components.
- If the design system has no table component, use accessible semantic table
  markup as a small placeholder.
- Optimize for scanning, comparison, and repeated operational use.

## States

- Empty, loading, and error states for the data body.
