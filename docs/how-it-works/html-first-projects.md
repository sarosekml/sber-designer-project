---
updated: 2026-07-23T16:18:09+03:00
---

# HTML-first projects

> **Current implementation status (2026-07-23):**
> implemented and live-verified on two restructured legacy projects plus one
> imported/custom DS project. The final direct-DeepSeek scout/Accept run kept
> the native CSS import graph and produced an index with 408 components,
> 800 tokens, quality 0.95 and no diagnostics.

## Назначение

HTML-first - это тип проекта для статических HTML/CSS прототипов, где
sber-designer работает без React, Storybook и установки зависимостей. Он нужен
для быстрого старта с чистого листа, переноса визуального reference в
project-owned файлы и проверки пользовательского сценария как живого DOM, а не
как отдельного макета.

Главное отличие от HTML attachment:

- HTML-first project - это подключенный проект, где `.html` и `.css` являются
  source of truth и попадают в git.
- HTML attachment - это недоверенный reference внутри agent run evidence. Его
  нельзя копировать в source как raw HTML/CSS/JS.

## Профиль проекта

На уровне product UI новый проект создается как:

```text
projectKind: "html-first"
```

После индексации auto profile становится:

```text
kind: "html-css"
screenUnit.sourceGlob: "{pages,screens,public,site}/**/*.html"
screenUnit.storyRequired: false
screenUnit.rootMarker: "data-sd-screen-root"
componentModel: "css-catalog"
renderProbe: "static-html"
```

Профиль выбирается как `html-css`, если:

- `.sber-designer/project.sdproj` явно содержит `projectKind: "html-first"`;
- или в workspace есть HTML/CSS без package.json и без обнаруженного React/Next;
- или HTML/CSS есть, а framework dependencies не определены.

## Стартовый проект

В диалоге **Connect or bootstrap a project** пользователь выбирает
**New project -> HTML-first**.

Если включен чекбокс starter files, backend создает:

```text
.sber-designer/project.sdproj
.gitignore
index.html
pages/
design-system/
  Design.md
  tokens.css
  components.css
  index.html
  refs/
    README.md
    starter-components.html
```

Для HTML-first не запускается `bun create vite`, не ставятся npm dependencies и
не инициализируется Storybook. Единственный технический шаг после создания
файлов - `git init`.

Если starter files выключены, создается только `.sdproj` и git repository;
страницы и design-system sources пользователь добавляет позже.

## Screens Index

`index.html` в HTML-first проекте - это управляемая домашняя страница проекта,
а не обычный экран для генерации.

Она содержит managed block:

```html
<!-- sber-designer:screen-index:start -->
...
<!-- sber-designer:screen-index:end -->
```

sber-designer синхронизирует этот блок из `.sdproj` и добавляет ссылки на
обычные HTML screens. Агенту явно запрещается писать новый generated screen в
`index.html`: для этого используются отдельные файлы, например
`pages/deal-review.html`.

Если `index.html` уже пользовательский и не содержит managed markers, backend не
перезаписывает его молча.

## Создание screen

В HTML-first проекте **Add a screen -> Blank screen** создает запись:

```text
ProjectScreen.kind: "page"
filePath: pages/<screen-slug>.html
implementationFilePath: pages/<screen-slug>.html
```

Физический root выбирается из существующих source roots в приоритете:

```text
pages -> screens -> site -> public -> docs/web/static -> pages
```

Если пользователь выбирает folder в Screens panel, folder становится segment в
пути:

```text
pages/<folder-slug>/<screen-slug>.html
```

Минимальный screen template:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Screen name</title>
  </head>
  <body data-sd-screen-root>
    <main aria-label="Screen name">
      <section data-sd-empty-canvas="true"></section>
    </main>
  </body>
</html>
```

Если пользователь добавил instruction или включил **Start with wireframe**,
Assistant получает HTML-specific prompt. Он должен:

- редактировать уже созданный page file;
- не вызывать `screen_create`/`screen_remove`;
- не писать generated page в `index.html`;
- использовать semantic HTML;
- брать tokens из `design-system/tokens.css` через `var(--...)`;
- брать reusable classes из `design-system/components.css`/CSS catalog;
- не добавлять React, Storybook, Tailwind или package dependencies, если профиль
  проекта их не показывает;
- сохранить `[data-sd-screen-root]`.

## Design-system sources

HTML-first дизайн-система — отдельный project-owned пакет. Три required source:

```text
design-system/Design.md
design-system/tokens.css
design-system/components.css
```

Управляемая поверхность и пользовательские референсы:

```text
design-system/index.html       # generated preview/catalog
design-system/refs/**          # user-owned HTML/CSS/JS examples
design-system/assets/**        # optional fonts, icons and images
```

`design-system/index.html` распознаётся как managed только по маркеру
`data-sd-managed-design-system-preview`. Если файл с таким именем уже существует
без маркера, rebuild останавливается и не перезаписывает пользовательский
контент. Старые root-пути и алиасы используются только как evidence в
read-only отчёте пересборки; writers в них не пишут.

Если все required sources найдены, профиль получает:

```text
htmlDesignSystem.status: "canonical"
```

Если найдены старые или частично перенесённые sources:

```text
htmlDesignSystem.status: "non-canonical"
```

При полном отсутствии пакета статус — `missing`. Non-canonical проект можно
просматривать как статический сайт, но reusable-authoring приостановлен до
явного plan-first запуска **Restructure into sber-designer layout**.

## Imported and custom design-system bundles

HTML-first не требует, чтобы исходная дизайн-система физически состояла только
из трёх файлов. Произвольный статический HTML/CSS/JS пакет сохраняет свою
структуру, а sber-designer добавляет тонкий canonical facade:

```text
design-system/Design.md       # source map и правила для агента
design-system/tokens.css      # local @import token/foundation entrypoints
design-system/components.css  # local @import component entrypoint
```

`design-system/index.html` остаётся managed preview. При rebuild он безопасно
разворачивает ограниченный граф локальных CSS `@import`; внешние URL и выход за
workspace не читаются. Индексатор параллельно сканирует исходные catalog pages,
CSS и specs, но `design-system/**` никогда не становится product screen.

Для адаптации используется `@ai-html-design-system-adapter` и скилл
`html-design-system-adapter`. Роль может менять только facade, rebuild'ить
preview и запускать reindex; перемещения остаются исключительной
ответственностью `@ai-project-restructurer`. Если пакет публикует компактный
Markdown-контракт имён для HTML runtime (`data-icon`/`DS_ICONS`), эти имена
попадают в project icon index без чтения большого SVG/JS registry.

Claude Design export — один из поддерживаемых примеров, не обязательный формат.
По официальной документации Claude Design умеет импортировать дизайн-систему
из GitHub, design files или локального codebase, извлекает reusable components,
цвета, типографику и patterns и экспортирует standalone HTML. Поэтому его
`manifest + specs + catalog pages + CSS entrypoint + screen template` являются
сильным evidence для адаптера, но не новым универсальным schema:
[Claude Design](https://claude.com/product/design),
[Get started](https://support.claude.com/en/articles/14604416-get-started-with-claude-design),
[Set up your design system](https://support.claude.com/en/articles/14604397-set-up-your-design-system-in-claude-design).

Storybook остаётся приоритетным источником для React-команд (CSF, controls,
args и executable stories). Ожидаемая доля HTML около 40% обслуживается через
тот же normalized design index: генератор экрана выбирает компоненты, токены,
иконки и usage evidence одинаковыми role-based запросами, независимо от того,
получены они из Storybook или HTML adapter.

## Canvas: Screen / Design system

У HTML-first проекта есть два независимых вида:

- **Screen** — продуктовые страницы из `pages/**`, экранные сессии и Flow;
- **Design system** — managed каталог, CSS-компоненты и страницы из
  `design-system/refs/**`; отдельная chat-session `__design-system__`.

В Design system view выбор CSS-компонента открывает
`design-system/index.html#<docsAnchor>`, выбор reference page открывает сам
файл. Mark/Annotate и screen tools отключены, viewport работает, а agent-run
получает write-scope только на пакет, его assets/refs и description sidecars.
`pages/**` и root `index.html` в таком ране read-only.

## Add design system

В Screens panel/Design System UI пользователь может открыть **Add design
system** и вставить или выбрать source-файлы:

- `Design.md`
- `tokens.css`
- `components.css`
- optional reference/preview material

Сохранение пишет непустые sources в `design-system/` и сразу запускает re-index.
Managed preview не принимается как source of truth и всегда пересобирается.

Если пакет отсутствует, Design system view перекрывает пустой canvas
bootstrap-карточкой с тремя явными путями:

- **Start from preset** — создаёт canonical sources и managed catalog;
- **Extract from reference** — открывает reviewable proposal flow;
- **Import files** — принимает несколько локальных файлов без модельного/API
  анализа изображения.

Import files маршрутизирует только по имени/типу файла:

| Вход                                               | Цель                                                      |
| -------------------------------------------------- | --------------------------------------------------------- |
| точные `Design.md`, `tokens.css`, `components.css` | соответствующий canonical source, только если отсутствует |
| `.html/.htm/.css/.js/.mjs/.cjs`                    | `design-system/refs/`                                     |
| изображения, svg, web-fonts                        | `design-system/assets/`                                   |

Лимиты проверяются и в UI, и на сервере: до 20 файлов, до 10 MB каждый и до
50 MB суммарно. Canonical source не перезаписывается; collision в refs/assets
получает `-2`, `-3` и т.д. После успешного импорта продукт пересобирает managed
preview, делает один reindex и показывает imported/skipped paths. Если
`design-system/index.html` user-owned, import останавливается до записи.

Кнопка **Rebuild preview** детерминированно пересобирает
`design-system/index.html` из трёх canonical sources, usage evidence и списка
reference pages. Этот файл является preview/catalog, а не отдельным источником
истины.

## Component descriptions

HTML-first проекты участвуют в том же флоу **Describe components for AI**, что
и Storybook-проекты, но компонентная модель другая: источник компонентов — CSS
catalog, а не CSF stories.

Входы:

- Settings -> Project -> **Describe components for AI**;
- DS Browser / component card, когда нужно проверить уже authored layer.

Для каждого `css-catalog-*` компонента агент показывает mined draft из
`.sber-designer/design-index/usage-cards.jsonl` и задаёт профильный набор
вопросов:

```text
Purpose
Use when
Modifiers        -> descriptionLayer.variantGuidance[prop="modifier"]
Base markup/classes -> requiredClasses -> requiredProps; canonicalHtml -> canonicalSnippets
Keywords
```

Запись всегда начинается с канонического sidecar:

```text
.sber-designer/components/<componentId>.md
```

Для HTML-first default write target — `design-system`: tool-owned writer
дополнительно вставляет или обновляет секцию в preview/catalog:

```html
<section data-sd-description-for="primary-action">
  <h2>Description for AI</h2>
  <p><strong>Purpose:</strong> Primary call-to-action button.</p>
</section>
```

Эта секция — **projection**, а не source of truth. Source of truth во всех
профилях — sidecar. Если managed `design-system/index.html` расходится с sidecar,
`get_component_description_source` и DS Browser показывают divergence
diagnostic. Rebuild умеет два режима:

- **Keep Description for AI sections** — восстановить sections из sidecars после
  пересборки preview;
- clean rebuild — собрать чистый preview без sections; sidecars не удаляются,
  последующий rebuild с keep снова вернёт descriptions.

После pass `request_project_reindex` стартует background job, поэтому coverage
`describedComponents` и очередь обновляются без ручного Index project. Для
external CLI-runs sidecar write также приводит к auto-reindex в post-run
finalizer.

## Restructure non-canonical HTML project

Входы **Restructure into sber-designer layout / Review plan** доступны в
Screens panel, предупреждении Design system view и Settings → Project. Они
запускают отдельную роль `ai-project-restructurer` в Design mode, но роль
остаётся plan-first:

1. `get_project_structure_report` классифицирует файлы, выводит все
   source → target mappings, link rewrites, broken links, conflicts и
   `planDigest`; записей на этом шаге нет.
2. Пользователь явно подтверждает показанный план.
3. `apply_project_restructure` принимает тот же digest и
   `confirmedByUser: true`. Любое изменение workspace после отчёта делает
   digest stale; применение останавливается до записи. То же относится к
   collision, truncated scan и framework/bundler repo.
4. Тул переносит sources через staging, не перезаписывает цели, меняет только
   локальные `href/src/url()` из плана, создаёт недостающие пустые canonical
   sources без выдумывания дизайна, регистрирует `pages/**/*.html`, rebuild'ит
   root Screens Index и DS preview, запускает один reindex.
5. Receipt сохраняет digest, moved/created/removed-managed paths, link
   rewrites, screen ids, changed files, reindex job и полный deterministic
   post-check. Ошибка finalization восстанавливает snapshots; результат не
   считается успешным, пока `completed !== true`.

Повторный report канонического проекта — no-op. Broken local reference остаётся
явным follow-up и не маскируется успешным статусом.

## Extract from reference

HTML-first проект может создать дизайн-систему из visual reference:

- uploaded file attachment;
- Pixso URL.

Поток **Extract from reference** не пишет production sources напрямую. Агент
создает reviewable proposal:

```text
design/proposals/<proposal-id>/
  Design.md
  extraction-report.md
  tokens.css             optional
  components.css         optional
  design-system.html     optional proposal preview
```

Proposal считается готовым к accept, когда есть `Design.md` и
`extraction-report.md`. При accept backend переносит найденные proposal sources
в канонический пакет и пересобирает preview:

```text
design-system/Design.md
design-system/tokens.css
design-system/components.css
design-system/index.html
design/extraction-report.md
```

Accept заменяет одноимённые canonical sources. Поэтому optional `tokens.css`
или `components.css` разрешены scout-у только как activation-safe complete
replacement: файл обязан сохранить необходимые local `@import` entrypoints
native bundle. Если reference недостаточно для безопасной полной замены,
optional CSS не создаётся. Это предотвращает ситуацию, когда корректный
proposal после Accept отрезает существующие component styles.

После accept запускается re-index, а proposal folder удаляется. Reject удаляет
proposal folder без изменения root sources.

## Distill existing pages

Если в HTML-first проекте есть обычные HTML pages, но canonical design system
ещё не создана, Screens panel может предложить **Distill design system**.

Distill запускается, когда:

- `projectKind` равен `html-first`;
- `htmlDesignSystem.status` равен `missing` или `non-canonical`;
- есть минимум две distillable HTML pages;
- нет уже открытого proposal;
- пользователь не dismissed текущий pages set.

Distillable pages - это `ProjectScreen.kind: "page"` с `.html/.htm`, кроме
root `index.html` и всего `design-system/**`.

Агент читает index distillation prep и выбранные страницы, затем создает
proposal под `design/proposals/*`. Production pages в этом run не меняются.

## Apply design system

Когда design system canonical, Screens panel может предложить **Apply design
system** для существующих HTML pages.

Apply run:

- читает `design-system/Design.md`, `design-system/tokens.css` и
  `design-system/components.css`;
- заменяет raw/inline values на эквивалентные tokens/classes;
- сохраняет структуру, контент, ссылки, формы и screen root;
- не редактирует canonical package sources, managed
  `design-system/index.html` и root `index.html`;
- после каждой страницы запускает static render validation.

## Индексация

HTML-first индекс создает обычные design-index artifacts плюс:

```text
.sber-designer/design-index/html-css-catalog-manifest.json
```

CSS catalog извлекает:

- HTML files и CSS files;
- classes, selectors, custom elements;
- CSS custom properties;
- reusable CSS catalog components;
- canonical snippets из catalog-like HTML;
- distillation prep: repeated values, class frequencies и inline hardcode
  violations;
- HTML design-system signals для quality score.

Project System summary для HTML-first говорит агенту использовать
`design-system/Design.md`, package CSS, static pages и CSS patterns перед
широким сканированием source. HTML/CSS из `design-system/refs/**` усиливают
component evidence, но не входят в page-quality метрики.

## Restructure existing project

Для non-canonical статического репозитория UI запускает pinned plan-session
роли `ai-project-restructurer`. Первый шаг всегда read-only:
`get_project_structure_report` классифицирует до 300 файлов, предлагает
mapping в `pages/` и `design-system/`, вычисляет переписываемые локальные
ссылки и показывает broken references. На canonical проекте отчёт возвращает
`alreadyCanonical: true`; React/framework/bundler project получает явный отказ.

Report ничего не перемещает. После review агент применяет план обычными
permission-gated file tools, не удаляет исходные данные молча, пересобирает
managed surfaces и повторяет link-check.

## Prototype wiring

HTML-first прототип должен быть кликабельным и внутри sber-designer Demo, и как
обычный static site без редактора. Поэтому каждый переход состоит из двух
синхронных слоёв:

```text
1. real link in markup:
   <a href="./checkout.html">Continue</a>

2. mirrored flow edge in .sber-designer/project.sdproj:
   trigger.kind = "link"
   trigger.href = "pages/checkout.html"
```

Агент использует `prototype-wiring` skill: сначала подтверждает сценарий и
перечень экранов, затем точечно вставляет ссылки в существующие HTML pages и
добавляет `flow_add_edge` на каждый переход. Он не создаёт новые screens и не
переписывает контент страницы, если пользователь попросил только wiring.

Runtime нормализует HTML href перед матчингом: `pages/checkout.html`,
`./checkout.html`, `/pages/checkout.html` и абсолютный preview URL считаются
одним target. Пустой href не матчится ни с одним edge.

## Canvas и render health

Canvas всё равно остается live DOM iframe. Для HTML-first selected URL - это
прямая static page path, а не Storybook `/iframe.html?id=...`.

Render probe:

```text
renderProbe: "static-html"
evidenceSource: "static-html-http"
```

Static HTTP evidence считается weak, если нет browser-backed evidence. Probe
проверяет:

- HTTP response;
- наличие `[data-sd-screen-root]`;
- body text;
- inline/script error evidence best effort.

Canvas warning для static page не упоминает Storybook:

```text
The iframe finished loading, but the page did not expose data-sd-screen-root.
Reload the static HTML preview.
```

## Rename, move, duplicate, delete

Screens panel работает с HTML pages так же, как с другими screens, но файловая
операция проще:

- rename меняет slug файла, сохраняя `.html`/`.htm` extension;
- move переносит файл в folder segment;
- duplicate создает новый page record/file;
- delete удаляет screen record и связанные generated files только после явного
  подтверждения.

Для HTML pages Storybook cache invalidation не нужна, но preview session
перезапускается/перечитывается, чтобы static file появился в iframe.

## Что нельзя делать

- Нельзя считать HTML-first temporary export или attachment mode.
- Нельзя писать новые screens в managed `index.html`.
- Нельзя копировать чужой HTML attachment как production source без анализа и
  reviewable scope.
- Нельзя добавлять React/Storybook/Tailwind/dependencies в HTML-first проект,
  если пользователь или project profile явно не показывает такой stack.
- Нельзя использовать raw inline palette, default utility classes or emoji icons
  вместо canonical `design-system/tokens.css`/`components.css`.
- Нельзя хранить локальные абсолютные paths в generated index artifacts,
  generated pages или public docs.
