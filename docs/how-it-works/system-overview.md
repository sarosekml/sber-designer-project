---
updated: 2026-07-24T23:16:13Z
---

# System overview

## Назначение

sber-designer - это программа для открытия, редактирования и доставки
изменений в подключенном frontend-проекте. Все пользовательские изменения
принадлежат проекту, а не редактору. Если экран создан агентом, это обычные
файлы в репозитории проекта плюс метаданные в `.sber-designer/project.sdproj`.

Продукт объединяет четыре слоя:

```text
web editor -> API backend -> sandbox preview -> connected project files
```

AI-часть находится рядом с этими слоями, но не заменяет их. Агент получает
контекст проекта, вызывает инструменты или внешний CLI runtime, а затем
sber-designer проверяет фактические изменения.

## Основные процессы

### Открытие проекта

1. Пользователь выбирает или открывает workspace.
2. API создает или читает `<workspace>/.sber-designer/project.sdproj`.
3. Sandbox запускает preview/dev-server проекта или static HTML preview для
   HTML-first проекта.
4. Catalog/indexer строит список компонентов, screens, tokens, icons, external
   icon references, assets, HTML/CSS catalog и diagnostics.
5. Web editor показывает Assistant, Screens/Components resource panel, canvas и режимы работы.

### Home и project cover

1. Home и `/projects` читают identity-scoped project registry без запуска
   sandbox каждого проекта.
2. Карточка сразу показывает явный thumbnail или детерминированную stock
   заглушку.
3. Если per-user **Generative thumbnail** включён, карточка авторизованным fetch
   запрашивает сохранённый project cover и подменяет им stock layer через
   object URL после успешной загрузки.
4. Успешный screen run делает best-effort snapshot target screen и записывает
   его в `.sber-designer/previews/cover.webp`.
5. **Set as thumbnail** закрепляет screen в registry; пока pin активен,
   генерации других screens cover не меняют.

Карточка не держит live iframe неактивного проекта. Полный lifecycle:
[Project covers](./project-covers.md).

### Редактирование экрана

1. Пользователь выбирает screen в Screens panel.
2. Canvas показывает Storybook iframe для `storyId` или static HTML page URL
   для `ProjectScreen.kind: "page"`.
3. В Interact mode экран кликабелен.
4. В Design mode overlay выбирает DOM-элемент и связывает его с исходником,
   если возможно.
5. В Code mode открывается исходный файл активного screen, wrapper story или
   source location выбранного элемента.
6. Изменения сохраняются в файлы проекта и обновляют iframe через HMR/reload.

### Работа агента

1. Assistant получает user request, active screen, selection, attachments и
   project context.
2. Backend выбирает target: API provider или local CLI runtime.
3. API provider запускает внутренний `ai-product-designer` tool loop.
4. CLI runtime получает adapted handoff prompt и сам редактирует workspace.
5. После изменений backend записывает receipts, проверяет scope, source health
   (вкл. typecheck экрана против проектного `tsconfig`), design-readable качество
   и render health; при `needs_review`/`failed` финал получает run-status banner.
6. UI сохраняет transcript в `.sdproj`, показывает summary, tool events, run
   links и health badge.
7. После успешного screen run UI best-effort снимает target screen для project
   cover. Ошибка snapshot не меняет run status и не подменяет receipts.

### Доставка изменений

1. Git status и graph читаются из подключенного проекта.
2. UI показывает owned/unowned changes и selected scope.
3. Send PR делает commit/push/PR через backend git routes.
4. `.sdproj` и generated files считаются частью проекта и могут попадать в
   commit, если они относятся к задаче.

## Репозитории и зоны ответственности

### `apps/web`

React-приложение редактора. Основные части:

- `EditorShell` - layout и top-level views: `edit`, `flow`, `demo`.
- `ScreensPanel` - список экранов, папки и создание screen.
- `CanvasArea` / `CanvasFrame` - toolbar и iframe preview.
- `VisualDesignPanel` - Design mode.
- `CodeView` - Code mode.
- `FlowCanvas` / `TransitionsPanel` - Flow mode.
- Zustand stores - editor/project/git UI state.

### `services/api`

Backend на Bun + Hono. Отвечает за:

- project store и `.sdproj`;
- identity-scoped project registry, explicit thumbnails, generated cover
  storage и pin;
- catalog, Storybook/static scan;
- design index и Design System Browser payload;
- HTML-first scaffolding, static screen index, design-system source import,
  proposals and preview generation;
- asset packs, icon sources and materialized screen asset library;
- Assistant stream, agent loop, run recorder;
- CLI runtime handoff;
- MCP config/runtime state;
- design inspect/apply;
- git routes;
- sandbox proxy and preview state.

### `services/sandbox`

Слой запуска preview/dev-server. В текущей реализации это локальные sandbox
sessions, которые стартуют команду проекта, следят за процессом и дают API
адрес реального preview origin. Важное правило: backend должен хранить sandbox
origin отдельно от выбранного iframe/story URL.

### `packages/*`

- `shared-types` - публичные типы между frontend и backend.
- `design-indexer` - генерация `.sber-designer/design-index/*`.
- `storybook-indexer` - Storybook index плюс static AST fallback.
- `llm-gateway` - единый слой API provider calls.
- `ast-bridge` - вспомогательные AST/source contracts.
- `proj-mcp` - inbound MCP surface для будущих внешних IDE/agents.

### Agent kits

Default product agent kit: `packages/agent-kit/kit/` (resolved via `resolveDefaultKitRoot()`, env override `SBER_DESIGNER_AGENT_KIT_DIR`). Root `.agents/` in the sber-designer repository is the development kit. Это не инструкции для Codex/Claude, которые чинят
sber-designer как кодовую базу. Это данные продукта: agents, instructions,
skills, knowledge и script manifests, которые sber-designer загружает для
встроенного `ai-product-designer`.

## Состояние и ownership

Проектное состояние живет рядом с проектом:

```text
<workspace>/.sber-designer/project.sdproj
<workspace>/.sber-designer/assets/*
<workspace>/.sber-designer/design-index/*
<workspace>/.sber-designer/previews/cover.webp  generated project cover
<workspace>/.sber-designer/previews/screens/*   local Flow captures, gitignored
<workspace>/.sber-designer/runs/*
<workspace>/src/sber-designer-assets/*  generated/materialized screen assets
<workspace>/Design.md, tokens.css, components.css  HTML-first design-system sources
<workspace>/pages/*.html or screens/*.html          HTML-first screen pages
<workspace>/sber-designer.json
<workspace>/.agents/*              optional project override
```

Папки assets имеют два разных смысла:

- `.sber-designer/assets/*` - манифесты sber-designer (`icon-sources.json`,
  `materialized-assets.json`, `imported-packs.json`).
- `src/sber-designer-assets/*` - переносимые файлы, которые sber-designer
  материализовал для экранов из внешних icon sources.

Редакторское состояние, которое не должно попадать в git, может храниться в
localStorage: ширина панелей, скрытие сайдбаров, последний UI tab. Оно не
должно влиять на генерацию, prompts, будущие сессии команды или commit.

General preference `Generative thumbnail` не хранится в localStorage: это
identity-scoped user setting вне connected project, синхронизированный между
браузерами/сессиями через `/api/config`. Он управляет capture/display текущего
пользователя. Сам cover остаётся project-owned файлом, а `coverScreenId` —
per-user полем project registry, потому что pin относится к записи Home, а не
к `.sdproj`.

## Режимы редактора

В product shell есть top-level views:

- `Edit` - основной режим работы со screen.
- `Flow` - карта экранов и переходов.
- `Demo` - презентационный просмотр flow.

Внутри `Edit` есть три canvas mode:

- `Interact` - живой экран без overlay, клики работают как в приложении.
- `Design` - DOM overlay, inspect, style/layout/content changes.
- `Code` - source-oriented режим, Monaco и diff.

Дополнительно есть canvas view:

- `Screen` - работа с экраном.
- `Storybook` - работа с компонентами каталога.

Storybook view не является четвертым режимом. Это другой объект редактирования:
component catalog вместо screen.

Для HTML-first проекта `Screen` canvas открывает static page напрямую, а
`Storybook` view может быть пустым или слабым. Это не деградация editor mode:
компонентный контекст берется из CSS catalog и design-index.

## Инварианты

- Не добавлять новый editor mode без ADR. Comments, inspect, a11y и другие
  возможности должны быть слоями поверх существующих режимов.
- Не делать UI-логику, завязанную на конкретный проект вроде `ibp-ui-kit`.
  Проектные знания приходят из index, catalog, source inspection, notes и
  project instructions.
- Не импортировать provider SDK напрямую в feature code. API providers идут
  через `llm-gateway`.
- Не считать Storybook обязательным.
- Не создавать скрытое редакторское состояние, которое меняет поведение
  проекта, но не видно в git.
