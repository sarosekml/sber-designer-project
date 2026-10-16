---
id: cards-deal
name: Cards — deal
description: Rich deal/entity overview — a mixed-height grid of section cards with header actions, badges, progress, and an embedded mini-table.
kind: detail
tags: [cards, deal, overview, pipeline, dcm, ecm]
status: stable
version: 1
states: [loading, error]
componentRoles:
  - role: app-shell
    intent: left navigation rail — Organisms/Navigation
  - role: breadcrumbs
    intent: path back through the pipeline — Molecules/BreadCrumbs
  - role: page-header
    intent: deal name with inline edit + last-changed meta line — Atoms/Typography/Title, Atoms/IconButton
  - role: section-card
    intent: titled card with an optional header action (→ navigate or ✎ edit) — Molecules/Card, Atoms/IconButton
  - role: status-block
    intent: stage label, progress bar, probability — Atoms/ProgressBar, Atoms/DictionaryBadge
  - role: embedded-table
    intent: compact schedule/list rendered inside a card — Organisms/Table/Details
  - role: count-badge
    intent: numeric counters on labels (documents, parties) — Atoms/BadgeCounter
---

## Intent

Use for the in-depth review of one deal or rich entity — the page someone lands
on from a pipeline and reads top to bottom. Unlike `cards`, the cards here are
not uniform: each owns its own content, some carry a header action (open a
sub-page → or edit ✎), some embed a progress bar, counters, or a small table.
The first viewport must answer "what is this deal and what state is it in".

## Layout

```text
┌────┬─────────────────────────────────────────┐
│Nav │ Breadcrumbs: Pipeline › <deal>          │
│    ├─────────────────────────────────────────┤
│    │ PageHeader: Title (✎) · changed <date>  │
│    ├─────────────────────────────────────────┤
│    │ Section cards (grid of Card):           │
│    ├──────────────┬──────────────┬───────────┤
│    │ Card: Client │ Card: Terms  │ Status      │
│    │              │              │ block: Stage│
│    ├──────────────┼──────────────┴────────────┤
│    │ Card: Issuer │ Embedded mini-table        │
│    ├──────────────┴───────────┬────────────────┤
│    │ Card: Team + Count badges│ Card: Docs     │
└────┴──────────────────────────┴────────────────┘
```

## Regions

- **Nav** — global left rail. Role: `app-shell`. `Organisms/Navigation`.
- **Breadcrumbs** — locate the deal. Role: `breadcrumbs`.
  `Molecules/BreadCrumbs`, ending on the deal title.
- **PageHeader** — identity + edit + provenance. Role: `page-header`. Deal
  title (`Atoms/Typography/Title`) with an inline edit `Atoms/IconButton`, and
  a muted "changed <date>, <author>" line below it.
- **Section cards** — the body grid. Role: `section-card`. `Molecules/Card`s of
  varying height. Each card has a heading; cards that lead somewhere carry a
  trailing `→` `Atoms/IconButton`, editable cards a `✎` one. Typical cards:
  Client, Deal terms, Stage, Issuer, Issue terms, Payment schedule, Team,
  Documents.
- **Status block** — the Stage card. Role: `status-block`. Stage name, status
  pill (`Atoms/DictionaryBadge`), an `Atoms/ProgressBar` with a percent, and a
  short comment.
- **Embedded mini-table** — inside the schedule card. Role: `embedded-table`.
  `Organisms/Table/Details` — a few rows (amount · date · status · paid-on), not
  a full page table.
- **Count badges** — on list-y cards. Role: `count-badge`. `Atoms/BadgeCounter`
  next to labels like Documents/Acts/Invoices to show counts.

## Component guidance

- Build the grid so cards keep their natural height (masonry-ish), not forced
  equal rows — content density differs per card.
- Reserve the card header's right slot for exactly one action: `→` to open a
  detail sub-page or `✎` to edit that section in place. Don't add both.
- For the embedded schedule use `Organisms/Table/Details` (compact), never the
  full `Organisms/Table/Layout`; link "see all" out to the `table` screen.
- Counters use `Atoms/BadgeCounter`; client/risk tags use `Atoms/DictionaryBadge`
  or `Atoms/RiskMetricsBadge` where a risk score is shown.

## States

- Loading: skeleton each card body; keep header, breadcrumbs, and card titles.
- Error: per-card error with retry where a card loads independently; keep the
  rest of the page usable rather than blanking everything.

## Notes for the agent

- This is the heavier sibling of `cards`. If the record is just read-only
  label/value facts with no actions or embeds, use `cards` instead.
- Below `lg` reflow to two columns, below `md` to one, preserving source order.
- Pull stages, statuses, and field names from the project index/catalog; keep
  copy realistic for the M&A / DCM / ECM domain — no lorem ipsum.
