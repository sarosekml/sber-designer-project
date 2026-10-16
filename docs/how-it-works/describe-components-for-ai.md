---
updated: 2026-07-09T02:28:02+03:00
---

# Describe components for AI

Модуль «Describe components for AI» — это управляемое чат-интервью, в котором
человек по очереди описывает компоненты дизайн-системы, а sber-designer
записывает подтверждённое описание (`Description for AI`) рядом с проектом и
компилирует его в индекс. Цель — дать слабым on-prem моделям готовое «как
пользоваться этим компонентом», не заставляя их читать исходники.

Канон источника истины —
[ADR-0017](../architecture/adr/0017-description-source-of-truth.md).

## Для кого этот документ

- **Продакту / пользователю** — разделы «Главная идея», «Точки входа», «Как
  отвечать», «Частые вопросы».
- **Разработчику** — «Что происходит под капотом», «Индекс», «Рантаймы», «Где
  искать код».

## Главная идея (один экран)

```text
[Components panel / Settings]                     запуск
        │  «Describe component» / «Describe components»
        ▼
[чат с ролью ai-description-layer]                профильное интервью
        │  для каждого компонента: mined-черновик → 5 вопросов → ответ
        ▼
[write_component_description]                      запись (sidecar всегда)
        │  + проекция: Storybook CSF opt-in / design-system.html default для HTML-first
        ▼
[request_project_reindex]                          фоновая компиляция (производное)
        │  usage-cards.jsonl + description-map.json + manifest.describedComponents
        ▼
[генерация экранов]                                потребление
           get_usage_card → готовые поля в промпте слабой модели
```

Ключевой принцип (правило 11 `CLAUDE.md`): **описание принадлежит проекту**, а
не редактору. Оно лежит в файлах проекта, ревьюится в git, переживает удаление
`.sber-designer/design-index`. Индекс — всегда производное и пересобирается.

## Источник истины и проекции

Канон во всех профилях — **сайдкар**
`.sber-designer/components/<componentId>.md`. Он содержит структурный
`ComponentDescriptionLayer` (`packages/shared-types/src/catalog.ts`) и
человекочитаемый markdown. Storybook CSF и `design-system.html` — не канон, а
восстанавливаемые проекции, удобные человеку и команде. Архитектурное решение:
[ADR-0017](../architecture/adr/0017-description-source-of-truth.md).

```text
1. Сайдкар (канон, всегда пишется)
   .sber-designer/components/<componentId>.md
   — markdown для людей + полный машинный sberDesigner-блок.

2. Storybook projection (opt-in target storybook)
   meta.parameters.docs.description.component = "## Description for AI ..."
   — видно разделом в autodocs; markdown лоссовый, round-trip gate откатывает unsafe write.

3. HTML-first projection (default target design-system)
   design-system.html <section data-sd-description-for="...">
   — preview/catalog видит описание рядом с демо компонента.

4. Indexed layer (производное)
   .sber-designer/design-index/components.jsonl + usage-cards/description-map
   — prompt-ready кэш, пересобирается из канона и проекций.
```

`write_component_description` **всегда** пишет сайдкар. Если `target` равен
`storybook`, tool дополнительно пытается merge в CSF story. Если `target` равен
`design-system`, tool пишет секцию в `design-system.html`. `auto` резолвится по
профилю: CSS catalog → `design-system`, React/Storybook → `storybook`. Если
проекция небезопасна или не round-trip'ится обратно в authored layer, она
откатывается, а sidecar остаётся источником истины.

`get_component_description_source` показывает весь read-back: `canonical`
sidecar, `indexed`, `projections[]` (live CSF и/или `design-system.html`) и
диагностики `sources diverge: ...`, когда сравнимые поля разошлись. DS Browser
читает тот же слой как read-only surface: purpose, provenance и divergence badge.

### Формат сайдкара (dual-format)

`write_component_description` рендерит файл так (`renderComponentDescriptionSidecar` в
`packages/proj-mcp/src/tools/component-description-core.ts`; API-тул использует тот же core):

````text
# Button

## Description for AI

**Purpose:** Primary action trigger for forms and dialogs.
**Use when:** form submit; primary CTA on a panel
**Variants:**

- `variant`: `primary` — emphasis; `ghost` — secondary, low weight.
  **Required props:** `children`
  **Canonical usage:**
  ```tsx
  <Button variant="primary">Save</Button>
  ```
  **Keywords:** button, action, cta

<!-- Machine-managed by the sber-designer description agent. The fenced
     block below is the canonical structured source; edit via the agent. -->
```sberDesigner
{ "descriptionLayer": { "purpose": "...", "keywords": [...],
    "requiredProps": ["children"], "status": "confirmed", "updatedAt": "..." } }
```
````

- **markdown-секция** — для человека (и как fallback-ридер).
- **`sberDesigner`-блок** — канонический структурный слой; его читает индексатор
  первым (`extractStructuredLayerBlock`). `status: confirmed` переживает пересборку.

Парсер/нормализатор формата — `packages/storybook-indexer/src/description-for-ai.ts`
(`parseDescriptionForAi`, `descriptionLayerFromMarkdown`, `extractStructuredLayerBlock`,
`coerceComponentLayer`). Тот же формат работает и в Storybook, и в сайдкаре.

## Точки входа для пользователя (UX)

Обе точки ведут в один хелпер `apps/web/src/lib/use-start-description-interview.ts`:
он стартует **новый чат**, **пиннит** агента `ai-description-layer` к сессии и
сидит стартовый промпт. В React/Storybook проектах canvas открывает Storybook,
когда он доступен; в HTML-first проектах вид не переключается в Storybook, а
интервью работает поверх static HTML / CSS catalog профиля.

```text
1. Components panel (слева) → «⋯» у компонента → «Describe component»
   apps/web/src/components/editor/ComponentsPanel.tsx
   → интервью по ОДНОМУ компоненту.

2. Settings → Project → блок «Describe components for AI»
   apps/web/src/components/editor/settings/project.tsx
   → счётчик покрытия «N / M described» + кнопка «Describe components»
   → интервью по ВСЕЙ очереди (most-used-first, ~8 за проход).
```

### Как пользователь отвечает

На каждый компонент агент показывает mined-черновик и блок вопросов, который чат
рендерит интерактивными контролами (`InterviewQuestions.tsx`):

```text
┌─ Purpose ─────────────────────────────────────────────┐
│ suggestion: "Primary action trigger."                 │
│  [ Accept ]   [ Type your own … ]   [ Skip ]          │
└───────────────────────────────────────────────────────┘
 … Use when · Variants · Required props · Keywords …
```

- **Accept** — принять предложенный ассистентом ответ (часто достаточно).
- **Type your own** — ввести свой вариант.
- **Skip** — пропустить вопрос.
- **Write target** — выбрать, нужна ли только каноническая запись в sidecar или
  ещё проекция в Storybook / `design-system.html`. HTML-first по умолчанию
  пишет sidecar + `design-system.html`; React/Storybook по умолчанию пишет
  только sidecar, Storybook projection выбирается явно.

Дополнительно:

- **Стоп-фраза.** Чтобы закончить раньше — напишите в чат «сохрани и закончим»
  (или похожее). Агент допишет подтверждённое, запросит один reindex и отдаст сводку.
- **Селектор агента.** Внизу композера — дропдаун со всеми агентами (primary +
  сабагенты). В интервью он автоматически стоит на `ai-description-layer`; ручные
  ответы без `@` остаются на нём (не откатываются на primary). `@mention` в тексте —
  разовый оверрайд на одно сообщение.
- **Бюджет прохода** — 5–10 компонентов; дальше агент останавливается и отчитывается,
  следующий запуск продолжает с непокрытых.

## Что происходит под капотом

### Роль, скилл, тулы

```text
agent:  packages/agent-kit/kit/agents/ai-description-layer.md         (mode: subagent)
skill:  packages/agent-kit/kit/skills/component-description-interview/SKILL.md
tools (allow):
  list_undescribed_components   ранжированная очередь (usage × missing-desc)
  get_usage_card                mined-черновик компонента (варианты/props/сниппет)
  read_file                     исходник/story для точного purpose
  write_component_description   запись сайдкара; target storybook/design-system/auto пишет projection
  get_component_description_source  canonical/indexed/projections + divergence read-back
  request_project_reindex       старт фоновой пересборки кэша (usage-cards/description-map)
deny: apply_patch, screen_*, flow_*, send_pr   — исходники нельзя править напрямую;
                                                projections только через tool-owned writers
```

### Цикл интервью по одному компоненту

```text
agent                                   user / chat UI
  │ list_undescribed_components ──────► очередь top-N
  │ get_usage_card(id) ──────────────► mined-черновик
  │ read_file(source) (по необходимости)
  │
  │ эмитит sd:interview-блок ────────► InterviewQuestions рисует карточки
  │                                    (Accept / own / Skip на каждый из 5)
  │              ◄──────────────────── "Answers for <name>:" (composeInterviewReply)
  │ write_component_description ─────► .sber-designer/components/<id>.md  ✓
  │                                    (+ CSF / design-system.html projection, если выбран target)
  │
  │ СРАЗУ следующий компонент (тот же reply) … до бюджета 5–10 или стоп-фразы
  ▼
  │ request_project_reindex (один раз в конце прохода; background job)
  ▼ сводка: «described N, M remaining»
```

«После каждого сохранения сразу показывать следующий компонент» — это
контракт режима. Останавливаться можно только по бюджету или стоп-фразе.

### Протокол `sd:interview` (машиночитаемый вопрос → структурный ответ)

Агент эмитит вопросы как fenced-блок с info-строкой `sd:interview` и JSON-телом.
Фронт вырезает блок из прозы и рендерит контролы; ответ возвращается обычной
репликой чата. Если выбран write target, рядом с legacy строкой
`Write target: ...` фронт добавляет компактный fenced-блок `sd:answer`:
`{componentId, answers, writeTarget}`. Skill читает `sd:answer` первым, строка
остаётся fallback для слабых моделей. Парсер/композер —
`apps/web/src/lib/interview-question.ts`.

```jsonc
// fenced block, info-string: sd:interview
{
  "componentId": "atoms-buttons-button",
  "componentName": "Button",
  "progress": { "index": 1, "total": 8 },
  "questions": [
    { "id": "purpose", "label": "Purpose", "suggestion": "Primary action trigger." },
    { "id": "use-when", "label": "Use when", "suggestion": "form submit; primary CTA" },
    {
      "id": "variants",
      "label": "Variants",
      "suggestion": "primary — emphasis; ghost — secondary",
    },
    { "id": "required", "label": "Required props", "suggestion": "children" },
    { "id": "keywords", "label": "Keywords", "suggestion": "button, action, cta" },
  ],
}
```

**Толерантность к слабой модели.** Если модель пишет вопросы прозой, а
не JSON-блоком, парсер всё равно достаёт их из прозы вида
`**Questions:** … *Suggestion: …*` (строгий гейт: нужен component-id + interview-лейблы,
иначе обычный ответ не считается интервью). Предпочтительный путь — всё же JSON-блок.

```jsonc
// fenced block, info-string: sd:answer
{
  "componentId": "atoms-buttons-button",
  "answers": {
    "purpose": "Primary action trigger.",
    "use-when": "form submit; primary CTA",
    "variants": null,
  },
  "writeTarget": "storybook",
}
```

### Завершение прохода и reindex

В конце прохода (бюджет или «сохрани и закончим») агент вызывает
`request_project_reindex` один раз. Тул стартует background job (single-flight на
workspace) и возвращает `jobId`/`statusEndpoint`; индекс перечитывает источник
(sidecar first, projections как gap-fill/debug) и перекомпилирует производный
кэш. Ручные правки в каноническом sidecar побеждают.

HTML surface sections импортируются только из managed preview:
`design-system.html`, `design/design-system.html` или `preview/design-system.html`.
Секции `data-sd-description-for` внутри обычных страниц не считаются authored
слоем, чтобы page-local заметки не подменяли канон.

Если модель забыла вызвать reindex, финализатор страхует проход: для built-in API
и внешних CLI-runtime, когда run изменил `.sber-designer/components/*.md`,
запускается project-index job и пишется receipt `project_index_reconcile`.

## Контекст-профиль description-режима

Для description-прогона стартовый контекст агента **минимальный**: НЕ собирается
screen-generation `component-pack` и screen-знания (это контекст для другой задачи).
Грузится только: имя проекта + статус индекса, профиль проекта, активный
компонент (если выбран), сводка очереди и mined-черновик по требованию.
Гейт в API — роль `ai-description-layer` / Storybook-view; в CLI handoff —
role-aware Output Contract, который инлайнит description skill вместо screen-gen
тела (`routes/chat-stream/run-context.ts`, `agent-kit-handoff.ts`).

## Permissions

Тулы интервью scoped к `.sber-designer/components` и индексу — поэтому auto-allow,
без permission-prompt на каждый шаг (`services/api/src/agent-kit/permissions.ts`):

```text
list_undescribed_components       read  (auto-allow)
get_usage_card                    read  (auto-allow)
write_component_description        read  (auto-allow)   ← sidecar target
write_component_description        read  (auto-allow)   ← design-system target
write_component_description        edit  (ask)          ← storybook/auto target
get_component_description_source   read  (auto-allow)
request_project_reindex           read  (auto-allow)   ← стартует background job
```

Sidecar write считается read-safe внутри permission model, потому что он scoped к
`.sber-designer/components`. `design-system` target тоже auto-allow: это managed
`design-system.html`, тул-owned merge по маркерам с round-trip gate и revert,
тот же trust-класс, что `rebuild_design_system_preview`. Storybook и `auto`
остаются edit-ask, потому что `auto` может резолвиться в CSF source.

> В **CLI-рантайме** permission-policy не энфорсится средой — sidecar-first/source
> safety держится только промптом/контрактом (роль + скилл + role-aware
> handoff).

## Чат: markdown, история, агент-селектор

- **Markdown.** Ответы агента рендерятся `react-markdown` + `remark-gfm`
  (raw-HTML выключен) — `apps/web/src/components/editor/chat/Markdown.tsx`,
  подключён в `Transcript.tsx`. Блок `sd:interview` вырезается из прозы до рендера.
- **История.** Транскрипт сохраняется в проект (assistant-сессии) и на
  fail/abort прогона тоже — перезагрузка страницы не теряет историю интервью.
- **Sticky-agent / дропдаун.** Выбранный агент сессии хранится
  per-session в `chat-store` (`sessionAgentBySession`) и шлётся `agentName` каждым
  сообщением; новый чат сбрасывает на primary.

## Индекс: как описания попадают в каталог

```text
источник (sidecar canonical + projections)       reindex
  │  readComponentSidecarLayer / CSF docs.description / design-system.html sections
  ▼
catalog build (packages/storybook-indexer/src/index.ts)
  │  shouldAdoptSidecarLayer: confirmed-сайдкар побеждает draft/projection layer
  ▼
design-indexer (packages/design-indexer/src/*)
  ├─ components.jsonl        компоненты + descriptionLayer
  ├─ usage-cards.jsonl       толстый кэш для промпта (purpose/variants/required/snippets)
  ├─ description-map.json    тонкая карта: 2–3 keywords + docsRef + status (authored|mined-draft|missing)
  └─ manifest.counts.describedComponents   ← бейдж «N / M described» в Settings
```

- **usage-cards.jsonl** — производный машинный кэш, который инжектится в промпт
  (`usage-cards.ts`). Авторённые `whenToUse`/`whenNotToUse` мерджатся поверх майнинга.
- **description-map.json** — тонкая проекция (никогда не редактируется руками,
  snapshot-тест запрещает толстый payload). `description-map.ts`.
- **describedComponents** — счётчик `status === 'authored'` (`countDescribedComponents`).

Канонические пути — `CANONICAL_DESIGN_INDEX_PATHS` в
`packages/design-indexer/src/types.ts`.

## Потребление при генерации экранов

Когда пользователь генерирует экран, слабая модель получает готовые поля, не читая
исходники:

```text
широкая карта (description-map: keywords + docsRef)   → каталог «что есть» (дёшево)  [Phase 4]
get_usage_card(componentId)                           → полные поля для task-relevant компонентов
```

`get_usage_card` — существующий prompt-ready тул (он же в proj-mcp). Новый
`get_component_description_source` — только для авторинга/ревью/дебага (возвращает
сам authored-источник, а не compiled-кэш), чтобы не путать слои.

## Рантаймы: API (in-product) vs CLI (external)

```text
API (in-product чат)                    CLI / external agent
  роль+скилл+тулы грузятся штатно         предпочитает proj-mcp tools, если есть
  (agent-kit)                             без MCP: handoff инлайнит роль + skill
  тулы интервью доступны                  fallback-конвенции: читать index artifacts,
  tool-owned projections                  писать только sidecar, finalizer reindex
  permission-policy энфорсится            policy НЕ энфорсится → source-safety промптом
```

Основной поддержанный путь — **API in-product**. Для external agents паритетный
путь — `proj-mcp`: `list_undescribed_components`, `write_component_description`,
`get_component_description_source`, `request_project_reindex`. Чистый файловый
fallback пишет только sidecar; поверхности восстанавливаются tool-owned writer'ами.

## Роутинг по профилям

| Профиль проекта                 | Канон                               | Default target  | Projection surface                                         |
| ------------------------------- | ----------------------------------- | --------------- | ---------------------------------------------------------- |
| React + Storybook/component lib | `.sber-designer/components/<id>.md` | `sidecar`       | Opt-in `storybook`: CSF `docs.description.component`       |
| React static / no Storybook     | `.sber-designer/components/<id>.md` | `sidecar`       | Нет surface projection                                     |
| HTML-first / CSS catalog        | `.sber-designer/components/<id>.md` | `design-system` | `<section data-sd-description-for>` в `design-system.html` |

Storybook **опционален** (правило 5). Во всех профилях usage-cards и
description-map — производный кэш после reindex.

### Вопросы для CSS catalog / HTML-first

HTML-first интервью использует тот же `sd:interview`, но вопрос set другой:
Purpose; Use when; Modifiers (как значения `variantGuidance.prop = "modifier"`);
Base markup/classes (`requiredClasses` → `requiredProps`, `canonicalHtml` →
`canonicalSnippets`); Keywords. Мined draft берётся из CSS catalog: reusable
classes, modifiers, canonical snippet и usage frequency.

## Целевая модель и устойчивость к слабой модели

Нижняя планка качества — on-prem open-source модель в закрытом контуре. Сейчас это
**deepseek-v3-pro (ds3pro)** (ранее v4-flash). Следствия для модуля: формат
`sd:interview` максимально простой, парсер толерантен (понимает и прозу, E3), промпт
экономный (Storybook-профиль без screen-pack), а контракт прохода жёсткий (не
останавливаться после одного компонента, F1) — слабая модель склонна писать прозой
и завершать рано.

## Что реализовано / что планируется

**Реализовано:** формат + чтение sidecar/Storybook/HTML sections; интервью с
контролами; запись канонического сайдкара; opt-in Storybook projection; default
HTML-first `design-system.html` projection; read-back canonical/indexed/projections
с divergence; DS Browser read-only слой; proj-mcp зеркало; auto reindex; компиляция
usage-cards/description-map + `describedComponents`; sticky-agent/дропдаун;
markdown; устойчивость к слабой модели.

**Реализованный Storybook target (Phase 3.1).** По решению владельца
(уточнение дизайна 2026-06-16) Storybook write делается **сразу при сохранении
компонента**, не батчем:

```text
write_component_description(target: 'storybook')
  │ резолв компонент → его CSF story-файл (IndexedComponentRecord.filePath)
  ▼
CSF-writer
  │ AST-merge: найти meta → parameters.docs.description.component ← markdown
  │ (позже) parameters.sberDesigner.descriptionLayer через describeComponent
  ▼
round-trip gate: reparse → layer == authored, иначе откат к сайдкару + диагностика
  │ per-answer target selector (Sidecar/Storybook) · Storybook reload signal
  ▼ описание видно в Docs/git немедленно; apply_patch роли по-прежнему denied
```

**Остаётся вне текущего контура:** structured Storybook helper
`describeComponent(layer)` и `parameters.sberDesigner.descriptionLayer` как
удобная projection surface; полноценный редакторский review UX в DS Browser;
финальный acceptance/ADR dual-profile доводки.

## Частые вопросы (FAQ)

- **`describeComponent` — это md-файл в `.sber-designer`?** Нет. Md-файл — это
  **сайдкар** (Phase 2). `describeComponent` — это маленький хелпер в **коде проекта**
  (`src/storybook/description-layer.ts`), который из одного объекта пишет в story-файл
  сразу обе поверхности (`docs.description.component` для людей +
  `sberDesigner.descriptionLayer` для индексатора). Это Phase 3.2.
- **Записал описания, но «N / M described» не вырос сразу.** Reindex теперь
  запускается автоматически как background job: in-product через
  `request_project_reindex`, external CLI — через post-run finalizer. Подождите
  завершения job или проверьте `statusEndpoint`; ручная кнопка **Index project**
  нужна только как повторный запуск/восстановление.
- **Агент спрашивает перед каждым компонентом?** Раньше — да (`get_usage_card` не был
  auto-allow); исправлено (G1). Sidecar и HTML-first `design-system` target не
  спрашивают; Storybook/`auto` target спрашивает edit approval.
- **Агент после одного компонента «отчитался и встал».** Это был баг F1 (исправлен
  контрактом «сразу следующий»); для CLI дополнительно усилен sticky-agent (D6/D7).
- **Можно без Storybook?** Да — источник истины всё равно сайдкар; React static
  не имеет projection, HTML-first получает projection в `design-system.html`.
- **HTML-first тоже можно описывать?** Да. Вопросы будут про CSS classes,
  modifiers и canonical HTML. Sidecar пишется всегда, а `design-system.html`
  получает `Description for AI` section рядом с демо компонента.

## Где искать код

```text
apps/web/src/lib/use-start-description-interview.ts     запуск интервью (вход)
apps/web/src/components/editor/ComponentsPanel.tsx      «Describe component»
apps/web/src/components/editor/settings/project.tsx     «Describe components» + бейдж
apps/web/src/components/editor/chat/InterviewQuestions.tsx  контролы accept/own/skip
apps/web/src/lib/interview-question.ts                  парсер/композер sd:interview (+ proza E3)
apps/web/src/lib/design-system-browser.ts               descriptionLayer read-view model
apps/web/src/components/editor/DesignSystemBrowser.tsx   DS Browser layer/provenance/divergence UI
apps/web/src/components/editor/chat/{Transcript,Markdown}.tsx  рендер чата + markdown
apps/web/src/stores/chat-store.ts                       sticky session agent (sessionAgentBySession)

packages/agent-kit/kit/agents/ai-description-layer.md   роль
packages/agent-kit/kit/skills/component-description-interview/SKILL.md  скилл (runbook + формат)

services/api/src/agent/tools/component-description.ts   list_undescribed/write/get_source
services/api/src/component-description-source.ts         canonical/indexed/projections read-back
services/api/src/html-design-system-description-write.ts design-system.html projection writer/reader
services/api/src/html-description-section.ts             общий parser HTML Description sections
services/api/src/agent/tools/project-index.ts           get_usage_card, request_project_reindex
packages/proj-mcp/src/tools/component-description-core.ts shared proj-mcp description handlers
services/api/src/agent-kit/permissions.ts               auto-allow интервью-тулов
services/api/src/agent-runtimes/agent-kit-handoff.ts    CLI handoff (инлайн роли+скилла, контракт)

packages/storybook-indexer/src/usage-metadata.ts        чтение CSF/сайдкара
packages/storybook-indexer/src/description-for-ai.ts    парсер формата Description for AI
packages/storybook-indexer/src/index.ts                 catalog build + shouldAdoptSidecarLayer (E1)
packages/design-indexer/src/{usage-cards,description-map,description-adoption,builder,types}.ts  компиляция кэша
packages/shared-types/src/catalog.ts                    ComponentDescriptionLayer
```

## Связанные документы

- [Indexing project](./indexing-project.md) — как строится `.sber-designer/design-index`.
- [Storybook mode and catalog](./storybook-mode-and-catalog.md) — компонентный canvas и каталог.
- [Agent system](./agent-system.md) — agent loop, роли, тулы, permissions, CLI handoff.
- [Assistant panel and tasks](./assistant-panel-and-tasks.md) — чат, сессии, current task.
- [ADR-0017](../architecture/adr/0017-description-source-of-truth.md) —
  почему описания живут рядом с компонентами и как разрешаются конфликты слоёв.
