---
updated: 2026-07-24T16:15:46+0300
---

# Design mode

> Эта страница описывает canvas-режим визуального редактирования. Chat session
> mode **Design** управляет генерацией и toolset ассистента и описан отдельно в
> [Chat mode: Design](./chat-mode-design.md).

## Назначение

Design mode позволяет выбрать элемент на живом screen и применить визуальные
изменения к исходнику проекта. Это мост между DOM и JSX/source.

Кодовые точки:

- `apps/web/src/components/editor/CanvasFrame.tsx`;
- `apps/web/src/components/editor/VisualDesignPanel.tsx`;
- `apps/web/src/lib/design-capabilities.ts`;
- `services/api/src/routes/design.ts`;
- `services/api/src/design-inspector.ts`;
- `services/api/src/design-apply.ts`;
- `services/api/src/design-screen-compatibility.ts`.

## Selection

Есть два уровня selection.

### Baseline selection

Работает почти в любом проекте. sber-designer получает из iframe:

- tag name;
- text;
- attributes;
- DOM path;
- bounds;
- screen context;
- возможный source hint.

Даже без точного source mapping это полезный task context для агента.

### Design-readable selection

Лучший режим для generated/repaired screens. Source достаточно структурирован,
чтобы backend мог понять editable location и доступные изменения.

Design-readable screen обычно имеет:

- отдельный implementation file;
- тонкий Storybook wrapper;
- JSX вместо raw HTML string;
- stable root `[data-sd-screen-root]`;
- project components/tokens/icons;
- валидные imports.

Web хранит и отправляет минимальный `DesignSelection`. Результат inspect —
обогащённый `DesignTarget` с `id/filePath/line/column`; эти служебные поля
нельзя без фильтрации отправлять обратно в strict inspect endpoint. Граница
нормализуется через `toDesignSelection()` и при source-recovery, и перед
запросом.

## Inspect API

`/api/design/inspect` принимает selection context и возвращает:

- resolved source location;
- editable kind;
- text/style/layout capabilities;
- component/path information;
- layer tree fragments;
- current values;
- reasons, если edit locked.

Если target нельзя безопасно менять, панель должна показать причину, а не
делать guess-edit.

## VisualDesignPanel

Панель Design mode разделена на вкладки:

- `Inspect` - свойства выбранного элемента;
- `Component` - объявленные параметры компонента (см. ниже);
- `Options` - component/variant-like controls, если доступны;
- `Style` - визуальные правки;
- `Insert` - добавление элементов по разрешенным правилам;
- `Layers` - дерево слоев/DOM/source.

Панель также показывает draft changes footer, preview/reset и apply controls.
Исключения — `Inspect` (правит live styles) и `Component` (пишет каждый
параметр сразу в исходник).

## Component tab: параметры компонента

Вкладка отвечает на вопрос «какие параметры есть у этого компонента и какие
значения допустимы», в отличие от `Options`, который правит уже написанные
атрибуты.

Каноническое сквозное описание selection → schema → instant apply находится в
[Component params](./component-params.md). Ниже — детали в контексте общей
Design panel.

**Инстанс, а не элемент.** Клик по библиотечному компоненту резолвится в его
собственный исходник (часто это тоже компонентный тег, например `<MuiButton>`
внутри `Button.tsx`). Редактировать там нельзя — правка утечёт во все экраны.
Поэтому `inspect` дополнительно возвращает `componentInstance`: usage-site
`<Button …>` в файле редактируемого экрана, взятый из fiber-границы
(`componentLoc`). Выбранный элемент считается инстансом только если он сам
лежит в файле активного экрана (`design-inspector-component.ts`).

**Схема параметров** извлекается детерминированно, без LLM
(`packages/design-indexer/src/component-params.ts`), в порядке приоритета:

1. TS-пропсы компонента (`*Props`, включая inline-аннотацию сигнатуры) —
   литеральные юнионы → `enum`, плюс `boolean` / `number` / `string`;
2. `cva()` variant maps — для shadcn-подобных компонентов, где опции лежат в
   класс-карте, а проп типизирован как `VariantProps<…>`;
3. Storybook `argTypes` / `args` — заполняют пробелы (опции, описание,
   display name и подсказка дефолта); text-control может сделать редактируемым
   `children`, который в TS объявлен широким `ReactNode`.

Общие union-алиасы (`size?: ButtonSize` из `@/types`) читаются через
ограниченное следование за импортами и одним hop за barrel-ре-экспортом
(`props-source.ts`). Составные literal aliases и конечные
`keyof typeof objectMap` также разворачиваются с бюджетом до 300 значений —
так `startIcon`/`endIcon` получают список имён из icon map. Смыслы значений enum берутся из
`descriptionLayer.variantGuidance` каталога. Функциональные пропсы,
ReactNode и объекты без явного статического Storybook control в контролы не
попадают.

**Запись — сразу, без draft-футера.** Правка пропса не видна DOM-мутацией
(компоненту нужно перерендериться из исходника), поэтому запись файла и есть
превью. Каждое переключение уходит существующими op `set-prop` / `remove-prop`
(сброс к дефолту = удаление пропа, дефолты в код не пишутся). Правки
коалесятся только внутри точного usage-контекста
`workspace + target + file/loc + prop` и уходят последовательными батчами.
Первый batch использует baseline из inspect, backend возвращает новый hash
для следующего; внешняя правка или активный agent run того же screen/file
даёт 409. После очереди панель переспрашивает `inspect`, причём stale reload
не может перезаписать новый selection. `set-prop` обновляет атрибут на месте,
сохраняя порядок — правка читается как одно-токенный diff.

Text/number держат локальный draft и применяются после debounce/blur;
невалидное промежуточное число файл не меняет. Boolean показывает
эффективный default, а required prop нельзя удалить reset-кнопкой. Visual
edit фиксируется в patch-store/Code diff и server audit; agent-run receipt не
создаётся, потому что LLM run не запускается.

Storybook display name используется только как UI label: например,
`children` может отображаться как `label`. Такой control пишет текст через
`set-children-text`; self-closing usage при необходимости безопасно
разворачивается в opening/closing JSX.

`@sber-designer/babel-plugin-sd-loc` не является обязательным для Screen mode.
Если клик уже связан с active screen или usage-site восстанавливается по
`componentLoc` и исходнику экрана, Component tab работает без дополнительной
инструментации. `data-sd-loc` нужен только как fallback в проектных
конфигурациях, где selection не содержит никакой восстанавливаемой source
location.

Границы: usage вне активного экрана помечается `editable: false` с причиной
(общий композит), expression-пропсы (`value={state}`) — read-only с переходом
в чат, spread на usage — предупреждение без блокировки контролов.

## Capabilities

`design-capabilities` описывает, что можно менять для выбранного target:

- text content;
- spacing;
- size;
- typography;
- colors;
- border/radius;
- visibility;
- component props;
- insertion points.

Capabilities важнее желания UI. Если source mapping слабый, UI должен
ограничить действия.

## Apply

`/api/design/apply` применяет `VisualChange[]` к source. После сохранения:

1. backend валидирует target file scope;
2. source/import health проверяет очевидные ошибки;
3. canvas reload получает новый key;
4. patch-store/diff становится доступен Code mode;
5. screen health обновляется при необходимости.

## Live preview vs saved edit

Design mode может показывать live inspect preview для hover/selection/draft, но
источник правды меняется только после apply/save. Preview state не должен
попадать в `.sdproj` как проектное изменение.

## Selection context для агента

Когда пользователь выделил элемент и пишет в Assistant, selection передается в
prompt:

- DOM data;
- source location;
- component path;
- visible text;
- selector/bounds;
- design-source hints.

Агент должен менять только allowed screen targets и не использовать selection
как разрешение на unrelated files.

## Ограничения

- Design mode не должен переписывать весь screen, если пользователь меняет
  один style/text.
- Нельзя применять raw HTML from attachment в visible UI.
- Нельзя полагаться на проектно-специфичные names в product code.
- Если изменения касаются общего компонента, пользователь должен явно выбрать
  component-level работу или Storybook mode.

## Секция Modal

Когда активный экран — модалка (`surface: 'modal'`), правая панель Design-режима
показывает закреплённую **screen-level секцию `Modal`** (видна без выбора
элемента). Это отдельный от selection managed-target: контролы `Width` /
`Height` / `Long content` читают текущие значения из live DOM элемента
`data-sd-modal-window`, превьюят правку inline (custom properties
`--sd-modal-width`/`--sd-modal-height` + атрибут `data-sd-modal-content`) и по
`Apply` пишут детерминированно через `POST /api/design/modal-size` — HTML
патчится bounded start-tag rewriter (`modal-size-rewrite.ts`), JSX/TSX — обычными
`set-style-prop`/`set-prop` op-ами по маркеру (ast-bridge unwrap-ит
`as React.CSSProperties`). Diff — одна-две строки, без LLM; selection-draft
внутреннего элемента при этом не теряется. Если маркера нет — `Unmanaged size`;
если их несколько — `Ambiguous contract`.

Live read/preview/reset выполняются через iframe modal bridge, а не прямое
чтение `contentDocument`, поэтому секция работает в штатном split-origin
preview. Apply сначала читает source baseline, отправляет его вместе с patch,
получает честный 409 при параллельной правке и регистрирует возвращённый diff в
patch-store.

Полное описание managed contract, standalone canvas и overlay:
[Modal screens](./modal-screens.md).
