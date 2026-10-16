---
id: table
name: Table
description: Full-page data table — registers, payment schedules, queues with filter, sortable rows, status, and a totals + pagination footer.
kind: list-table
tags: [table, register, schedule, queue, worklist]
status: stable
version: 1
states: [loading, empty, error]
componentRoles:
  - role: app-shell
    intent: left navigation rail — Organisms/Navigation
  - role: breadcrumbs
    intent: path back to the parent section — Molecules/BreadCrumbs
  - role: page-header
    intent: title + secondary action and a primary "+" action — Atoms/Typography/Title, Atoms/Buttons/Button
  - role: filters
    intent: filter trigger and active-filter chips — Organisms/FiltersModal, Organisms/FiltersChips
  - role: data-table
    intent: dense sortable rows with status pills and a row-overflow menu — Organisms/Table/*, Atoms/DictionaryBadge, Atoms/Buttons/ContextMenuButton
  - role: table-footer
    intent: aggregate totals on the left, rows-per-page + pager on the right — Organisms/Table/DataInteraction
---

## Intent

Reach for this when the whole screen is one table the user scans, sorts, and
acts on — a payment schedule, register, or queue. Optimize the first viewport
for density and fast triage; the totals/pagination footer must stay visible.

## Layout

```text
┌────┬─────────────────────────────────────────┐
│Nav │ Breadcrumbs: Parent › <list>            │
│    ├─────────────────────────────────────────┤
│    │ PageHeader: Title [Secondary] [Primary +]│
│    ├─────────────────────────────────────────┤
│    │ Filters: [Filter ▾] (active chips)       │
│    ├─────────────────────────────────────────┤
│    │ Table — sortable headers (↕)             │
│    │  row: date·sum·status·party·…     [⋯]    │
│    │  (loading / empty / error)               │
│    ├─────────────────────────────────────────┤
│    │ Footer: Totals Σ…·VAT…   Rows:50 ‹1 2 3…›│
└────┴─────────────────────────────────────────┘
```

## Regions

- **Nav** — global left rail. Role: `app-shell`. Use `Organisms/Navigation`;
  keep it collapsed to the icon rail like the rest of the product.
- **Breadcrumbs** — locate the table. Role: `breadcrumbs`.
  `Molecules/BreadCrumbs`, ending on the current list name.
- **PageHeader** — orient + actions. Role: `page-header`. Title on the left
  (`Atoms/Typography/Title`); on the right a secondary action and a primary
  `+ Add` action (`Atoms/Buttons/Button`).
- **Filters** — narrow the set. Role: `filters`. A `Filter` trigger that opens
  `Organisms/FiltersModal`; render selected values as `Organisms/FiltersChips`.
- **Table** — the work surface. Role: `data-table`. `Organisms/Table/*` with
  sortable column headers, money columns right-aligned, status as
  `Atoms/DictionaryBadge`, and a trailing `⋯` overflow column
  (`Atoms/Buttons/ContextMenuButton`).
- **Footer** — totals + paging. Role: `table-footer`. Aggregate sums on the
  left (Σ, VAT, net), rows-per-page selector and pager on the right.

## Component guidance

- Prefer `Organisms/Table/Layout` for the page-filling table and
  `Organisms/Table/DataInteraction` for sorting + pagination behavior.
- Right-align numeric/currency columns; format with thin-space groups
  (`7 241 045,36`). Keep row height tight — this screen is for repeated use.
- If no pagination component exists, render a small local pager in the footer
  and flag the gap in the run summary.

## States

- Loading: skeleton rows; keep header, filter trigger, and footer chrome.
- Empty: explain which filter produced zero rows and offer a reset; keep totals
  showing zeros.
- Error: inline retry above the table; never blank the whole screen.

## Notes for the agent

- Do not add a hero, illustration, or KPI cards — the table is the screen.
- Keep the totals footer pinned; it is the summary the user came for.
- Below `md`, let the table scroll horizontally rather than dropping columns.
