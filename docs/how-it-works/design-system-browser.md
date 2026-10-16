---
updated: 2026-07-07T00:17:09+03:00
---

# Design System Browser

## Назначение

Design System Browser - отдельное окно в editor UI для просмотра того, что
sber-designer знает о проекте после индексации. Это рабочий инструмент для
пользователя и источник проверяемого контекста для агента.

Кодовые точки:

- `apps/web/src/components/editor/DesignSystemBrowser.tsx`;
- `services/api/src/design-system-browser.ts`;
- `services/api/src/routes/design-index.ts`;
- `packages/design-indexer`.

## Что показывает окно

Категории:

- all;
- components;
- tokens;
- icons and icon candidates;
- assets;
- screens;
- routes;
- notes;
- health.

Данные приходят из `.sber-designer/design-index/*` и Project System overview.

Для HTML-first проектов browser также показывает:

- `htmlDesignSystem.status` (`connected` или `bootstrap`);
- найденные/missing source files: `Design.md`, `tokens.css`, `components.css`,
  optional `design-system.html`;
- CSS catalog components and classes;
- design-system proposals under `design/proposals/*`;
- quality checks for `Design.md` sections, root tokens, theme override,
  component classes and page token discipline.

## Setup profiler

Если автоопределение проекта неполное, browser показывает setup questions:

- package manager;
- frameworks;
- dev command;
- typecheck command;
- test command;
- Storybook availability;
- source roots.
- HTML design-system source status for HTML-first projects.

Ответы пользователя сохраняются в:

```text
.sber-designer/design-index/project-profile.answers.json
```

Эти ответы не являются временным UI state. Они принадлежат проекту и должны
помогать будущим индексам и агентам.

## Component notes

Пользователь может добавить guidance к компоненту:

- когда использовать;
- какие props важны;
- какие patterns preferred;
- что не делать.

Notes пишутся в `agent-notes.jsonl`. После re-index они становятся частью
agent context и могут попадать в prompt summary.

## Health

Health view помогает понять, почему индекс слабый:

- нет Storybook;
- catalog empty;
- tokens missing;
- assets missing;
- routes uncertain;
- setup answers absent;
- icon source missing on this machine;
- external icons indexed but not materialized yet;
- HTML-first design-system sources missing;
- HTML/CSS token/class discipline issues;
- diagnostics from builder.

UI должен давать next action: index, re-index, review diagnostics or ready.

## Связь с агентом

Агент использует те же данные, что видит пользователь:

- Project System overview;
- prompt summary;
- component records;
- token/icon/asset records;
- external icon references that require `materialize_indexed_icon` before use;
- agent notes.

Это важный принцип: если агент опирается на проектный факт, пользователь должен
иметь способ увидеть и поправить этот факт.
