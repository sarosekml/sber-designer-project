---
updated: 2026-07-24T23:16:15Z
---

# How it works: sber-designer

Эта папка - текущая системная документация sber-designer. Она фиксирует
реальное состояние продукта по коду. Почему система устроена именно так,
объясняют ADR в [`docs/architecture/adr/`](../architecture/adr/README.md).
Для spec driven работы ориентируйтесь на документы из этой папки.

## Встроенный раздел How it works

Эта же папка является источником встроенной пользовательской документации.
Раздел открывается через пункт **How it works** в левой панели, а три страницы
с самым свежим `updated` показываются карточками на Home:

- `README.md` рендерится по маршруту `/how-it-works` как обзор;
- любой другой `*.md` автоматически получает маршрут
  `/how-it-works/<имя-файла>`;
- каждый документ начинается с `updated` в ISO frontmatter; metadata-каталог
  для Home содержит только slug/title/excerpt/date и не втягивает Markdown body
  в initial bundle;
- заголовок страницы и название в навигации берутся из первого `# H1`;
- ссылки между Markdown-файлами этой папки остаются внутренней навигацией;
- новый файл не нужно вручную регистрировать в React-коде: Vite включает весь
  glob `docs/how-it-works/*.md` в отдельный lazy-loaded documentation chunk.

Встроенный reader поддерживает заголовки, списки, таблицы, цитаты, ссылки,
изображения и fenced code blocks. Raw HTML намеренно не исполняется. Документ
нужно писать так, чтобы он одинаково читался в GitHub и внутри продукта.

## Home и Projects

Общий `HomeShell` содержит три primary destination:

- `/` — Home landing: prompt, project tiles, три последних How it works
  документа, затем `Agent quality rollout`;
- `/projects` — реестр проектов текущего local/server пользователя, поиск и
  существующие create/connect/tile actions;
- `/how-it-works` — полная библиотека документации.

Home lazy-loads общую project surface и показывает первые три записи
current-user registry без page toolbar и поиска. `/projects` использует ту же
surface в полном режиме.

Верхний Home header оставляет только accent-aware `BrandLogo`. Над prompt
показывается responsive wordmark `SBER DESIGNER`: Script-глифы `S`, `D`, `S`
комбинируются с доступными Pixel-глифами из двух bundled OTF-файлов. Поскольку
Pixel-файл не содержит заглавных `I` и `G`, эти две буквы явно набраны
bundled `SB Sans Display SemiBold`; это исключает тонкий системный fallback.
Wordmark остаётся полностью uppercase и использует `--primary`, поэтому следует
выбранному accent.
В режиме `Monogram` общий `BrandMark` показывает одну Script-букву `D` вместо
прежнего `SD`; тот же компонент используется в header и preview настроек.
Home и editor header используют общий `BrandHomeLink`: его `44px` hit area
центрирован на отметке `32px`, совпадающей с серединой `64px` Home rail. Поэтому
логотип не смещается по горизонтали при переходе из landing в проект.

Карточка проекта всегда имеет безопасную основу: явно выбранный/uploaded
`thumbnailPath` или детерминированную stock-заглушку Preview 01–05. После
успешной генерации поверх основы может появиться статический snapshot target
screen. Он сохраняется в
`<workspace>/.sber-designer/previews/cover.webp`, коммитится вместе с проектом
и обновляется после следующих успешных runs. **Set as thumbnail** закрепляет
конкретный screen; per-user **Settings → General → Generative thumbnail**
отключает capture и отображение generated layer, но не удаляет сохранённый
файл. Явный `thumbnailPath` показывается сразу и держится до следующей успешной
генерации; **Generated preview** возвращает snapshot вручную. Подробный
lifecycle, storage/API guards и release smoke:
[Project covers](./project-covers.md).

Встроенные project thumbnails имеют парные dark/light PNG для Preview 01–05.
В registry хранится только канонический dark path, а Home, Projects и thumbnail
picker реактивно выбирают соответствующий raster-вариант по app theme.
Generated и загруженные пользователем изображения не преобразуются.

Settings → General рендерит surface palette в порядке
`Graphite → Gray → Black`, brand mark — `Monogram → Image`, а neutral accent
идёт после Yellow. Для пользователей без сохранённых preferences дефолтами
являются Graphite и Script `D` monogram; существующие personal overrides не
перезаписываются. Indigo использует `#5046C1`, Green — `#2DAF44`.

## Главная модель продукта

sber-designer - это локальный AI visual editor для подключенного frontend
проекта. Он не хранит отдельный макет и не заменяет репозиторий своим
документным форматом. Продукт открывает проект, запускает его preview/dev
server, показывает живой DOM в iframe, индексирует компоненты и меняет исходные
файлы проекта.

Короткая цепочка:

```text
connected project -> sandbox preview -> project index -> editor modes ->
agent or manual edit -> source files/.sdproj -> git diff/PR
```

Ключевые правила:

- Источник правды - подключенный проект и его файлы.
- Состояние sber-designer, которое влияет на проект, хранится в проекте,
  обычно в `.sber-designer/*`.
- Browser localStorage используется только для временного состояния интерфейса.
- Canvas - это live DOM iframe, а не векторная модель.
- Storybook полезен, но не обязателен.
- HTML-first проекты являются отдельным project type, а не attachment/export
  режимом: `.html`/`.css` файлы могут быть source of truth подключенного
  проекта.
- LLM-вызовы API-провайдеров проходят через `@sber-designer/llm-gateway`.
- CLI runtime, например Codex, OpenCode, Claude Code, Kimi или GigaCode,
  работает через отдельный handoff и проверяется после завершения.
- Продуктовый agent kit живёт в `packages/agent-kit/kit/` — это product data
  для внутреннего агента, а не инструкции внешнему coding agent. Корневая
  `.agents/` — кит агентов-разработчиков sber-designer (ADR-0020).

## Текущий acceptance status

Автоматические гейты закрыты по всем направлениям, описанным в этой папке.
Открытыми остаются только проверки, которые нельзя выполнить без участия
человека или без внешней среды:

- **GigaCode CLI** — fixtures и replay зелёные; обязательная live-матрица на
  машине с установленным CLI остаётся release gate.
- **Модальные экраны** — автоматические exit gates пройдены; owner live-smoke
  standalone- и overlay-сценариев остаётся acceptance gate.
- **Генерируемые обложки проектов** — backend- и web-гейты пройдены; полный
  browser-цикл `generation → refresh → pin → switch → Generated preview`
  остаётся release smoke.

Living smoke/replay документы остаются повторяемыми release-процедурами.
Здесь намеренно нет быстро устаревающего общего счётчика suite. Отдельные future platform/UX идеи и owner-triggered
ultra/security audit не являются скрытым незавершённым scope.

## Документы

- [System overview](./system-overview.md) - общая архитектура, основные
  процессы и границы ответственности.
- [Code map](./code-map.md) - карта кода: где какой модуль лежит после
  декомпозиции god-файлов, принцип фасадов и таблица «куда вносить
  изменение».
- [Project requirements](./project-requirements.md) - что должен уметь
  подключенный проект, чтобы нормально открываться, индексироваться и
  рендериться.
- [Project workspace modes](./project-workspace-modes.md) - простое объяснение,
  где физически лежит проект в local dev, local user-mode и remote server beta,
  что копируется, что остается на диске пользователя и что переживает update.
- [HTML-first projects](./html-first-projects.md) - отдельный статический
  HTML/CSS project type: создание проекта, Screens Index, дизайн-система,
  distill/apply потоки, indexing, canvas и пользовательский путь.
- [Project state and persistence](./project-state-and-persistence.md) - где
  хранится проектное состояние, `.sdproj`, design index, runs, assets и
  настройки.
- [Project covers](./project-covers.md) - generated cover после успешного run,
  приоритет изображения, pin `Set as thumbnail`, General switch, storage,
  cache и security guards.
- [Indexing project](./indexing-project.md) - как строится
  `.sber-designer/design-index`, Project System overview, HTML/CSS catalog,
  icon sources и Design System Browser.
- [Screens panel and screen creation](./screens-panel-and-screen-creation.md) -
  список экранов, папки, `Ungrouped`, создание, импорт из Storybook, rename,
  move, duplicate, delete и health.
- [Modal screens](./modal-screens.md) - модель `surface: 'modal'`, managed
  source contract, standalone modal-sized canvas, честный Flow overlay,
  Design-size apply, generation/planning и craft gate.
- [Screen templates](./screen-templates.md) - built-in и project-authored
  screen recipes для создания экранов.
- [Canvas and sandbox](./canvas-and-sandbox.md) - preview iframe, sandbox
  session, bounded active/warm preview pool, Storybook single-frame behavior,
  reload/restart и render health.
- [Flow mode](./flow-mode.md) - top-level Flow view, nodes, edges, triggers,
  previews, visibility и Demo.
- [Dual-profile harness](./dual-profile-harness.md) - сквозная карта
  мультиагентного харнеса для Storybook/React и HTML-first профилей: агенты,
  skills, Description for AI, component authoring, prototype wiring, runtimes и
  smoke-acceptance.
- [Design mode](./design-mode.md) - выбор DOM-элемента, inspect/apply,
  capabilities, вкладки и design-readable контракт.
- [Component params](./component-params.md) - schema-driven вкладка
  `Component`: instance recovery, TS/Storybook extraction, instant JSX apply,
  baseline/conflict-safe очередь и границы поддержки.
- [Code mode](./code-mode.md) - Monaco editor, source resolution, save и diff.
- [Storybook mode and catalog](./storybook-mode-and-catalog.md) - компонентный
  canvas, catalog, static fallback и component authoring.
- [Describe components for AI](./describe-components-for-ai.md) - интервью-модуль:
  как человек описывает компоненты, протокол `sd:interview` и контролы, сайдкар как
  источник истины, компиляция в индекс и потребление при генерации.
- [Design System Browser](./design-system-browser.md) - окно просмотра
  дизайн-системы, setup profiler и agent notes.
- [LLM providers and runtimes](./llm-providers-and-runtimes.md) - API providers,
  CLI runtimes, capabilities, attachments, config и preflight.
- [GigaCode CLI runtime](./gigacode-runtime.md) - detection/auth, headless
  runner, stream-json mapping, truthful model/session/usage, failure semantics
  и граница fixtures-vs-live verification.
- [Open project in IDE and Copy for CLI](./open-in-ide-handoff.md) - локальный
  handoff подключённого workspace в IDE, файловый менеджер, терминал или
  внешний coding agent; platform probe, безопасный spawn и server-граница.
- [Assistant panel and tasks](./assistant-panel-and-tasks.md) - пользовательский
  слой чата, screen-scoped sessions, current task и attachments.
- [Chat session modes](./chat-session-modes.md) - Ask / Plan / Design,
  отдельный Auto-тумблер, серверный tool gating и handoff из plan-документа.
  Подробности: [Ask](./chat-mode-ask.md), [Plan](./chat-mode-plan.md),
  [Design](./chat-mode-design.md).
- [Agent system](./agent-system.md) - agent kits (product / personal / project), API-agent loop, external CLI
  handoff, tools, permissions, runs и diagnostics.
- [Agent quality harness](./agent-quality-harness.md) - понятная сквозная
  модель нового экранного harness: пользовательские сценарии, target/scope,
  bounded CLI follow-ups, 30-minute Codex session rollover, finalization,
  Design Jury, token usage, dataset, feedback и project style memory.
- [Component retrieval lifecycle](./component-retrieval-lifecycle.md) - как
  full component map превращается в structure/selection plan, hydrated
  contracts, фактический reuse и bounded late retrieval для API и CLI.
- [Generation pipeline](./generation-pipeline.md) - global user defaults из
  `Settings → Harness setup` и per-run overrides из блока `Harness` для
  direction-picker, wireframe, Design Jury и Screen readiness DoR.
- [MCP and integrations](./mcp-and-integrations.md) - product-owned MCP,
  runtime overrides, safety policy и design-source интеграции.
- [Assets and attachments](./assets-and-attachments.md) - asset packs, icon
  sources, generated screen asset library, prompt attachments, images, SVG и
  HTML references.
- [Git and PR workflow](./git-and-pr-workflow.md) - git status, graph,
  selected scope, ownership, commit, push и Send PR.
- [Run records and diagnostics](./run-records-and-diagnostics.md) - run
  artifacts, attempt logs, receipts, render health и recovery.
- [Local MVP smoke](./local-mvp-smoke.md) - repeatable local health checks and
  manual smoke checklist for the current MVP.

## Где искать код

```text
apps/web/             React editor
services/api/         backend, project state, agent, indexer, git, design API
services/sandbox/     preview/dev-server sessions
packages/shared-types shared contracts
packages/design-indexer
packages/storybook-indexer
packages/llm-gateway
packages/agent-kit    default product agent kit (kit/)
.agents/              dev kit для агентов-разработчиков
```

## Как поддерживать эту папку

Когда меняется поведение продукта, обновляйте соответствующий документ в этой
папке в том же PR. Если task-файл содержит новый вывод после инцидента или
ревью, перенесите итоговое правило сюда, а task оставьте как evidence.
