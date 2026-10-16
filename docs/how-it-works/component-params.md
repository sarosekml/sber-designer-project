---
updated: 2026-07-24T16:18:53+0300
---

# Component params

## Назначение

Вкладка **Component** в Design mode показывает объявленные параметры
выбранного библиотечного компонента и сразу записывает изменения в JSX usage
активного screen. Это похоже на Storybook Controls, но source of truth —
реальный screen file, а не временные story args.

## Component и Options — разные поверхности

| Вкладка   | Что знает                                                                   | Как применяет                                            |
| --------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| Component | Полную статическую схему компонента: допустимые props/options/default hints | Сразу пишет безопасный literal/remove op в screen source |
| Options   | Уже присутствующие props/attributes выбранного JSX/DOM target               | Использует обычный Design draft/apply                    |
| Style     | CSS/style capabilities выбранного target                                    | Preview, затем Apply                                     |

Component не редактирует исходник библиотечного компонента и не заменяет
Options для произвольных DOM attributes.

## Пользовательский путь

1. Открыть React screen в режиме **Screen**.
2. Переключиться в **Design**.
3. Кликнуть по usage библиотечного компонента, включая его внутренний DOM.
4. Открыть вкладку **Component**. Badge показывает число доступных параметров.
5. Изменить enum, boolean, string или number.
6. Дождаться HMR: canvas и source обновятся без отдельной кнопки Apply.
7. Использовать reset, чтобы удалить optional prop и вернуться к default
   компонента.

Storybook полезен для enrichment, но не обязателен. Основной сценарий работает
на active screen и в static React catalog.

## Как selection становится component instance

DOM target часто находится внутри реализации библиотеки:

```text
screen <Button>
  → Button.tsx
    → <MuiButton>
      → DOM <button>
```

Редактировать `<MuiButton>` в `Button.tsx` опасно — это изменит все usages.
Backend использует fiber/source hints и `componentPath`, чтобы найти границу
компонента, затем восстанавливает usage-site `<Button …>` в файле active
screen.

`DesignInspectResult.componentInstance` содержит:

- component identity;
- usage `filePath` и source location;
- editable state/reason;
- фактические JSX props;
- извлечённую param schema;
- source baseline hash.

Target считается прямым instance только если лежит в editable screen file.
Shared composite или библиотечный source получает `editable: false`.

`@sber-designer/babel-plugin-sd-loc` не обязателен. Он остаётся fallback для
проектов, где selection не содержит и не позволяет восстановить source
location.

## Извлечение схемы

Схема считается детерминированно во время inspect и не требует LLM. Приоритет:

1. TS props/interface/type или inline parameter annotation;
2. literal unions и primitive `boolean`/`number`/`string`;
3. `cva()` variants, связанные через `VariantProps<typeof …>`;
4. colocated Storybook `argTypes`/`args` для options, description, display
   label и default hint;
5. `descriptionLayer.variantGuidance` для смысла enum values.

Поддерживаются ограниченные безопасные разрешения:

- imported union aliases;
- один hop через barrel re-export;
- составные finite literal unions;
- `keyof typeof` object maps;
- максимум 300 enum values.

Последний случай позволяет показать, например, конечный список имён иконок, не
превращая произвольный runtime object в control.

Функции, callback props, произвольные объекты и широкие ReactNode без явного
Storybook text control не становятся редактируемыми controls.

## Controls и значения

| Schema/control            | UI                                      | Source operation                   |
| ------------------------- | --------------------------------------- | ---------------------------------- |
| enum                      | segment для короткого списка или select | `set-prop` string literal          |
| boolean                   | switch                                  | `set-prop` boolean / `remove-prop` |
| number                    | number input                            | `set-prop` finite number           |
| string                    | text input                              | `set-prop` string literal          |
| Storybook text `children` | text input с display label              | `set-children-text`                |

Текущее значение всегда читается из фактического JSX usage. Default из типа,
деструктуризации или story показывается как hint и не материализуется в коде.

Поведение специальных случаев:

- optional prop reset → `remove-prop`;
- required prop → reset недоступен;
- boolean без literal → показывается effective default;
- expression (`value={state}`) → read-only с переходом в Assistant;
- spread → предупреждение, потому что он может переопределить literal;
- неизвестный написанный prop → `Other props from code` и переход в Options;
- component без схемы → честный `No editable params detected`.

Storybook display label не меняет имя prop. Например `children` может
отображаться как `label`, но source operation остаётся `set-children-text`.
Self-closing JSX при необходимости безопасно разворачивается.

## Instant apply

Component controls не используют общий draft footer. Prop влияет на результат
только после React re-render, поэтому source write и является preview:

```text
control change
  → optimistic local value
  → per-usage apply queue
  → POST /api/design/apply
  → AST op in screen source
  → new baseline hash + visual diff
  → HMR
  → fresh inspect
```

Enum/boolean уходят сразу. String/number держат local draft и применяются после
debounce/blur. Пустое или неfinite промежуточное число файл не меняет.

`set-prop` меняет существующий JSX attribute на месте и не переставляет его в
конец opening element, поэтому diff остаётся точечным.

## Queue и conflict safety

Очередь изолирована контекстом:

```text
workspace + target + usage file/location + prop
```

Она:

- сериализует writes одного usage;
- коалесит быстрые изменения только одного prop в том же контексте;
- не переносит write на новый selection/workspace;
- продолжает независимые контексты после локальной ошибки;
- использует baseline из inspect для первого batch;
- цепляет hash ответа как baseline следующего batch.

Параллельная внешняя/agent правка вызывает 409, а не перезаписывается. Active
agent run, который владеет тем же screen/file, также блокирует manual apply.
После ошибки optimistic control откатывается и показывает причину.

Stale reload guard не позволяет медленному inspect старого selection
перезаписать новую вкладку.

## Persistence и diagnostics

Param schema не хранится отдельным stale artifact в
`.sber-designer/design-index`: она вычисляется из текущего component source и
colocated story во время inspect. Component source cache ключуется content
hash, поэтому same-length edit тоже инвалидирует результат.

Каждая успешная правка:

- изменяет project source file;
- появляется в patch-store/Code diff;
- пишет backend audit;
- обновляет baseline.

Agent run и receipt не создаются: Component apply не вызывает LLM. Git остаётся
источником истории.

## Профили и границы

Поддерживаются:

- React со Storybook catalog;
- React со static catalog без Storybook.

HTML-first в эту вкладку не входит: CSS components используют classes/modifiers, а не
TS props. Также не выполняются молчаливые shared-component edits, runtime
expression rewrites и произвольные object/function controls.

Если source location невосстановима, вкладка не угадывает файл и предлагает
Options/Assistant fallback.

## Карта кода

| Область                 | Файл                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| Shared schema           | `packages/shared-types/src/component-params.ts`                   |
| TS/Storybook extraction | `packages/design-indexer/src/component-params.ts`                 |
| Import/type resolution  | `packages/design-indexer/src/props-source.ts`                     |
| Instance resolution     | `services/api/src/design-inspector-component.ts`                  |
| Inspect transport       | `packages/shared-types/src/design-mode.ts`                        |
| Tab view model          | `apps/web/src/lib/component-params.ts`                            |
| Apply queue             | `apps/web/src/lib/component-param-queue.ts`                       |
| UI                      | `apps/web/src/components/editor/design-panel/ComponentTab.tsx`    |
| Store/apply integration | `apps/web/src/stores/design-store.ts`                             |
| JSX operations          | `packages/ast-bridge/src/ops/set-prop.ts`, `set-children-text.ts` |

## Проверки

Автоматический контур покрывает:

- TS primitives/unions/imported aliases/barrels;
- CVA и scoped Storybook enrichment;
- `children`/display label и large finite enum;
- component instance recovery;
- strict selection normalization;
- literal/reset/children AST ops;
- queue isolation, coalescing, baseline chaining и failure isolation;
- active-run/baseline conflicts;
- content-hash cache invalidation.

Целевой Screen-mode browser smoke подтверждает selection библиотечного
компонента, schema controls и read-only inspect без обязательного
`data-sd-loc`.
