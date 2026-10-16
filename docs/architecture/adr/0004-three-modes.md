---
id: ADR-0004
title: Three editor modes
status: Accepted
date: 2026-05-07
scope: editor mode model
---

# ADR-0004: Three editor modes — Interact / Design / Code

> Since 0121 the Assistant also has chat session modes Ask / Plan / Design.
> They control agent intent and tools and are stored as `sessionMode`. This ADR
> continues to describe canvas `mode`: Interact / Design / Code. The repeated
> Design label is intentional; see
> [chat session modes](../../how-it-works/chat-session-modes.md).

- **Дата:** 2026-05-07
- **Статус:** Accepted

## Контекст

[Builder.io Fusion Mode Overview](https://www.builder.io/c/docs/fusion-mode-overview)
описывает три режима редактирования, которые делят один live preview:

| Mode         | Назначение                   | Что видит/делает пользователь                                              |
| ------------ | ---------------------------- | -------------------------------------------------------------------------- |
| **Interact** | Default. Functional preview. | Живое приложение, кликает, проходит флоу, проверяет на разных breakpoints. |
| **Design**   | Visual editing.              | Селект элементов, правка пропсов / стилей / лейаута через handles.         |
| **Code**     | Direct source access.        | Monaco IDE, file tree, terminal/dev-server logs, кнопка `Send PR`.         |

> "changes made in Code mode automatically sync with Design and Interact modes" —
> двусторонняя синхронизация между режимами.

## Решение

**Принимаем эту модель: один active shared sandbox-iframe + три UI-наложения.**

### Принципы

1. **Единый источник истины — AST файлов в репо.** Все три режима читают и пишут только в него.
2. **Один active iframe на сессию.** Переключение режима не пересоздаёт
   sandbox и не убивает HMR-state. ADR-0018 разрешает bounded cache из двух
   пассивных screen previews; они не являются editor targets и не получают
   bridge/overlay/runtime bindings.
3. **Interact — pointer-events на iframe** (пользователь нажимает реальные кнопки приложения).
4. **Design — pointer-events отключаются у iframe**, активируется DOM-overlay в shell. Клик ловит overlay → находит target ноду → подсвечивает → правки идут через ts-morph patches → HMR обновляет iframe.
5. **Code — Monaco поверх (или сбоку) iframe**, открыт текущий файл выделенной ноды. Сохранение → запись через api → HMR. Кнопка `Send PR` запускает `git-worker → MR`.

### Переключение

Tab-bar в верхней части редактора (`I`/`D`/`C` хоткеи: `Cmd-1/2/3`).
Состояние селекшна и текущий файл сохраняются между режимами:
выделил ноду в Design → переключился в Code → курсор стоит на этой JSX-ноде в Monaco.

### Mapping DOM ↔ AST

- При сборке dev-сервера в sandbox автоматически инъектируется Babel-плагин,
  добавляющий к каждому JSX-элементу `data-sd-loc="file.tsx:12:4"`.
- DOM-overlay читает атрибут на клике → передаёт в `ast-bridge` → ts-morph находит точную ноду.
- Этот же атрибут позволяет реверс-маппинг: AST-нода → найти соответствующий DOM-узел и подсветить (например, при клике в Code).

### Не делаем

- Отдельный режим для prototyping/animations — Phase 5+.
- Отдельный «Comments» режим — это слой поверх любого из трёх (как в caldera screenshot 003).

## Последствия

- Сложность DOM-overlay коррелирует со сложностью DOM приложения (теневой DOM, порталы MUI, fixed/absolute layouts) — это известный риск, проверяем в Phase 0 на `ibp-ui-kit` (там есть MUI Modal с порталами и DataGrid с виртуализацией).
- Babel-плагин `data-sd-loc` — неизбежная зависимость; в Vite/Webpack/SWC настраивается тривиально, но требует enforcement при подключении репо (мониторим: «плагин подключён?»).
- В Phase 0 строим минимальный prototype переключения только Interact ↔ Design ↔ Code на одной странице, без full UX shell.

См. [ADR-0018: bounded screen preview cache](./0018-bounded-screen-preview-cache.md)
для уточнения active-frame инварианта после появления screen tabs.
