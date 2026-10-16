# sber-designer

Корпоративный компонентно-осведомлённый AI-редактор для визуальной сборки
интерфейсов прямо поверх реального frontend-проекта.

sber-designer подключается к локальному Git-репозиторию, индексирует
компоненты, HTML/CSS catalog, шаблоны, токены, экраны и flows проекта,
открывает приложение в живом iframe-холсте и позволяет собирать или править
reviewable UI через встроенного агента `ai-product-designer` или подключенный
локальный CLI runtime.

Проще говоря: это on-prem аналог Builder.io Fusion/v0 для корпоративных
frontend-команд, где источником правды остаётся код проекта, а не отдельный
макет или throwaway-артефакт.

## Что умеет продукт

- Подключать локальные React/Vite/Storybook и static HTML/CSS проекты.
- Работать с проектами без Storybook через статический AST-индексатор.
- Создавать HTML-first проекты без Storybook и package install: static pages,
  `Design.md`, `tokens.css`, `components.css`, managed `index.html` и CSS
  catalog.
- Показывать живой DOM-холст из реального dev-server, а не картинку или
  векторную копию.
- Поддерживать три режима редактора:
  - **Interact** — кликабельный предпросмотр приложения.
  - **Design** — выбор элемента на экране и передача его агенту для точечной
    правки.
  - **Code** — просмотр и редактирование исходников.
- Создавать и хранить набор экранов проекта в `.sber-designer/project.sdproj`.
- Строить flow между экранами и запускать демонстрационный сценарий.
- Показывать Flow как дизайнерскую карту прототипа: compact/frames preview,
  visibility controls, screen notes и duplicate screen action.
- Индексировать дизайн-контекст проекта в `.sber-designer/design-index`.
- Импортировать локальные SVG/PNG/WebP паки иконок и иллюстраций в
  `src/assets`, создавать Storybook-разделы `Assets/Icons` /
  `Assets/Illustrations` и добавлять эти ресурсы в проектный индекс.
- Показывать **Project System** overview: готовность индекса, freshness,
  counts и context items, которые агент может использовать без широкого
  сканирования репозитория.
- Хранить **Project Instructions** в `.sdproj`, редактировать их в Settings и
  добавлять в built-in/external agent prompts перед task context.
- Хранить screen-scoped assistant history: история видна дизайнеру, но агент
  получает текущий task context активного экрана; старые задачи видимы в
  истории, но не отправляются модели по умолчанию.
- Принимать prompt attachments: PNG/JPEG/WebP/SVG, текстовые спецификации и
  `.html/.htm` reference documents. HTML сохраняется как run evidence,
  анализируется как недоверенный структурный макет и перестраивается агентом
  через компоненты проекта, а не копируется как raw HTML/CSS/JS.
- Создавать HTML-first design-system proposals из attachment или Pixso URL:
  `design/proposals/*` review, accept/reject, затем root `Design.md`/CSS
  sources and re-index.
- Использовать встроенную агентную систему (product agent kit в
  `packages/agent-kit/kit`) с ролями, навыками,
  знаниями, permission-моделью и безопасными script manifest-файлами.
- Записывать persistent agent runs в `.sber-designer/runs`: manifest,
  timeline, tool receipts и handoff-файл для следующего агента или ревьюера.
- Проверять source до сохранения agent edits: workspace imports, named exports,
  barrels/re-export aliases и project aliases из `tsconfig`/`jsconfig`/Vite.
- Работать с LLM через единый `@sber-designer/llm-gateway`, без прямой
  привязки к одному провайдеру.
- Подключать локальные CLI runtimes как внешних исполнителей: OpenCode, Codex
  CLI и Claude Code обнаруживаются через runtime registry; sber-designer
  остаётся acceptance boundary через контекст, snapshots, receipts и validation.
- Дожидаться появления новых Storybook stories в `/index.json` перед
  render-health, различать browser-backed evidence и слабый static HTTP
  fallback, и сохранять сгенерированный source для repair при runtime ошибке.
- Запускать Pixso/Figma design-source handoff через external runtime: Assistant
  распознает link/selected-frame intent, показывает mini-form, добавляет scoped
  target files и пишет evidence/mapping artifacts в run folder.
- Готовить изменения к delivery через Git/PR workflow.

## Как это работает в двух словах

1. Пользователь открывает sber-designer и подключает локальный проект.
2. Backend запускает sandbox/dev-server для этого проекта.
3. Web-приложение показывает проект в iframe.
4. Индексатор собирает факты о проекте:
   - компоненты;
   - Storybook stories или static AST fallback;
   - HTML/CSS catalog для HTML-first проектов;
   - токены;
   - иконки;
   - ассеты и иллюстрации;
   - routes;
   - зарегистрированные screens;
   - built-in screen templates;
   - agent notes.
5. Из этих фактов строится Project System overview и context shelf:
   компонентные, token, icon, asset, screen, route, example и agent-note записи
   с готовностью, freshness и ссылками на artifact-файлы.
6. Агент получает не весь проект целиком, а структурированный контекст:
   Project System shelf, `.sber-designer/design-index`, active HTML/CSS catalog
   or React component catalog, активный экран, выделенный DOM-элемент,
   комментарии, задачи, prompt attachments и доступные skills. HTML attachments
   попадают в prompt/handoff как compact reference analysis, а исходный файл
   остается в run artifacts для аудита.
7. Когда агент предлагает изменение, sber-designer применяет его как правку
   файлов проекта: `apply_patch`, `write_file`, screen registration или flow
   update.
8. Если выбран локальный CLI runtime, sber-designer строит handoff prompt,
   snapshots allowed target files, пробует снять before/after screenshots и
   принимает результат через no-op/source/visual acceptance boundary. Для
   Pixso/Figma prompts он также добавляет design-source directive и evidence
   pack.
9. Каждый agent run оставляет manifest, timeline и receipts в
   `.sber-designer/runs/<run-id>`, чтобы изменение можно было восстановить,
   продолжить или передать другому агенту.
10. Canvas обновляется через обычный dev-server/HMR, поэтому пользователь видит
    результат как настоящее приложение.

## Для кого это

- **Продуктовый дизайнер** может собирать живые экраны из компонентов, которые
  реально существуют в проекте.
- **Frontend-разработчик** видит обычные `.tsx` файлы, может проверить diff,
  typecheck и отправить PR.
- **Продакт или аналитик** может открыть Demo mode, пройти сценарий, оставить
  комментарии и попросить агента внести правки.

## Обновление: пользователи, auth и Remote Server Beta

Серверный сценарий добавляет первый серверный профиль sber-designer, но не
заменяет локальный продукт. Главное правило обновления: **обычный
`bun run dev` продолжает работать как раньше**, а серверная версия включается
только отдельной командой или production-конфигурацией.

| Профиль            | Команда                    | Проекты                                               | Пользователи и серверные политики                                                        |
| ------------------ | -------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Local              | `bun run dev`              | Исходные папки на диске разработчика, без копирования | Нет login; локальные CLI и текущий provider config работают как раньше                   |
| Auth UI harness    | `bun run dev:user-mode`    | Не является server workspace mode                     | Тестовый `admin@local` / `admin`; только проверка login, Profile, Users и Administration |
| Server dev/staging | `bun run dev:server`       | Managed workspace `<projectsRoot>/<userId>/...`       | Password identity, изоляция пользователей и server policies                              |
| Remote production  | systemd units из `deploy/` | `/srv/sber-designer/projects/<userId>/...`            | Same-origin web + API, nginx/TLS, server auth и persistent data                          |

### Что осталось прежним в local profile

- Проект открывается прямо из выбранной папки на диске и не копируется в
  скрытое хранилище sber-designer.
- Git, sandbox, Storybook/Vite, индексатор и агент работают с этой же папкой.
- Project-owned данные остаются внутри проекта в `.sber-designer/`: экраны,
  flow, descriptions, design-index и связанные metadata.
- Доступны Codex, OpenCode и Claude Code CLI, установленные на этой машине.
- Server roots, аккаунты, server retention, Administration policy и лимит в
  пять sandbox-сессий не включаются.
- Home rail показывается, но нижнего блока пользователя, аватара и account
  menu в local profile нет.
- Settings на Home показывает только системную группу: General, Agent kit,
  Post-checks, LLM providers и MCP servers. Группа Project доступна только
  внутри открытого проекта.
- В меню проекта нет `Duplicate`: новую рабочую копию пользователь создаёт
  обычным `git clone` или копированием папки и затем подключает её отдельно.
- В редакторе нет `Share`, потому что local profile не публикует постоянные
  внешние ссылки. В server profile обе функции остаются доступны внутри
  managed workspace.

### Что добавлено в server profile

**Аккаунты и UI:**

- регистрация по email и паролю;
- Argon2id password hashes, HttpOnly cookie sessions, sliding renewal и
  серверное завершение сессий;
- встроенная SVG CAPTCHA без внешних сервисов, rate limits и блокировка
  abuse-сценариев;
- роли `member` и `admin`, Profile, смена пароля, Home rail и аватар текущего
  пользователя;
- страницы **Users** и **Administration** для админа: поиск, disable/enable,
  reset password, смена роли, управление регистрацией и системными
  переключателями;
- bootstrap первого администратора через server env с обязательной сменой
  временного пароля;
- атрибуция agent runs, busy-состояния и Git-коммитов реальному пользователю.

**Проекты и данные:**

- у каждого пользователя свой список проектов и своё физическое поддерево
  внутри `SBER_DESIGNER_PROJECTS_ROOT`;
- API проверяет владельца workspace, блокирует `..`, symlink escape и прямой
  доступ к чужому пути во всех файловых, Git, patch, design и sandbox
  поверхностях;
- удалённый сервер не видит папки на ноутбуке пользователя: remote-проект —
  это обычный checkout или scaffold на сервере, где запускаются Git,
  dev-server и agent tools;
- источником правды остаётся сам репозиторий проекта и его
  `.sber-designer/*`, а серверный реестр хранит только пользовательские плитки
  и настройки;
- удаление пользователя переносит его workspace'ы в админ-корзину вместе с
  манифестом размера, Git remote и незакоммиченных/неотправленных изменений;
- корзина не очищается автоматически: администратор вручную делает
  **Restore to user…** или необратимый **Purge**.

**Deploy и обновления:**

- production web собирается отдельной командой `bun run build:server` и
  раздаётся same-origin вместе с `/api`;
- `/api/version` и build markers позволяют проверить, что web и API собраны
  из одной версии;
- в `deploy/` есть systemd units, nginx template, env template, backup,
  retention, server update и локальная SSH-обёртка;
- обычное обновление выполняется с рабочей машины одной командой:

  ```bash
  ./deploy/remote-update.sh admin@SERVER <tag-or-branch-or-sha>
  ```

- checkout продукта живёт в `/opt/sber-designer`, а persistent data — вне
  него:

  ```text
  /srv/sber-designer/projects
  /home/sd/.sber-designer
  /etc/sber-designer
  ```

  Поэтому новый commit/tag обновляет код и web build, но не удаляет аккаунты,
  сессии, настройки, проекты, экраны и индексы пользователей.

**Модели и CLI:**

- local profile продолжает использовать локальный `sber-designer.json`, env
  и CLI этой машины;
- в server profile уже работает базовая **Server default** API-модель,
  преднастроенная администратором;
- удалённый backend не видит CLI на ноутбуке пользователя; доступны только
  Server CLI agents, установленные и разрешённые администратором на server
  host;
- персональные API connections из **Settings → LLM providers**, их
  account-scoped encrypted storage и выбор personal model ещё не реализованы
  и не считаются готовой возможностью.

### Граница закрытой беты

Password server mode предназначен для доверенной команды во внутреннем
контуре или на временном тестовом сервере с TLS и закрытой после онбординга
регистрацией. Sandbox пока запускает код проекта от системного пользователя
server host; Docker driver экспериментальный. OIDC/Keycloak не входит в
готовый password-beta contract, пока не закрыта авторизация `/api/events`.

Серверный сценарий пока не закрыт: нужны реальный clean-host deploy, ручная
проверка restore из backup, персональные API-модели, финальный security pass и
release validation. Актуальные документы:

- [как работают local и server workspace](docs/how-it-works/project-workspace-modes.md);
- [пошаговый deploy на удалённый сервер](docs/integrations/remote-server-beta-deploy.md);
- [известные ограничения закрытой беты](docs/integrations/beta-known-limitations.md);
- [модели и CLI в local/server profile](docs/how-it-works/llm-providers-and-runtimes.md).

## Текущий статус

Проект находится в стадии локального MVP и подготовки закрытой Remote Server
Beta. Основной серверный код уже в `main`, но финальные deploy/security gates
ещё открыты.

Уже есть:

- Явно разделённые профили: `bun run dev` для прежней локальной работы и
  `bun run dev:server` для managed server semantics.
- Password auth, offline CAPTCHA, роли, Profile, Users/Administration,
  per-user project roots, workspace confinement, user Trash и реальная
  атрибуция Git/agent runs для серверной беты.
- Same-origin server build, `/api/version`, systemd/nginx templates,
  one-command update, backup и run retention в `deploy/`.
- Projects Home и подключение локальных проектов.
- New Project поддерживает React + Vite и HTML-first static projects.
- Editor shell с режимами Interact / Design / Code.
- Screens, Flow и Demo режимы.
- Flow compact/frames previews, visibility controls for screens/folders/edges,
  screen notes and duplicate screen.
- `.sdproj` файл проекта.
- Storybook/static catalog indexing.
- HTML-first project type: static preview, page create/rename/move,
  managed Screens Index, `Design.md`/`tokens.css`/`components.css`,
  CSS catalog manifest, reference extraction proposals, distill/apply flows and
  deterministic `design-system.html` preview.
- Unified project index в `.sber-designer/design-index`.
- Project System overview в Settings → Indexing project и в агентном
  `get_project_index_status`.
- Встроенный агент `ai-product-designer`.
- Screen-scoped assistant sessions with `New task`, history menu, internal
  current-task context policy, compact icon/count context strip and task
  summaries. The old visible context-mode switcher is not part of the current
  UI.
- Project Instructions in Settings → Project, persisted in `.sdproj` and
  injected into built-in and external runtime prompts.
- Agent kit `packages/agent-kit/kit` с subagents, skills, knowledge и scripts.
- Active agent selector, переключение агента через `Tab`, список агентов через
  `@`.
- Agent Run Timeline: manifest, timeline, receipts и `handoff.md` для каждого
  чата с подключенным workspace; handoff includes user goal, scope, changed
  files, evidence, validation, screenshots, assumptions and next-agent prompt.
- Agent run evidence export: failed/needs-review transcript notices can
  download a JSON evidence manifest that lists run artifacts plus attempt/dev
  log links for support triage.
- Durable prompt attachment evidence: text/markdown/json/yaml/html and image
  files are copied into run artifacts, continuation context snapshots preserve
  source prompts and attachment analysis for `Continue run` / restored chats.
- Sandbox startup diagnostics classify missing binaries, missing dependencies
  and internal-registry package blocks, and the Canvas overlay shows evidence
  plus the next setup action instead of only a raw process exit code.
- Local CLI runtime registry for OpenCode, Codex CLI and Claude Code, with
  model/MCP inventory, runtime selection, Codex/OpenCode stream parsing and
  target-file no-op validation, source-diff classification, explicit
  render-validation unavailability reasons, optional before/after screenshot
  diff and `needs_review` acceptance status.
- Product-owned MCP configuration for API-mode `ai-product-designer`: servers
  live in `sber-designer.json`, status/reload are visible in Settings → LLM
  providers → API MCP servers, and local CLI runtimes keep using their own MCP
  configs.
- Agent tool-call reliability for large BRDs and DeepSeek-style models:
  `read_file` supports `startLine`/`limit`, `write_file` supports
  `contentsLines`, provider abort signals are forwarded, and permission deny
  stops the run as failed.
- Pixso/Figma design-source handoff MVP: parser, ChatPanel mini-form,
  new-screen/replace-current target policy, evidence pack, mapping-report
  template and `proj-mcp create_screen`.
- Minimal craft gates: автоматическая post-check проверка экранов после
  файловых agent edits, включая dense table/list component-family findings;
  переключатель находится в Settings → Agent kit.
- Task-relevant component packs for generation/editing: роль-ориентированный
  подбор компонентов из design-index, public import contract guidance, и
  понижение low-confidence implementation records, когда рядом есть public
  barrel/index record.
- Workspace import validation for agent writes: относительные и project-alias
  imports резолвятся как TypeScript/Vite candidates, named imports проверяются
  через barrels/re-exports, а несуществующие public symbols блокируются до
  финального render run.
- Storybook readiness and render-health hardening: new/changed stories poll
  Storybook `index.json`, static HTTP preview evidence is marked weak, and
  Chrome-backed evidence is used when `SBER_DESIGNER_CHROME_DEBUGGING_URL` is
  configured.
- Storybook asset packs: импорт локальных папок иконок/иллюстраций через
  Settings → Indexing project с автоматическим re-index.
- Design-readable screen contract для экранов, которые агент генерирует или
  ремонтирует.
- Git/PR workflow для controlled delivery.

Еще развивается:

- завершение серверного сценария: clean-host deploy, backup restore drill,
  personal API connections в Settings, security pass и финальная server
  validation;
- Project Design System Stage 1: top-bar Design System Browser module and setup
  profiler/status now support editable shared setup answers, metadata previews/
  actions and agent-note add/edit/delete; semantic search, pre-run freshness and
  templates/fidelity are not implemented yet;
- Pixso/Figma setup polish: OpenCode MCP setup UI, smoke tests and secondary
  Figma docs;
- более глубокий Context Shelf UI поверх Project System и assistant history,
  без возврата старого Assistant context-mode switcher;
- более глубокая визуальная правка без участия чата: props, variants, tokens,
  component swap;
- desktop shell и enterprise packaging поверх текущей single-host server beta;
- CI regression harness для golden agent tasks.

## Быстрый старт

Короткий вариант только с последовательными командами находится в
[QUICKSTART.md](QUICKSTART.md).

Требования:

- Bun `>= 1.2` — проверено на 1.2.13. Текстовый `bun.lock` (lockfileVersion 1)
  читается только Bun 1.2+, CI закреплён на 1.2.13;
- Node.js `>= 20`;
- локальный frontend-проект для подключения.

Установка зависимостей:

```bash
bun install
```

В CI и при воспроизводимой установке — `bun install --frozen-lockfile`.

Личные настройки, которые не должны попадать в общий репозиторий (MCP-сервер с
абсолютным путём на вашей машине, другой default provider), кладите в
`sber-designer.local.json` — он в `.gitignore` и накладывается поверх
`sber-designer.json` глубоким merge. Шаблон: `sber-designer.local.example.json`.

Запуск всего локального окружения:

```bash
bun run dev
```

Эта команда запускает три процесса:

- `services/api` — backend API;
- `services/sandbox` — sandbox/dev-server controller;
- `apps/web` — web-редактор.

После запуска откройте:

```text
http://localhost:5173
```

Если этот порт уже занят другим worktree/profile, `dev-all` выбирает следующий
свободный web-порт и печатает точный адрес в строке `web
http://localhost:<port>`. Открывайте URL именно из этой строки.

Для локальной проверки полного server profile используйте отдельную команду
`bun run dev:server` и задайте тестовые managed roots. Готовая последовательность
с изолированными test data и bootstrap admin приведена в
[QUICKSTART.md](QUICKSTART.md#серверный-профиль-для-локального-теста).

Отдельные команды:

```bash
bun run dev:web
bun run dev:api
bun run dev:sandbox
```

Сборка:

```bash
bun run build          # local profile
bun run build:server   # server profile
```

Проверки:

```bash
bun run build:info     # BUILD_INFO.json; нужен vite.config и тестам версии на свежем клоне
bun run typecheck      # tsc по пакетам; gate сравнивает с typecheck-baseline.json
bun run test           # весь автоматический набор (без демо-проектов в projects/)
bun run lint           # oxlint
bun run format:check   # Prettier
```

Локальный browser smoke (реальный Chromium, поднимает api + sandbox + собранный
web на свободных портах с offline mock-провайдером; ничего не уходит в сеть):

```bash
bunx playwright install chromium   # один раз
bun run build                      # smoke проверяет собранный бандл
bun run smoke:browser
```

Он проверяет то, чего не видят endpoint-пробы и тесты на строки в исходниках:
Home не тянет Monaco/граф редактора и укладывается в бюджет JS, HTML-first
проект открывается в редакторе, Interact/Design/Code делят **один** iframe
песочницы, Monaco грузится по требованию и только со своего origin, состояние
проекта переживает reload.

## Как подключить проект

1. Запустите `bun run dev`.
2. Откройте `http://localhost:5173`.
3. Нажмите **Connect repo**.
4. Укажите абсолютный путь к локальному проекту.
5. После открытия проекта проверьте Settings -> Indexing project: там видно
   freshness/status индекса и можно запустить re-index.
6. Откройте **Design System Browser** кнопкой в top bar, чтобы проверить
   profile/setup health, запустить setup profiler, отредактировать shared
   answers или добавить guidance для компонентов.

Для нового статического проекта выберите **New project -> HTML-first**. С
starter files sber-designer создаст `.sdproj`, `index.html`, `Design.md`,
`tokens.css` и `components.css`, сразу откроет static preview и позволит
создавать отдельные HTML screens без Storybook.

В подключенном проекте sber-designer может создать или обновить:

```text
.sber-designer/
  project.sdproj
  assets/
  design-index/
  runs/
  previews/
```

Если в проекте есть `.agents`, она будет объединена с базовой агентной системой
sber-designer.

## Как настроить MCP для API mode

Для встроенного `ai-product-designer` с обычным API-провайдером MCP
настраивается в корневом `sber-designer.json`, в секции `mcpServers`. Это
отдельный product-owned config: OpenCode, Codex CLI и Claude Code по-прежнему
используют свои собственные MCP-настройки.

Ручная правка `sber-designer.json` считается согласием на подключение:
отдельного trust/hash шага нет. Remote MCP не блокируется, но Settings
показывает предупреждение, что tool calls и выбранный контекст могут уйти на
этот endpoint.

Стандартные Pixso entries:

```json
{
  "mcpServers": {
    "pixso-desktop": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:3667/mcp",
      "enabled": true,
      "timeoutMs": 30000,
      "description": "Pixso Desktop Local MCP. Enable Pixso MCP in Pixso Desktop before reloading this server in Settings."
    },
    "talk-to-pixso-mcp": {
      "type": "stdio",
      "command": "bun",
      "args": ["run", "./dist/server.js"],
      "cwd": "/absolute/path/to/simple-pixso-mcp",
      "enabled": true,
      "timeoutMs": 100000,
      "description": "Local first-party simple-pixso-mcp adapter. Read-oriented default tool set for importing Pixso context into sber-designer.",
      "connectTool": {
        "tool": "connect_to_pixso",
        "requiresChannel": false
      },
      "allowedTools": [
        "connect_to_pixso",
        "get_document_info",
        "get_selection",
        "read_my_design",
        "set_focus",
        "set_selections",
        "get_node_info",
        "get_nodes_info",
        "scan_text_nodes",
        "scan_nodes_by_types",
        "get_annotations",
        "get_image_by_hash",
        "get_local_components",
        "get_all_components",
        "get_component_source_summary",
        "get_component_variants",
        "get_component_variants_by_key",
        "get_component_set_variants",
        "get_instance_component_variants",
        "get_component_json_by_key",
        "get_library_list",
        "get_library_assets",
        "get_library_components_in_use",
        "get_library_styles_in_use",
        "get_styles",
        "get_style_by_id"
      ]
    }
  }
}
```

Hosted/remote first-party development вариант для `simple-pixso-mcp`:

```json
{
  "mcpServers": {
    "talk-to-pixso-mcp": {
      "type": "remote",
      "url": "https://pixso-mcp.online/mcp",
      "enabled": true,
      "timeoutMs": 100000,
      "description": "First-party hosted Pixso MCP adapter from simple-pixso-mcp."
    }
  }
}
```

После правки JSON откройте **Settings → LLM providers → API MCP servers** и
нажмите **Reload**. UI показывает `Connected` / `Not connected` / `Failed`,
endpoint или command, remote warning, diagnostics, runtime switcher и
сворачиваемый список tools. Switcher выключает server только для текущего
runtime и не удаляет entry из `sber-designer.json`.

## Структура репозитория

```text
.
├── apps/
│   ├── web/              React + Vite web-редактор
│   │                     (панели в components/editor + фичевые подпапки
│   │                     chat/, screens/, settings/, design-panel/;
│   │                     HTTP-клиент по доменам в lib/api/)
├── services/
│   ├── api/              Bun + Hono backend
│   │                     (агент: agent/tools/, agent/run-record/;
│   │                     SSE-ран: routes/chat-stream/; design-context/)
│   └── sandbox/          запуск и контроль dev-server подключенного проекта
├── packages/
│   ├── ast-bridge/       связь DOM/source location с JSX и безопасные AST-правки
│   ├── babel-plugin-sd-loc/
│   │                     fallback для source-location атрибутов
│   ├── design-indexer/   генерация `.sber-designer/design-index`
│   ├── llm-gateway/      единый шлюз к LLM-провайдерам
│   ├── agent-kit/        дефолтный продуктовый agent kit (kit/) и
│   │                     resolveDefaultKitRoot() (ADR-0020)
│   ├── proj-mcp/         MCP/HTTP мост для внешних coding agents
│   ├── shared-types/     общие TypeScript-типы и схемы
│   └── storybook-indexer/
│                         Storybook index.json и static AST catalog
├── examples/
│   └── sample-storybook/ fixture-проект для sandbox/catalog smoke tests
├── projects/             демо-проекты для ручной проверки (React/Storybook,
│                         HTML-first, UI-kit)
├── .agents/              кит агентов-разработчиков sber-designer (dev kit)
├── docs/                 how-it-works, architecture/ADR, integrations
├── scripts/              dev/build/validation helper-скрипты
└── sber-designer.json    конфигурация LLM и project-level настроек
```

## Основные файлы проекта

- `README.md` — обзор продукта.
- `QUICKSTART.md` — только последовательные команды для local и test server
  запуска.
- `docs/how-it-works/` — текущая системная документация по модулям продукта.
- `docs/how-it-works/system-overview.md` — как работает система в целом.
- `docs/how-it-works/code-map.md` — карта кода: где какой модуль лежит,
  принцип фасадов, таблица «куда вносить изменение».
- `docs/how-it-works/agent-system.md` — как устроена агентная система.
- `CLAUDE.md` и `AGENTS.md` — правила для AI coding agents, работающих в этом
  репозитории.
- `docs/architecture/adr/` — архитектурные решения.
- `THIRD_PARTY_NOTICES.md` — сведения о стороннем коде и заимствованиях.
- `LICENSE` — условия использования.
- `DISTRIBUTION.md` — что это за срез продукта и что сознательно не передано.

## Агентная система

Базовый (продуктовый) agent kit находится в:

```text
packages/agent-kit/kit/
```

Корневая `.agents/` — отдельный кит: инструкции и навыки для агентов,
разрабатывающих сам sber-designer.

Главный агент:

```text
ai-product-designer
```

Он умеет:

- читать проектный индекс;
- выбирать компоненты и токены;
- находить импортированные project assets через `assets.jsonl` и
  `get_indexed_asset`;
- генерировать Design-readable screens;
- править выбранный элемент из Design mode;
- работать с built-in screen templates и Storybook template stories;
- запускать разрешенные scripts;
- делегировать задачи subagents.

Важные особенности:

- агент всегда работает в контексте подключенного проекта;
- skills и knowledge загружаются по требованию, а не целиком в каждый prompt;
- scripts описываются безопасными JSON manifest-файлами;
- permissions решают, что агент может делать сам, что требует подтверждения,
  а что запрещено;
- каждый chat/stream run получает `runId`, а успешные `write_file` и
  `apply_patch` сохраняют JSON receipts;
- screen-scoped assistant sessions сохраняют историю по экрану и отправляют
  модели только активный task context по выбранной политике;
- в Settings → Agent kit включен по умолчанию **Screen craft check**, который
  запускает `validate_screen_craft` после успешных файловых правок агента;
- `write_file` / `apply_patch` проходят workspace import validation перед
  сохранением: guard читает project aliases, проверяет barrels/named exports и
  блокирует internal implementation names, если public module их не экспортирует;
- пользователь может добавить проектную `.agents` папку в подключенном проекте.

Подробно это описано в
[docs/how-it-works/agent-system.md](docs/how-it-works/agent-system.md).

## Unified project index

Главный источник контекста для агента:

```text
<connected-project>/.sber-designer/design-index/
```

Там лежат:

- `manifest.json`;
- `project-profile.json`;
- `project-profile.answers.json`;
- `components.jsonl`;
- `html-css-catalog-manifest.json`;
- `component-groups.json`;
- `tokens.json`;
- `icons.json`;
- `icon-candidates.jsonl`;
- `icon-catalog.md`;
- `assets.jsonl`;
- `routes.json`;
- `screens.jsonl`;
- `usage-examples.jsonl`;
- `agent-notes.jsonl`;
- `diagnostics.json`;
- `prompt-summary.md`.

Этот индекс заменяет старую идею, где агент в основном ориентировался на
`DESIGN.md` и `component-selection-map.md`. Эти файлы могут оставаться как
fallback или compatibility layer, но новая логика строится вокруг
`.sber-designer/design-index`.

Поверх raw artifacts sber-designer строит **Project System**:

- `freshness` — `ready`, `stale`, `missing`, `needs-attention` или `error`;
- `nextAction` — что делать дальше: index, re-index, review diagnostics или
  можно работать;
- `contextItems` — готовые полки контекста: components, tokens, icons, screens,
  routes, examples и agent notes;
- compact summary для prompt-builder и `get_project_index_status`.

Это первый слой Context Shelf: агент видит, какие записи уже готовы, какие
пустые или устарели, и когда нужно попросить пользователя переиндексировать
проект.

Из top bar отдельным окном открывается **Design System Browser**: он показывает
profile/setup health, категории components/tokens/icons/assets/screens/routes/
notes, поиск, detail panel, metadata previews, copy/context actions, setup
profiler и shared comments for AI agents. Confirmed setup answers сохраняются в
`project-profile.answers.json`, а component/project guidance — в
`agent-notes.jsonl`.

## Agent runs

Каждый запрос к встроенному агенту или локальному CLI runtime при подключенном
workspace создает runtime-папку:

```text
<connected-project>/.sber-designer/runs/<run-id>/
  run-manifest.json
  timeline.jsonl
  continuation-context.json
  attachments/
    attachments.json
    01-reference.png
    02-reference.html
  receipts/
    *.json
  reference/
    design-source/
      source-summary.md
      mapping-report.md
      manifest.json
  external-runtime/
    prompt.md
    agent-kit-summary.md
  screenshots/
    before.png
    after.png
  handoff.md
```

- `run-manifest.json` хранит route, provider/model, project, user goal,
  active screen и status run.
- `timeline.jsonl` фиксирует события run: старт, tool receipts, завершение или
  ошибку.
- `continuation-context.json` хранит compact source prompt, active target,
  attachment evidence/HTML analysis, changed files and last tool calls for
  `Continue run` and restored chats.
- `attachments/*` хранит prompt attachment evidence. HTML files are copied as
  source evidence; prompts receive sanitized structure/intent analysis and an
  explicit "do not copy raw HTML/CSS/JS" contract.
- `receipts/*.json` сохраняют проверяемый след tool-вызовов, пока для
  `write_file`, `apply_patch`, `validate_screen_craft` и external runtime
  target-diff validation.
- attempt/dev-run logs and manifests cross-link each other through diagnostics
  and log-link events, so a copied support artifact can point to the rest of
  the run evidence.
- `GET /api/agent-runs/<run-id>/evidence` and the Assistant "Export evidence"
  action return a folder-like JSON manifest with run artifacts, prompt
  attachments, continuation context, design-source references, screenshots,
  receipts and external log links.
- `reference/design-source/*` появляется для Pixso/Figma runs: source summary,
  token/component mapping report and machine manifest.
- `handoff.md` дает файл передачи контекста следующему агенту или человеку на
  ревью: user goal, scope, changed files, source/design evidence, validation,
  screenshots, open assumptions, next-agent prompt and craft findings.

В Assistant panel после завершения run показывается путь к manifest-файлу.
Для failed/needs-review runs рядом с notice доступен экспорт evidence JSON.

## Minimal craft gates

Craft gates — это lightweight post-check слой против типичного AI-generated UI
в продуктовых экранах. Сейчас `validate_screen_craft` проверяет:

- invented-looking business metrics без `mock/sample` пометки;
- raw hex colors, когда в проекте есть индексированные design tokens;
- icon-only buttons без `aria-label`, `aria-labelledby` или `title`;
- data-heavy surfaces без явных empty/loading/error states;
- raw flex/static row data regions when a matching indexed data table/list
  component family is available;
- card-heavy layouts без workflow/table/form surface;
- marketing hero language внутри operational UI.

Post-check включен по умолчанию. Его можно выключить в Settings → Agent kit →
Post-checks → **Screen craft check**. Проверка не блокирует запись файла:
findings записываются в run receipts и `handoff.md`, а агент или следующий
ревьюер видит, что нужно исправить или осознанно отложить.

## Design-readable screens

sber-designer должен открывать любой проект хотя бы в базовом режиме: можно
выбрать элемент на экране и отправить его агенту как контекст.

Но экраны, которые создает или ремонтирует `ai-product-designer`, должны быть
более структурированными:

- отдельный editable implementation file;
- тонкий Storybook wrapper, если нужен Storybook;
- screen record в `.sber-designer/project.sdproj`;
- запись в `.sber-designer/design-index/screens.jsonl`;
- JSX без скрытого raw HTML;
- простые props, text и className там, где ожидается визуальная правка;
- использование компонентов и токенов проекта.

Такой экран называется Design-readable screen.

Для HTML-first проекта Design-readable screen - это semantic `.html` page с
`data-sd-screen-root`, registered `ProjectScreen.kind: "page"`, tokens из
`tokens.css` и reusable classes из `components.css`/CSS catalog. Root
`index.html` остается managed Screens Index, а не target новой страницы.

## Документация

- [docs/how-it-works/](docs/how-it-works/) — текущая системная документация по
  фичам и модулям.
- [docs/how-it-works/system-overview.md](docs/how-it-works/system-overview.md)
  — как работает система в целом.
- [docs/how-it-works/html-first-projects.md](docs/how-it-works/html-first-projects.md)
  — полный пользовательский путь и нюансы HTML-first project type.
- [docs/how-it-works/agent-system.md](docs/how-it-works/agent-system.md) — как
  устроены агенты.
- [docs/architecture/adr/](docs/architecture/adr/) — архитектурные решения.
- [docs/integrations/](docs/integrations/) — интеграционные инструкции.

## Лицензии и сторонний код

Проект является внутренним/proprietary MVP. Сведения о сторонних зависимостях,
заимствованиях и лицензионных уведомлениях находятся в
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
