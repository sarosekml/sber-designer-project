# Third-party notices

This product includes adapted code and configuration from open-source
projects. We list each one below with the upstream source, license, and
where it lives in this repository.

## ZSeven-W/openpencil — MIT

Source: <https://github.com/ZSeven-W/openpencil>
License: MIT (Copyright © 2026 ZSeven-W)

**Описание.** openpencil — это готовый каркас монорепозитория, с которого
мы стартовали проект, чтобы не собирать всё с нуля. Из него мы взяли
базовые «строительные блоки»: общие стили (`styles.css`), вспомогательные
функции (`utils.ts`), пару готовых UI-компонентов (кнопку и разделитель),
файл настроек shadcn (`components.json`) и саму структуру папок (`apps/`,
`packages/` и рабочие пространства Bun). При этом мы намеренно **не** берём
из openpencil ту часть, которая рисует холст через Skia (векторная
графика): у нас холст устроен иначе — это живой DOM в iframe, а источником
правды является код (AST). Поэтому пакеты `pen-engine`, `pen-core`,
`pen-renderer`, `pen-react` и `pen-codegen` мы заменили собственным движком
собственными TypeScript-модулями в `apps/web`, `services/api` и
`packages/ast-bridge`. Остальные пакеты (`pen-mcp`, `pen-figma`,
`agent-native`) служат только идейным образцом и не присутствуют в рабочем
дереве.

Files in this repo are adapted (not vendored verbatim) from `openpencil`:

| File in this repo                                      | Adapted from                               |
| ------------------------------------------------------ | ------------------------------------------ |
| `apps/web/src/styles.css`                              | `apps/web/src/styles.css`                  |
| `apps/web/src/lib/utils.ts`                            | `apps/web/src/lib/utils.ts`                |
| `apps/web/src/components/ui/button.tsx`                | `apps/web/src/components/ui/button.tsx`    |
| `apps/web/src/components/ui/separator.tsx`             | `apps/web/src/components/ui/separator.tsx` |
| `apps/web/components.json`                             | `apps/web/components.json`                 |
| Monorepo layout (`apps/`, `packages/`, Bun workspaces) | repo structure                             |

We deliberately do **not** depend on or vendor the following openpencil
packages, even though our roadmap references their ideas:

- `pen-engine`, `pen-core`, `pen-renderer` — Skia-based document/canvas.
  Replaced by the AST-first editor and API modules in this repository; there is
  no placeholder `editor-engine` package.
- `pen-react` — React UI SDK over the Skia canvas.
- `pen-codegen` — vector → React generator.
- `agent-native` (Zig NAPI) — нативный agent-рантайм (multi-provider,
  streaming, tool-calling, «команды агентов»). **Почему не берём:** дублирует
  наш agent loop и обходит правило «все вызовы модели только через
  `@sber-designer/llm-gateway`» (ADR-0005), а нативный Zig-бинарник усложняет
  on-prem-сборку поверх Bun/TS. **Когда можем взять:** Phase 4, как
  опциональный локальный рантайм для air-gapped инсталляций. Идею
  «concurrent agent teams» можно перенять отдельно в наш TS-координатор.
- `pen-mcp` — used as a structural reference for our future
  `@sber-designer/proj-mcp`; no source is shared yet. **Почему не берём:** его
  инструменты (`insert_node`, `move_node`, `batch_design`) работают над
  векторными узлами Skia-документа, а у нас документ — это AST/`.tsx`
  (ADR-0001). **Что берём как референс:** таксономию инструментов и паттерн
  послойной генерации `design_skeleton → design_content → design_refine`.
- `pen-figma` — planned for adoption in Phase 3 (`.fig` import). **Почему не
  берём сейчас:** конвертирует `.fig` в векторные узлы, а наша текущая линия —
  живой Figma/Pixso MCP design-source handoff. **Когда можем взять:** Phase 3,
  и только парсер-половину — для оффлайн-импорта `.fig` без облака, с
  переотображением в наши токены/компоненты/каркас экрана.

When any of those upstream sources land in our tree, this file will be
updated with file-level mapping.

## modelcontextprotocol/typescript-sdk — MIT

Source: <https://github.com/modelcontextprotocol/typescript-sdk>
License: MIT

**Описание.** Это официальная библиотека для протокола MCP (Model Context
Protocol) — стандарта, по которому внешние ИИ-инструменты (например, Claude
Code или Cursor) могут «подключаться» к нашему проекту и управлять им. Мы
используем её в пакете `proj-mcp`, чтобы поднять MCP-сервер: он принимает
команды от внешнего агента и открывает ему доступ к инструментам нашего
проекта. Подключаем как обычную зависимость, свой код в неё не копируем.

Used by `packages/proj-mcp/` to host an MCP server. We depend on it as a
package (`@modelcontextprotocol/sdk`), no source is vendored.

## colinhacks/zod — MIT, StefanTerdell/zod-to-json-schema — ISC

**Описание.** zod — это библиотека для проверки данных во время работы
программы: она описывает, «как должны выглядеть» входные данные, и сразу
ловит ошибки, если что-то пришло не в том формате. Мы применяем её в
`llm-gateway` (проверка настроек и запросов к ИИ-провайдерам) и в
`proj-mcp` (проверка входных данных для инструментов). Дополнительно
`zod-to-json-schema` превращает наши zod-описания в формат JSON Schema,
который требует протокол MCP, — чтобы не описывать одно и то же дважды.

`packages/llm-gateway/` and `packages/proj-mcp/` use zod for runtime
validation; `proj-mcp` additionally uses `zod-to-json-schema` to turn
tool input schemas into the MCP-required JSON Schema shape.

## steambap/svg-captcha — MIT

Source: <https://github.com/steambap/svg-captcha>
License: MIT (Copyright © 2016–present Weilin Shi)

**Описание.** `services/api` использует `svg-captcha` 1.4.0 для полностью
офлайн-защиты регистрации и входа. Пакет читает приложенный к нему шрифт на
сервере и превращает каждый символ в SVG-`<path>`; браузеру не передаётся
`<text>`, ссылка на шрифт или внешний URL. Challenge и ответ хранятся только
в памяти API с ограниченным TTL и не попадают в SVG.

Новая runtime-цепочка зависимостей целиком разрешена для on-prem-сборки:

- `svg-captcha` 1.4.0 — MIT;
- `opentype.js` 0.7.3 — MIT (Copyright © 2017 Frederik De Bleser);
- `tiny-inflate` 1.0.3 — MIT (Copyright © 2015–present Devon Govett).

В `svg-captcha/fonts/LICENSE.md` приложенный шрифт Comismsh отдельно помечен
автором GemFonts как `free` и содержит ссылку на сайт автора. Файл шрифта
приходит только внутри npm-пакета; во время работы API ничего не скачивает.

## opencode (sst/opencode) — MIT (config-format inspiration only)

Source: <https://github.com/sst/opencode> · <https://opencode.ai/docs/providers/>
License: MIT

**Описание.** opencode — это сторонний инструмент для работы с
ИИ-провайдерами; его код мы **не** используем. Мы лишь позаимствовали саму
идею того, как должен выглядеть файл настроек. Наш файл
`sber-designer.json` (где перечислены провайдеры с полями `type`, `name`,
`options`, `models`, подстановка переменных окружения `{env:VAR}` и блок
`mcpServers`) сделан по тем же принципам, что и `opencode.json`. Это удобно
тем, кто уже знаком с opencode.

The shape of `sber-designer.json` (top-level `provider` map with `type`,
`name`, `options`, `models`, plus `{env:VAR}` substitution and the
`mcpServers` block) follows the conventions of `opencode.json`. No
opencode source is vendored.

## google-labs-code/design.md — Apache-2.0 (format/spec constants)

Source: <https://github.com/google-labs-code/design.md>
License: Apache-2.0 (Copyright 2026 Google LLC)

**Описание.** design.md (от Google) — это спецификация формата файла
`DESIGN.md`, в котором описывается контекст дизайна проекта: какие разделы
в нём должны быть. Мы взяли из неё только список канонических названий
разделов и номер версии формата и положили их в `design-md-spec.ts`. Это
позволяет нам проверять файлы дизайн-контекста прямо у себя и без интернета
— мы не запускаем чужую утилиту и ничего не скачиваем во время работы.

`services/api/src/design-md-spec.ts` records the canonical public
`DESIGN.md` section names and current `alpha` spec version so
sber-designer can validate project design-context files offline. The
runtime validator is implemented locally in `services/api/src/design-context.ts`;
we do not shell out to the upstream CLI or download packages at runtime.

## Original shadcn/ui — MIT

Source: <https://ui.shadcn.com>
License: MIT

**Описание.** shadcn/ui — это набор готовых UI-компонентов (кнопка,
разделитель, диалог и т.д.). Его особенность в том, что компоненты не
ставятся как библиотека, а копируются прямо в твой проект — и дальше ты сам
ими владеешь и можешь свободно менять. Поэтому в
`apps/web/src/components/ui/` лежат наши собственные копии этих
компонентов. По нашим правилам shadcn/ui — первый источник любых базовых
элементов интерфейса.

The button, separator, and dialog components in `apps/web/src/components/ui/`
are the standard shadcn/ui implementations as adapted by openpencil and
re-adapted here. They are not a redistribution of a shadcn package — the
shadcn workflow is to copy components into your repo and own them.

## Radix UI Primitives — MIT

Source: <https://github.com/radix-ui/primitives>
License: MIT (Copyright © 2022 WorkOS)

**Описание.** Интерактивные shadcn-компоненты используют доступные по
клавиатуре headless-примитивы Radix UI. В Этапе 6 эпика 0400 добавлен
`@radix-ui/react-avatar` 1.2.2 для общего Avatar/Fallback-компонента в рейле и
профиле; Dropdown Menu, Dialog, Label, Separator, Tabs и Tooltip уже используют
другие Radix-пакеты. Всё исполняется локально в web-бандле и не обращается к
внешним сервисам.

## lucide-icons/lucide — ISC

Source: <https://github.com/lucide-icons/lucide>
License: ISC

**Описание.** lucide — это большой набор иконок (тот самый `lucide-react`,
который мы используем в интерфейсе). В
`packages/design-indexer/src/builtin-icons/` лежит готовый «слепок» с
описанием всех иконок этого набора. Он нужен как запасной встроенный
каталог иконок: если у подключённого проекта нет своего списка иконок, мы
показываем этот стандартный набор.

`packages/design-indexer/src/builtin-icons/` contains a generated
metadata snapshot of the `lucide-react` icon set plus the upstream ISC
license text. sber-designer uses this as a built-in fallback icon
catalog for the design-system index when a connected project has no
project-local icon inventory.

## mhutchie/vscode-git-graph — MIT (rendering techniques adapted)

Source: <https://github.com/mhutchie/vscode-git-graph>
License: MIT (Copyright © Michael Hutchison)

**Описание.** Это VS Code-расширение «Git Graph» — наш визуальный эталон для
просмотрщика истории Git внутри редактора (task 0096). Мы **не вендорим и не
зависим** от его кода: рендерер у нас собственный
(`apps/web/src/lib/git-graph-layout.ts` —
swim-lane алгоритм, и `apps/web/src/components/editor/GitGraphDialog.tsx` —
отрисовка). Но мы **переняли из его исходников несколько конкретных приёмов
отрисовки**, изучив `web/graph.ts` и `web/styles/main.css`:

- форму кривой ветки — симметричная по-строчная кубическая Безье с
  control-offset `0.8·rowH` (из `Branch.draw` в `web/graph.ts`);
- «shadow»-обводку фоновым цветом под каждой линией для чистых пересечений
  дорожек (из правил `path.shadow` / `path.line` в `web/styles/main.css`);
- стиль вершин: текущий коммит/HEAD как полое кольцо (заливка фоном + цветная
  обводка), остальные точки — с тонким halo фоном (`circle.current` /
  `circle:not(.current)`);
- узел **Uncommitted Changes (N)** сверху с серым пунктиром к HEAD;
- переключатель стиля графа **Rounded / Angular** (их `GraphStyle`, включая
  формулу угловых переходов `0.38·rowH`).

We do **not** vendor or depend on any code from this project. Our Git Graph
viewer is first-party; we only re-implemented a handful of rendering
techniques observed in its `web/graph.ts` and `web/styles/main.css`: the
per-row cubic bezier branch curve (control offset `0.8·rowH`), the
background-colour `path.shadow` stroke drawn under each `path.line` for clean
lane crossings, the hollow-HEAD / haloed-dot vertex styling, the
uncommitted-changes node, and the Rounded/Angular style toggle. No code is
copied verbatim and there is no runtime dependency on the extension.

**Historical note (`commit-graph`).** The viewer was first prototyped with the
`commit-graph` npm package (MIT in `package.json`, Apache-2.0 `LICENSE` file in
its repo), but its SVG-serif text and fixed layout could not match the VS Code
Git Graph look, so the dependency was removed. No third-party Git-graph package
ships in the product.

## microsoft/monaco-editor — MIT

Source: <https://github.com/microsoft/monaco-editor>
License: MIT (Copyright © Microsoft Corporation)

**Описание.** monaco-editor — это редактор кода из VS Code; мы используем его
(через обёртку `@monaco-editor/react`) для режима Code в редакторе. Раньше
`@monaco-editor/react` по умолчанию подгружал сам редактор с публичного CDN
`cdn.jsdelivr.net` во время выполнения. Для self-hosted / on-prem установок
(правило #7 в `CLAUDE.md`) это недопустимо: за корпоративным прокси или в
air-gapped-сети CDN недоступен, и режим Code навсегда зависал на «Loading...».
Поэтому мы **вендорим `monaco-editor` в бандл** и указываем загрузчику
использовать локальный пакет (`apps/web/src/lib/monaco-setup.ts`,
`loader.config({ monaco })`), а языковые web-воркеры подключаем через
Vite `?worker`. Никаких обращений к сети во время выполнения.

## remarkjs/react-markdown — MIT, remarkjs/remark-gfm — MIT

Source: <https://github.com/remarkjs/react-markdown>,
<https://github.com/remarkjs/remark-gfm>
License: MIT (Copyright © Titus Wormer)

**Описание.** `react-markdown` (+ `remark-gfm` для GitHub-flavored markdown) рендерит
ответы ассистента в чате как форматированный markdown — раньше `**жирный**`, списки и
блоки кода показывались сырым текстом (задача 0083 D3). Это обычные npm-зависимости
`apps/web` (MIT, чистый JS, без сетевых обращений и без нативных бинарников — безопасно
для on-prem, правило #7). Сырой HTML **намеренно не включён** (мы не подключаем
`rehype-raw`), поэтому вывод модели/бриджа не может внедрить разметку. Рендерер —
`apps/web/src/components/editor/chat/Markdown.tsx`.

## bubkoo/html-to-image — MIT

Source: <https://github.com/bubkoo/html-to-image>
License: MIT (Copyright © 2017–2023 bubkoo)

**Описание.** `html-to-image` растеризует живой DOM канваса в PNG для слоя
Mark (задача 0127): пользователь обводит область экрана красным маркером, и
скриншот с пометками уходит ассистенту как вложение. Обычная npm-зависимость
`services/api`; прокси превью (`services/api/src/routes/preview.ts`) инлайнит
его UMD-бандл в HTML-ответ вместе с selection-бриджем — **никаких CDN и
сетевых обращений во время выполнения** (правило #7, on-prem). Наш
самодельный SVG/foreignObject-растеризатор оставлен только как фолбэк: на
реальных страницах со стилями он отрисовывает пустой кадр (тот же класс
проблем, что Open Design фиксирует как issue #4064), поэтому библиотека —
основной путь.
