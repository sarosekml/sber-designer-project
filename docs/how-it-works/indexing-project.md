---
updated: 2026-07-24T16:16:43+0300
---

# Indexing project

## Зачем нужна индексация

Агенту нельзя каждый раз читать весь репозиторий. Индекс превращает проект в
компактный, структурированный контекст:

- какие компоненты есть;
- какие CSS catalog components есть в HTML-first проектах;
- где лежат компоненты и examples;
- какие tokens, icons и assets доступны;
- какие screens зарегистрированы;
- какие routes обнаружены;
- какие diagnostics мешают работе;
- какие human notes уже добавлены.

Индекс не является новым источником правды. Он пересобирается из исходников,
Storybook/static scan, HTML/CSS catalog, `.sdproj`, `DESIGN.md`, imported
assets, configured icon sources, component descriptions и agent notes.

## Где лежит индекс

```text
<workspace>/.sber-designer/design-index/
  manifest.json
  prompt-summary.md
  project-profile.json
  project-profile.answers.json
  design-brief.md
  components.jsonl
  html-css-catalog-manifest.json
  component-groups.json
  tokens.json
  icons.json
  icon-candidates.jsonl
  external-icons.jsonl
  icon-catalog.md
  assets.jsonl
  routes.json
  screens.jsonl
  storybook.json
  usage-examples.jsonl
  usage-snippets.jsonl
  usage-cards.jsonl
  description-map.json
  patterns.jsonl
  agent-notes.jsonl
  diagnostics.json
  fingerprints.json
```

Рядом с индексом есть служебные asset manifests:

```text
<workspace>/.sber-designer/assets/
  icon-sources.json
  imported-packs.json
  materialized-assets.json
```

Это не raw assets. Это манифесты о том, что было импортировано,
проиндексировано или материализовано.

За пределами `.sber-designer/design-index/` индексатор также может обновить
`DESIGN.md`: сейчас он экспортирует portable design brief из собранного индекса.
Это проектный документ, а не служебный cache-file.

## Что делает каждый файл

### `.sber-designer/design-index/*`

| Файл                             | Назначение                                                                                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`                  | Главный manifest индекса: версия, время генерации, source flags, counts, fingerprint и canonical artifact paths. UI и агент используют его как быстрый статус индекса.           |
| `prompt-summary.md`              | Компактная выжимка для prompt/handoff: компоненты, группы, tokens, icon hints, assets и AI notes без чтения всех raw artifacts.                                                  |
| `project-profile.json`           | Auto-detected профиль проекта: package manager, frameworks, source roots, aliases и package scripts.                                                                             |
| `project-profile.answers.json`   | Ответы пользователя из setup/profile flow. Они дополняют auto-detected profile и переживают re-index.                                                                            |
| `design-brief.md`                | Нормализованный design brief, собранный из `DESIGN.md`, компонентов, групп и tokens.                                                                                             |
| `components.jsonl`               | По одному record на компонент: id/title/shortName/filePath, stories, description layer, tags, groups, confidence. Для HTML-first включает `source: "css-catalog"` records.       |
| `html-css-catalog-manifest.json` | HTML-first catalog manifest: HTML/CSS files, classes, selectors, CSS custom properties, custom elements, reusable class components, distillation prep and design-system signals. |
| `component-groups.json`          | Группы компонентов для быстрого выбора: tables/lists, forms, navigation, actions, status, layout, charts.                                                                        |
| `tokens.json`                    | Найденные design tokens: colors, spacing, radius, typography и источник каждого token.                                                                                           |
| `icons.json`                     | Project icon files/components плюс встроенный Lucide fallback registry.                                                                                                          |
| `icon-candidates.jsonl`          | Единый lookup-каталог иконок для агента. Включает `project-icon-prop`, `project-asset`, `project-file`, `external-icon-reference`, `lucide-fallback`.                            |
| `external-icons.jsonl`           | Иконки из external sources. Здесь нет абсолютных путей: только source id/name, relative path внутри source, extension, hash/tags.                                                |
| `icon-catalog.md`                | Читаемая человеком и агентом инструкция по порядку выбора иконок и примеры использования.                                                                                        |
| `assets.jsonl`                   | Project-local assets: `src/assets/*`, `src/sber-designer-assets/*`, `public/assets/*` и workspace icon-source assets.                                                            |
| `routes.json`                    | Обнаруженные routes: route path, file path и источник (`next-app`, `next-pages`, `react-router`, `file-system`, `unknown`).                                                      |
| `screens.jsonl`                  | Зарегистрированные/найденные screens: implementation path, story path, route path, Design-readable status.                                                                       |
| `storybook.json`                 | Что известно про Storybook: есть ли config, какие config paths/stories globs найдены.                                                                                            |
| `usage-examples.jsonl`           | Usage examples из description layer и Storybook descriptions.                                                                                                                    |
| `usage-snippets.jsonl`           | Mined JSX usage clusters: где компонент реально используется, какие props встречаются, насколько часто.                                                                          |
| `usage-cards.jsonl`              | Скомпилированные usage cards для компонентов: whenToUse/whenNotToUse, variant guidance, important props, snippets, facts.                                                        |
| `description-map.json`           | Легкая карта покрытия Description for AI: authored/mined/missing, keywords и docs reference.                                                                                     |
| `patterns.jsonl`                 | Composition/screen patterns из screen templates и mined evidence. Нужны генератору screen layouts.                                                                               |
| `agent-notes.jsonl`              | Durable human/agent notes по проекту, компонентам, screens, tokens, icons и assets. Re-index их сохраняет.                                                                       |
| `diagnostics.json`               | Warnings/errors/info, которые объясняют неполный индекс: нет Storybook, нет tokens, missing source, слабый catalog и т.п.                                                        |
| `fingerprints.json`              | Список tracked files и fingerprint. Используется для stale detection после изменений в проекте.                                                                                  |

### `.sber-designer/assets/*`

| Файл                       | Назначение                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `icon-sources.json`        | Manifest configured icon/illustration sources после scan: id/name, mode `workspace` или `external`, families, status, count. Для external source хранится только label, не absolute path. |
| `imported-packs.json`      | История full imports через **Import and re-index**: pack id/name, source label, content hash, список скопированных assets.                                                                |
| `materialized-assets.json` | Связь external icon reference -> файл, скопированный в `src/sber-designer-assets/*` через `materialize_indexed_icon`.                                                                     |

### Project-owned asset files

| Файл или папка                      | Назначение                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/assets/icons/*`                | Иконки, скопированные full import-ом из workspace-local asset pack.                         |
| `src/assets/illustrations/*`        | Иллюстрации, скопированные full import-ом из workspace-local asset pack.                    |
| `src/assets/index.ts`               | Barrel export для imported asset pack files.                                                |
| `src/stories/assets/*.stories.tsx`  | Storybook galleries для imported assets, создаются только если в проекте есть `.storybook`. |
| `src/sber-designer-assets/icons/*`  | Точечно материализованные external icons, которые понадобились generated screens.           |
| `src/sber-designer-assets/index.ts` | Barrel export для materialized screen assets.                                               |

## Кто строит индекс

Основной код:

- `services/api/src/routes/design-index.ts` - HTTP routes;
- `services/api/src/design-index.ts` - сбор контекста и запись артефактов;
- `services/api/src/project-index/indexing-runner.ts` - background job;
- `packages/design-indexer/src/builder.ts` - deterministic builder;
- `services/api/src/design-system-browser.ts` - payload для UI.

## API

Основные endpoints:

```text
GET  /api/project/design-index
POST /api/project/design-index/jobs
GET  /api/project/design-index/jobs/:id
GET  /api/project/design-index/browser
POST /api/project/design-index/profile-answers
POST /api/project/design-index/html-design-system-sources
POST /api/project/design-index/html-design-system-preview
GET  /api/project/design-index/html-design-system-proposals
POST /api/project/design-index/html-design-system-proposals/:id/accept
DELETE /api/project/design-index/html-design-system-proposals/:id
POST /api/project/design-index/generate
POST /api/project/design-index/component-notes
POST /api/assets/import-pack
POST /api/assets/materialize-indexed-icon
```

Background job проходит стадии:

```text
queued -> scanning -> writing -> enriching -> validating -> complete
```

`enriching` опционален. Если LLM provider не настроен, deterministic index все
равно создается.

## Источники данных

### Storybook

Если Storybook доступен, индексатор читает `index.json` и получает stories,
component titles, ids and import paths. Это дает самый точный каталог.

### Static scan

Если Storybook недоступен, `storybook-indexer` использует AST scan исходников:

- exported React components;
- likely stories/examples;
- source locations.

Этот режим слабее, но позволяет работать без Storybook.

### Component params on inspect

Вкладка Design → Component использует код индексера, но не пишет отдельный
`component-params.jsonl`. Во время `/api/design/inspect` backend берёт
разрешённый component source и colocated story, затем
`packages/design-indexer/src/component-params.ts` строит свежую схему TS/CVA /
Storybook controls.

Такое решение намеренное:

- schema соответствует текущему source и не ждёт project re-index;
- static catalog работает без Storybook;
- component cache ключуется content hash, а не mtime/длиной;
- в `.sber-designer/design-index` не появляется derived artifact с отдельной
  staleness-моделью.

Сама component identity и description/variant guidance по-прежнему приходят из
catalog/design-index. Полный selection и instant-apply lifecycle:
[Component params](./component-params.md).

### HTML/CSS catalog

Если project profile определен как `html-css`, индексатор строит CSS catalog из
static HTML/CSS files:

- source files: `*.html`, `*.htm`, `*.css`, `*.scss`, `*.sass`, `*.less`;
- screen pages из `pages/`, `screens/`, `public/`, `site/`;
- reusable class blocks, modifiers and custom elements;
- CSS custom properties and selectors;
- canonical HTML snippets from catalog-like files;
- distillation prep for repeated raw values/classes and inline hardcodes;
- design-system signals for quality score.

Результат пишется в `html-css-catalog-manifest.json`, а найденные reusable
blocks также попадают в `components.jsonl` как `css-catalog` components. Для
HTML-first проекта отсутствие Storybook не является warning само по себе:
основной component model - CSS catalog.

### `.sber-designer/project.sdproj`

Registered screens попадают в `screens.jsonl`, даже если Storybook пока не
готов или новая story еще не появилась в `index.json`. Это важно для freshly
created screens и partial-success agent runs.

Там же лежат настройки asset workflows:

- `assetPacks` - последняя выбранная локальная папка для полного импорта pack;
- `externalAssetSources.icons` - именованные icon/illustration sources для
  индексации.

### `DESIGN.md`, HTML-first sources и `design-brief.md`

`DESIGN.md` - человекочитаемое описание дизайн-системы проекта, если команда
его ведет. `design-brief.md` - нормализованный brief в design-index.

Для HTML-first проекта canonical design-system sources:

```text
Design.md
tokens.css
components.css
design-system.html   optional preview/catalog
```

`project-profile.json` фиксирует `htmlDesignSystem.status`:

- `connected`, если `Design.md`, `tokens.css` и `components.css` найдены;
- `bootstrap`, если хотя бы один required source отсутствует.

`design-system.html` можно пересобрать детерминированно из трех source files.
Он индексируется как preview/catalog, но не является единственным source of
truth.

### Component notes

Через Design System Browser пользователь может добавить guidance к компоненту.
Notes сохраняются в `agent-notes.jsonl` и после re-index попадают в prompt
summary и agent context.

### Asset packs

Settings -> Indexing project -> Asset packs содержит одно поле
**Path to assets**. Оно используется для двух действий:

- **Save and index** - сохраняет путь как indexed asset/icon source и запускает
  проектную индексацию без копирования всего pack.
- **Import and re-index** - делает full import выбранной папки в проект и потом
  запускает re-index.

### Что делает `Import and re-index`

Кнопка доступна только если **Path to assets** указывает на папку внутри
connected workspace. Для external folder она блокируется, потому что full import
должен брать переносимый, project-owned source, а не чужой абсолютный путь.

Порядок работы:

1. UI сохраняет текущие asset preferences в project state.
2. Backend вызывает `POST /api/assets/import-pack`.
3. `import_asset_pack` читает выбранную папку, берет только
   `.svg/.png/.jpg/.jpeg/.webp/.avif`, пропускает hidden files, symlinks,
   файлы больше 8 MB и максимум после 500 source files.
4. Файлы классифицируются по выбранным families:
   - `icons` -> `src/assets/icons/*`;
   - `illustrations` -> `src/assets/illustrations/*`.
5. Если target file уже есть и `overwrite` не включен, файл пропускается как
   `target_exists`.
6. Backend генерирует `src/assets/index.ts`.
7. Если в проекте есть `.storybook`, backend генерирует galleries:
   `src/stories/assets/Icons.stories.tsx` и
   `src/stories/assets/Illustrations.stories.tsx`.
8. Backend пишет `.sber-designer/assets/imported-packs.json` с manifest-ом
   import-а.
9. UI запускает project index job. После re-index скопированные files попадают в
   `.sber-designer/design-index/assets.jsonl` как first-class project assets, а
   иконки из них также попадают в `icon-candidates.jsonl` как `project-asset`.

`Import and re-index` не предназначен для external icon sources. Для внешней
папки нужно использовать **Save and index**: индекс сохранит portable references,
а конкретная иконка будет скопирована в `src/sber-designer-assets/*` только если
агент выберет ее через `materialize_indexed_icon`.

После full import `assets.jsonl` получает records:

```text
kind
filePath
importName
importSource
packId
tags
```

Если папка находится вне workspace, import недоступен, но Save and index
остается валидным: external folder индексируется как portable references.

### Icon sources

Внутри indexer поле **Path to assets** сохраняется как icon/illustration source.
Это не полный импорт pack. Это способ дать агенту справочник, какие assets есть
в выбранной папке:

```text
.sber-designer/project.sdproj       externalAssetSources.icons[]
.sber-designer/assets/icon-sources.json
.sber-designer/design-index/external-icons.jsonl
.sber-designer/design-index/icon-candidates.jsonl
```

Source может быть двух типов:

- `workspace` - папка физически лежит внутри connected project. Такие SVG/images
  индексируются как project assets, а `.tsx/.jsx` icon components - как project
  icon files. Копировать их не нужно.
- `external` - папка лежит вне workspace. Индекс не хранит абсолютный путь:
  `external-icons.jsonl` содержит stable id, source id/name, `sourceRelPath`,
  extension, hash/tags. Абсолютный `localPath` остается только локальной
  привязкой в `.sdproj`, чтобы эта машина могла заново найти файл.

Если агент выбрал `external-icon-reference`, он не должен импортировать внешний
путь в код. Сначала вызывается tool/API `materialize_indexed_icon`, который
копирует конкретную иконку в переносимую библиотеку:

```text
src/sber-designer-assets/icons/<icon>.svg
src/sber-designer-assets/index.ts
.sber-designer/assets/materialized-assets.json
```

После materialization запускается re-index, и иконка становится обычным
`project-asset` с `importSource: "@/sber-designer-assets"`.

### Icons

Иконки собираются из:

- проектных icon contracts;
- imported assets and materialized screen assets;
- workspace icon source assets and project icon files;
- external icon references, которые нужно materialize перед использованием;
- Lucide fallback, если проектного источника недостаточно.

Важно: project icon names имеют приоритет. Fallback warning не должен заставлять
агента читать весь icon registry, если имя уже есть в проекте.

Приоритет lookup в `get_indexed_icon` / `search_project_index`:

```text
project icon prop -> project asset -> project file -> external reference -> Lucide fallback
```

## Project System overview

Поверх raw artifacts строится обзор:

```text
freshness: missing | error | stale | needs-attention | ready
nextAction: index-project | reindex-project | review-diagnostics | ready
counts: components/tokens/icons/iconSources/externalIcons/assets/screens/routes/examples/agent-notes
contextItems: готовые полки контекста
```

Этот overview показывается в Settings/Design System Browser и попадает агенту.
Он отвечает на вопрос: можно ли доверять индексу прямо сейчас и что делать
дальше.

Для HTML-first overview дополнительно показывает `htmlDesignSystem` и кратко
объясняет, работает ли проект в `connected` или `bootstrap` режиме. Quality
checks оценивают наличие 9 секций `Design.md`, root tokens в `tokens.css`,
theme override, reusable classes в `components.css` и token discipline на
страницах.

## Design System Browser

Design System Browser читает тот же индекс и показывает:

- setup/profile health;
- components and groups;
- tokens;
- icons and icon candidates;
- assets;
- screens;
- routes;
- examples;
- health/diagnostics;
- editable agent notes.

Setup profiler сохраняет ответы пользователя в:

```text
.sber-designer/design-index/project-profile.answers.json
```

Ответы пользователя накладываются поверх auto-detected facts. Это позволяет
исправить неверное автоопределение без изменения исходников.

## Как индекс использует агент

API-agent получает:

- compact prompt summary;
- Project System overview;
- доступ к tools `get_project_index_status`, `search_project_index`,
  `get_indexed_component`, `get_usage_card`, `list_patterns`,
  `get_indexed_icon`, `materialize_indexed_icon` и другим;
- task-relevant component pack: ранжированные кандидаты с guidance из usage-card
  (варианты, required props, реальные сниппеты) плюс два обогащения description-слоя -
  **import-conventions cheat-sheet**, намайненный из экранов самого проекта (из
  какого модуля импортируется каждый символ, с флагом коллизий вроде китового
  `Grid` vs MUI `Grid`), и **public-export verification**, который помечает
  кандидата и подсказывает реальное имя экспорта, когда advised символ
  реэкспортируется под алиасом (`export { Tile as BaseTile }` → импортировать
  `BaseTile`, а не `Tile`).

CLI runtime получает:

- overview and prompt summary в handoff prompt;
- пути к artifact files;
- инструкцию читать `.sber-designer/design-index/*` при необходимости.

## Freshness and diagnostics

`fingerprints.json` помогает понять, устарел ли индекс после изменений в
исходниках. `diagnostics.json` объясняет, почему индекс слабый или неполный:

- Storybook недоступен;
- package manager не определен;
- tokens не найдены;
- assets empty;
- component source не удалось прочитать;
- setup answers отсутствуют.

UI должен показывать диагностику как actionable state, а не как скрытую ошибку.

## Что не должен делать индексатор

- Не создавать проектно-специфичные догадки в product code.
- Не выдумывать routes из случайных файлов, если framework не подтвержден.
- Не превращать task-журналы в prompt context.
- Не перезаписывать ручные setup answers и agent notes без явного действия.
- Не считать Storybook обязательным.
