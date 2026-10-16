---
updated: 2026-07-24T23:16:10Z
---

# Screens panel and screen creation

## Назначение

В Edit workspace Assistant стоит первой колонкой, а Screens/Components — второй
resource-колонкой. Screens panel управляет экранами открытого проекта и работает
с `project.screens[]` из `.sdproj`, а не сканирует файловую систему напрямую при
каждом рендере UI.

Кодовые точки:

- `apps/web/src/components/editor/ScreensPanel.tsx`;
- `apps/web/src/components/editor/CanvasNavigationStrip.tsx`;
- `apps/web/src/lib/screen-tabs.ts`;
- `apps/web/src/lib/screen-folders.ts`;
- `services/api/src/routes/screen-folders.ts`;
- `services/api/src/screen-folder-rename.ts`;
- `services/api/src/html-screen-index.ts`;
- `services/api/src/project-store.ts`.

## Экран

Screen в sber-designer - это запись в `.sdproj` плюс связанные source files:

```text
ProjectScreen
  id
  name
  kind
  surface
  folder
  storyId
  filePath
  implementationFilePath
  thumbnail
  health
  description
  template
  position
```

`kind` различает Storybook reference (`story`) и workspace page/source entry
(`page`). `storyId` нужен для Storybook preview. `implementationFilePath` нужен
для Code mode, agent write scope и generated screen edits.

В HTML-first проектах обычный экран имеет `kind: "page"`, а `filePath` и
`implementationFilePath` указывают на один `.html` файл.

## Resource panel и screen tabs

Если Screens panel скрыта, над canvas появляется navigation strip с dropdown
всех screens и эфемерными вкладками открытых screens. Выбор в полной панели или
dropdown вызывает один переход: tab открывается append-unique, затем
`setActiveScreenId(id, { source: 'user' })` синхронно переключает canvas,
per-screen Assistant session, selection и comment context.

Ограничения на число tab metadata нет. Вкладки живут только в текущей browser
session, не записываются в `.sdproj`/localStorage и не создают iframe, sandbox
или agent run. Active screen всегда имеет tab, когда strip показан. Закрытие
active tab выбирает правого соседа, иначе левого; единственный tab нельзя
закрыть. Закрытие tab не останавливает run этого screen.

Последний active screen хранится отдельно от tab metadata в project-scoped
localStorage по workspace path. После reload/restart редактор восстанавливает
его, если screen всё ещё существует; иначе безопасно выбирает первый screen.

Tab/dropdown показывают running, stopping и permission-waiting состояния из
общего assistant run store. `Open run` снова открывает tab нужного screen перед
его активацией.

В Storybook тот же strip содержит только Components dropdown. Выбор меняет
`activeComponentId` как в полной Components panel, но не создаёт component tab,
отдельную chat session или preview cache. Management actions остаются в полной
панели, которую можно открыть из dropdown.

## Папки и `Ungrouped`

В UI screens группируются по `folder`.

`Ungrouped` - логическая секция для экранов без выбранной папки. Это базовое
место, куда можно положить screen, но при открытии пустого проекта не нужно
заранее создавать отдельную physical folder. Если в проекте есть screens без
папки, они показываются в секции `Ungrouped`.

Правила:

- `normalizeScreenFolder(undefined | "" | whitespace)` возвращает `Ungrouped`.
- `listScreenCreationFolders()` всегда включает `Ungrouped` первым.
- Если пользователь выбирает `Ungrouped` при создании screen, новый screen
  получает эту логическую секцию.
- Для generated Storybook/source paths `Ungrouped` может стать частью пути,
  потому что Storybook title and file layout требуют стабильный folder segment.
- Старые date folders не мигрируются автоматически. Они остаются как есть,
  пока пользователь не переименует их вручную.
- Папки с пробелами поддерживаются. Они нормализуются как display folder и
  используются при генерации path/title через существующие helpers.
- Если пользователь выбирает `New folder`, создается уникальное имя:
  `New folder`, `New folder 2`, `New folder 3` и так далее.

## Last folder

Последняя выбранная папка для создания screen хранится в:

```text
project.screenCreation.lastFolder
```

Это project-owned state. Оно влияет на будущие screen creation defaults и
должно быть reviewable вместе с `.sdproj`.

Default в диалоге:

1. последняя выбранная папка, если она еще существует;
2. иначе первая папка из списка, где первой всегда идет `Ungrouped`;
3. пункт `New folder` всегда доступен как action option.

## Folder collapse state

Свернутые папки Screens panel хранятся в:

```text
project.screensPanel.collapsedFolderNames
```

Это project-owned state в `.sdproj`, а не `localStorage`: пользовательский вид
дерева восстанавливается после reload страницы, перезапуска editor и
`Sync screens`.

Правила:

- отсутствующее поле или пустой список означает, что все папки раскрыты;
- новые папки после создания screen или sync раскрыты по умолчанию;
- rename folder переносит collapsed-state на новое имя папки;
- delete folder и sync удаляют collapsed names, которых больше нет в
  `project.screens`;
- `screensPanel.collapsedFolderNames` не связан с
  `flowView.hiddenFolderNames`: первое управляет раскрытием дерева в панели,
  второе скрывает папки только на Flow map.

## Создание screen

Диалог создания поддерживает сценарии:

- blank generated screen;
- blank HTML page для HTML-first проекта;
- screen from Storybook story;
- optional assistant instruction after creation;
- template selection;
- target folder selection;
- per-run overrides для direction-picker, wireframe и Design Jury.

Blank generated screen создает:

```text
src/screens/<Folder>/<ComponentName>.tsx
src/stories/screens/<Folder>/<ComponentName>.stories.tsx
```

И регистрирует `ProjectScreen` в `.sdproj`.

В HTML-first проекте blank screen создает:

```text
pages/<screen-slug>.html
```

или, если выбран folder:

```text
pages/<folder-slug>/<screen-slug>.html
```

Root выбирается из существующих `pages`, `screens`, `site`, `public` или
fallback `pages`. Экран регистрируется как `ProjectScreen.kind: "page"`.

Блок `Harness` наследует глобальные user defaults из
`Settings → Harness setup`, но checkboxes меняют только текущий create-run.
Иконка вопроса рядом с заголовком открывает tooltip с этим пояснением; прежнего
правого текстового хинта больше нет. Если пользователь добавил Assistant
instruction или включил wireframe, агент получает HTML-specific prompt:
редактировать уже созданный файл, сохранить `data-sd-screen-root`, использовать
`Design.md`/`tokens.css`/`components.css` и не писать generated page в managed
`index.html`. Пустая instruction создаёт только editable shell и не запускает
pipeline сама по себе.

Подробно: [Generation pipeline](generation-pipeline.md).

После сохранения `.sdproj` backend синхронизирует HTML-first Screens Index:

```text
index.html
```

В нем обновляется только managed block со ссылками на реальные страницы.

После записи backend/UI ждут Storybook readiness. Если Storybook index еще не
видит новую story, но story file на диске соответствует registered `storyId`,
экран должен получить понятный `needs_review` или preview-unavailable статус,
а не выглядеть как полностью потерянный.

## Создание из Storybook

Если canvas view переключен в Storybook или пользователь выбирает story из
диалога, screen может быть создан из существующей Storybook story.

Возможные формы:

- pinned/original story как screen reference;
- editable copy, где создается implementation file и тонкий story wrapper.

Editable copy предпочтительнее для agent/design/code flows, потому что у нее
есть отдельный allowed target file.

## Синхронизация со Storybook

Screens panel умеет refresh/sync:

- обновить component/story catalog;
- найти новые stories;
- выровнять folder rename и file rename для generated screens;
- обновить health;
- сохранить `.sdproj`.

Sync не должен удалять пользовательские screens без явного действия.

## Действия над screen

Поддерживаются:

- select screen;
- rename;
- move to folder;
- duplicate;
- export;
- Set as thumbnail;
- delete;
- manual health override;
- extract HTML-first design system from reference;
- distill HTML-first design system from existing pages;
- apply connected HTML design system to pages;
- sync/refresh.

Rename и move должны обновлять `.sdproj` и, для generated screens, согласованные
Storybook title/file path. После rename cache Storybook может быть stale, поэтому
нужна invalidation/restart или явный preview warning.

Для HTML-first pages rename/move меняют сам `.html` path и сохраняют extension
`.html`/`.htm`. Storybook cache invalidation не нужна, но static preview должен
перечитать новый path, а managed `index.html` должен быть синхронизирован.

Delete screen удаляет запись из проекта и связанные generated files только если
это безопасно и явно подтверждено. Storybook source, который пользователь не
просил удалять, нельзя терять молча.

**Set as thumbnail** — checkbox в контекстном меню screen. Включение
сохраняет `coverScreenId` в project registry и сразу делает snapshot этого
screen; генерации других screens после этого cover не меняют. Повторный клик
на закреплённом screen снимает pin и возвращает automatic mode «последний
успешно сгенерированный screen». Удаление закреплённого screen очищает pin, а
refresh/open чинят orphan pin после внешних изменений. При выключенном
**Settings → General → Generative thumbnail** action полностью отсутствует в
меню.

Pin относится к per-user registry, а generated image хранится и коммитится
внутри connected project. Подробно:
[Project covers](./project-covers.md).

`index.html` и root `design-system.html` не считаются обычными distillable HTML
pages. Их нельзя использовать как цель нового screen generation или apply run.

## HTML-first design-system actions

Для `projectKind: "html-first"` Screens panel показывает дополнительные
действия:

- **Extract from reference** - создать reviewable proposal из файла или Pixso
  URL. Production sources не меняются до accept.
- **Distill design system** - когда есть минимум две обычные HTML pages и
  `htmlDesignSystem.status` еще `bootstrap`, агент создает proposal под
  `design/proposals/*`.
- **Apply design system** - когда `Design.md`, `tokens.css` и `components.css`
  connected, агент применяет tokens/classes к выбранным pages, не меняя
  design-system source files.

Proposal accept копирует `Design.md`, optional `tokens.css`,
`components.css`, `design-system.html` в root workspace, пишет accepted
`design/extraction-report.md`, запускает re-index и удаляет proposal folder.

## Действия над folder

Folder row поддерживает:

- rename;
- delete;
- visibility toggle в Flow view.

Удаление folder не удаляет screens. Screens переносятся в `Ungrouped`.
`Ungrouped` нельзя удалить как обычную папку.

## Health badges

Screen может показывать состояние:

- ready;
- needs-review;
- broken;
- preview unavailable;
- generated empty/placeholder.

Health должен отражать фактический source/render state. Если агент записал
source, но run остановился по лимиту, это не должно выглядеть как "ничего не
сделано". Правильное состояние - `needs_review` с evidence.

## Flow-specific controls

Когда открыт top-level Flow view, Screens panel показывает дополнительные eye
controls для screen/folder visibility. Это только настройка карты flow:

```text
project.flowView.hiddenScreenIds
project.flowView.hiddenFolderNames
```

Она не удаляет screen и не влияет на runtime transition graph.

## Модалки

Модалка — это обычный `ProjectScreen` с additive-полем `surface: 'modal'`
(absent = `page`, читается через `screenSurface(screen)`; поле каноничного
writer'а хранит только `modal`, `page` стирает). Отдельной сущности нет: тот же
файл, регистрация и пайплайн генерации/редактирования. В New-screen диалоге
сегмент `Screen | Modal` фильтрует шаблоны по surface и даёт поля
`Width`/`Height`/`Long content` (грамматика длин — `300px`/`50%`/`auto`, без
`calc()`); blank-скаффолд обоих профилей материализует контракт модалки (scrim +
центрированный `data-sd-modal-window`, зоны `data-sd-modal-region`,
размер в `--sd-modal-*`). Встроенные шаблоны — `modal-form` (kind form) и
`modal-confirm` (kind custom) в `packages/agent-kit/kit/screen-templates/`. Модалки живут в
общих списках с бейджем `Modal` (Screens panel, tab strip, Flow-нода, HTML
Screens Index); ребро в модалку по умолчанию открывается как overlay (Р-5).

Отдельно открытая modal использует iframe/canvas по размеру окна; только
Flow-overlay остаётся прозрачным full-viewport iframe, чтобы scrim покрывал
underlay. Полный контракт создания, source markers, sizing, conversion и
quality gate: [Modal screens](./modal-screens.md).
