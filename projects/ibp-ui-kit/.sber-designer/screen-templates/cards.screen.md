---
id: cards
name: Cards
description: Entity detail as a uniform grid of read-only info cards — one record's facts grouped into label/value blocks.
kind: detail
tags: [cards, detail, record, summary, info]
status: stable
version: 1
states: [loading, error]
componentRoles:
  - role: app-shell
    intent: left navigation rail — Organisms/Navigation
  - role: breadcrumbs
    intent: path back to the parent list — Molecules/BreadCrumbs
  - role: page-header
    intent: record title, status pill, and one or two actions — Atoms/Typography/Title, Atoms/DictionaryBadge, Atoms/Buttons/Button
  - role: info-card
    intent: a grouped block of label/value pairs — Molecules/Card
  - role: card-grid
    intent: responsive equal-width grid holding the cards — Atoms/GridTiles/Grid
---

## Intent

Use when the job is to read one record's facts at a glance — a payment, a
contract, a counterparty. The screen is a tidy grid of read-only cards, each a
titled cluster of label/value pairs. No tabs, no embedded tables, no per-card
actions: pick `cards-deal` when the page needs those.

## Layout

```text
┌────┬─────────────────────────────────────────┐
│Nav │ Breadcrumbs: Parent › <record>          │
│    ├─────────────────────────────────────────┤
│    │ PageHeader: Title [Status] [Action ⋮]   │
│    ├─────────────────────────────────────────┤
│    │ Card grid (of Info card):               │
│    ├───────────┬───────────┬─────────────────┤
│    │ Card      │ Card      │ Card            │
│    │ label/val │ label/val │ label/val       │
│    ├───────────┼───────────┼─────────────────┤
│    │ Card      │ Card      │ Card            │
│    │ label/val │ label/val │ label/val       │
└────┴───────────┴───────────┴─────────────────┘
```

## Regions

- **Nav** — global left rail. Role: `app-shell`. `Organisms/Navigation`.
- **Breadcrumbs** — locate the record. Role: `breadcrumbs`.
  `Molecules/BreadCrumbs`, ending on the record name.
- **PageHeader** — identity + state + actions. Role: `page-header`. Record
  title (`Atoms/Typography/Title`), a status pill (`Atoms/DictionaryBadge`)
  next to it, and one primary + one secondary/overflow action on the right
  (`Atoms/Buttons/Button`, `Atoms/Buttons/ContextMenuButton`).
- **Card grid** — the body. Role: `card-grid`. A responsive grid
  (`Atoms/GridTiles/Grid`) of equal-width cards; 2–3 per row.
- **Info card** — one fact cluster. Role: `info-card`. `Molecules/Card` with a
  short heading and a vertical list of label/value pairs
  (`Atoms/Typography/Text`: muted label above, value below). Empty values
  render as an em dash (—), not a blank.

## Component guidance

- Use one `Molecules/Card` per logical group (Amount, Counterparty, Deal,
  Purpose, Related task, Documents) — mirror the source record's sections.
- Keep label/value typography consistent across every card: same muted-label
  style, same value style, same vertical rhythm.
- Document/file rows inside a card may use `Atoms/Link/Link` with a download
  affordance; status inside a card uses `Atoms/DictionaryBadge`.

## States

- Loading: skeleton each card's rows; keep header and breadcrumbs.
- Error: retry in the body; keep breadcrumbs and header visible.

## Notes for the agent

- This is read-only — do not add edit pencils or per-card navigation arrows
  (that is `cards-deal`). Keep cards visually uniform.
- Below `md`, collapse the grid to a single column in source order.
- Pull field names from the project index; don't invent a schema or use lorem.
