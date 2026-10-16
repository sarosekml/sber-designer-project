---
updated: 2026-07-24T16:18:53+0300
---

# Modal screens

## Модель

Модалка — не отдельная сущность. Это обычный `ProjectScreen` с опциональным
project-owned полем:

```ts
surface?: 'page' | 'modal';
```

Отсутствующее поле означает `page`. Canonical writer сохраняет только
`surface: 'modal'`, а явный `page` удаляет, поэтому старые `.sdproj` и читатели
остаются совместимыми.

Один и тот же screen pipeline используется для:

- регистрации и папок;
- React/Storybook и HTML-first source;
- Assistant sessions и generation info;
- templates, duplication и conversion;
- Flow, Demo и Share;
- Design/Code edits;
- readiness/craft validation.

## Что видит пользователь

### Создание

В **Add a screen** переключатель **Screen | Modal** определяет target surface.
Для Modal доступны:

- совместимые modal templates;
- `Width`;
- `Height`;
- `Long content: Scroll body | Grow modal`;
- обычные folder, instruction и Harness options.

Blank creation сразу создаёт managed modal scaffold. Если instruction пустая,
Assistant не запускается; пользователь получает редактируемый shell.

### Отдельно открытая модалка

Когда modal screen является активной сама по себе, canvas не растягивает её до
viewport. Он центрирует iframe и задаёт ему размер управляемого modal window:

```text
canvas
  └─ modal-sized iframe
       └─ modal window fills iframe
```

Для fixed/managed width и height берутся контрактные значения. Для
`height:auto`/grow используется измеренная высота окна с безопасным
ограничением canvas. В standalone-режиме backdrop становится прозрачным и не
добавляет внешний scrim: iframe уже равен модалке, поэтому фон вокруг него
рисует canvas.

### Модалка поверх screen

Flow overlay — другой режим:

```text
full viewport
  ├─ live underlay iframe (inert)
  └─ transparent full-viewport modal iframe
       ├─ modal-owned scrim
       └─ centered modal window
```

Здесь iframe обязан оставаться полноэкранным: backdrop/scrim должен покрыть
весь underlay. Standalone fit-frame CSS в этот путь не включается.

## Managed source contract

Generated/repaired modal source должен иметь:

```text
exactly one [data-sd-modal-window]
exactly one [data-sd-modal-region="body"]
zero or one [data-sd-modal-region="header"]
zero or one [data-sd-modal-region="footer"]
[data-sd-screen-root][data-sd-modal-backdrop] on the backdrop/root
data-sd-modal-content="scroll" | "grow" on the window
--sd-modal-width and --sd-modal-height inline on the window
role="dialog" or "alertdialog"
aria-modal="true"
accessible name
```

Размеры управляются custom properties:

```css
--sd-modal-width: 640px;
--sd-modal-height: 480px;
```

Допустимы безопасные простые значения:

- width: положительное `px` или `%`;
- height: положительное `px`, `%` или `auto`;
- `calc()`, CSS injection, отрицательные и неизвестные units отклоняются.

Для React marker должен находиться на native element или на известном
DOM-forwarding dialog primitive. Opaque custom host, который не гарантирует
передачу `data-*`, style и a11y attributes в DOM, не считается managed.

## Scroll и grow

### Scroll body

`data-sd-modal-content="scroll"` оставляет header/footer фиксированными, а
elastic body получает внутренний вертикальный scroll. Окно ограничено viewport
и использует управляемую height.

### Grow modal

`data-sd-modal-content="grow"` снимает фиксированную height/max-height с окна.
Вертикальный scroll переносится на backdrop, который выравнивает длинное окно
сверху и позволяет прокрутить весь dialog. Это предотвращает обрезание длинной
модалки при центрировании.

HTML и React scaffold материализуют оба режима сразу; переключение Design
Panel меняет только managed attribute/variables.

## Templates

Built-in templates:

- `modal-form.screen.md`;
- `modal-confirm.screen.md`.

Template frontmatter разделяет две оси:

```yaml
surface: modal
kind: form
modalDefaults:
  width: 640px
  height: 480px
  longContent: scroll
```

Project template может задать свои defaults в
`.sber-designer/screen-templates/*.screen.md`. New-screen dialog применяет
template `longContent` до первого ручного изменения control. Page template
нельзя выбрать для Modal и наоборот.

## Flow presentation

Presentation вычисляется target-aware:

```text
target surface modal → overlay
target surface page  → navigate
```

Поле `edge.presentation` опционально. Если пользователь явно выбирает
`navigate` или `overlay`, override сохраняется даже когда совпадает с текущим
default. Поэтому последующая conversion target `page ↔ modal` не меняет
намерение пользователя.

Transitions panel и edge dialog показывают effective target mode, но различают
унаследованный default и явный override.

Внутри overlay:

- transition обратно в текущий underlay закрывает modal;
- transition в другой page закрывает modal и навигирует;
- transition в другую modal заменяет overlay без стека;
- reused Cancel выбирает edge, ведущий в текущий underlay.

Stale overlay автоматически закрывается, если другой control меняет base
screen в Canvas, Demo или Share.

## Cross-origin iframe bridge и focus

Обычный local split-origin (`web :5173`, API preview `:3000`) не позволяет
parent читать `iframe.contentDocument`. Поэтому preview bridge переносит:

- flow edges с `toScreenId`;
- `preferToScreenId`;
- initial focus request;
- Escape forwarding;
- modal read/preview/reset/standalone requests.

При открытии overlay focus перемещается в iframe и на первый доступный control.
Escape внутри cross-origin iframe отправляется parent через bridge; закрытие
возвращает focus trigger-элементу. Underlay помечается `inert`.

Полный contained Tab-order через iframe boundary пока является post-MVP
улучшением. Текущий контракт покрывает initial focus, inert underlay, Escape и
focus restore.

## Design mode: managed size

Для active modal правая панель показывает screen-level секцию **Modal**
независимо от DOM selection:

- `Width`;
- `Height`;
- `Long content`;
- `Reset`;
- `Apply`.

Read и temporary preview идут через modal bridge, поэтому работают
same-origin и split-origin. Preview меняет только live DOM. Apply:

1. читает source baseline/hash;
2. отправляет patch и baseline в `POST /api/design/modal-size`;
3. получает 409 при параллельном изменении source;
4. переписывает HTML bounded start-tag rewriter-ом или JSX/TSX AST ops;
5. регистрирует visual diff;
6. сбрасывает temporary preview и перезагружает canvas.

HTML scanner рассматривает только настоящие start tags и игнорирует marker в
quoted values, comments, script/style/raw-text.

## Generation и planning

Structured generation options несут:

```ts
{
  surface: 'modal',
  modal: {
    width,
    height,
    longContent,
  },
}
```

Поля сохраняются в direct run и direction-picker pending run. Structure plan
получает surface/modal defaults и использует regions:

- `Modal header`;
- `Modal body`;
- `Modal footer actions`.

Prompt явно запрещает превращать target в full-screen page, удалять scrim или
терять managed contract без запроса пользователя. Если старый текстовый
request говорит `modal`/`dialog`, planner умеет best-effort вывести modal
surface, но новый UI всегда передаёт структурированное поле.

## Conversion

Conversion выполняется обычным `screen_update`:

- `page → modal` меняет metadata и обязан перестроить source под managed modal
  contract;
- `modal → page` меняет metadata и обязан удалить modal-only backdrop/window
  contract.

Изменить только `.sdproj` недостаточно. Craft gate блокирует metadata/source
mismatch.

## Quality gate

Modal-aware craft validator проверяет source parser/AST-aware, а не substring
поиском. Blocking findings включают:

- zero/multiple window markers;
- missing backdrop/root;
- non-forwarding React host;
- missing size variables/content mode;
- duplicate/missing regions;
- role/`aria-modal`/accessible-name errors;
- broken scroll/grow layout;
- opaque Storybook/page host;
- page metadata с оставшимся modal contract.

Modal surface пропускает page-only craft эвристики, которые ошибочно требовали
full-screen page composition, но сохраняет source integrity, data honesty,
a11y и design-system checks.

## Маркировка и persistence

Badge **Modal** показывается в:

- Screens panel;
- active screen tab strip;
- Flow node;
- HTML-first Screens Index.

`surface` проходит через editor state, tools, generation info, run records,
fingerprints и duplication. Это позволяет любому consumer использовать
`screenSurface(screen)` вместо собственной эвристики по имени/DOM.

## Карта кода

| Область                     | Файл                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| Surface/defaults/grammar    | `packages/shared-types/src/modal-surface.ts`                          |
| Prompt/source contract      | `packages/shared-types/src/modal-contract.ts`                         |
| Blank scaffold              | `apps/web/src/lib/modal-scaffold.ts`                                  |
| Standalone bridge/fit-frame | `apps/web/src/lib/modal-preview.ts`, `useStandaloneModalCanvas.ts`    |
| Overlay state machine       | `apps/web/src/lib/overlay-runtime.ts`                                 |
| Flow default/override       | `apps/web/src/lib/flow-runtime.ts`                                    |
| Overlay UI                  | `apps/web/src/components/editor/FlowOverlay.tsx`                      |
| Managed Design UI           | `apps/web/src/components/editor/design-panel/ModalSurfaceSection.tsx` |
| Source apply                | `services/api/src/modal-size-apply.ts`                                |
| HTML rewrite/scanner        | `services/api/src/modal-size-rewrite.ts`, `html-start-tags.ts`        |
| Preview bridge              | `services/api/src/routes/preview.ts`                                  |
| Craft                       | `services/api/src/screen-craft-modal.ts`                              |
| Planning                    | `services/api/src/screen-planning/screen-structure-plan.ts`           |

## Acceptance boundary

Автоматический контур покрывает transport, templates, scaffold, size rewrite,
bridge protocol, flow runtime, planning и craft. Перед финальной product
приёмкой остаётся owner live-smoke:

- light/dark theme;
- narrow viewport;
- standalone fixed и grow modal;
- overlay поверх реального underlay;
- React project с собственным Dialog primitive;
- Escape/focus/Cancel и conversion в живом editor flow.
