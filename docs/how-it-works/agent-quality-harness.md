---
updated: 2026-07-23T16:18:09+03:00
---

# Agent quality harness

## Зачем нужен этот документ

Это сквозное описание нового harness, который запускает экранного агента,
ограничивает его область работы, проверяет результат, сохраняет evidence и
учится на явной оценке пользователя и доказуемых follow-up правках.

Документ рассчитан на человека, который ещё не знает устройство
sber-designer. Здесь описано фактическое поведение на 19 июля 2026.

## Короткая модель

Harness — не отдельная модель и не генератор картинок. Это оркестратор вокруг
модели:

```text
действие пользователя
  -> определение задачи и target
  -> сбор контекста проекта
  -> optional direction choice до запуска модели
  -> API-agent или CLI runtime
  -> разрешённые изменения source files
  -> механические проверки
  -> optional Design Jury и одна revision
  -> terminal status и run artifacts
  -> dataset, оценка пользователя и project style memory
```

Источник правды результата — файлы подключённого проекта. Canvas показывает
live DOM из этих файлов. Harness не хранит параллельный «макет», который потом
нужно экспортировать в код.

## Что harness получает на вход

Перед запуском backend собирает только доступный и релевантный контекст:

- merged agent kit: product kit (`packages/agent-kit/kit`), personal kit и kit проекта;
- инструкции проекта;
- активный экран или компонент;
- выбранный DOM-элемент, если пользователь работает в Design mode;
- task intent: новый экран, edit, redesign, image-to-screen и т.д.;
- полную compact component selection map из project index;
- run-owned screen structure plan с regions, UI roles, data, actions и states;
- task-relevant component pack с подробными контрактами выбранных кандидатов;
- screen template;
- design-system контекст, токены, иконки, assets и component descriptions;
- attachments и внешние design references;
- compact project style memory для поддерживаемых экранных задач;
- optional structured Design brief конкретного generation run;
- runtime/model capabilities.

Контекст делится на две части:

- **stable** — роль, инструкции, inventory скиллов/knowledge, сведения о
  project system и project style memory;
- **task-specific** — текущий target, brief, selection, attachments,
  structure plan, component pack и user request. Полная component map относится
  к stable project context, а structure plan, shortlist и его подробные
  contracts — к текущей задаче.

Для CLI stable-часть получает digest. При продолжении той же runtime-сессии
неизменившийся stable-контекст можно заменить короткой ссылкой на digest.
`preferences.md` входит именно в stable-часть: digest меняется, только когда
реально изменились правила проекта.

### Component discovery до hydration

Reindex создаёт
`.sber-designer/design-index/component-selection-map.json`. Это полная карта
всех indexed components, а не фиксированный shortlist. Для каждого component
она хранит stable id/public name, purpose, roles/capabilities, keywords,
when-to-use/avoid, description status/confidence и compact variant axes.

Карта намеренно не содержит full props, source excerpts и usage snippets.
Screen-профиль сначала видит её целиком в bounded prompt projection, затем
task-relevant component pack добавляет тяжёлые contracts только выбранных
кандидатов. Поэтому число доступных компонентов определяется проектом, а не
старым лимитом `12`; prompt budget ограничивает объём hydrated details, а не
discovery.

Подробные contracts выбранных candidates гидратируются region-aware batches.
Candidate наследует `regionIds` роли из `ScreenStructurePlan`; exact user
requirement без плановой роли попадает в отдельный batch
`explicit-requirements`. Batches ограничиваются фактическим UTF-8 byte weight
(по умолчанию `12_000` bytes), а не числом components. Если один contract сам
превышает budget, он остаётся доступным в отдельном batch с `oversized: true`.
Отдельный snippet ограничен `3_500` UTF-8 bytes, но глобального лимита на число
snippets или hydrated components нет.

Перед hydration выбранные React components проходят instantiation resolution
по актуальным source/types. Resolver повторно сканирует только selected records:
TS literal unions и Storybook argTypes задают допустимые variant values,
non-optional members component `*Props` — required props. Exact variant
выбирается по run intent/region context, а если intent не различает values — по
literal prop из реального mined usage. Public symbol/module берётся из
однозначной project import convention, затем проверяется по public barrel;
export alias добавляется в component family для последующего reuse-check.
CSS-catalog components аналогично используют modifiers, required classes и
canonical markup.

Результат хранится в `selectionPlan.resolutions`: status, resolved public
import, `chosenVariants`, `criticalProps`, unresolved axes и evidence source.
Если index diagnostic помечает description fields как `diverged`, resolver
записывает их в `excludedAuthoredFacts` и не использует authored variant values,
required props или canonical snippets как authoritative guidance. Source/types
и наблюдаемое usage при этом остаются доступными. При запрете ссылаться на
существующие screens mined screen usage не участвует в resolution.

Для screen-generation-like Design-run shortlist строится по уникальным UI roles
из `ScreenStructurePlan`, а не по фиксированному generic профилю. Selection не
имеет count cap: каждая релевантная роль получает candidate, а exact component
requirement пользователя добавляется как mandatory и не вытесняет другой
candidate. Если индекс не даёт достаточно релевантного component, pack получает
structured `selectionPlan.gaps` с role, regions и причиной; такой pack имеет
status `weak`, но gap остаётся явным evidence, а не скрытым fallback на случайный
component. Legacy screen-edit вызовы без structure plan сохраняют role-profile
fallback.

Перед role discovery explicit forbidden component names удаляются только из
positive-intent projection: исходный request остаётся неизменным для constraint
validation и run evidence, но `Не используй Grid` больше не превращает экран в
dense-table workflow. Semantic rerank отдельно считает authored purpose,
usage-card `whenToUse`, description layer, public name и task nouns; `filePath`,
id и group membership считаются incidental evidence и сами не проходят
structure-plan relevance threshold. При равном semantic evidence public
root/index выше nested `plugins/internal/parts`. Поэтому внутренний `Tab` не
выбирается как whole side-preview, а `Overlay` из table plugin — как корневой
data-table без прямого purpose/usage evidence.

Run evidence сохраняет карту внутри `component-pack.json`, а receipt
`task_relevant_component_pack` отдельно фиксирует `indexedCount`,
`describedCount`, `divergedCount`, количество подробно поданных candidates,
`selectionSource`, `plannedRoleCount`, `gapCount` и `gapRoles`. Поле
`hydrationManifest` дополнительно хранит strategy, batch byte budget, полный
список `hydratedComponentIds`, суммарный UTF-8 объём и каждый batch с его
regions, component ids, byte size и oversized-status. API и CLI рендерят одни и
те же batch boundaries в task-specific prompt. Receipt также сохраняет полный
component resolution trace и агрегаты resolved/partial/unverified.

### Structure planning checkpoint

Для `screen-generation`, `image-to-screen` и полного `screen-redesign` backend
до первого write строит run-owned `ScreenStructurePlan`. Он продолжает исходный
user request, выбранный direction/Design brief и выбранный screen template,
раскладывая задачу на regions, UI roles, data, actions и lifecycle states.

Это не пользовательский Plan session document и не новый source of truth.
Ревьюируемый `.sber-designer/plans/*.md` остаётся intent пользователя; внутренний
plan Design-run развивает его на актуальном project context. API и CLI получают
одинаковый порядок: полная component map, structure plan, затем hydrated pack.
Artifact сохраняется в `screen-structure-plan.json`, receipt называется
`screen_structure_plan`.

## Поддерживаемые сценарии

| Сценарий                         | Как определяется scope                                             | Design Jury                  | Style memory                      |
| -------------------------------- | ------------------------------------------------------------------ | ---------------------------- | --------------------------------- |
| Новый React/Storybook screen     | Новый screen, созданный через `Add a screen`                       | Да, по policy/per-run choice | Да                                |
| Новый HTML-first page            | Новый `.html` screen                                               | Да, по policy/per-run choice | Да                                |
| Image-to-screen                  | Новый или активный screen + image attachment                       | Как screen generation        | Да                                |
| Полный redesign активного screen | Активный screen + явный запрос redesign/редизайн без DOM-selection | Да, по policy/per-run choice | Да                                |
| Точечный edit screen             | Активный screen или выбранный DOM node                             | Нет                          | Нет                               |
| Storybook component work         | Активный component/story                                           | Нет                          | Нет                               |
| Description for AI               | Component catalog и description sidecar                            | Нет                          | Нет                               |
| Project indexing                 | Project-owned index artifacts                                      | Нет                          | Нет                               |
| Design-system scout              | Reviewable proposal, затем human Accept/Reject                     | Нет                          | Косвенно после принятия контракта |

Точечный edit намеренно не получает project style memory: одноразовая правка
не должна автоматически превратиться в глобальное правило. `image-to-screen`
считается классом генерации и память получает.

### Важный нюанс target

На основном canvas нет обязательного блока с названием `Target`. Target
определяется из действия пользователя:

- новый screen — из `Add a screen`;
- текущий screen — из открытого screen и текущей Assistant task;
- конкретный элемент — из selection в Design mode;
- Storybook component — из выбранного component/story.

Если на экране открыт обычный screen и диалог `Add a screen` не открыт, искать
отдельный `Target -> New` не нужно.

## Как пользователю создать экран

1. В панели `Screens` нажать `+` и открыть `Add a screen`.
2. Выбрать `Blank screen` и задать имя.
3. Ввести короткую инструкцию: назначение, обязательные блоки, данные, язык и
   важные ограничения.
4. При необходимости раскрыть `Design brief (optional)` и задать только
   важные оси: palette, typography, layout, mood, density и constraints.
5. При необходимости включить `Start with wireframe`.
6. Для дополнительного review включить `Run Design Jury`.
7. Нажать `Create & ask Assistant`.
8. Если direction-picker включён, выбрать одно из трёх направлений в чате.
9. Если появилась permission-card, проверить точный файл и нажать `Approve`
   или `Deny`.
10. Дождаться terminal status. Не считать первый текст модели завершением:
    после него идут source/craft/render checks и, возможно, Jury.
11. Проверить итоговый screen, статус, Jury score и строку
    `Total · Input · Output`.
12. В `Rate this run` поставить 👍/👎, написать короткую причину и нажать
    `Save`.

Для причины 👍 лучше писать правило, которое нужно повторять, например
`Keep compact table rows`. Для 👎 — то, чего нужно избегать, например
`Avoid oversized empty areas`. Такая формулировка сразу пригодна для
project style memory.

## Structured Design brief

Design brief — параметры одного generation run, а не постоянная тема проекта.
Серый текст внутри пустого поля — placeholder. Он объясняет ожидаемый формат,
но не отправляется агенту. Brief содержит только явно заданные оси:

- `palette`;
- `typography`;
- `layout`;
- `mood`;
- `density`: `compact`, `balanced` или `spacious`;
- `constraints`: до восьми жёстких ограничений.

Поля `Add a screen` означают следующее:

| Поле                            | Что оно задаёт                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Blank screen / From Storybook` | Создать пустой screen или начать с существующей Storybook story.                                        |
| `Screen name`                   | Имя screen в дереве и основа имени создаваемых файлов/компонента.                                       |
| `Folder`                        | Группа screen в дереве и папка его файлов.                                                              |
| `Assistant instruction`         | Что должен делать экран: блоки, данные, язык и бизнес-требования.                                       |
| `Palette`                       | Цветовой характер и акценты.                                                                            |
| `Typography`                    | Иерархия и характер шрифтов.                                                                            |
| `Layout`                        | Композиция и расположение блоков.                                                                       |
| `Mood`                          | Визуальный тон: строгий, спокойный, выразительный и т. п.                                               |
| `Density`                       | `Compact` — больше данных на экране; `Balanced` — средняя плотность; `Spacious` — больше воздуха.       |
| `Constraints`                   | Жёсткие правила, по одному в строке.                                                                    |
| `Template`                      | Готовая структура-основа; `Without template` начинает с пустого shell.                                  |
| `Start with wireframe`          | Сначала greybox-композиция, затем визуальная реализация.                                                |
| `Run Design Jury`               | После успешных механических проверок пять reviewers оценивают экран и разрешают одну целевую доработку. |

Не стоит одновременно писать `Layout: обычный для проекта` и запрещать
использовать текущие screens: чтобы определить обычную композицию, агенту нужны
project evidence. Если нельзя копировать существующие screens, лучше написать
это буквально: `не копируй их композицию; используй только компоненты и токены`.

Пользователь заполняет их в `Add a screen`. Mini-form создаёт
`generation.designBrief` с `source: mini-form`. Контракт также допускает
`request` и будущий `direction-picker`. Пустой объект не принимается.

Backend добавляет одинаковую секцию `## Design brief` в API system prompt и
CLI handoff, включая resume/delta turn. Если ось не заполнена, агент:

1. сначала ищет project evidence в index, templates, соседних screens и style
   memory;
2. задаёт один короткий вопрос до первой записи, если выбор существенно меняет
   результат;
3. иначе выбирает минимальный project-compatible default и помечает его в
   финальном ответе как assumed default.

Явные constraints считаются hard requirements, но свежий явный user request
может их переопределить. Бриф сохраняется в `run-manifest.json` и отдельном
receipt `design_brief`. Поэтому Design Jury оценивает screen против того же
объекта, который получил генератор, включая bounded revision.

### Direction-picker

Глобальный user default задаётся без редактирования JSON:

```text
Settings → System → Harness setup → Choose a design direction
```

В `Add a screen` тот же checkbox позволяет переопределить default для одного
экрана. Значение сохраняется в user settings sber-designer и действует во всех
проектах этого пользователя.

Глобальные настройки харнесса живут в `Settings → Harness setup`, а разовые
переопределения текущего create-run — в блоке `Harness` диалога `Add a screen`.
Иконка вопроса у заголовка блока явно объясняет эту границу.

Старый config остаётся fallback до первого сохранённого global UI-default:

```json
{
  "agent": {
    "directionPicker": "screens"
  }
}
```

- `off` — обычная генерация без промежуточного выбора; это default;
- `screens` — выбор перед заполнением нового screen;
- `always` — включает picker для поддерживаемых direction-aware входов,
  включая новый screen.

Это не три режима агента и не уровни качества. Это три альтернативных
направления композиции до дорогого запуска модели. Для нового screen harness
строит их без обращения к модели:

1. `Workflow focus` — один доминирующий workflow;
2. `Operational overview` — более плотный обзор статусов и сравнений;
3. `Guided progression` — спокойная пошаговая структура.

Явные palette/typography/layout/mood/density/constraints из mini-form не
заменяются. Пресет заполняет только отсутствующие layout, density и mood.

Поэтому варианты могут отличаться слабее, если пользователь уже зафиксировал
эти оси. Например, при заданных `Layout` и `Density: Compact` направление
`Guided progression` не имеет права заменить их на пошаговый spacious-layout;
оно добавит только intent и незаданный mood. Карточка выбора должна объяснять
это пользователю конкретными итоговыми значениями.

Первый этап — persisted interruption, а не agent run. Harness добавляет в
project transcript исходный request и карточку с тремя кнопками, но помечает
оба сообщения `contextEligible: false`. Поэтому provider, CLI runtime и tools
ещё не запускаются, а служебная карточка не загрязняет model context. После
reload кнопки остаются рабочими.

При клике harness находит исходный request по message id и запускает обычный
generation run. В `generation` добавляются выбранный `Design brief` и
`directionSelection`. Run пишет receipts `design_brief` и
`direction_selection`; Jury получает оба объекта.

Live-прогон 2026-07-19 обнаружил важную границу: ввод голой цифры `1`, `2` или
`3` в composer не был равен клику по карточке. Такой ввод запускал новый
обычный request и терял brief, direction selection и Jury flag. Исправление
оставляет выбор на явных button-карточках и блокирует обычный composer, пока
selection не записан. Manifest/receipts всё ещё требуют повторной live
приёмки.

Важный нюанс: `Add a screen` сначала создаёт управляемый пустой target-файл и
Storybook/page shell, чтобы у будущего run был точный scope. Direction-picker
гарантирует отсутствие **agent write/permission** до выбора, но не отменяет
это первоначальное tool-owned создание target shell.

## Post-checks и единый quality flow

Direction-picker и Design brief работают до generation. `Post-checks / Screen
readiness DoR` запускаются после записи файлов, Design Jury делает optional
субъективный review, а terminal render proof проверяет runtime. Они образуют
один pipeline, но решают разные задачи и не должны выглядеть как один
необъяснимый тумблер.

Подробное пользовательское описание, профили, категории, статусы и текущие
ограничения собраны в
[Post-checks и Screen readiness DoR](screen-readiness-post-checks.md).
Global user defaults и правила per-run override описаны в
[Generation pipeline](generation-pipeline.md).

## Как изменить текущий screen

1. Открыть нужный screen.
2. Создать новую Assistant task, если старая относится к другому target.
3. Для изменения всего screen написать конкретный запрос в Assistant.
4. Для точечного изменения перейти в Design mode и выбрать DOM-элемент.
5. Перед `Approve` сверить path в permission-card с implementation file
   активного screen.
6. После завершения проверить terminal status и reload canvas.

При `edit-current-screen` scope guard разрешает менять только allowed target
files активного screen. Attachments не расширяют scope.

## Как запустить полный redesign

1. Открыть существующий screen.
2. Снять DOM-selection, если нужно изменить весь screen, а не один элемент.
3. Явно написать `redesign`, `редизайн`, `переделай экран` или описать смену
   композиции.
4. Перечислить, что нельзя потерять: секции, факты, статусы, действия и данные.
5. Запустить task и проверить preservation результата.

Full-screen redesign получает отдельный `screen-redesign` skill. Если DOM node
выбран, запрос классифицируется как targeted edit и не должен переписывать всю
композицию.

## Storybook и Description for AI

В Storybook mode scope — выбранный component/story, а не screen. Harness не
добавляет screen-generation pressure, screen templates, Design Jury или style
memory.

Для `ai-description-layer` используется ещё более узкий профиль:

- component catalog;
- очередь компонентов без описания;
- usage card и mined draft;
- canonical sidecar `.sber-designer/components/<id>.md`;
- tool-owned projections в Storybook/index.

Экранный component pack и screen selection в этот режим не подмешиваются.

## API и CLI: что общее, а что разное

Оба runtime работают как один продуктовый агент и проходят общую terminal
finalization, но исполняют изменения по-разному.

### API provider

- Backend собирает system prompt.
- Модель вызывает встроенные tools.
- Каждый write/apply_patch проходит permission и mutation transaction.
- Backend сразу получает структурированный tool result и receipt.

### External CLI

- Backend строит `agent-kit-handoff` с paths и контрактами.
- Codex CLI, Claude Code или OpenCode работает внутри workspace собственными
  средствами.
- Backend читает runtime stream и после выхода сравнивает target snapshots.
- CLI не получает внутренние tool schemas как API tools.
- Для bounded Jury revision используется resume текущей CLI-сессии.

Общими остаются target scope, project context, mechanical finalization,
Design Jury policy, terminal statuses, token usage и run recorder.

### Bounded CLI follow-ups and session rollover

Локальная правка уже существующего screen отличается от генерации: target и
основные component choices уже известны, поэтому повторная широкая разведка
репозитория только увеличивает задержку и token usage. Для resumed
`screen-edit` с активным implementation file harness использует отдельный
bounded-контракт.

Delta prompt сохраняет:

- runtime identity и instruction hierarchy;
- текущий user request;
- active screen, implementation/story paths и allowed targets;
- attachment references;
- task kind и readiness component pack;
- stable-context digest и runtime session id.

Из delta prompt намеренно исключаются уже переданные неизменные блоки:

- полные agent/skill/knowledge inventories;
- полный project description map и component selection map;
- повторная hydration всех component contracts;
- volatile path предыдущего run manifest.

Вместо этого runtime получает явный рабочий цикл:

```text
inspect active target once
  -> patch once
  -> verify the allowed target once
  -> finish or report one concrete blocker
```

Основной follow-up просит оставаться в пределах шести CLI/tool calls. Если
mechanical finalization находит repairable craft gap, repair prompt допускает
до четырёх calls: найти точное finding, внести одну правку и выполнить одну
target-scoped проверку. Это контракт поведения внешнего агента, а не скрытый
таймер процесса; harness всё равно независимо проверяет source diff, story
identity, craft, Design compatibility и render evidence.

Bounded-режим запрещает повторно читать глобальные `SKILL.md`, `AGENTS.md`,
`CLAUDE.md`, knowledge/inventory и запускать package-wide typecheck, Storybook
или browser smoke. Эти проверки принадлежат harness. Если запрос требует нового
component, redesign всей композиции или generation, применяется полный
task-specific context, а не этот локальный shortcut.

#### Когда CLI session продолжается

Stable-context digest и CLI session решают разные задачи. Digest доказывает,
что неизменный project context можно не пересылать целиком. Resume сохраняет
историю диалога runtime. Длинная простаивавшая история может стать дороже новой
сессии даже при коротком delta prompt, поэтому Codex использует idle rollover.

```text
matching runtime + model + workspace
  ├─ updated ≤ 30 minutes ago -> resume + compact delta prompt
  └─ updated > 30 minutes ago -> new session, missReason=idle_expired

metadata missing or runtime/model/workspace mismatch -> new session
legacy metadata without timestamp -> resume for backward compatibility
```

Граница включительная: ровно 30 минут ещё разрешают resume; rollover происходит
после превышения 30 минут. Порог выбран как баланс: пользователь может спокойно
продолжить естественную рабочую сессию в течение получаса, но поздний follow-up
не обязан повторно обрабатывать заведомо остывшую длинную историю.

Пока policy применяется только к capture-style Codex session: именно для неё
live evidence показало рост effective tokens после долгого idle. Другие CLI
runtimes не получают этот timeout без отдельного измерения и session contract.

`runtimeSessionUpdatedAt` обновляется при подтверждённом runtime session event и
cumulative usage event. Backend и web autosave сохраняют timestamp рядом с:

- `runtimeSessionId`;
- `runtimeSessionRuntime`;
- `runtimeSessionModel`;
- `runtimeSessionWorkspacePath`;
- `runtimeSessionUsage`.

После rollover первый run передаёт полный stable context и capture-ит новый
session id. Следующие follow-ups в пределах 30 минут снова используют resume и
compact delta prompt. В run diagnostics видны `mode`, `resumeUsed`, `source`,
`updatedAt` и, при rollover, `missReason=idle_expired`.

#### Текущая live-приёмка

Episode 26 закрыл чистый T3 → T4 → T9 сценарий на реальном screen-edit
`Megatest-01/CodexImgT3T4T9`. Перед финальным замером Project Index был доведён
до готового состояния `148 components / 32 described`, после чего все три run
получили один stable digest
`sha256:33ec869feeedec1f2bccf383e8684d6ec01299f00b7e03063bd9378061619d52`.

| Run                                       | Runtime  | Prompt                       | Tool calls | Effective input | Доля T3  | Результат |
| ----------------------------------------- | -------- | ---------------------------- | ---------- | --------------- | -------- | --------- |
| T3 `run-2026-07-20T21-03-45-932-6ca835b0` | `new`    | `71,357` bytes, full context | `7`        | `32,760`        | baseline | complete  |
| T4 `run-2026-07-20T21-05-22-998-409ecfcd` | `resume` | `6,146` bytes, reference     | `2`        | `4,744`         | `14.5%`  | complete  |
| T9 `run-2026-07-20T21-07-03-442-5244e59e` | `resume` | `6,141` bytes, reference     | `2`        | `5,084`         | `15.5%`  | complete  |

Оба follow-up существенно ниже D8.5b `<25%`. Они сделали только target inspect
и target verification вокруг одной source-правки, не изменяли story и не
запускали automatic repair. После evidence строка `gap` восстановлена в `1`;
implementation и story снова совпадают с Git.

До зелёной последовательности live-прогон выявил и закрыл два persistence
race, которые нельзя было увидеть в чистом unit replay:

- **W7.15 — active task pointer.** `New task` создавал пустую session, но
  freshness merge выбирал старый чат по более позднему transcript `updatedAt`.
  Теперь web merge сохраняет локально выбранную задачу, server save — выбранную
  incoming-задачу, а остальные active sessions того же screen архивируются.
  Live-проверка показала ровно одну active session с `runtimeSessionId=null`.
- **W7.16 — internal prompt echo.** Codex transcript возвращал полный External
  Runtime Handoff и bounded craft-repair prompt как дополнительные user turns.
  UI теперь не сохраняет эти harness-owned prompts в пользовательскую историю.
  Live-проверка после T3 показала один настоящий user turn и ноль handoff/repair
  echo.

Отдельный диагностический повтор также показал, почему acceptance нельзя
снимать во время cold index rebuild: переход временного static index
`850 / 0 described` к готовому `148 / 32 described` честно меняет stable digest
и требует один новый full-context run. После прогрева digest стабилен и оба
resume используют reference prompt.

30-минутный rollover остаётся Codex-only policy с точными boundary-regressions:
ровно 30 минут ещё resume, `30m + 1s` даёт `mode=new` и
`missReason=idle_expired`. Episode 26 отдельно доказал явный fresh-task reset и
token economy быстрых resume; ожидание реальных 30 минут в live-сценарии не
подменялось.

На Projects Home показывается компактный build-level snapshot текущей приёмки:
`Episode 28`, live HTML/CSS page-by-image, source-mutation gate, объём
HTML/CSS-каталога и Codex rollover `30 min`. Это не per-project runtime telemetry
и не заменяет manifest; подробная диагностика всегда берётся из
`.sber-designer/runs/<run-id>/run-manifest.json` и `external-runtime/`.

## HTML profile page-by-image live acceptance

T12 проверяет полный вертикальный сценарий не-React проекта: к активной
`pages/*.html` странице прикладывается raster reference, API-agent меняет именно
этот файл, static canvas перечитывает HTML без Storybook, а follow-up продолжает
тот же экран. Manifest обязан сохранить профиль
`html-css / css-catalog / static-html`.

Episode 28 прошёл на проекте `demo-html-project2`, странице
`pages/html-page-test-01.html` и read-only reference `dsign-md-ref.png`. До
первого полезного результата live-smoke поймал четыре дефекта harness:

- текст/код в ответе модели мог завершить generation без source mutation;
- validation receipt ошибочно считался изменением файла и запускал repair
  пустого экрана;
- общий agent profile и поздняя prompt-секция протаскивали React/Storybook
  требования в HTML/CSS run;
- `components.css`-блок без существующего HTML instance не попадал в catalog.

Теперь generation-like run с обязательной записью получает один bounded retry,
если модель не вызвала mutation tool. Finalizer считает изменением только
успешные `write_file`, `apply_patch` и root-marker repair receipts; validation и
read receipts не подходят. HTML profile contract появляется до agent profile и
фиксирует exact active target, `../tokens.css`, `../components.css`, один
`data-sd-screen-root`, CSS variables, catalog classes и static validation без
React/Storybook pressure. `components.css` индексируется как authoritative
catalog даже до первого использования класса на странице.

Финальная live-последовательность:

| Run                                    | Назначение                              | Результат                                                                               |
| -------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| `run-2026-07-21T20-19-44-768-86537fa2` | page by image после profile/index fixes | `complete`; одна запись только в active page; static render receipt `ok`                |
| `run-2026-07-21T20-22-32-198-bf3532a7` | тот же page, sidebar + real SVG chart   | source сохранён; два exact reuse blocker, bounded repair не смог применить patch        |
| `run-2026-07-21T20-24-54-802-cabc3270` | точечное закрытие reuse blockers        | `complete`; craft `0/0/0`, reuse `5/5`                                                  |
| `run-2026-07-21T20-28-30-423-2926bb82` | визуальная полировка того же page       | `complete`; `0` blocking, static render receipt `ok`; KPI/grid/header ближе к reference |

Последний polish-run оставил семь неблокирующих legacy-shortlist подсказок.
Часть из них (`CorpBreadcrumbs`, `TileCard`) не относится к Oripio и не должна
встраиваться ради счётчика. Live evidence при этом обнаружил отдельную ошибку
quoted-attribute parser: HTML-класс с последующим атрибутом мог индексироваться
как `corp-breadcrumbs"`. После исправления и reindex catalog содержит `139`
components, `139` classes, `112` selectors и `53` declared tokens без кавычек
или фрагментов соседних атрибутов в `requiredClasses`.

Проверка результата должна разделять три уровня:

1. source truth — exact page mutation, profile и root marker;
2. deterministic quality — craft/reuse/static render receipts;
3. visual review — композиция относительно reference. Зелёный craft не заменяет
   visual review: именно скрин canvas обнаружил stacked KPI и неверную структуру
   header, после чего follow-up исправил их в том же файле.

## Parallel run isolation, sticky permissions, and request-scoped identity

T10 проверяет не просто наличие двух индикаторов `running`, а четыре независимых
контракта одного параллельного запуска:

1. каждый HTTP request снимает неизменяемый editor snapshot со своим active
   screen, story и implementation target;
2. lease и terminal events принадлежат конкретному run-id и не блокируют второй
   экран;
3. UI показывает фактические provider/runtime/model, захваченные в момент Send,
   а selector отдельно говорит только о модели следующего запуска;
4. out-of-scope mutation создаёт run-scoped permission request, который остаётся
   доступен после перехода на другой экран и не превращается в разрешение для
   соседней задачи.

Episode 27 впервые поймал нарушение первого контракта в живом параллельном
сценарии. Manifest API-run правильно указывал
`Deepseek-api-text-T10`, но system prompt строился через поздний глобальный
`getState()` и получил уже выбранный в другой вкладке
`Codex-img-t3-t4-t9`. Run прочитал чужой target, но ничего не записал.
`buildSystemPrompt` теперь принимает request-scoped `EditorState`; оба chat
route передают именно snapshot, снятый в начале запроса. Regression меняет
глобальный active screen после capture и проверяет, что prompt продолжает
содержать только request target.

Финальная пара была отправлена практически одновременно:

| Run                                    | Runtime identity             | Target                   | Terminal                                            | Duration    |
| -------------------------------------- | ---------------------------- | ------------------------ | --------------------------------------------------- | ----------- |
| `run-2026-07-20T21-45-32-468-d7a8e092` | DeepSeek / `deepseek-v4-pro` | `DeepseekApiTextT10.tsx` | `needs_review`, render proof pending                | `29,673ms`  |
| `run-2026-07-20T21-45-32-470-de2b2a60` | Codex CLI / `gpt-5.5`        | `CodexTextT10.tsx`       | `needs_review`, pre-existing craft + Pixso MCP auth | `104,726ms` |

Оба manifest созданы с разницей `3ms`; API завершился, пока CLI продолжал
работать. Каждый изменил ровно один разрешённый implementation target. Story,
screen identity и соседний implementation не менялись. После evidence обе
однострочные padding-манипуляции восстановлены; четыре implementation/story
файла совпадают с Git.

Отдельный permission-run
`run-2026-07-20T21-36-43-671-af669c43` стартовал на
`Deepseek-api-text-T10`, но запросил `apply_patch` для `CodexTextT10.tsx`.
Карточка явно показала cross-target scope, пережила переход на другой экран и
открылась из background-run strip. Решение `deny` записано через `28,004ms` как
`permission_resolved`; target не изменился. Так live закрыты L12.6/L12.7, а
per-run `Current run · DeepSeek · deepseek-v4-pro` и
`Current run · Codex CLI · gpt-5.5` закрывают L12.8/F20.

Для local `screen-edit` действует ещё одна safety boundary: blocking craft
findings остаются честным `needs_review`, но не запускают широкий automatic
repair существующего экрана. Automatic craft repair разрешён только для
`screen_generation` и `screen_redesign`. Это сохраняет точную пользовательскую
правку и выносит прежние проблемы экрана в отдельную работу.

## Permissions, Stop и граница commit

В API mode write tools используют transaction со snapshot до изменения.
Побочные эффекты вроде reload/receipt откладываются до commit.

Возможны два корректных результата `Approve -> Stop`:

- Stop пришёл **до commit tool result** — source восстанавливается из snapshot,
  write receipt не появляется, run получает `cancelled`;
- UI уже показал `write_file ok` — изменение committed, поэтому поздний Stop
  завершает run как `cancelled`, но файл остаётся.

Stop не является общей кнопкой Undo. Для CLI уже выполненные внешним процессом
записи также нельзя считать автоматически откатанными. Всегда ориентируйтесь
на receipt/timeline, а не на скорость нажатия кнопок.

## Механическая финализация

После ответа модели harness проверяет фактический результат. Набор проверок
зависит от профиля и task kind, но может включать:

- была ли видимая запись и изменился ли allowed target;
- не заменён ли ожидаемый project component самодельной копией;
- соответствует ли component role контракту;
- связан ли Storybook story с правильной implementation;
- совпадает ли identity story/screen;
- присутствует ли screen root marker;
- проходит ли source/type integrity;
- проходит ли screen craft/readiness;
- используются ли design-system components/tokens;
- совместим ли screen с Design mode;
- открывается ли актуальный preview и подтверждён ли render.

Для TypeScript screen `validate_screen_craft` использует `tsconfig` проекта и
может вернуть `craft.type-error` или `craft.typecheck-unavailable`.

Mechanical gate отвечает на проверяемые инварианты. Субъективное качество
композиции не должно превращать полезный source в `failed`; для этого есть
`needs_review` и Design Jury.

## Terminal statuses

- `complete` — полезная мутация есть, обязательные проверки пройдены;
- `needs_review` — source сохранён, но preview, craft или Jury не дают
  достаточного подтверждения;
- `failed` — нет полезной мутации либо подтверждённо сломан обязательный
  source/runtime инвариант;
- `cancelled` — run остановлен пользователем;
- `running` — только промежуточное состояние.

Если финальный текст модели обещает больше, чем доказали post-checks,
authoritative run-status banner имеет приоритет над текстом модели.

Blocking craft finding не превращает уже сохранённый полезный target в
технический crash: такой run получает `needs_review` и причину ремонта. Если
tool-вызов сначала завершился ошибкой, но агент повторил его, сохранил target и
прошёл craft/story/root/render gates, ошибка остаётся в diagnostics и не
блокирует Design Jury.

Component constraints имеют полярность. `Используй компонент X` делает `X`
обязательным, а `Не используй компонент Y` исключает `Y` из task-relevant pack.
Запрещённый компонент нельзя одновременно считать обязательным или выдавать за
его отсутствие blocking finding.

Constraint `не используй текущие экраны проекта` меняет и context policy:
harness убирает советы читать nearby/indexed screens, screen-mined snippets и
import conventions. Агент может читать component source и Storybook examples
только для проверки API/imports, но не должен брать из существующих screens
layout, content или visual direction.

Это частный случай общей иерархии design-инструкций: текущий явный запрос
пользователя выше структурированного brief, project evidence и общих советов
харнесса. При конфликте нижняя инструкция полностью отбрасывается. Отдельно от
этой design-иерархии всегда действуют safety, allowed-target, source integrity,
фактические и accessibility-инварианты.

## Design Jury

Design Jury запускается только после успешной механической финализации для
generation/image-to-screen/redesign.

Пять последовательных read-only ролей возвращают строгий JSON без tools:

| Роль                 |  Вес | Что проверяет                                                   |
| -------------------- | ---: | --------------------------------------------------------------- |
| Layout & Hierarchy   | 0.25 | Иерархию, группировку, плотность, alignment и основной workflow |
| Brief fit            | 0.25 | Полноту brief, бизнес-факты, состояния и reference fidelity     |
| Tokens & Consistency | 0.20 | Reuse components/tokens и согласованность с проектом            |
| Accessibility        | 0.15 | Семантику, labels, keyboard/focus, contrast risks и состояния   |
| Copy & Language      | 0.15 | Язык, терминологию, факты и ясность действий                    |

Composite считается по этим весам. Порог — `8.0/10`.

- `>= 8.0` — run остаётся `complete`;
- `< 8.0` — разрешена ровно одна bounded revision;
- после revision механические проверки выполняются заново;
- если второй composite всё ещё ниже 8.0, итог — `needs_review`, не `failed`;
- если Jury недоступно, механически валидный source сохраняется и получает
  `needs_review`;
- Stop во время Jury даёт `cancelled`.

Каждый раунд пишет receipt `jury_round` с per-role score, `mustFix`, evidence,
composite и usage.

Если run содержит structured Design brief, все Jury-роли получают его рядом с
user goal. Это позволяет `Brief fit` проверять не только свободный текст, но и
конкретные palette/layout/density/constraints.

### Critique policy

Skill задаёт `sd.critique.policy`:

- `required` — запускать всегда;
- `opt-in` — только при явном выборе;
- `opt-out` — запускать по умолчанию, но разрешить выключить.

Без поля действует `opt-in`. Сейчас `product-screen-generation` и
`screen-redesign` используют `opt-in`. В обычном UI явный выбор доступен в
`Add a screen` как `Run Design Jury`. Для произвольного redesign из composer
отдельного checkbox пока нет.

## Craft v2 и style contract

Craft layer расширяет механические и guidance-проверки темами:

- typography и color;
- anti-slop и state coverage;
- accessibility baseline;
- layout/spacing;
- laws of UX;
- form validation;
- data density;
- motion discipline.

Enforced-подмножество ловит машинно проверяемые проблемы. Остальные правила
дают агенту guidance и evidence для review.

Project style contract — project-owned девятисекционный `DESIGN.md`/`Design.md`:

1. Visual Theme & Atmosphere;
2. Color Palette & Roles;
3. Typography Rules;
4. Component Stylings;
5. Layout Principles;
6. Depth & Elevation;
7. Do's and Don'ts;
8. Responsive Behavior;
9. Agent Prompt Guide.

React и HTML-first indexer читают его как read-only source. Presets могут
развернуть контракт, tokens и базовые components для нового HTML-first
проекта. Scout сначала пишет отдельный proposal; production contract меняется
только после human Accept.

## Token usage в чате

Под завершённым ответом ассистента показывается стабильная строка:

```text
Total 1,240 · Input 1,010 · Output 230
```

Это usage конкретного assistant response/run, а не накопительный итог всего
чата. Для Jury его review/revision usage входит в финальные счётчики run.

- порядок всегда `Total · Input · Output`;
- `Total` вычисляется из Input + Output, когда обе части известны;
- неизвестное значение показывается как `—`, а не как `0`;
- usage сохраняется в transcript и manifest и переживает reload.

## Run artifacts и dataset

Каждый run получает отдельную папку:

```text
.sber-designer/runs/<run-id>/
  run-manifest.json
  timeline.jsonl
  receipts/
  handoff.md
  continuation-context.json
  source-preference-snapshot.json optional, hash и признаки source после run
  feedback.json                 optional, после Rate this run
  prompt-attachments/           optional
  external-runtime/             optional для CLI
  screenshots/                  optional evidence
```

Дополнительно на уровне проекта:

```text
.sber-designer/runs-dataset.jsonl
.sber-designer/preferences/events.jsonl
.sber-designer/preferences/preferences.md
```

### Что хранит dataset

На terminal finalization записывается одна строка на Run ID:

- status, route, provider, model и runtime kind;
- project/profile/screen;
- craft/render/readiness gates;
- component reuse;
- blocking craft count;
- final `jury_composite`;
- `token_usage.total/input/output/iterations`;
- feedback.

Повторная finalization не создаёт второй `run_id`. Сохранение оценки атомарно
обновляет `feedback` в существующей строке. Неизвестные значения — `null`, не
ложные нули.

## Feedback и project style memory

### Слои хранения

1. `.sber-designer/runs/<run-id>/feedback.json` — последняя оценка конкретного
   run.
2. `.sber-designer/runs/<run-id>/source-preference-snapshot.json` — hash и
   структурные признаки target source после успешного run. Исходный код и
   видимый текст в snapshot не копируются.
3. `.sber-designer/preferences/events.jsonl` — канонический append-only журнал
   явных оценок и доказуемых follow-up/revert сигналов.
4. `.sber-designer/preferences/preferences.md` — derived cache, который удобно
   читать, ревьюить и хранить в git.

Повторный `Save` без изменений не пишет новое событие. Смена 👍 на 👎 или
изменение причины пишет новое raw event; при derivation учитывается только
последнее событие каждого Run ID.

### Как строится Prefer/Avoid

- 👍 + непустая причина создаёт кандидат `Prefer`;
- 👎 + непустая причина создаёт кандидат `Avoid`;
- feedback без причины остаётся в raw log/dataset, но не создаёт расплывчатое
  style rule;
- причины нормализуются по регистру, пробелам и завершающей пунктуации;
- завершённый follow-up одного screen сравнивается с последним snapshot того
  же `screen_id` и target path;
- source diff сохраняет категории `colors`, `density`, `copy` или `other`, но
  автоматический текст правила сейчас создаётся только для однозначного
  направления density;
- уменьшение сопоставимых `padding`/`gap`/`height` значений даёт
  `Use denser screen layouts.`, увеличение —
  `Use more spacious screen layouts.`;
- точное возвращение к hash более раннего snapshot создаёт `source_revert` и
  исключает автоматическое правило отменённого run;
- одинаковая причина из разных ранов усиливает confidence;
- 1 signal — `low`, 2 — `medium`, 3 и больше — `high`;
- в prompt попадает максимум 8 наиболее сильных/свежих строк;
- чат не анализируется через NLP, скрытых выводов из переписки нет.

Пример:

```markdown
## Project style memory

### Prefer

- [medium · 2 signals] Keep compact table rows

### Avoid

- [low · 1 signal] Avoid oversized empty areas
```

Derived block ограничен маркерами
`sber-designer:project-style-memory:start/end`. Он перезаписывается при новой
derivation. Ручные правила нужно добавлять **вне этих маркеров**, например в
`## Manual preferences`; они сохраняются и тоже передаются агенту.

Память обновляется после Save feedback, после доказуемого follow-up/revert и
дополнительно проверяется перед поддерживаемым generation/redesign run.
Поэтому raw log остаётся источником правды, а derived cache может
восстановиться после сбоя. Текущий user request всегда имеет приоритет при
конфликте с памятью.

### Как определяется автоматический follow-up

Harness не читает формулировку чата и не пытается угадать намерение
пользователя. Сигнал записывается только когда одновременно выполнены условия:

1. run завершён как `complete` или `needs_review`;
2. это `screen-edit`/`screen-redesign` того же screen и того же source target;
3. предыдущий terminal run оставил source snapshot;
4. receipt текущего run доказывает запись именно этого target;
5. итоговый source hash изменился.

Snapshot содержит SHA-256, digest цветов и копирайта и числовую density
signature. Для Tailwind учитываются размерные классы вроде `p-6`, `gap-4` и
`h-12`; для CSS — числовые `padding`, `margin`, `gap`, `height` и
`line-height`. Направление считается уверенным, только если не меньше 60%
сопоставимых изменений идут в одну сторону и медианное изменение достаточно
велико. Неоднозначный diff остаётся raw evidence без Prefer/Avoid.

Повторная finalization одного Run ID не дублирует event. Failed/cancelled run,
изменение без receipt и ручное изменение файла вне agent run не обучают память.

### Как отключить память

1. Открыть `Settings`.
2. Перейти в раздел `Project`.
3. Выключить `Project style memory`.

Настройка сохраняется в
`.sber-designer/project.sdproj#agentMemory.styleMemoryEnabled` и применяется со
следующего run. API и CLI перестают добавлять `## Project style memory` в
generation/redesign/image-to-screen prompt. `events.jsonl`, `preferences.md` и
feedback/snapshots не удаляются и продолжают обновляться, поэтому включение
switch возвращает накопленную память без потери данных. Уже запущенный run
использует контекст, собранный на момент старта.

### Что пока не поддерживается

- изменения colors/copy фиксируются в raw event, но пока не превращаются в
  глобальное текстовое правило;
- ручные изменения source вне agent run не считаются preference signal;
- нет NLP mining чата;
- автоматическое обучение не доказывает визуальное улучшение — это проверяется
  eval/live сравнением.

## Eval loop

Для B4 есть отдельный CI-safe eval без модели и без dev-server:

```bash
bun run eval:style-memory
```

Он создаёт временный синтетический проект, проводит два baseline и два
density follow-up run через реальные manifests/receipts/finalization, затем
проверяет пять условий:

1. записаны ровно два `follow_up_edit` с категорией `density`;
2. выведено правило `[medium · 2 signals] Use denser screen layouts.`;
3. правило есть в API generation prompt;
4. правило есть в CLI generation handoff;
5. добавление памяти изменило CLI stable digest.

Результаты пишутся во временные `records.jsonl` и `scorecard.json`; команда
выводит их точные пути. `status: passed` доказывает прохождение всей цепочки до
контекста третьего run, но не качество экрана от конкретной модели.

Eval runner вызывает тот же `/api/chat/stream`, что UI, и поэтому проходит
permissions, finalization и Design Jury. Он записывает `records.jsonl` и
`scorecard.json`, включая reuse, craft, fidelity, Jury и token metrics.

Безопасный dry run:

```bash
bun run tests/eval/run-eval.ts --dry-run
```

Живой eval, который имеет право менять fixture workspace, требует явного
флага:

```bash
bun run tests/eval/run-eval.ts \
  --workspace /absolute/path/to/project \
  --model provider/model \
  --profile react-storybook \
  --approve-permissions
```

Без `--approve-permissions` permission на запись отклоняется, а eval cell
фиксируется как `failed`. Это защита от случайной пакетной мутации проекта.

### Release-gate для scorecard

После baseline и current eval сравниваются отдельной CI-safe командой:

```bash
bun run eval:release-gate \
  --baseline path/to/baseline/scorecard.json \
  --current path/to/current/scorecard.json \
  --output path/to/eval-diff
```

Команда создаёт два PR-ready файла: `eval-diff.json` для автоматики и
`eval-diff.md` с таблицей для review. Проверяются одинаковый состав матрицы,
отсутствие failed/planned cells и три метрики:

- `languageFactFidelityScore`: выше лучше, допустимое падение по умолчанию
  `0.02`;
- `componentReuseScore`: выше лучше, допустимое падение `0.05`;
- `craftBlockingCount`: ниже лучше, допустимый рост `0`.

Пороги меняются флагами `--max-fidelity-drop`, `--max-reuse-drop` и
`--max-craft-increase`. Их нужно менять явно в команде PR, а не скрыто в
scorecard.

У gate три исхода:

| Status       | Exit code | Значение                                                       |
| ------------ | --------- | -------------------------------------------------------------- |
| `passed`     | 0         | Матрицы сопоставимы, метрики в пределах порогов                |
| `regression` | 1         | Есть доказанное ухудшение хотя бы одной контролируемой метрики |
| `blocked`    | 2         | Матрица неполная/изменилась или нужная метрика равна `null`    |

`null` не заменяется нулём. Если fidelity/reuse/craft не измерены в одном из
scorecard, gate не может доказать отсутствие регресса и требует повторного
eval. Синтетический smoke для всех трёх исходов лежит в
`tests/fixtures/0114-eval-release-gate`.

### Baseline registry и PR workflow

GitHub Actions job `eval-release-gate` получает полный diff PR и читает
`tests/eval/baselines/manifest.json`. Каждая registry entry задаёт:

- `appliesTo` — точные prompt/skill/craft paths или каталоги с `/**`;
- `baselineScorecard` — принятый scorecard из `main`;
- `currentScorecard` — обязательный scorecard текущего PR;
- thresholds конкретного gate;
- `status`: `pending` или `active`.

Если protected paths не менялись, job завершается как `not_required`. Для
matched active entry запускается обычный scorecard comparator. Итоговый
`pr-eval-gate.md` попадает в GitHub job summary, а полный каталог отчётов
загружается как artifact даже при ошибке gate.

Active gate дополнительно требует, чтобы файл `currentScorecard` был изменён в
этом же PR. Уже лежащий в ветке старый candidate повторно использовать нельзя.
Baseline разрешён только под `tests/eval/baselines/`, candidate — только под
`tests/eval/candidates/`; один файл не может выполнять обе роли.

Текущий `screen-generation-main` намеренно имеет статус `pending`: реального
принятого baseline ещё нет. Поэтому PR, меняющий основной screen-generation
prompt, соответствующие skills или craft knowledge, получает `blocked`, пока
baseline не будет снят живой eval-матрицей. Синтетические fixtures нельзя
указывать как product baseline.

Активация entry:

1. На неизменённом `main` провести принятую eval-матрицу.
2. Добавить её scorecard в `tests/eval/baselines/<id>/<version>/scorecard.json`.
3. В registry указать этот путь и сменить `status` на `active`.
4. В PR положить новый scorecard по пути `currentScorecard`.
5. Приложить созданный CI `eval-diff.md` к review.

Локально тот же PR-контракт запускается так:

```bash
git diff --name-only <base-sha> <head-sha> > /tmp/pr-changed-files.txt
bun run eval:pr-gate \
  --changed-files /tmp/pr-changed-files.txt \
  --output /tmp/pr-eval-gate
```

## Live acceptance: закрытие core-матрицы

Episode 29 закрыл доступную live-матрицу на обоих project profiles и
трёх CLI runtime:

- Claude image generation и same-session follow-up используют честный
  `prompt_path_only`: attachment читается самим runtime, а повторный ход
  сохраняет session id и `resumeUsed=true`;
- failed-run recovery освобождает active run и позволяет сразу создать, открыть
  и удалить новый blank screen;
- wireframe option сохраняет обязательный `## Generation Mode` даже при 80KB
  cap, включает wireframe craft profile и не требует production-метрик;
- Claude, Codex и OpenCode подтверждают injected project MCP как
  `forwarded_verified`; Claude дополнительно вызвал read-only
  `get_project_index_status` и получил фактический component count;
- HTML-first empty-project flow создаёт static scaffold, а page можно rename и
  move без Storybook;
- `screen-redesign` меняет композицию существующего target, сохраняя факты,
  actions, states и routes, после чего проходит craft/Design checks.

Главная страница показывает этот статус в `Agent quality rollout`: core
live-матрицу, CLI MCP parity, текущий regression gate и отдельный статус
provider eval.

23 июля 2026 года внешний блокер снят без OpenRouter: финальная API-матрица
прошла через прямой `deepseek/deepseek-v4-pro` на обоих профилях. React-run
завершился `needs_review` после одной bounded Jury revision, HTML-run —
`complete` с Jury `8.0`. Machine receipts дали числовые release-gate метрики:
component reuse `1.0`, craft blocking `0`, Jury `brief_fit`/language-fact
fidelity `1.0`. `screen-generation-main` baseline v1 активирован, а локальный
PR comparator выдал `passed`.

Тот же проход закрыл B3–B5: style scout создал reviewable 9/9 proposal, Accept
заменил канонический HTML style contract и пересобрал индекс; два одинаковых
feedback-сигнала сформировали `[medium · 2 signals] Keep compact table rows`;
toggle отключал prompt block, не удаляя memory-файлы; dataset содержит больше
пяти уникальных run-id. Post-Accept runtime check сохранил native CSS graph:
канонический `design-system/components.css` импортирует исходный `ds.css`;
повторный индекс содержит 408 components, 800 tokens, quality 0.95 и ноль
diagnostics.

Финальный code gate после provider closure: `1839 pass / 1 skip / 0 fail`,
typecheck без новых ошибок и lint `0 errors / 26` прежних warnings.
Dual-profile parity закрыта по завершённому code/integrated-live scope; отдельные
owner-triggered ultra/security команды остаются повторяемой release assurance
и не выдаются за уже выполненный внешний аудит.

## Как разбирать проблемный run

1. Скопировать Run ID из блока `Agent run` в чате.
2. Открыть `run-manifest.json` и проверить status/summary/diagnostics.
3. В `timeline.jsonl` найти последнюю permission, tool result и terminal event.
4. В `receipts/` проверить target diff, craft, render и `jury_round`.
5. Сверить фактический файл с `changedFiles`.
6. Для CLI дополнительно открыть `external-runtime/` и attempt log.
7. Если source корректен, но preview не доказан, использовать
   `Re-run render proof`, а не повторять генерацию вслепую.

### Быстрая расшифровка симптомов

| Симптом                                 | Что это обычно значит                                                      |
| --------------------------------------- | -------------------------------------------------------------------------- |
| Файл есть после Stop                    | Stop пришёл после commit или запись сделал CLI                             |
| `needs_review`, screen открывается      | Source полезен, но один из quality/render/Jury checks не доказан           |
| `failed` + no target changes            | Runtime не изменил allowed target                                          |
| Jury score есть, status `needs_review`  | После одной revision composite остался ниже 8                              |
| Input/Output показывают `—`             | Runtime не вернул раздельный usage                                         |
| Feedback сохранён, memory не изменилась | Причина пустая или это не последнее событие Run ID                         |
| Manual rule исчез                       | Она была записана внутри managed markers; ручной текст должен быть снаружи |

## Карта кода

| Область                         | Основной код                                                      |
| ------------------------------- | ----------------------------------------------------------------- |
| API system prompt               | `services/api/src/prompt-builder.ts`                              |
| Design brief schema/prompt      | `services/api/src/generation-mode.ts`                             |
| Design brief shared contract    | `packages/shared-types/src/design-brief.ts`                       |
| Direction presets/payload       | `apps/web/src/lib/design-direction-picker.ts`                     |
| Direction chat card             | `apps/web/src/components/editor/chat/Transcript.tsx`              |
| CLI stable/task handoff         | `services/api/src/agent-runtimes/agent-kit-handoff.ts`            |
| Streaming orchestration         | `services/api/src/routes/chat-stream/index.ts`                    |
| Mechanical gates                | `services/api/src/routes/chat-stream/finalization-gates.ts`       |
| Design Jury runner              | `services/api/src/design-jury.ts`                                 |
| Jury finalization               | `services/api/src/routes/chat-stream/design-jury-finalization.ts` |
| Transactional API writes        | `services/api/src/agent/tool-mutation-transaction.ts`             |
| Run recorder                    | `services/api/src/agent/run-record/`                              |
| Dataset                         | `services/api/src/agent/run-record/dataset.ts`                    |
| Feedback raw signal             | `services/api/src/agent/run-record/feedback.ts`                   |
| Follow-up/revert raw signal     | `services/api/src/agent/run-record/preference-signals.ts`         |
| Preference derivation/injection | `services/api/src/project-preferences.ts`                         |
| Run feedback UI                 | `apps/web/src/components/editor/chat/RunFeedbackCard.tsx`         |
| Token footer                    | `apps/web/src/components/editor/chat/run-metadata.tsx`            |
| New screen options              | `apps/web/src/components/editor/screens/NewScreenDialog.tsx`      |
| Eval runner                     | `tests/eval/run-eval.ts`                                          |
| B4 deterministic eval           | `tests/eval/run-style-memory-eval.ts`                             |
| Eval release gate               | `tests/eval/run-release-gate.ts`                                  |
| PR eval gate + registry         | `tests/eval/run-pr-release-gate.ts`                               |

## Связанные документы

- [Agent system](./agent-system.md) — agent kit, tools и runtime architecture.
- [Dual-profile harness](./dual-profile-harness.md) — React/Storybook и
  HTML-first профили.
- [Run records and diagnostics](./run-records-and-diagnostics.md) — forensic
  evidence и recovery.
- [Assistant panel and tasks](./assistant-panel-and-tasks.md) — sessions и UX
  чата.
- [LLM providers and runtimes](./llm-providers-and-runtimes.md) — provider/CLI
  configuration и capabilities.
- Ручная приёмка новых harness-веток проводится отдельными live-прогонами
  после deterministic tests.

- [OpenAI Agents SDK: Human-in-the-loop](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/) — reference-паттерн persisted interruption и resume исходного run state.
