---
updated: 2026-07-24T23:16:11Z
---

# Generation pipeline: глобальные defaults и настройки одного run

## Где настраивать

`Settings → System → Harness setup` — единое место для глобальных
defaults пользовательского agent harness. Они сохраняются в user settings
sber-designer и применяются во всех проектах, которые открывает этот
пользователь. В `.sdproj` новые значения не записываются и в Git проекта не
попадают.

Физическое хранение — `~/.sber-designer/users/local/settings.json` в local
mode и `<SBER_DESIGNER_USERS_ROOT>/<user>/settings.json` в server mode. Это
внутренняя persistence-деталь: менять параметры нужно через UI, не вручную в
JSON.

В `Add a screen` есть блок `Harness`. При каждом открытии модалки он наследует
global defaults. Иконка вопроса рядом с заголовком объясняет, что checkbox-ы
относятся только к текущему run и не меняют глобальные настройки в
`Settings → Harness setup`.

## Какие параметры поддерживаются

| Настройка                 | Scope       | Поведение                                                                 |
| ------------------------- | ----------- | ------------------------------------------------------------------------- |
| Choose a design direction | New screens | До generation показывает три clickable-направления и ждёт выбор карточки. |
| Start with wireframe      | New screens | Сначала просит greybox-структуру, затем visual polish.                    |
| Run Design Jury           | Screen runs | Пять reviewers оценивают результат и разрешают одну focused revision.     |
| Screen readiness checks   | Screen runs | После edits запускает deterministic DoR и возвращает findings агенту.     |

Direction и wireframe применяются к созданию нового screen. Jury default также
добавляется к обычному пользовательскому Act-запросу на screen, поэтому экран,
созданный пустым и заполненный позже через Assistant, не теряет глобальный
review. Plan/Auto, quick replies и continuation не получают новый Jury только
из-за default.

Пустая инструкция в `Add a screen` по-прежнему создаёт только editable shell и
не запускает Assistant: pipeline options не являются самостоятельным prompt.

Для modal creation UI передаёт вместе с Harness options структурированный
target:

```text
surface = modal
modal.width / modal.height / modal.longContent
```

Эти поля сохраняются и в direct generation, и в pending direction-picker run.
Structure plan выбирает `Modal header / Modal body / Modal footer actions`, а
prompt запрещает превращать target в full-screen page или терять managed modal
contract. Подробнее: [Modal screens](./modal-screens.md).

## Приоритет настроек

```text
per-run checkbox в Add a screen
  → user-wide Harness setup settings
  → legacy agent.directionPicker в sber-designer.json
  → build-first defaults (всё optional выключено, DoR Standard включён)
```

JSON-флаг `agent.directionPicker` оставлен только для обратной совместимости со
старыми установками. Как только пользователь сохраняет global defaults через
UI, они имеют приоритет и редактировать JSON не требуется.

Persisted shape:

```json
{
  "generationPipeline": {
    "generationDefaults": {
      "directionPicker": true,
      "wireframe": false,
      "designJury": true
    },
    "screenReadiness": {
      "enabled": true,
      "profile": "standard",
      "categories": {}
    }
  }
}
```

## Быстрый сценарий без вопросов

В `Settings → Harness setup`:

1. Выключить `Choose a design direction`.
2. Выключить `Start with wireframe`.
3. Включить `Run Design Jury`, если нужен subjective review и одна ревизия.
4. Оставить `Screen readiness checks` на `Standard`.

Получится:

```text
prompt → generation → deterministic DoR → optional Jury/revision → runtime proof → result
```

Post-checks не добавляют пользовательский вопрос. Подробное описание их
категорий находится в
[Post-checks и Screen readiness DoR](screen-readiness-post-checks.md).

Если agent tool один раз ошибся, но retry сохранил target и все механические
checks прошли, run продолжает pipeline и может запустить Jury; ошибка остаётся
в diagnostics. Если source сохранён, но craft оставил blocking finding, итог —
`NEEDS REVIEW` с причиной ремонта, не generic red `Agent run failed`.

Hard constraint, запрещающий использовать существующие screens/pages как
референсы, также сокращает generation context: убираются nearby-screen советы,
screen-mined snippets и import conventions. Component source и Storybook
examples остаются доступны только для проверки API и imports.

Общая иерархия design-требований действует для всех generation runs:

```text
явная инструкция пользователя для текущего run
  → явные поля Design brief / выбранное direction / template / per-run options
  → совместимые project components, tokens, templates и style memory
  → общие советы и defaults харнесса
```

Если нижний уровень противоречит верхнему, он отбрасывается. Поэтому общий
совет `посмотри соседние экраны` не может переопределить пользовательское `не
используй текущие экраны проекта`. Safety, allowed-target, source integrity,
фактические и accessibility-инварианты остаются обязательными независимо от
этой design-иерархии.

## Post-run project cover

После успешного screen run UI выполняет отдельный best-effort side effect:
снимает target screen из run binding и обновляет project cover. Это происходит
после успешного, не cancelled `done` в SSE и после поддерживаемого
non-truncated one-shot ответа. Failed, cancelled, truncated или не привязанный
к screen run capture не запускает.

```text
successful run
  → binding.screenId
  → offscreen iframe
  → snapshot bridge (Annotate-слой)
  → resize 640×360 WebP
  → PUT /api/projects/:id/cover
```

Snapshot программный: LLM и server-side Chrome в нём не участвуют. Ошибка
capture не меняет run status, transcript, receipts или screen health. Очередь
выполняет один capture за раз и сохраняет только самый новый pending target.
Если **Set as thumbnail** закрепил другой screen, чужой run cover не
перезаписывает; run закреплённого screen обновляет его. General preference
**Generative thumbnail** отключает этот side effect для текущего пользователя;
значение хранится в его server-side settings и следует за профилем между
сессиями.

Полный контракт приоритета, pin, persistence и API:
[Project covers](./project-covers.md).

## UX-основание

Build-first остаётся default: дополнительные паузы opt-in, а user-wide
agent/validation preferences доступны в Settings. Это соответствует модели
[Builder Fusion Chat](https://www.builder.io/c/docs/fusion-chat), где Build
запускает реализацию сразу, и
[Project settings](https://www.builder.io/c/docs/fusion-project-settings), где
Agent tab содержит постоянные validation/browser automation параметры.
