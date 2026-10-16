---
updated: 2026-07-24T16:15:46+0300
---

# Screen templates

## Назначение

Screen templates задают повторяемые layout recipes для новых экранов. Они
помогают агенту и пользователю выбирать форму экрана до генерации: list-table,
dashboard, detail, form, settings и другие.

Template - это не готовый React component и не Storybook story. Это markdown
recipe with constraints, который говорит, какую композицию и качество ожидать.

## Источники templates

Есть два источника:

```text
product built-in:
packages/agent-kit/kit/screen-templates/*.screen.md

project-authored:
<workspace>/.sber-designer/screen-templates/*.screen.md
```

Старый flat path:

```text
<workspace>/.sber-designer/templates/*.md
```

считается superseded. Новые реализации должны использовать
`.sber-designer/screen-templates`.

## Built-in templates

Default kit содержит:

- `list-table.screen.md`;
- `dashboard.screen.md`;
- `detail.screen.md`;
- `form.screen.md`;
- `settings.screen.md`;
- `modal-form.screen.md`;
- `modal-confirm.screen.md`;
- `TEMPLATE.screen.md` как формат.

Они живут в `packages/agent-kit/kit/screen-templates`, потому что это часть
product agent kit. Они не являются
инструкциями внешнему coding agent.

## Project templates

Проект может добавить свои templates в:

```text
.sber-designer/screen-templates/
```

Это project-owned state. Команда может закоммитить такие templates, чтобы
экранные recipes были одинаковыми у всех участников.

Project templates должны быть универсальными для проекта:

- роль экрана;
- композиция;
- preferred components;
- forbidden patterns;
- fidelity requirements;
- empty/loading/error states;
- accessibility expectations.

В них не нужно писать текущую user task. Task живет в Assistant request.

Template может явно задать surface и managed modal defaults:

```yaml
surface: modal
kind: form
modalDefaults:
  width: 640px
  height: 480px
  longContent: scroll
```

`surface` и `kind` — разные оси: modal-form остаётся `kind: form`, а
modal-confirm может быть `kind: custom`. `modalDefaults` допустимы только для
`surface: modal`; parser валидирует размерную грамматику и выдаёт warning с
безопасным fallback при ошибке.

## New screen dialog

При создании blank screen пользователь может выбрать template. Выбранный
template сохраняется в `ProjectScreen.template` и передается агенту, если
пользователь сразу запускает generation instruction.

Переключатель **Screen | Modal** фильтрует несовместимые templates. Для modal
template значения `Width`/`Height`/`Long content` становятся defaults;
`longContent` наследуется до первого ручного изменения control.

Template selection не заменяет folder selection. Это разные измерения:

- folder отвечает, где screen лежит в Screens panel/source path;
- template отвечает, какую форму UI построить.

## Agent tools and prompt

Агент получает templates через tools/context:

- list available templates;
- read selected template;
- include selected template in screen generation contract.

Агент должен использовать template как skeleton/fidelity guide, но конкретные
components, tokens, icons and examples брать из project index, catalog and source
inspection.

## Storybook template stories

Storybook stories могут быть concrete starting points. Это не то же самое, что
screen templates:

- Storybook story - runnable component example;
- screen template - markdown recipe для generation.

New screen flow может позволять pin/copy Storybook story, но это отдельный
сценарий от выбора `.screen.md` recipe.

## Fidelity

Template должен помогать избегать generic UI:

- list-table требует реальный table/list pattern проекта;
- dashboard требует useful metrics/sections, а не decorative cards;
- form требует labels, validation/error states and submit actions;
- detail требует hierarchy, status and related data;
- settings требует grouped controls and save/reset behavior.

Если template требует компонентной семьи, которой нет в проектном индексе,
агент должен явно сказать, какой fallback использовал, и пометить результат как
`needs_review` при слабом evidence.

## Обновление templates

При изменении built-in templates нужно обновлять:

- `packages/agent-kit/kit/screen-templates/*`;
- `docs/how-it-works/screen-templates.md`;
- `product-screen-generation` skill, если меняется workflow.

При изменении project templates достаточно менять files внутри подключенного
project workspace.

Подробно о modal scaffold и generation contract:
[Modal screens](./modal-screens.md).
