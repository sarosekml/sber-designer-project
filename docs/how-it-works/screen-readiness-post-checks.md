---
updated: 2026-07-24T16:15:57+0300
---

# Generation pipeline: Post-checks и Screen readiness DoR

## Зачем нужна настройка

`Settings → System → Harness setup → Screen readiness DoR` задаёт
глобальный пользовательский Definition of Ready для экранов, которые изменяет Assistant. Это
автоматические детерминированные проверки после записи кода. Они не задают
пользователю вопросов и не выбирают дизайн вместо него.

Профиль хранится в user settings sber-designer, переживает reload и применяется
во всех проектах этого пользователя. В проектный `.sdproj` он не записывается.

## Прямой сценарий без дополнительных вопросов

Для сценария
`prompt → generation → checks/review → repair → result`:

1. Выключить `Choose a design direction` в `Settings → Harness setup`.
2. Оставить optional `Design brief` пустым.
3. Не включать `Start with wireframe`.
4. Оставить `Screen readiness checks` включёнными с профилем `Standard` или
   `Strict`.
5. Включить `Run Design Jury`, только если нужен дополнительный субъективный
   review пятью ролями и одна целевая ревизия.

Direction-picker, wireframe и Jury имеют global defaults и per-run overrides в
`Add a screen`. Post-checks не добавляют диалог: backend возвращает findings
агенту в том же run. Blocking findings нельзя принять без ремонта; should-fix
и advisory остаются видимыми для review. Общая модель наследования описана в
[Generation pipeline](generation-pipeline.md).

## Как связаны элементы quality flow

| Этап                        | Механизм                           | Что делает                                                                             |
| --------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| До run                      | Design brief                       | Передаёт явные layout, density, palette и hard constraints.                            |
| До run                      | Direction-picker                   | Optional HITL-выбор композиционного направления.                                       |
| После write                 | Post-checks / Screen readiness DoR | Детерминированно проверяет source, компоненты, токены, данные, states и accessibility. |
| После механических проверок | Design Jury                        | Optional субъективный review и одна ограниченная ревизия.                              |
| В terminal finalization     | Runtime render proof               | Проверяет, что screen реально открылся в canvas.                                       |

Это один quality pipeline, но разные механизмы нельзя сводить к одному
чекбоксу: direction отвечает за намерение до генерации, DoR — за измеримые
дефекты после записи, Jury — за субъективное качество, render proof — за
работоспособность runtime.

## Профили

- `Standard` — активный базовый набор. Source/data/accessibility blocking,
  большинство design-system и UX findings остаются should-fix/advisory.
- `Strict` — включает все категории и повышает design-system/operational
  should-fix до blocking. Категории без подключённого runner всё равно честно
  показываются как `skipped`.
- `Custom` — запускает выбранные категории. Отключённая категория не добавляет
  findings в craft result, но не отключает независимые terminal safety gates.

Поле `control` в shared schema делает эту границу машинно-читаемой:
`custom-profile` действительно управляется Custom, `terminal-required` всегда
выполняется финализатором, `planned` пока честно возвращает skipped. Сейчас к
неотключаемым относятся runtime render proof и Design-mode compatibility.
Кроме них Custom не отключает structural terminal invariants: target diff,
Storybook identity/export, screen-root marker, selected-target scope и
redesign-fidelity для задач redesign.

## Категории и текущая готовность

### Source integrity — active

Находит отсутствующий source, ошибки TypeScript/props/imports и React hooks вне
компонента. Blocking finding не позволяет принять run.

Для `surface: modal` эта категория также запускает parser/AST-aware modal
contract gate: ровно один window marker, backdrop/root, DOM-forwarding,
size/content attributes, уникальные regions, a11y и рабочий scroll/grow layout.
Metadata/source mismatch `page ↔ modal` является blocking; marker в комментарии
или quoted attribute value не считается DOM contract. Полный список и
lifecycle: [Modal screens](./modal-screens.md).

### Render health — separate runtime gate

Проверяет runtime crash, blank canvas и наличие screen root. JS-capable proof
может быть `confirmed`, `failed` или `pending`; отсутствие browser evidence не
считается успехом.

Сейчас terminal render proof уже выполняется независимо от строки профиля.
Чекбокс `Render health` ещё не управляет этим gate — это известный
convergence gap харнеса.

### Design-system fit — active

Проверяет project tokens, raw colors/fonts/assets и повторное использование
task-relevant компонентов. Явное требование `используй компонент X` является
blocking: родственный component или layout primitive не считается заменой.
Явный запрет `не используй компонент Y` имеет обратную семантику: `Y`
исключается из component pack и его отсутствие не может стать finding.

### Data honesty — active

Не позволяет показывать придуманные суммы/проценты как реальные данные.
Явно отмеченные mock/sample/demo данные допустимы. Это не внешняя проверка
бизнес-фактов.

### Operational UX states — active

Ищет loading/empty/error states, card soup и marketing hero language в
операционных интерфейсах. Standard оставляет большинство findings для review,
Strict повышает should-fix до blocking.

### Accessibility basics — active

Проверяет accessible name у icon-only controls и emoji вместо проектных иконок.
Отсутствие имени у control — blocking.

### Responsive visual sanity — planned

Будущий browser runner для desktop/tablet/mobile snapshot evidence, overflow и
clipped controls. Сейчас результат — `skipped` с причиной.

### Design-mode compatibility — separate terminal evidence

Standalone validator проверяет source mapping и inspectable DOM. Финализатор
запускает его независимо от Custom-профиля и включает результат в единый
quality summary; строка профиля не отключает этот terminal evidence.

## Где смотреть результат

- `validate_screen_craft` receipt — профиль, findings и `categoryResults`;
- `runtime_render_health` receipt — отдельное runtime evidence;
- `run-manifest.json` — terminal status и render proof;
- `quality_summary` receipt и карточка Assistant — craft categories, Design
  mode, render proof, automatic repair, оставшиеся findings, skipped checks и
  Design Jury revision;
- handoff — короткое резюме для продолжения run.

Статусы category result: `passed`, `findings`, `blocked`, `disabled`, `skipped`
и `missing`. `disabled` и `skipped` не равны `passed`.

Если blocking craft finding остался после записи полезного target, harness
делает одну bounded automatic craft repair. Повторный blocker завершает agent
run как `needs_review` с причиной ремонта. Пользователь может нажать
`Mark reviewed`: reviewer/timestamp сохраняются в `review.json` и dataset, но
исходный terminal outcome остаётся `needs_review`. `failed` используется,
когда target не создан либо обязательный source/runtime инвариант действительно
сломан. Это не ослабляет DoR: `needs_review` не считается принятым результатом.
