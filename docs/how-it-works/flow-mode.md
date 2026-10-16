---
updated: 2026-07-24T16:15:14+0300
---

# Flow mode

## Назначение

Flow mode - top-level view для карты экранов и переходов. Он помогает видеть
структуру сценария продукта, связывать screens и запускать demo.

Кодовые точки:

- `apps/web/src/components/editor/FlowCanvas.tsx`;
- `apps/web/src/components/editor/FlowToolbar.tsx`;
- `apps/web/src/components/editor/TransitionsPanel.tsx`;
- `apps/web/src/components/editor/DemoCanvas.tsx`;
- `packages/shared-types/src/index.ts` для `ProjectFlowEdge` и
  `ProjectFlowViewSettings`.

## Данные

Flow хранится в `.sdproj`:

```text
project.flow[]
project.flowView
project.screens[].position
project.screens[].description
```

`ProjectFlowEdge` описывает переход между screens. `position` хранит положение
node на карте. `description` экрана используется как заметки/контекст.

## Top-level view

В `EditorShell` Flow - отдельный view рядом с Edit и Demo. Layout:

```text
TopBar
ScreensPanel
TransitionsPanel
FlowCanvas
StatusBar
```

ScreensPanel в этом view не только выбирает screen, но и показывает visibility
controls для карты.

## Nodes

Каждый registered screen становится node. Node может показывать:

- name;
- folder;
- health;
- compact or framed preview;
- cached screenshot;
- hidden state.

Позиции сохраняются в `.sdproj`, чтобы команда видела ту же карту после reopen.

## Edges

Edges описывают переходы:

- source screen;
- target screen;
- trigger;
- optional presentation `navigate | overlay`;
- optional label/metadata;
- hidden in Flow view.

Triggers используются Interact/Demo runtime. Скрытие edge в Flow view не должно
удалять transition из runtime graph, если это только настройка видимости карты.

### Modal targets и presentation

Если `presentation` отсутствует, runtime вычисляет default по target surface:

```text
modal → overlay
page  → navigate
```

Transitions panel и edge dialog показывают effective mode. Явно выбранное
значение сохраняется даже когда совпадает с текущим default, поэтому conversion
target page↔modal не меняет намерение пользователя.

Modal overlay — прозрачный full-viewport iframe поверх live underlay. Cancel
назад в текущий underlay закрывает overlay, переход в другую page закрывает и
навигает, а переход в другую modal заменяет overlay без стека. Bridge передаёт
`toScreenId`/underlay preference, поэтому reused modal выбирает правильное
Cancel-ребро. Подробно: [Modal screens](./modal-screens.md).

## HTML-first prototype wiring

Для HTML-first проектов прототип состоит из двух синхронных слоёв:

- настоящая навигация в разметке, например `<a href="./checkout.html">`;
- зеркальное flow-ребро в `.sdproj` с trigger `kind: "link"` и href до той же
  страницы, например `pages/checkout.html`.

Такой контракт нужен, чтобы static preview оставался кликабельным без
sber-designer, а Demo/Interact могли проигрывать тот же сценарий по flow graph.
В голом browser/static preview работает первый слой (`<a href>`); в Demo
sber-designer дополнительно использует flow edge, чтобы подсвечивать сценарий,
держать карту переходов и не зависеть от конкретного DOM-текста ссылки.

Runtime нормализует HTML-ссылки перед матчингом: `pages/checkout.html`,
`./checkout.html`, `/pages/checkout.html` и абсолютный preview URL считаются
одним переходом, если указывают на тот же `.html` target. Пустой href не
матчится ни с одним edge.

Агент должен добавлять real `<a href>` первым, затем зеркалировать переход через
`flow_add_edge`. Для React/Storybook экранов real link не обязателен: flow-рёбра
могут описывать click/link/on-mount переходы поверх уже существующих screens.

Если пользователь просит «wire pages into a prototype» в HTML-first проекте,
роль `ai-product-designer` или `ai-screen-architect` должна использовать
`prototype-wiring` skill: подтвердить сценарий, изменить только участвующие
page-файлы, добавить mirror edges, затем отчитаться количеством страниц и рёбер.

## Transitions panel

TransitionsPanel показывает переходы выбранного screen и заметки:

- outgoing edges;
- trigger metadata;
- hide/unhide in flow;
- screen notes.

Notes хранятся в `ProjectScreen.description` и могут быть полезны агенту как
экранный контекст.

## Flow toolbar

FlowToolbar управляет отображением:

- compact/frames previews;
- connections visibility;
- notes visibility;
- refresh previews.

Это view preferences, а не изменение source files.

## Previews

FlowCanvas умеет показывать cached/live previews. Capture идет через backend
flow-preview pipeline. Если preview недоступен, node должен показывать
диагностируемое состояние, а не пустую белую область без объяснения.

## Demo

Demo view использует flow graph для презентационного прохождения. В отличие от
Flow view, он фокусируется на результате сценария, а не на редактировании карты.
Modal overlay использует ту же state machine и lifecycle, что Interact canvas и
Share; внешняя смена base screen закрывает stale overlay.

## Агент и Flow

Агент может читать flow context и создавать/менять transitions через
разрешенные tools. При генерации screen flow данные помогают понять место
экрана в продукте, но агент не должен менять flow без явной задачи или
очевидного требования сценария.
