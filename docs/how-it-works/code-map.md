---
updated: 2026-09-18T00:00:00+0300
---

# Code map

Карта кода sber-designer после декомпозиции god-файлов. Цель — чтобы
человек или агент за пару минут понял, где что лежит и куда вносить
изменение. Поведенческое описание системы — в
[system-overview.md](./system-overview.md), а сквозная карта dual-profile
харнеса — в [dual-profile-harness.md](./dual-profile-harness.md); здесь только
структура кода.

Базовые правила раскладки и бюджет размера файлов закреплены в `CLAUDE.md`
(разделы «Module layout and size budget» и «Tests»).

## Принцип: фасады поверх модулей

Бывшие крупные файлы разрезаны на узкие модули, но **старые пути импорта
работают**: на прежнем месте остался фасад (тонкий реэкспорт) или
directory-index. Новый код импортирует конкретный модуль; фасады —
совместимость для существующих импортов.

```text
apps/web/src/lib/api-client.ts          барель  -> lib/api/<домен>.ts
apps/web/src/hooks/useChat.ts           хук     -> use-chat-stream / lib/chat-transcript
services/api/src/agent/toolset.ts       реестр  -> agent/tools/<группа>.ts
services/api/src/agent/run-recorder.ts  фасад   -> agent/run-record/*
services/api/src/design-context.ts      фасад   -> design-context/*
services/api/src/routes/chat-stream/    directory index (бывший chat-stream.ts)
packages/shared-types/src/index.ts      барель  -> доменные contract-модули
```

## apps/web — редактор

Режимы Assistant проходят через `ProjectAssistantSession.sessionMode`.
`services/api/src/session-mode.ts` содержит Ask / Plan / Design prompt
contracts, built-in tool filtering и guard для `.sber-designer/plans/*.md`.
В web `chat/SessionModeSelect.tsx` показывает режим, `chat/Composer.tsx`
хранит отдельный эфемерный Auto toggle, а `chat/PlanDocumentCard.tsx` читает,
редактирует и передаёт план в Design.

```text
apps/web/src/
  components/
    editor/              оболочки панелей редактора (один файл = одна панель)
      chat/              под-вью ассистент-чата: Transcript, ContextStrip,
                         AssistantChatSelector, DesignSourceMiniForm,
                         BackgroundRunsStrip, PermissionRequestCard,
                         run-metadata, attachments, ...
      screens/           под-вью панели Screens: NewScreenDialog,
                         GenerationRunOptions,
                         ExportScreenDialog, AddDesignSystemDialog,
                         ExtractReferenceDialog, screen-/folder-dialogs,
                         ScreenRow, EmptyScreensState, dialog-shared
      settings/          секции Settings: GenerationPipelineSettings,
                         ScreenReadinessChecks, project, providers,
                         cli-runtimes, mcp-servers, indexing/project profile,
                         general, shared
      design-panel/      вкладки Design mode: InspectTab, ComponentTab,
                         OptionsTab, StyleTab, InsertTab, LayersTab,
                         ModalSurfaceSection, DesignDraftFooter, shared
      EditorShell.tsx    Assistant-first компоновка панелей; TopBar / StatusBar / ModeTabs
      ChatPanel.tsx      shell чата: composer + send-оркестрация
      ScreensPanel.tsx   shell списка экранов + хендлеры действий
      SettingsDialog.tsx shell настроек: навигация по секциям
      VisualDesignPanel.tsx  shell Design mode: табы + inspect-запросы
      CanvasNavigationStrip.tsx  screen tabs / screen picker / Storybook component picker
      CanvasArea/CanvasFrame/DomOverlay  холст, active iframe, bounded warm pool, overlay
      MarkOverlay.tsx    Mark layer: красный маркер поверх канваса → чат
      FlowCanvas/FlowScreenNode/TransitionsPanel  Flow-граф (XYFlow)
      CodeView.tsx       Code mode (Monaco + diff)
      GitGraphDialog/StatusBar + git/{SourceControlPanel,GitDiffView}  git-поверхность
      HandoffMenu/HostAppIcon  local Open in IDE / Copy path / Copy for CLI
    home/                общий HomeShell; HomeLanding + HomeDisplayWordmark;
                         ProjectsPage/shared project surface + ProjectCard
                         (ProjectCard рисует генерируемую обложку поверх
                         стоковой заглушки; `project-thumbnails.ts` резолвит
                         override/cover/stock);
                         RecentDocumentationPanel и встроенный Markdown-reader
                         How it works (`HowItWorksPage.tsx`)
    share/               read-only share viewer
    ui/                  shadcn/ui примитивы
  hooks/
    useChat.ts           хук чата (фасад: реэкспорт публичной поверхности)
    use-chat-stream.ts   send/stream-машинерия, обработка SSE-событий
    useEditorBridge.ts   postMessage-мост с iframe
    useSandboxSession / useCatalog / useProject / useFlowRuntime / ...
  lib/
    api/                 HTTP-клиент по доменам: http (база: ApiError,
                         authHeaders), chat, project, screens, design, git,
                         agent-runs, agent-kit, mcp, project-index, files,
                         share, tasks, host-tools
    api-client.ts        совместимый барель над lib/api/*
    how-it-works-metadata.ts  frontmatter parser, metadata contract и recent sorting
    screen-folders.ts    модель папок экранов: Storybook-sync, планы
                         rename/push
    screen-panel-actions.ts  чистые хелперы действий ScreensPanel
    screen-tabs.ts      ordered unique/close/prune правила эфемерных screen tabs
    screen-preview-cache.ts bounded MRU/LRU active+warm preview model
    component-groups.ts общая grouping/dedup логика ComponentsPanel и picker
    settings-logic.ts    чистая логика Settings (enabled providers,
                         asset packs, icon sources, SettingsSection)
    chat-transcript.ts   чистые transcript/format-хелперы чата
    canvas-mark.ts       модель Mark-слоя: сцена, геометрия, painter,
                         <canvas-mark> prompt-блок
    canvas-snapshot.ts   клиент снапшот-моста превью + композит скриншота
    design-types / design-capabilities / live-inspect / insert-policy
                         контракт Design mode на стороне web
    flow-*.ts            Flow: graph, runtime, preview, targets, view
    interview-question.ts  sd:interview / sd:answer parser+composer,
                         profile-aware write target
    use-start-description-interview.ts
                         Describe components entrypoint; Storybook vs HTML-first
                         view behavior and pinned ai-description-layer session
    design-system-browser.ts
                         DS Browser item model, including descriptionLayer
                         provenance/divergence read-view
    assistant-sessions / agent-run-status / agent-continue / agent-mentions
                         ассистент: сессии, статусы ранов, continue, @-меншены
    html-design-system-{reference,distillation}.ts
                         draft prompts/events for HTML-first reference,
                         distill and apply flows
    handoff.ts / handoff-cli-prompt.ts
                         preferred host app, platform fallback и CLI prompt
  lib/api/project-index.ts   вызовы project-index; формы — project-index-types.ts
  stores/                Zustand-слайсы: editor, chat, project, catalog,
                         design, git, sandbox, tasks, assistant-run,
                         patch, theme
                         chat-store разделён: chat-store.ts —
                         машина состояний, chat-store-types.ts — формы,
                         chat-store-constants.ts — screen-id и seed,
                         chat-session-helpers.ts — чистые хелперы;
                         импорт-путь '@/stores/chat-store' сохранён
```

## services/api — backend (Bun + Hono)

```text
services/api/src/
  index.ts               сборка Hono-приложения: роуты + auth + CORS
  routes/
    chat-stream/         SSE-ран ассистента (бывший chat-stream.ts):
      index.ts           роутер + реэкспорт публичной поверхности
      request-schema.ts  схемы запроса, editor-context
      run-context.ts     target/intents, structure plan и plan-driven component pack
      built-in.ts        финализация API-провайдер-ранов
      external.ts        handoff на CLI-рантаймы (OpenCode/Codex/Claude Code)
      design-jury-finalization.ts  общий post-mechanical Jury orchestration
      external-design-jury.ts     CLI review-turn adapter через resume-сессию
      render-health.ts   post-run проверка рендера, снапшоты, run-status banner
      evidence.ts        диагностика, attachments, лог-ссылки
      sse.ts             SSE-врайтер, permission-реестр
      external-stream.ts SSE-ветка внешнего рантайма
      built-in-stream.ts SSE-ветка встроенного agent-loop
      external-prepare.ts подготовка внешнего хода: kit-контекст, handoff-
                         промпт, reusable stable context, run-запись
      external-notices.ts тексты retry/repair/context-budget уведомлений
      external-finalization-notices.ts почему ран закрыт не как чистый success
      external-design-system-proposal.ts валидация bundle предложения DS
    assets.ts / git.ts / project.ts / projects.ts / screen-folders.ts / catalog.ts /
    host-tools.ts        local-only GET apps / POST open-in для active workspace
    preview.ts           route-shell реверс-прокси превью
    preview-proxy-policy.ts  политика форвардинга обоих прокси: pinned upstream
                         origin, read-only share, срезание Cookie/Authorization/
                         service-token/share-password
    preview-bridge.ts    инжект selection-моста + rewrite root-relative URL
    preview-bridge-script.ts  сам браузерный скрипт (selection/inspect, layer
                         tree, export HTML, Mark-растеризатор html-to-image)
    preview-share.ts     публичный share-прокси по токену (read-only)
    design*.ts / share.ts / mcp.ts / ...   остальные роуты —
                         один файл на поверхность API
  agent/
    loop.ts / stream.ts  агентский цикл (sync и SSE-вариант)
    toolset.ts           реестр тулзов (ALL_TOOLS, loadAgentToolsForContext)
    tools/               реализации тулзов по группам: files (apply_patch,
                         read/write + rollback + craft), catalog,
                         project-index (+ project-index-data), validation,
                         editor-bridge, screens-flow, delivery, shared
    run-record/          артефакты рана: types, store (пути/manifest IO),
                         receipts, evidence, handoff (handoff.md), manifest
    run-recorder.ts      фасад над run-record/*
    continuation-context / permission-requests / run-coordinator
  agent-kit/             загрузка китов (default из packages/agent-kit,
                         personal, project .agents), permissions, tools
  agent-runtimes/        драйверы CLI-рантаймов, change-validation, events,
                         agent-kit-handoff разделён: -types (формы
                         и лимиты), -contracts (правила + инвентари),
                         -context (состояние редактора + output contract),
                         -session (delta для resumed-сессии), -budget
                         (разметка/ранжирование/усечение секций)
                         truthful model identity (model-identity.ts)
                         (registry/adapter + *-runner.ts на рантайм: claude,
                         codex, opencode, kimi, gigacode)
  host-tools.ts          фиксированный host-app каталог, PATH/.app probe,
                         detached no-shell spawn
  design-context/        DESIGN.md / component-selection-map: contract,
                         markdown, state, load, validate, generate,
                         prompt-summary (фасад design-context.ts)
  assets/                import_asset_pack и materialize_indexed_icon:
                         перенос assets в src/assets или src/sber-designer-assets
  design-index.ts + project-index/ + design-system-browser.ts
                         unified project index
  component-description-source.ts
                         canonical sidecar / indexed / Storybook / HTML projection
                         read-back + divergence comparison
  scaffolder.ts / html-screen-index.ts / html-design-system-preview.ts /
  html-design-system-description-write.ts / html-design-system-targets.ts
                         HTML-first bootstrap, managed Screens Index and
                         generated design-system/index.html preview, description
                         projection writer/restore/read-back
  design-inspector*.ts / design-apply.ts / design-tokens.ts /
  design-compatibility.ts   серверная часть Design mode
                         design-inspector-component.ts — usage-site компонента
                         и схема его параметров для вкладки Component
  mcp/                   product-owned MCP: manager, security, redaction
  git/                   git-worker (status v2/branch/commit/PR); ownership удалён
  screen-folder-rename.ts  rename/move экранов и папок на диске
  prompt-builder.ts    выбор профиля и сборка промпта агента
  prompt-blocks.ts     чистые рендереры блоков промпта
  prompt-attachments.ts вложения промпта
  routes/config.ts       frontend config + global user Harness setup API
  safe-fs.ts / auth.ts / user-storage.ts
                         per-user roots, global harness settings and path confinement
                         safe-fs работает по canonical пути из
                         ast-bridge `canonicalizeInside`
  workspace-access.ts / workspace-context.ts
                         global /api workspace guard + request-scoped identity
  state-store.ts / event-bus.ts
                         workspace-keyed editor state and events
  project-store.ts       in-memory store экземпляров проекта, мутации,
                         reconcile timestamps; фасад для схем
  project-schema.ts      zod-схема `.sdproj` + санитайзеры метаданных
  project-paths.ts       где лежит `.sdproj` для workspace
  project-persistence.ts atomic replace, очередь записи на файл, revision и
                         различение missing/ok/corrupt
  project-assistant-recovery.ts
                         merge assistant-истории и восстановление транскрипта
                         из run-записей
```

## services/sandbox — контроллер dev-server

```text
services/sandbox/src/
  index.ts          REST: sessions CRUD; выбор драйвера; auth-middleware
  policy.ts         bind/auth/workspace/launch policy + env-allowlist для
                    дочерних процессов; fail-closed при плохой конфигурации
  session.ts        local-spawn драйвер (дефолт)
  static-html-session.ts static HTTP preview для HTML-first/html-css проектов;
                    публикует только web-ассеты, служебные файлы → 404
  docker-session.ts docker-драйвер (экспериментальный)
  log-matcher.ts    detect-ready и классификация ошибок старта
  session-reaper.ts чистка зомби-сессий
```

## packages

```text
shared-types/        кросс-пакетные типы: барель index.ts над core, catalog,
                     screen-templates, agent-kit, design-mode, project-file,
                     assistant-history, task-tracker, design-source, host-tools
llm-gateway/         единый LLM-шлюз (ADR-0005): schema, chat, stream,
                     providers/{mock, openai-compatible, anthropic,
                     claude-code-bridge}
ast-bridge/          ts-morph/Babel AST-правки + каноническая path-безопасность
                     (resolveInside / canonicalizeInside)
design-indexer/      построение .sber-designer/design-index (builder.ts —
                     оркестрация; builder-components / -icons / -quality /
                     -notes); asset/icon-source
                     scanners, html-css-catalog, project-profile scanner,
                     project-style-contract (B3 9-section parser/validator),
                     icon-candidates, сканеры использований:
                     usage-scanner (майнинг JSX-использований), variant-scanner
                     (union-props + argTypes), usage-cards (компиляция карточек),
                     description-map, component-selection-map, pattern-compile (паттерны из project
                     screen-templates)
storybook-indexer/   Storybook index.json + static AST catalog; Description for AI
                     markdown/structured parser and sidecar reader
proj-mcp/            inbound MCP-сервер для внешних coding agents; description
                     interview mirror in `src/tools/component-description-core.ts`
babel-plugin-sd-loc/ data-sd-loc атрибуты для DOM->source маппинга
```

Пустые пакеты `editor-engine` и `sandbox-client` удалены при уборке репозитория. Общие действующие
контракты остаются в `shared-types`; новые package boundaries создаются вместе
с реальным потребителем, а не заранее.

## Куда вносить изменение

| Хочу поменять                              | Смотреть                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Поведение агентского тулза                 | `services/api/src/agent/tools/<группа>.ts`; регистрация — `agent/toolset.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Жизненный цикл SSE-рана                    | `services/api/src/routes/chat-stream/*` (ветка built-in vs external)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Артефакты рана (manifest/receipts/handoff) | `services/api/src/agent/run-record/*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Screen info / история генераций            | Контракт — `packages/shared-types/src/screen-generation-info.ts`; атрибуция и dataset — `services/api/src/agent/run-record/{screen-attribution,dataset}.ts`; API — `services/api/src/routes/screen-info.ts`; web query — `apps/web/src/hooks/useScreenGenerationInfo.ts`; UI — `apps/web/src/components/editor/screen-info/ScreenInfoSheet.tsx`; поведение — [screen-info.md](./screen-info.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| DESIGN.md / style-contract scout           | Parser — `packages/design-indexer/src/project-style-contract.ts`; reference prompt/UI — `apps/web/src/lib/html-design-system-reference.ts` + `components/editor/screens/{ExtractReferenceDialog,DesignSystemProposalCard}.tsx`; proposal accept guard — `services/api/src/routes/design-index.ts`; agent skill — `packages/agent-kit/kit/skills/ai-design-system-scout/SKILL.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Создание/перенос/экспорт экрана            | `apps/web/src/components/editor/screens/*` + `lib/screen-folders.ts` + `services/api/src/screen-folder-rename.ts`; HTML-first index sync — `services/api/src/html-screen-index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Модалки (`surface: 'modal'`)               | Контракт/грамматика — `packages/shared-types/src/{modal-surface,modal-contract}.ts`; scaffold — `apps/web/src/lib/modal-scaffold.ts`; standalone canvas/bridge — `apps/web/src/lib/modal-preview.ts` + `hooks/useStandaloneModalCanvas.ts`; overlay-runtime — `apps/web/src/lib/overlay-runtime.ts` + `components/editor/FlowOverlay.tsx` (плееры: `CanvasFrame/DemoCanvas/ShareViewer`); managed size — `services/api/src/{modal-size-rewrite,modal-size-apply}.ts` + route `routes/design.ts` (`/modal-size`) + `components/editor/design-panel/ModalSurfaceSection.tsx`; flow default — `lib/flow-runtime.ts`; craft — `services/api/src/screen-craft-modal.ts`; шаблоны — `packages/agent-kit/kit/screen-templates/modal-{form,confirm}.screen.md`; поведение — [Modal screens](./modal-screens.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| HTML-first project type                    | UI — `CanvasArea.tsx`, `DesignSystemBootstrapCard.tsx`, `CanvasNavigationStrip.tsx`, `ConnectRepoDialog.tsx`, `HtmlDesignSystemPresetPicker.tsx`, `screens/{NewScreenDialog,AddDesignSystemDialog,ExtractReferenceDialog,ImportDesignSystemFilesDialog}.tsx`; import API — `services/api/src/{html-design-system-import,routes/html-design-system}.ts`; backend — `services/api/src/{scaffolder,html-screen-index,html-design-system-preview,html-design-system-targets,html-design-system-presets}.ts`, `routes/design-index.ts`; shared paths/import rules — `packages/shared-types/src/{html-design-system-paths,html-design-system-import}.ts`; profile/index — `packages/design-indexer/src/{project-profile-scanner,html-css-catalog,project-style-contract}.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| HTML project restructure                   | Deterministic report — `packages/design-indexer/src/html-project-structure-report.ts`; transactional apply — `services/api/src/project-restructure.ts`; shared report/receipt — `packages/shared-types/src/html-project-structure.ts`; built-in report/apply tools — `services/api/src/agent/tools/project-structure.ts`; read-only proj-mcp report — `packages/proj-mcp/src/tools/index.ts`; UI launcher — `apps/web/src/lib/use-start-project-restructure.ts`; product role/skill — `packages/agent-kit/kit/agents/ai-project-restructurer.md`, `packages/agent-kit/kit/skills/project-restructure/SKILL.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Imported/custom HTML design-system adapter | Thin facade/import graph — `services/api/src/html-design-system-preview.ts`; DS-only detection and screen exclusion — `packages/design-indexer/src/{html-project-structure-report,screen-scanner}.ts`; compact HTML icon contracts — `packages/design-indexer/src/icon-contract-scanner.ts`; product role/skill — `packages/agent-kit/kit/agents/ai-html-design-system-adapter.md`, `packages/agent-kit/kit/skills/html-design-system-adapter/SKILL.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Description for AI interview               | UI — `lib/use-start-description-interview.ts`, `lib/interview-question.ts`, `components/editor/chat/InterviewQuestions.tsx`; API — `agent/tools/component-description.ts`, `component-description-source.ts`, `html-design-system-description-write.ts`; index — `design-indexer/src/{builder,usage-cards,description-map}.ts`; external — `packages/proj-mcp/src/tools/component-description-core.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| DS Browser / description read-view         | Payload — `services/api/src/design-system-browser.ts`; web model — `apps/web/src/lib/design-system-browser.ts`; UI — `apps/web/src/components/editor/DesignSystemBrowser.tsx`; beta gate — `lib/theme.ts` + `TopBar.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Prototype wiring / Flow                    | Runtime — `apps/web/src/lib/flow-runtime.ts`; UI — `FlowCanvas`, `TransitionsPanel`, `DemoCanvas`; API tools — `services/api/src/agent/tools/screens-flow.ts`; product data — `packages/agent-kit/kit/knowledge/interactive-prototype.md`, `packages/agent-kit/kit/skills/prototype-wiring/SKILL.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Генерируемые превью проектов               | Источник обложки — **последний сгенерированный экран** (не первая страница): захват `apps/web/src/lib/project-cover-capture.ts` (offscreen-iframe → снапшот Mark-слоя → downscale 640×360 WebP → coalescing latest-only queue → PUT), триггеры — SSE `done` и успешный one-shot в `hooks/use-chat-stream.ts`; закрепление экрана — `Set as thumbnail` в `components/editor/screens/ScreenRow.tsx` + `ScreensPanel.tsx` → `coverScreenId` (реестр) и зеркало в `stores/editor-store.ts`, delete/open/project-refresh чинят orphan pin; per-user свитчер `Generative thumbnail` — `components/editor/settings/general.tsx` + `lib/api/http.ts`/`stores/theme-store.ts`, backend `user-storage.ts` + `routes/config.ts`; storage — `services/api/src/project-cover-store.ts` (read/write/gitignore, magic bytes + 1MB read/write guard + canonical symlink guard + atomic write) и `projects-registry.ts` (serialized cover/reset/thumbnail/pin mutations + raw lookup); routes — `routes/projects.ts` (`GET/PUT /:id/cover`, content SHA-256 ETag, source-screen pin guard, `PUT /:id/cover-screen`, `PUT /:id/thumbnail {reset}`); файл — `<workspace>/.sber-designer/previews/cover.webp`, **коммитится с проектом**, а `previews/screens/` (flow-captures) под gitignore; отображение — `components/home/ProjectCard.tsx` + `project-thumbnails.ts`, auth-aware object URL — `hooks/use-project-artwork-src.ts`, галерея Generated preview — `ProjectsPage.tsx`; поведение — [Project covers](./project-covers.md) |
| Чат-композер и отправка                    | `ChatPanel.tsx` (shell) + `hooks/use-chat-stream.ts`; под-вью — `components/editor/chat/*`; состояние — `stores/chat-store*.ts` + `stores/chat-session-helpers.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Секция настроек                            | `apps/web/src/components/editor/settings/*`; чистая логика — `lib/settings-logic.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Вкладка Design mode                        | `apps/web/src/components/editor/design-panel/*`; сервер — `design-inspector*.ts` / `design-apply.ts`. Параметры компонента (вкладка Component): извлечение — `packages/design-indexer/src/component-params.ts` + `props-source.ts`, резолв инстанса — `services/api/src/design-inspector-component.ts`, модель вкладки — `apps/web/src/lib/component-params.ts`, безопасная instant-apply очередь — `apps/web/src/lib/component-param-queue.ts`; поведение — [Component params](./component-params.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| GigaCode CLI runtime                       | Registry — `services/api/src/agent-runtimes/registry.ts`; safe auth/catalogue state — `gigacode-state.ts`; spawn/parser — `gigacode-runner.ts`; detection/auth/MCP — `detection.ts`; session/model identity — `session.ts` + `model-identity.ts`; UI — `apps/web/src/components/editor/settings/providers.tsx` + `settings/cli-runtimes.tsx` + `chat/AssistantModelSwitcher.tsx`; traces — `tests/fixtures/runtime-traces/gigacode/`; поведение — [GigaCode CLI runtime](./gigacode-runtime.md); установка — [connect-gigacode](../integrations/connect-gigacode.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Вызов HTTP API из web                      | `apps/web/src/lib/api/<домен>.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Open in IDE / Copy for CLI                 | UI — `apps/web/src/components/editor/{HandoffMenu,HostAppIcon}.tsx`; web logic — `apps/web/src/lib/{handoff,handoff-cli-prompt}.ts` + `lib/api/host-tools.ts`; backend — `services/api/src/{host-tools,routes/host-tools}.ts`; contract — `packages/shared-types/src/host-tools.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Asset packs / icon sources                 | UI — `apps/web/src/components/editor/settings/project.tsx` + `lib/settings-logic.ts`; backend — `services/api/src/routes/assets.ts`, `services/api/src/assets/*`; index — `packages/design-indexer/src/{asset-scanner,icon-source-scanner}.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Границы доступа                            | FS-граница — `packages/ast-bridge/src/safe-path.ts` (`resolveInside` / `canonicalizeInside`) + `services/api/src/safe-fs.ts`; политика sandbox-контроллера — `services/sandbox/src/policy.ts`; политика прокси превью — `services/api/src/routes/preview-proxy-policy.ts`; публикуемые пути static-preview — `services/sandbox/src/static-html-session.ts`; MCP-политика — `services/api/src/mcp/security.ts`; решение — [ADR-0019](../architecture/adr/0019-access-boundaries-and-project-integrity.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Целостность `.sdproj`                      | `services/api/src/project-persistence.ts` (atomic replace, очередь, revision, missing/corrupt), `project-store.ts` (`saveProject({ expectedRevision })`, `recoverCorruptProject`), маршрут — `routes/project.ts` (ETag + `If-Match` → 409)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Локальный browser smoke                    | `scripts/browser-smoke.ts` + `tests/browser/{harness,static-web-server}.ts`; запуск — `bun run smoke:browser` (нужен `bunx playwright install chromium`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Новый LLM-провайдер                        | `packages/llm-gateway/src/schema.ts` + `providers/<name>.ts` (см. CLAUDE.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Общий тип между пакетами                   | `packages/shared-types/src/<домен>.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Planning-first component retrieval         | Индекс — `packages/design-indexer/src/{usage-scanner,variant-scanner,usage-cards,description-map,component-selection-map,pattern-compile}.ts`; structure planning — `services/api/src/screen-planning/screen-structure-plan.ts` + shared contract `packages/shared-types/src/screen-structure-plan.ts`; polarity/rerank/resolution/hydration — `services/api/src/component-intelligence/{component-intent,component-selection-ranker,component-resolution,component-resolution-match,component-hydration,component-pack,component-reselection,import-conventions,public-exports}.ts`; reuse — `services/api/src/screen-craft-reuse.ts`; run artifact/receipt — `services/api/src/agent/run-record/{evidence,quality}.ts`; lifecycle — [component retrieval](./component-retrieval-lifecycle.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Craft-валидация + typecheck-гейт           | `services/api/src/screen-craft.ts` (+ `screen-typecheck.ts` — ts-morph по `tsconfig` проекта → `craft.type-error`/`craft.typecheck-unavailable`); правила/категории — `packages/shared-types/src/screen-readiness.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Гейт качества screen-шаблонов              | `services/api/src/screen-templates/validate.ts`; формат/парсер — `screen-templates/parse.ts` + `packages/agent-kit/kit/screen-templates/TEMPLATE.screen.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Тесты

`bun run test`. Размещение и конвенции — раздел «Tests» в
`CLAUDE.md`: co-located `*.test.ts` для чистых web-модулей, `tests/` для
интеграции сервисов; номерные `00XX-*` — регрессии инцидентов; импортировать
реальный модуль, а не фасад.
