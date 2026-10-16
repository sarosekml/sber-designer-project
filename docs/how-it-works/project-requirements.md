---
updated: 2026-07-07T00:17:09+03:00
---

# Project requirements

Этот документ описывает минимальные требования к проекту, который открывается
в sber-designer.

## Базовая идея

sber-designer не является генератором только для одного репозитория. Он должен
открывать разные frontend-проекты. Проект может быть зрелым приложением со
Storybook, React/Vite проектом без Storybook, HTML-first проектом на
статических `.html/.css` файлах или почти пустым репозиторием. Разница только в
качестве автоматического контекста и preview.

Минимально проект должен позволять:

- читать файлы из workspace;
- запускать preview/dev-server или быть диагностируемо неготовым;
- хранить `.sber-designer/project.sdproj`;
- принимать изменения в git;
- иметь понятную структуру source files для generated screens.

## Workspace

Проект открывается как filesystem workspace. Backend должен иметь доступ на
чтение и запись внутри этого workspace.

Ожидаемые свойства:

- есть `package.json` для frontend-проектов на Node/Bun;
- для HTML-first проекта `package.json` не обязателен, если есть static
  `.html/.css` files;
- зависимости могут быть установлены пользователем или через documented setup;
- есть команда preview/dev/storybook для app-проектов или static HTML preview
  для HTML-first;
- исходники лежат внутри workspace: обычно `src/*` для React и
  `pages/`, `screens/`, `site/` или `public/` для HTML-first;
- git repository желателен для status, graph и Send PR.

Если часть требований не выполнена, продукт не должен падать молча. Он должен
показать diagnostics: missing dependency, missing binary, command failure,
preview unavailable, Storybook index unavailable и так далее.

## Preview/dev-server

Canvas работает через живой iframe. Поэтому для полноценной работы нужен
preview origin:

```text
http://localhost:<port>
```

Sandbox session хранит именно origin. Выбранный screen URL, например
`/iframe.html?id=...`, строится отдельно.

Критичное правило:

```text
backend canvasUrl = sandbox origin
selected screen URL = sandbox origin + story/route path
```

Нельзя сохранять proxied `/api/preview/...` URL как upstream origin, иначе
preview proxy становится self-referential.

Для HTML-first проекта preview origin обслуживает static files, а selected
screen URL - это путь к `.html` странице:

```text
backend canvasUrl = sandbox/static origin
selected screen URL = sandbox/static origin + /pages/<screen>.html
```

Такой проект не требует Storybook `/iframe.html?id=...`.

## Storybook

Storybook поддерживается, но не обязателен.

Если Storybook есть, sber-designer использует:

- `index.json` для stories/components;
- `iframe.html?id=<storyId>` для screen preview;
- Storybook HMR для обновления после записи файлов.

Если Storybook нет, работают fallback-сценарии:

- static AST scan ищет exported React components;
- catalog строится из исходников;
- screen generation может создавать story wrappers, если проектный setup это
  поддерживает;
- Design System Browser показывает weaker diagnostics и setup questions.

Storybook может временно не успеть увидеть новую story после записи файла.
Backend ждет readiness с bounded backoff и при недоступном `index.json` может
проверить story file на диске, чтобы отличить "source saved, preview unavailable"
от полного провала.

## Screen root

Для надежного canvas/debug/design mode generated screen должен иметь root:

```tsx
<div data-sd-screen-root>...</div>
```

Значение атрибута не обязательно должно быть `"true"`. Любой
`[data-sd-screen-root]` считается валидным.

В HTML-first screen root обычно стоит на `<body>` или на корневом `<main>`:

```html
<body data-sd-screen-root>
  <main aria-label="Deal review">...</main>
</body>
```

Этот root нужен для:

- canvas warning overlay;
- render-health проверки;
- future selection and design-readability diagnostics.

## Generated screen layout

Для React/Storybook generated screens предпочтительный формат:

```text
src/screens/<Folder>/<ComponentName>.tsx
src/stories/screens/<Folder>/<ComponentName>.stories.tsx
```

Story wrapper должен быть тонким. Основной UI должен жить в implementation
file. Это дает:

- понятный Code mode target;
- безопасный active-screen write scope;
- возможность переиспользовать screen в приложении;
- design-readable validation.

Папка `Ungrouped` в UI является логической секцией по умолчанию. Для generated
Storybook/source paths она может стать физическим сегментом пути, потому что
Storybook title и source layout требуют стабильного folder segment. При этом
проект не обязан заранее иметь папку `Ungrouped`.

Для HTML-first generated screens формат другой:

```text
pages/<screen-slug>.html
pages/<folder-slug>/<screen-slug>.html
```

`index.html` зарезервирован как managed Screens Index/project home и не должен
становиться target для новой страницы. Если экран лежит в
`ProjectScreen.kind: "page"`, `filePath` и `implementationFilePath` указывают
на один и тот же HTML файл.

HTML-first project также может иметь design-system sources:

```text
Design.md
tokens.css
components.css
design-system.html   optional generated preview/catalog
```

Для connected status нужны `Design.md`, `tokens.css` и `components.css`.

## Design-readable screen

React screen считается хорошим target для будущего Design mode, если:

- implementation экспортирует React component;
- UI написан JSX, а не raw HTML string;
- wrapper story не содержит основной layout;
- используются project components, tokens, icons и assets;
- импортируемые пути валидны для tsconfig/jsconfig/Vite aliases;
- внешние icon/source folders не импортируются напрямую; нужные external icons
  сначала материализованы в `src/sber-designer-assets`;
- ключевые элементы имеют понятную структуру и labels;
- нет сырого `dangerouslySetInnerHTML` для visible UI из prompt attachments;
- screen зарегистрирован в `.sdproj` и, после индексации, в
  `.sber-designer/design-index/screens.jsonl`.

HTML-first screen считается хорошим target, если:

- это semantic HTML file, а не скопированный attachment dump;
- есть `[data-sd-screen-root]`;
- используются `var(--...)` tokens и classes из `components.css`, когда
  design system connected;
- reusable patterns вынесены в CSS catalog вместо одноразовых inline styles;
- `index.html` и root `design-system.html` не используются как production page
  targets;
- screen зарегистрирован в `.sdproj` и попал в `screens.jsonl`.

Validation не должна уничтожать source при timeout. Если код записан, но
проверка не завершилась, run должен стать `needs_review`, а пользователь должен
видеть, что source сохранен.

## Dependencies and package install

sber-designer не должен скрыто чинить внешний проект, если это меняет его
зависимости. Если dependencies missing или install blocked, sandbox должен
показать evidence и suggested action. Пользователь или агент может внести
изменения в проект явно.

## Local sandbox environment contract

Текущий локальный MVP запускает preview/dev-server подключенного проекта как
локальный child process. Это не production isolation boundary; это переносимый
developer workflow. Поэтому другой разработчик после `git checkout` должен
иметь возможность восстановить окружение из project-owned файлов и локального
`.env`/shell setup.

Project-owned setup should include:

- `package.json`, lockfile and package-manager config for app projects;
- HTML-first sources (`Design.md`, `tokens.css`, `components.css`,
  `pages/*.html`/`screens/*.html`) for static projects;
- `.npmrc`, `.bunfig.toml` or equivalent registry config when the project uses
  an internal registry;
- source files, generated screens, stories, templates and assets required by
  the editor;
- materialized screen assets in `src/sber-designer-assets/*`, if generated
  screens use external indexed icons;
- `.sber-designer/project.sdproj` and relevant
  `.sber-designer/design-index/*` records when they describe project state;
- `.sber-designer/assets/*` manifests when they describe imported/materialized
  assets or configured icon sources;
- README/setup notes for required local commands.

Machine-local setup can stay outside git:

- provider API keys and runtime secrets;
- `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`;
- `NODE_EXTRA_CA_CERTS`, `SSL_CERT_FILE` or other internal CA paths;
- local runtime binary overrides such as `SBER_DESIGNER_CODEX_BIN`;
- local attempt log paths such as `SBER_DESIGNER_AGENT_LOG_DIR`;
- browser evidence endpoint such as `SBER_DESIGNER_CHROME_DEBUGGING_URL`.
- local absolute paths for external icon source folders. They may be rebound in
  Settings on another machine; generated code must only use materialized
  project-owned files.

Use the repository `.env.example` as the sber-designer-side template. It lists
the supported local MVP variables without requiring Docker or real provider
secrets. Do not commit filled `.env` files.

Local sandbox child processes inherit the developer shell today so internal
registry/proxy/CA configuration keeps working. A future protected mode may add
an explicit environment allow-list, but it must preserve a documented passthrough
for package-manager infrastructure variables before it becomes default.

## Git

Для полноценного workflow проект должен быть git repository. Тогда доступны:

- status bar;
- Git dirty indicator;
- graph dialog;
- selected commit/file scope;
- Send PR.

Если git недоступен, экранная работа и индексирование могут продолжаться, но PR
workflow будет ограничен.

## Project portability through git

Для переноса рабочего MVP на другую машину коммитьте только state, который
принадлежит подключенному проекту или нужен для воспроизведения результата:

- `.sber-designer/project.sdproj`;
- relevant `.sber-designer/design-index/*`;
- relevant `.sber-designer/assets/*` manifests;
- generated screen implementation files;
- generated Storybook stories/wrappers;
- HTML-first pages and design-system sources (`Design.md`, `tokens.css`,
  `components.css`, optional `design-system.html`);
- project screen templates, `src/assets/*`, `src/sber-designer-assets/*` and
  agent notes that affect generation;
- `sber-designer.json` when provider/runtime/MCP config references are meant to
  be shared and do not contain secrets.

Не коммитьте machine-local artifacts:

- `.env`, `.env.*` with real values;
- `.playwright-mcp/`;
- temp attempt logs and `tmp/`;
- root screenshots and ad-hoc smoke captures;
- local browser dumps or one-off debugging logs.

Run evidence under `.sber-designer/runs/*` is project-owned diagnostic data.
Keep it when it explains a screen-generation bug, Continue run, design-source
handoff or review decision. Exclude it from normal feature PRs when it is just
large local attempt evidence and not needed by the reviewer.

## Checklist для нового проекта

1. Откройте workspace.
2. Для React/app проекта убедитесь, что dependencies установлены.
3. Для React/app проекта запустите или настройте preview/dev/Storybook command;
   для HTML-first проекта убедитесь, что static preview открывает `.html`
   файлы.
4. Дайте sber-designer создать `.sber-designer/project.sdproj`.
5. Запустите indexing.
6. Проверьте Design System Browser diagnostics.
7. Для HTML-first проекта добавьте или примите `Design.md`, `tokens.css` и
   `components.css`, если хотите connected design-system status.
8. Создайте первый screen в `Ungrouped` или `New folder`.
9. Убедитесь, что canvas показывает `[data-sd-screen-root]` без warning.
10. Проверьте git status перед commit/PR.
11. Перед передачей проекта запустите локальный smoke checklist:
    `bun run smoke:local-mvp`.
