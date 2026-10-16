---
id: detail
name: Detail
description: Entity details, record profiles, asset/fund/deal pages, and review screens.
kind: detail
tags: [detail, record, profile, review]
states: [loading, error]
componentRoles:
  - role: breadcrumbs
    intent: compact path back to the parent list
  - role: page-header
    intent: entity name, status metadata, primary action
  - role: summary-card
    intent: identity, key tags, owner, top facts
  - role: tabs
    intent: Overview / Activity / Documents / Team sections
  - role: right-rail
    intent: timeline, contacts, risks, or next steps
---

## Intent

Use for entity details, record profiles, asset/fund/deal pages, and review
screens. The first viewport must answer "what is this and what's its state"
without scrolling.

## Layout

```text
┌──────────────────────────────────────────────┐
│ Breadcrumbs: Parent › <entity>                │
├──────────────────────────────────────────────┤
│ PageHeader: <entity> [Status]     [Primary ▸] │
├───────────────────────────┬──────────────────┤
│ SummaryCard               │ RightRail:        │
│ identity · owner · facts  │ Timeline /        │
├───────────────────────────┤ contacts / risks  │
│ Tabs: Overview|Activity|… │                   │
│ ┌───────────────────────┐ │                   │
│ │ Tab body              │ │                   │
│ └───────────────────────┘ │                   │
└───────────────────────────┴──────────────────┘
```

## Regions

- **Breadcrumbs** — locate the record. Role: `breadcrumbs`. Use a project
  breadcrumb component when present; otherwise a compact path line or omit.
- **PageHeader** — identity + action. Role: `page-header`. Content: entity name,
  status metadata, primary actions.
- **SummaryCard** — top facts. Role: `summary-card`. Content: entity identity,
  key tags, owner, and top facts.
- **Tabs** — sectioned detail with the tab body. Role: `tabs`. Content: Overview, Activity,
  Documents, Team, or other domain sections.
- **Right rail** — supporting context. Role: `right-rail`. Content: timeline,
  contacts, risks, or next steps. Stacks below the body on narrow widths.

## Component guidance

- Prefer the current project's exported components and existing page patterns.
- If breadcrumbs, tabs, or timeline components are not available, use
  lightweight placeholders.
- Keep all copy realistic for the project domain and make the first viewport
  useful without scrolling.

## States

- Loading: skeleton the summary card and tabs; keep the header.
- Error: surface a retry in the body, keep breadcrumbs and header visible.
