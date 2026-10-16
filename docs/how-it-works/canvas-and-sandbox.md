---
updated: 2026-07-24T16:15:14+0300
---

# Canvas and sandbox

## Назначение

Canvas - центральная область, где sber-designer показывает живой экран
подключенного проекта. Это iframe с настоящим DOM, а не статичная картинка.

Кодовые точки:

- `apps/web/src/components/editor/CanvasArea.tsx`;
- `apps/web/src/components/editor/CanvasNavigationStrip.tsx`;
- `apps/web/src/components/editor/CanvasFrame.tsx`;
- `apps/web/src/lib/screen-preview-cache.ts`;
- `services/api/src/routes/preview.ts`;
- `services/api/src/routes/sandbox.ts`;
- `services/sandbox/src/session.ts`;
- `services/sandbox/src/docker-session.ts`;
- `services/sandbox/src/session-reaper.ts`.

## Preview origin и iframe URL

После исправлений agent-run pipeline важно разделять две сущности:

```text
sandbox origin: http://localhost:<port>
selected screen URL: http://localhost:<port>/iframe.html?id=<storyId>
proxied UI URL: /api/preview/iframe.html?id=<storyId>
```

Backend preview/render-health должен использовать sandbox origin как upstream.
Frontend может показывать proxied URL в iframe, но не должен записывать его в
backend как `state.canvasUrl`.

Self-reference guard в preview route нужен только как защита. Основная
архитектура - не смешивать upstream origin и выбранный iframe URL.

Для HTML-first проекта selected screen URL строится как static page path:

```text
sandbox/static origin: http://localhost:<port>
selected screen URL: http://localhost:<port>/pages/<screen>.html
proxied UI URL: /api/preview/pages/<screen>.html
```

Это тот же live DOM iframe, но без Storybook `/iframe.html?id=...`.

## Sandbox session

Sandbox session запускает команду проекта и хранит:

- workspace path;
- command;
- process status;
- preview URL/origin;
- diagnostics;
- stdout/stderr evidence;
- last health information.

Если dev-server не стартует, diagnostics должны показывать причину:

- missing binary;
- missing dependencies;
- blocked install;
- command exit;
- timeout;
- Storybook index unavailable;
- static HTML page unavailable;
- generic script failure.

## Storybook readiness

Для Storybook preview backend проверяет:

- доступен ли `index.json`;
- есть ли `storyId`;
- отвечает ли iframe;
- можно ли обнаружить screen root;
- не упал ли runtime с React/Storybook ошибкой.

Новая story может появляться не мгновенно. Поэтому readiness использует bounded
backoff. Если source на диске консистентен, но preview еще не готов, UI должен
показывать "source saved, preview unavailable", а не общий провал.

## Static HTML readiness

Для HTML-first проекта render probe использует static HTTP evidence:

- fetch выбранной `.html` страницы;
- HTTP status;
- наличие `[data-sd-screen-root]`;
- body text after stripping HTML;
- best-effort inline/script error evidence.

Такое evidence помечается как `static-html-http` и может быть weak, если нет
browser-backed render evidence. Canvas warning для static page не должен
советовать restart Storybook: пользователь видит reload static HTML preview.

## Canvas modes

CanvasFrame используется для всех трех edit modes:

- `Interact` - iframe работает почти как обычное приложение.
- `Design` - поверх iframe есть selection overlay и inspector bridge.
- `Code` - source panel активен, iframe остается тем же preview.

Смена Interact/Design/Code не должна пересоздавать sandbox session или active
preview. Это требование ADR-0004: один active iframe, разные слои
взаимодействия.

## Active preview и bounded warm cache

Screen tabs не создают sandbox sessions и не получают по iframe на вкладку.
`CanvasFrame` держит один active editor target и не больше двух последних
пассивных screen previews в MRU/LRU-пуле:

```text
1 active screen iframe + 0..2 inert warm frames = максимум 3 iframe
```

Только active frame видим, focusable, регистрируется как
`designStore.previewWindow`, подключает `DomOverlay`, слой аннотаций
[Mark](./canvas-mark.md), Flow runtime и canvas warnings. Warm frames имеют `inert`, `aria-hidden`, `tabIndex=-1`, не получают
pointer events и не подключаются к editor bridge. Переключение
Interact/Design/Code не входит в iframe key, поэтому не remount-ит active
document.

Flow overlay занимает один auxiliary slot: пока он открыт, остаётся максимум
один warm frame. Переход в Storybook полностью очищает screen preview pool;
Storybook всегда использует один iframe, а выбор компонента заменяет его URL.
При возврате screen tab metadata сохраняется, но active screen прогревается
заново.

Pool очищается или инвалидируется при смене project/sandbox session,
reload/restart, удалении/закрытии screen, входе в Storybook и source write.
Background tool-result использует захваченный `ChatRunBinding.screenId` и
увеличивает revision именно этого screen; inactive stale document не может
стать active editor target.

Архитектурная граница: [ADR-0018](../architecture/adr/0018-bounded-screen-preview-cache.md).

## Screen root warning

Generated screen должен иметь:

```tsx
<div data-sd-screen-root>...</div>
```

Canvas warning появляется, если root не найден. Проверка должна быть lenient:
любой `[data-sd-screen-root]` валиден, значение `"true"` не требуется.

В HTML-first root может быть на `<body data-sd-screen-root>` или внутри page
layout. Если root отсутствует на пустой static page, warning формулируется как
проблема static HTML preview, не Storybook.

## Reload и restart

В UI есть два разных действия:

- Reload iframe - перечитать текущий preview URL.
- Restart preview/Storybook - перезапустить sandbox/dev-server.

После успешного `write_file` или `apply_patch` по active screen UI должен
сразу bump'ать reload key и не ждать финального `done`. Это важно для partial
success runs: source уже записан, но agent loop мог упереться в лимит.

## Render health

Render health проверяет, что измененный screen реально рендерится. Он должен
запускаться не только для `complete`, но и для runs, где:

- есть changed files active screen;
- run завершился `truncated`;
- были tool errors после успешной записи;
- финальная validation не успела.

Результат записывается в run receipts и влияет на screen health.

## HMR and stale sessions

Storybook/Vite HMR может деградировать: hot-update 404, stale cache, missing
story после rename. Текущая реализация:

- инвалидирует Storybook cache после некоторых rename/move операций;
- reaps stale sessions при создании новой session;
- показывает явные overlay states для blank/unhealthy canvas.

Background restart-on-unhealthy для уже живой HMR-сессии оставлен как live
validation item: его нельзя включать вслепую, чтобы не убивать активный
dev-server пользователя.

## Local sandbox portability

Local mode is the current MVP default:

```text
SBER_DESIGNER_SANDBOX_DRIVER=local
```

It starts the connected project's preview/dev command as a local child process.
This is a developer workflow, not a production isolation boundary. The child
process inherits the developer shell today so internal package-manager setup can
work on corporate machines.

Keep the portable part in the connected project:

- registry settings in `.npmrc`, `.bunfig.toml` or documented install commands;
- lockfiles and package scripts;
- source files, generated screens and Storybook wrappers;
- `.sber-designer/project.sdproj` and relevant design-index records.

Keep machine-local infrastructure in the developer shell or private `.env`:

- `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`;
- `NODE_EXTRA_CA_CERTS`, `SSL_CERT_FILE`;
- runtime binary overrides such as `SBER_DESIGNER_CODEX_BIN`;
- provider secrets referenced from `sber-designer.json` as `{env:NAME}`.

Docker mode exists as an optional driver/future protected-deployment path. Local
MVP setup and smoke validation must not require Docker.

## Interact flow runtime

В Interact mode CanvasFrame также учитывает Flow runtime:

- click/link edges;
- on-mount transitions;
- presentation overlay behavior.

Это runtime слой поверх live DOM, а не отдельный preview engine.

## Честный overlay модалок

Если modal screen открыт отдельно как active screen, `CanvasFrame` центрирует
**modal-sized iframe**, а не полноэкранный белый frame. Managed width/height
берутся из modal contract; grow/auto height следует измеренному окну. В этом
режиме preview bridge включает standalone CSS: окно заполняет bounded iframe,
а backdrop не рисует внешний scrim.

Ребро с presentation `overlay` (по умолчанию — во все экраны `surface: 'modal'`)
открывает цель через общий `FlowOverlay`: для модалки это full-viewport
**прозрачный** iframe поверх базового экрана (scrim рисует сама страница,
underlay просвечивает), для legacy не-модальных целей — прежнее windowed-окно.
На время overlay базовый runtime на паузе, underlay iframe `inert`, а его
`useFlowRuntime` подключён к overlay-iframe, поэтому кнопки внутри модалки живут:
`navigate` в текущий underlay = закрыть (Р-19, underlay-preferring match для
переиспользуемого Cancel), `navigate` в другой экран = закрыть+перейти,
`overlay` из модалки = заменить (без стека). Esc из сфокусированного input
внутри iframe закрывает: same-origin использует direct listener, split-origin —
injected preview bridge. Bridge также переносит underlay preference и initial
focus; после закрытия фокус возвращается к trigger. Одна и та же логика в трёх
плеерах — Interact-канвас, Demo, Share. Чистая state-machine —
`apps/web/src/lib/overlay-runtime.ts`.

Полный контракт standalone/overlay, focus и managed source:
[Modal screens](./modal-screens.md).
