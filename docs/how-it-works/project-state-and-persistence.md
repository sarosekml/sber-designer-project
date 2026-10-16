---
updated: 2026-07-24T23:16:14Z
---

# Project state and persistence

## Главное правило

sber-designer - это редактор подключенного проекта. Поэтому состояние, которое
влияет на проект, должно быть проектным, reviewable и переносимым через git.
Редактор не должен хранить важные правила генерации, историю задач или экранные
метаданные только в своем локальном профиле.

## `.sber-designer/project.sdproj`

Основной project file лежит здесь:

```text
<connected-project>/.sber-designer/project.sdproj
```

Backend читает и сохраняет его через `services/api/src/project-store.ts`.
Файл содержит:

- `version`, `name`, `workspacePath`, `projectKind`;
- `screens[]`;
- `screenCreation.lastFolder`;
- `screensPanel.collapsedFolderNames`;
- `flow[]`;
- `flowView` настройки карты;
- `comments`;
- `assistant.sessions[]` и `activeSessionByScreenId`;
- `projectInstructions`;
- `agentMemory.styleMemoryEnabled`;
- `agentDefault`;
- legacy `generationDefaults` и `postChecks.screenReadiness` принимаются при
  чтении старых файлов, но больше не управляют pipeline и не записываются UI;
- `taskTracker`;
- `gitSession`;
- `agentAutoPr`;
- `screenDesignExportTemplate`;
- `assetPacks`;
- `externalAssetSources`;
- `visualEditing`;
- `mcpSettings`;
- `description`;
- `savedAt`.

### Screen entry

`ProjectScreen` описывает экран, который видит Screens panel:

```text
id
name
kind
storyId
filePath
implementationFilePath
thumbnail
folder
description
health
template
surface
position
```

`filePath` обычно указывает на Storybook wrapper, а
`implementationFilePath` - на editable `.tsx` компонент экрана. Для screen,
созданных из Storybook, wrapper может быть исходной story, а editable copy
создается отдельно только когда пользователь выбирает такой сценарий.

`kind` различает screen reference:

- `story` - экран указывает на Storybook story id;
- `page` - экран указывает на workspace-relative page/source file.

`surface` независимо описывает presentation/layout subtype:

- отсутствует или `page` — обычный full-screen screen;
- `modal` — managed modal screen.

Canonical writer хранит только `modal`; это additive-поле не меняет `kind`.
Modal остаётся тем же registered screen, но Flow использует overlay default, а
Canvas/Design/generation/craft применяют modal contract. Подробно:
[Modal screens](./modal-screens.md).

Для HTML-first проекта screens обычно имеют `kind: "page"`, а `filePath` и
`implementationFilePath` указывают на один `.html` файл. Root `index.html`
является managed Screens Index и синхронизируется отдельно из `.sdproj`.

### Screens Panel State

`screensPanel.collapsedFolderNames` хранит normalized имена папок, которые
пользователь свернул в Screens panel:

```json
{
  "screensPanel": {
    "collapsedFolderNames": ["Archive", "Drafts"]
  }
}
```

Отсутствующее поле или пустой массив означает, что все папки раскрыты. Это
project-owned UI state: оно переживает reload/editor restart и переносится с
проектом через `.sdproj`. Оно не связано с `flowView.hiddenFolderNames`, потому
что Flow visibility скрывает папки на карте, а collapse state только управляет
деревом в левой панели.

### Assistant history

История Assistant хранится screen-scoped:

```text
project.assistant.sessions[]
project.assistant.activeSessionByScreenId
```

После последних agent-run исправлений финальный `done.transcript` считается
авторитетным источником для сохранения видимой истории. Важные stream events
checkpoint'ятся в `.sdproj`, чтобы reload не оставлял только user prompt после
плохого запуска. Внутренние auto-nudge сообщения не должны попадать в видимую
историю как пользовательские.

### Project Instructions

`projectInstructions` - ручные правила конкретного проекта. Они добавляются в
prompt после agent profile и до editor/task context. Те же инструкции попадают
в external CLI handoff, чтобы API-agent и CLI-agent работали с одинаковыми
проектными ограничениями.

### Project Style Memory Switch

`agentMemory.styleMemoryEnabled` управляет передачей project style memory в
будущие generation/redesign prompts. Поле отсутствует — память включена.
`false` убирает derived блок из API prompt и CLI stable handoff, но не удаляет
`.sber-designer/preferences/events.jsonl` или `preferences.md`. Switch находится
в `Settings -> Project` и сохраняется обычным project autosave.

### Screen Readiness Post-Checks

Screen readiness — глобальный user-owned профиль проверок экрана после agent
edits. Он хранится в user settings sber-designer и настраивается через
`Settings → System → Harness setup`, а не в `.sdproj`. Legacy поле
`postChecks.screenReadiness` всё ещё принимается schema старого project-файла,
но UI и runtime его больше не используют.

Legacy shape (read compatibility only):

```json
{
  "postChecks": {
    "screenReadiness": {
      "enabled": true,
      "profile": "standard",
      "categories": {
        "sourceIntegrity": true,
        "renderHealth": false,
        "designSystemFit": true,
        "dataHonesty": true,
        "operationalUxStates": true,
        "accessibilityBasics": true,
        "responsiveVisualSanity": false,
        "designModeCompatibility": false
      }
    }
  }
}
```

Missing profile means Standard, enabled by default. The older
`agentCraftPostCheckEnabled` flag remains a runtime/wire compatibility field,
not a persisted migration source.

Подробное поведение категорий, связь с Design brief, Direction-picker, Jury и
runtime proof описаны в
[Post-checks и Screen readiness DoR](screen-readiness-post-checks.md).

### Generation pipeline defaults

`generationPipeline.generationDefaults` хранит глобальные пользовательские
значения optional этапов в user settings sber-designer:

```json
{
  "generationPipeline": {
    "generationDefaults": {
      "directionPicker": true,
      "wireframe": false,
      "designJury": true
    }
  }
}
```

UI настраивает их в `Settings → Harness setup`. Внутренний section id
`generation`, deep-link `initialSection='generation'` и persisted key
`generationPipeline` не переименованы. `Add a screen` наследует defaults при
открытии, но локальный checkbox из блока `Harness` не записывает override
обратно в глобальные настройки. `designJury` также применяется к обычным
Act-запросам на screen, чтобы последующее заполнение пустого shell не обходило
глобальный review.

Порядок SYSTEM-навигации одинаков в полном и system-only Settings:
`General → LLM providers → Agent kit → Harness setup → MCP servers`.

Подробности: [Generation pipeline](generation-pipeline.md).

### Screen design export template

`screenDesignExportTemplate` хранит импортированный markdown template для
будущих screen design exports:

```text
path
fileName
uploadedAt
```

Сам template лежит в workspace, обычно под `.sber-designer/*`, чтобы команда
видела один и тот же экспортный формат.

### Assets settings

`.sdproj` хранит настройки, которые влияют на будущий index/import workflow:

```text
assetPacks.localSourcePath
assetPacks.kinds
externalAssetSources.icons[]
```

`assetPacks` - preference для полного импорта assets. Реальные импортированные
файлы лежат в `src/assets/*`, а manifest pack-ов - в
`.sber-designer/assets/imported-packs.json`.

`externalAssetSources.icons[]` - список именованных icon/illustration sources.
Для workspace sources в записи может быть `workspacePath`; для external sources
есть локальный `localPath`, который нужен только этой машине для
индексации/materialization. Generated code и generated index не должны ссылаться
на этот абсолютный путь.

### Project card, pin и cover

Карточка проекта объединяет два разных ownership-слоя:

- `ProjectEntry.thumbnailPath` и `ProjectEntry.coverScreenId` живут в
  identity-scoped user registry вне connected project;
- generated image живёт в
  `<workspace>/.sber-designer/previews/cover.webp` и принадлежит самому
  проекту.

`thumbnailPath` — явный override: встроенная картинка или пользовательский
upload. `coverScreenId` — per-user pin **Set as thumbnail**; это не поле
`ProjectScreen` и не часть `.sdproj`. Сам cover коммитится и переносится через
git, но новый пользователь после clone не наследует чужой pin.

Preference **Generative thumbnail** хранится в identity-scoped user
`settings.json` вне connected project и синхронизируется через `/api/config`.
Она управляет capture и generated layer текущего пользователя: выключение не
удаляет cover-файл, pin или явный thumbnail, а значение следует за профилем
между браузерами/сессиями. Полный приоритет и lifecycle:
[Project covers](./project-covers.md).

## `.sber-designer/design-index`

Design index - сгенерированная карта проекта. Она не заменяет исходники, но
делает проект понятным редактору и агенту:

```text
.sber-designer/design-index/
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
  component-selection-map.json
  patterns.jsonl
  agent-notes.jsonl
  diagnostics.json
  fingerprints.json
```

Индекс можно пересобрать без ручного редактирования. Исключения:

- `project-profile.answers.json` - подтвержденные пользователем setup answers;
- `agent-notes.jsonl` - editable guidance, добавляемый через Design System
  Browser;
- generated caches вроде `usage-cards.jsonl` / `description-map.json` /
  `component-selection-map.json` можно
  пересобрать, но их часто полезно коммитить как agent-facing context.

Для HTML-first проектов `html-css-catalog-manifest.json` описывает найденные
HTML/CSS files, reusable class components, tokens, distillation prep and
design-system signals. Это generated artifact, но его полезно коммитить вместе
с проектным индексом, когда команда хочет воспроизводимый agent context.

## HTML-first source files

HTML-first project-owned source находится в обычных файлах workspace:

```text
Design.md
tokens.css
components.css
design-system.html        optional generated preview/catalog
pages/*.html
screens/*.html
site/*.html
public/*.html
index.html                managed Screens Index/project home
design/proposals/*        reviewable design-system proposals
design/extraction-report.md
```

`Design.md`, `tokens.css` и `components.css` переводят profile в connected
HTML design-system status. `design-system.html` можно пересобрать из них и не
следует считать единственным source of truth. Proposal folders под
`design/proposals/*` удаляются после accept/reject.

## `.sber-designer/assets`

Это project-owned манифесты asset workflows:

```text
.sber-designer/assets/
  imported-packs.json
  icon-sources.json
  materialized-assets.json
```

- `imported-packs.json` описывает full asset pack imports в `src/assets/*`.
- `icon-sources.json` - generated summary configured icon sources, включая
  ready/missing status and counts. Для external sources хранится basename
  (`sourceLabel`), но не абсолютный path.
- `materialized-assets.json` связывает external icon reference с файлом,
  скопированным в `src/sber-designer-assets/*`.

Эти манифесты можно пересобрать/обновить через Settings и asset tools; raw
assets лежат не здесь, а в `src/assets/*`, `src/sber-designer-assets/*` или
`public/assets/*`.

## `src/sber-designer-assets`

Это переносимая screen asset library, которую sber-designer создает при
materialization внешних indexed icons:

```text
src/sber-designer-assets/icons/
src/sber-designer-assets/illustrations/
src/sber-designer-assets/index.ts
```

Сгенерированный screen должен импортировать отсюда через project alias
`@/sber-designer-assets`, а не из внешней папки пользователя.

## `.sber-designer/previews`

Project cover и тяжёлые вспомогательные captures разделены:

```text
.sber-designer/previews/
  cover.webp        generated project cover, коммитится
  cover.png         допустимый fallback; одновременно хранится один формат
  screens/          Flow captures, не коммитятся
```

Обычный browser capture записывает один 640×360 WebP quality `0.72`; PNG
используется как fallback. Backend проверяет magic bytes, лимит 1 MB,
canonical path/symlink boundary и пишет через atomic rename.

Вложенный `<workspace>/.sber-designer/.gitignore` игнорирует только:

```gitignore
previews/screens/
```

Legacy-правило `previews/` автоматически сужается, чтобы `cover.webp` не был
случайно скрыт от git. Корневой `.gitignore` проекта не переписывается.

## `.sber-designer/runs`

Каждый agent run получает durable папку:

```text
.sber-designer/runs/<run-id>/
  run-manifest.json
  timeline.jsonl
  receipts/
  screen-structure-plan.json
  component-pack.json
  prompt-attachments/
  external-runtime/
  continuation-context.json
```

Эти артефакты нужны для:

- разбора инцидентов;
- evidence export;
- Continue run;
- проверки target diff;
- render health receipts;
- диагностики CLI runtime startup.

Для screen-generation-like runs `screen-structure-plan.json` появляется до
первого source write и хранит regions, UI roles, data, actions и states.
`component-pack.json` хранит component discovery/hydration evidence следующего
этапа. Его `selectionPlan` связывает UI roles с selection source и явными
design-system gaps; число hydrated candidates не ограничено фиксированной
константой. `selectionPlan.resolutions` хранит resolved public import, exact
chosen variants, critical props, unresolved axes и исключённые diverged authored
facts для каждого selected component. `hydrationManifest` связывает каждый
selected component с region-aware batch и фиксирует batch byte budget,
`hydratedComponentIds`, суммарный UTF-8 объём, byte size и oversized-status
каждого batch. Receipt timeline позволяет проверить, что structure planning и
contract resolution предшествовали component hydration, а metadata фиксирует
planned role/gap counts, resolution trace и тот же hydration manifest в
компактном виде.

Run artifacts принадлежат проекту. Их можно не коммитить для обычной работы,
но они должны быть рядом с проектом, потому что описывают его фактическое
редактирование.

## `sber-designer.json`

Project config для providers, agent defaults и MCP:

```text
<workspace>/sber-designer.json
```

В нем задаются:

- `provider` entries;
- `agent.default`, `agent.restrict`, `agent.directionPicker`,
  attachment/concurrency limits;
- `mcpServers`;
- runtime-independent проектные настройки.

Секреты задаются через `{env:VAR}` и на frontend отдаются только в redacted
виде. Если config не найден, backend использует безопасный mock provider.

## Project `.agents`

Подключенный проект может иметь свой agent kit:

```text
<workspace>/.agents/
```

Он накладывается поверх product default kit и optional personal kit. Это часть
проекта, поэтому может хранить проектные skills, knowledge и script manifests.
Подробнее см. [Agent system](./agent-system.md).

## Local/editor-only state

То, что не должно влиять на проект, может жить в браузере:

- ширина панелей;
- скрыты ли боковые панели;
- последний UI tab;
- локальные display preferences.
- preference `Generative thumbnail`: per-user capture/display generated cover,
  без удаления project-owned файла; хранится в user settings, не в
  localStorage.

Запрещено хранить только локально:

- список screens;
- выбранную папку для создания screen, если это влияет на следующий screen;
- project instructions;
- assistant transcript;
- agent defaults проекта;
- flow edges;
- design index setup answers;
- icon source/materialization manifests, если они нужны будущим агентам;
- MCP enable/disable overrides проекта.

## Связь с git

Так как state project-owned, изменения в `.sber-designer/*` видны через git
status. UI должен показывать их как обычные изменения проекта. Send PR может
включать эти файлы, если они относятся к задаче.

Исключения должны быть точечными: `.sber-designer/runs/` и
`.sber-designer/previews/screens/` — тяжёлые локальные artifacts; один
`.sber-designer/previews/cover.webp` или `.png` является переносимой обложкой и
не игнорируется.
