# Деплой sber-designer на удалённый сервер (закрытая бета)

Пошаговый гайд: как развернуть и запускать рабочую версию sber-designer на
удалённом Linux-сервере (доступ по SSH) для закрытого бета-теста — один
сервер, доступ по ссылке. В `password`-режиме у каждого пользователя свой
реестр проектов и своё поддерево workspace'ов.

Гайд написан под **текущий main** и честно помечает бета-оговорки; он
обновляется по мере закрытия этапов серверного сценария — пользователи,
аутентификация и серверный релиз. Enterprise-путь (OIDC, Docker-sandbox,
compose) описан там же, в разделе «enterprise-путь после беты».
Перед выдачей доступа прочитайте также
[известные ограничения закрытой беты](beta-known-limitations.md).

> **Два разных режима запуска.** Обычный `bun run dev` остаётся локальным
> режимом: backend работает на компьютере разработчика с выбранными папками и
> локальными CLI, без managed server workspace. Удалённый production запускают
> только через `sd-api`/`sd-sandbox` systemd-юниты ниже. Для server
> dev/staging есть отдельный `bun run dev:server`: он включает те же managed
> workspace/auth-ограничения и не подменяется обычным local-запуском.

> ⚠️ **Обязательное условие.** Продукт исполняет код (агент пишет файлы,
> запускает git и dev-серверы). Не публикуйте его без гейта: включите
> встроенный `password`-режим, TLS и держите регистрацию открытой только на
> время онбординга. Закрытая сеть/VPN и Basic Auth на reverse proxy остаются
> полезным опциональным вторым забором. «Никто не знает ссылку» — не защита.

## 0. Что получится

```text
Браузер тестера (VPN) ──HTTPS──▶ nginx  :443
                                  ├── /            static  apps/web/dist
                                  └── /api/*       proxy → services/api   127.0.0.1:3000
                                       │  (SSE /api/chat/stream, WS /api/events,
                                       │   превью канваса /api/preview/*)
                                       └──────────▶ services/sandbox      127.0.0.1:3001
                                                    (спавнит dev-серверы проектов)

Данные на диске:
  /opt/sber-designer                     код (git checkout)
  /srv/sber-designer/projects/<userId>/  приватные workspace'ы пользователя,
                                         включая .sber-designer/previews/cover.*
  /srv/sber-designer/projects/.trash/    админ-корзина удалённых workspace'ов
  ~sd/.sber-designer/users/<userId>/     projects.json, settings.json, thumbnails/
                                          после personal-model части Этапа 11 —
                                          encrypted model connections
  /etc/sber-designer/env                 env-файл (секреты провайдеров и пр.)
```

Наружу смотрит только nginx. Канвас/превью не требуют прямого доступа к
dev-серверам — всё проксируется через `/api/preview/*`.

## 0.1 Как публикуем обновления продукта

Основной путь серверного сценария — **один удалённый Linux-сервер** под нашим
контролем. Это может быть VPS, bare-metal или VM; важно не слово «VM», а
чистота окружения: свежий host или новый пользователь `sd` без старого
checkout'а, `/etc/sber-designer`, `~sd/.sber-designer` и projects root.

Целевой пользовательский сценарий публикации:

```text
разработчик делает commit/tag
  → push в git remote
  → deploy/remote-update.sh admin@SERVER <tag-or-branch-or-sha>
  → сервер fetch/checkout этого ref
  → bun install --frozen-lockfile + build web
  → restart sd-sandbox/sd-api
  → health/version/smoke
  → тестирование локально или на удалённом стенде
```

Главная гарантия обновления: код в `/opt/sber-designer` можно менять, а
пользовательские данные остаются на месте. `deploy/update.sh` не должен
удалять или перетирать:

- `/srv/sber-designer/projects` — workspace'ы пользователей и `.trash/`,
  включая project-owned `.sber-designer/previews/cover.*`;
- `/home/sd/.sber-designer` — auth-store, user registries, settings,
  thumbnails;
- `/etc/sber-designer` — env и `sber-designer.json`.

Если новая версия меняет формат файловых данных, рядом с обновлением нужна
миграция или явная migration-note, а перед запуском — backup. Обычные
обновления продукта должны быть бесшовными: пользователи продолжают работу с
теми же аккаунтами, проектами, корзиной и наработками, но уже на новой версии
приложения.

Этап 10 оформляет это в `deploy/update.sh` на сервере и локальную
SSH-обёртку `deploy/remote-update.sh`, чтобы обновление запускалось одной
командой с ноутбука. Внешний CI не обязателен для закрытой беты; GitHub
Actions, Vercel или другой CI позже могут просто запускать тот же серверный
сценарий по push/tag, но не заменяют инвариант сохранения серверных данных.

Минимальный пошаговый маршрут для первого стенда:

1. Поднять чистый удалённый Linux-сервер или создать нового системного
   пользователя `sd` на существующем сервере.
2. Установить git/Bun/Node/nginx и создать каталоги из шагов 2–3.
3. Доставить код в `/opt/sber-designer`, выполнить
   `bun install --frozen-lockfile` и
   `bun run build:server`.
4. Заполнить `/etc/sber-designer/env` и
   `/etc/sber-designer/sber-designer.json`.
5. Включить `sd-api` и `sd-sandbox` через systemd, затем nginx/TLS.
6. Прогнать smoke и ручной сценарий тестера.
7. После Этапа 10 использовать `deploy/update.sh`/`remote-update.sh` и
   `backup.sh` вместо ручных команд обновления и бэкапа.

## 1. Требования

- **Сервер:** Linux x86_64 (проверяем на Ubuntu 22.04/24.04), sudo по SSH.
  Минимум 4 vCPU / 8 GB RAM / 40 GB диска; для нескольких одновременных
  Storybook-сессий лучше 8 vCPU / 16 GB (живой dev-server ест ~1–2 GB).
  Считайте бюджет как `RAM для API/ОС + 1–2 GB × max sessions`; дефолтный
  лимит пяти сессий рассчитан минимум на 8 GB и лёгкие проекты, для тяжёлых
  Storybook-проектов уменьшите его.
- **Сеть:** закрытый контур (VPN/интранет). Доступ к LLM-endpoint'ам из
  контура (on-prem модель или разрешённый egress к API провайдера).
- **Софт:** git ≥ 2.34, curl, unzip; **Bun ≥ 1.2** (основной рантайм,
  проверено на 1.2.13 — текстовый `bun.lock` требует 1.2+);
  Node.js ≥ 20 LTS (для dev-серверов подключаемых проектов — Storybook/Vite
  внутри пользовательских репо часто ожидают node/npm); nginx.
- Опционально: Docker (экспериментальный sandbox-driver), Chromium
  (browser-backed render evidence), CLI-агенты (Claude Code / Codex /
  OpenCode) — для внешних CLI-рантаймов, бете не обязательны.

## 2. Пользователь и каталоги

```bash
sudo useradd --system --create-home --shell /bin/bash sd
sudo mkdir -p /opt/sber-designer /srv/sber-designer/projects /etc/sber-designer
sudo chown -R sd:sd /opt/sber-designer /srv/sber-designer
sudo chmod 750 /srv/sber-designer/projects
```

Git-identity сервисного пользователя (от этого имени пойдут коммиты агента —
общая identity на всю бету, это известное ограничение):

```bash
sudo -u sd git config --global user.name  "sber-designer beta"
sudo -u sd git config --global user.email "sber-designer-beta@internal"
```

## 3. Установка рантаймов

```bash
# Bun (основной рантайм api/sandbox/сборки)
sudo -u sd bash -c 'curl -fsSL https://bun.sh/install | bash'
# → бинарник /home/sd/.bun/bin/bun
sudo -u sd /home/sd/.bun/bin/bun --version

# Node 20 LTS (для dev-серверов подключаемых проектов)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

sudo apt-get install -y git nginx apache2-utils   # apache2-utils → htpasswd
```

В закрытом контуре без egress: используйте внутренние зеркала/офлайн-установку
Bun/Node — сами шаги ниже не меняются.

## 4. Код и зависимости

Репозиторий приватный — на сервер он попадает либо clone'ом по внутреннему
git-remote, либо `rsync` с рабочей машины:

```bash
# вариант А: внутренний remote
sudo -u sd git clone <internal-remote-url> /opt/sber-designer

# вариант Б: rsync с ноутбука (из корня репо; без node_modules)
rsync -a --exclude node_modules --exclude .git/objects/pack ./ sd@SERVER:/opt/sber-designer/
```

```bash
cd /opt/sber-designer
sudo -u sd /home/sd/.bun/bin/bun install --frozen-lockfile
```

## 5. Конфигурация

### 5.1 env-файл

`/etc/sber-designer/env` (читается systemd-юнитами; `.env` в корне репо API
тоже умеет читать — `services/api/src/local-env.ts`, — но для сервера держите
конфиг вне checkout'а, чтобы `git pull` его не трогал):

```bash
sudo install -m 600 -o root -g sd /opt/sber-designer/deploy/env.example /etc/sber-designer/env
sudo editor /etc/sber-designer/env
```

```bash
# --- ядро ---
PORT=3000
SBER_DESIGNER_SANDBOX_URL=http://127.0.0.1:3001
SBER_DESIGNER_CONFIG_PATH=/etc/sber-designer/sber-designer.json
SBER_DESIGNER_DEPLOYMENT_MODE=server
SBER_DESIGNER_BUN_PATH=/home/sd/.bun/bin/bun

# --- встроенные аккаунты ---
SBER_DESIGNER_AUTH_MODE=password
SBER_DESIGNER_BOOTSTRAP_ADMIN_EMAIL=owner@company.internal
SBER_DESIGNER_BOOTSTRAP_ADMIN_PASSWORD=replace-with-a-long-temporary-password
SBER_DESIGNER_TRUST_PROXY=1
SBER_DESIGNER_CAPTCHA=always
SBER_DESIGNER_SERVICE_TOKENS=smoke:<64-hex>,mcp:<64-hex>
# SBER_DESIGNER_ADMIN_EMAILS=owner@company.internal,backup-admin@company.internal
# SBER_DESIGNER_ALLOWED_ORIGINS=https://separate-web.internal

# --- данные ---
SBER_DESIGNER_PROJECTS_ROOT=/srv/sber-designer/projects
SBER_DESIGNER_USERS_ROOT=/home/sd/.sber-designer/users
# Только для миграции старого общего реестра Этапа 0:
# SBER_DESIGNER_PROJECTS_REGISTRY_PATH=/home/sd/.sber-designer/projects.json
# SBER_DESIGNER_PROJECT_THUMBNAILS_DIR=/home/sd/.sber-designer/thumbnails

# --- секреты LLM-провайдеров (имена — те, что стоят в {env:...} конфига) ---
DEEPSEEK_API_KEY=...
# GIGACHAT_API_KEY=...

# --- sandbox (отдельный юнит переопределяет PORT) ---
SBER_DESIGNER_SANDBOX_MAX_SESSIONS=5
SBER_DESIGNER_RUNS_RETENTION_DAYS=30
# SBER_DESIGNER_SANDBOX_DRIVER=docker    # опционально; default local-spawn
```

При первом старте API создаёт bootstrap-пользователя с ролью admin и
`mustChangePassword=true`; пароль хранится только как Argon2id-хеш. После
первого входа смените временный пароль. Обе bootstrap-переменные обязательны
вместе. `SBER_DESIGNER_TRUST_PROXY=1` разрешает доверять
`X-Forwarded-Proto: https` от nginx и выставлять cookie `Secure`; не включайте
его, если к API можно обращаться в обход доверенного прокси.

Для локальной проверки user mode без сервера выполните `bun run
dev:user-mode`: при пустом auth-store будет создан `admin@local` / `admin`.
Этот seed жёстко запрещён при заданном `SBER_DESIGNER_PUBLIC_URL` и не должен
использоваться на стенде. Это auth/admin test harness, а не server profile:
он не должен менять обычную работу с локальными папками и CLI.

Сгенерируйте независимые service tokens командой `openssl rand -hex 32` и
подставьте результаты вместо `<64-hex>`. Они нужны только небраузерным
клиентам (smoke/proj-mcp), передаются в отдельном заголовке и получают
identity `svc:smoke` / `svc:mcp`. Не используйте bootstrap-пароль как token.

Для юнита sandbox нужен свой `PORT=3001` — он задаётся прямо в unit-файле
(шаг 6), чтобы не путать с портом api.

`SBER_DESIGNER_PROJECTS_ROOT` обязателен для серверной беты: общий API guard,
connect, scaffold и FolderPicker ограничиваются
`<SBER_DESIGNER_PROJECTS_ROOT>/<userId>/`, включая защиту от `..`, выхода
через symlink и прямой передачи чужого `workspacePath` в git/patch/design и
другие API. Если конкретный запрос не передал путь, сервер берёт только
активный workspace текущего аккаунта, а не последний проект другого
пользователя. `SBER_DESIGNER_SANDBOX_MAX_SESSIONS=0` полностью запрещает
новые sandbox-сессии; при достижении положительного лимита API отвечает 429,
пока сессия не будет остановлена или заменена новой сессией того же проекта.
Перед проверкой лимита reaper выбрасывает завершившиеся/упавшие записи, чтобы
они не занимали бюджет живых dev-серверов.

Лимит `5` — только server default. Обычный `bun run dev` не ограничивает
число локальных sandbox-сессий, если разработчик сам не задал
`SBER_DESIGNER_SANDBOX_MAX_SESSIONS`; это сохраняет прежнее локальное
поведение.

`SBER_DESIGNER_RUNS_RETENTION_DAYS=30` включает чистку старых
`.sber-designer/runs/<run-id>` artifacts. Это локальные diagnostics/evidence,
а не источник правды проекта; `project.sdproj`, descriptions и authored
project files не удаляются. Пустое значение, `0`, `false` или `off` выключают
retention.

### 5.2 Anti-abuse

В `password`-режиме капча по умолчанию включена для регистрации
(`SBER_DESIGNER_CAPTCHA=register`). Она генерируется внутри API библиотекой
`svg-captcha`: символы отдаются как SVG-пути, приложенный шрифт читается
локально, сетевых запросов нет. Challenge одноразовый, живёт 5 минут; процесс
держит не более 500 живых challenge.

Режимы:

- `register` — капча на регистрации и после пяти неудачных входов за 15 минут;
- `always` — капча на каждой регистрации и каждом входе; рекомендуемый режим
  для стенда, доступного из публичной сети;
- `off` — только для доверенного внутреннего контура; IP-лимиты и блокировка
  после 15 неудачных входов всё равно остаются активны.

API ограничивает вход до 10 запросов/мин/IP, регистрацию до 5/час/IP и выдачу
капчи до 30/час/IP. После пяти неверных паролей по одному email ответ 401
содержит `captchaRequired: true`; после 15 учётная запись блокируется на 15
минут с 423 и `retryAfter`. Эти счётчики однопроцессные и сбрасываются при
рестарте API.

`X-Forwarded-For` учитывается только при `SBER_DESIGNER_TRUST_PROXY=1`.
Включайте эту переменную лишь когда API слушает внутренний адрес и доступен
только через контролируемый nginx; иначе клиент сможет подменять IP. Сам nginx
должен перезаписывать, а не дополнять пришедший от клиента заголовок:

```nginx
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
```

### 5.3 Access control

В `password`-режиме анонимно доступны только `/health`, `/api/version`,
status/captcha/login/register, чтение share по токену и
`/api/preview-share/<token>/*`. `/api/config`, обычный preview, WebSocket,
SSE и все остальные API требуют сессию или service token; новые `/api/*`
роуты автоматически попадают под тот же guard.

Для браузера API использует HttpOnly-cookie. Мутирующие session-запросы
дополнительно проверяют `Origin`; CORS разрешает credentials только
same-origin и origin'ам из `SBER_DESIGNER_ALLOWED_ORIGINS`. При пустой
переменной дополнительно разрешены локальные Vite origin'ы
`http://localhost:5173` и `http://127.0.0.1:5173`. На production same-origin
задавать allowlist не требуется.

Service token передаётся так:

```bash
curl -H 'x-sber-designer-service-token: <smoke-token>' \
  https://sd-beta.internal/api/config
```

### 5.4 Администрирование и break-glass

Администратор — обычная учётная запись с ролью `admin`. После входа ей
доступны **Users** (`/admin/users`) и **Administration** (`/admin/system`):
роли/блокировка/reset-password, открытие регистрации, системный дефолт DS
Browser и allowlist CLI-агентов. Disable и reset-password немедленно отзывают
сессии пользователя. Последнего активного администратора разжаловать или
заблокировать нельзя.

Удаление доступно только для disabled-аккаунта и требует ввести его email.
Перед удалением UI показывает размер и git-риск проектов. Workspace'ы
переносятся через rename в `/srv/sber-designer/projects/.trash/<entryId>/`,
а пользовательский реестр — в `~sd/.sber-designer/users/.trash/<entryId>/`.
На странице **Users → Trash** администратор может вернуть отдельный проект
активному пользователю (**Restore to user…**) или удалить проект/запись
окончательно (**Purge** с ручным подтверждением). Автоочистки и TTL нет.

При первом чтении реестра первым администратором старый общий
`SBER_DESIGNER_PROJECTS_REGISTRY_PATH` импортируется в его список с отметкой
`legacy`; исходный файл не меняется. Назначение владельцев и перенос старых
workspace'ов выполняйте вручную по SSH. Обычные пользователи эти записи не
видят.

Если доступ к UI потерян, выполните break-glass CLI по SSH от системного
пользователя `sd` (чтобы читался `/home/sd/.sber-designer/auth/`):

```bash
cd /opt/sber-designer
sudo -u sd /home/sd/.bun/bin/bun run auth:admin list
sudo -u sd /home/sd/.bun/bin/bun run auth:admin promote owner@company.internal
sudo -u sd /home/sd/.bun/bin/bun run auth:admin reset-password owner@company.internal
sudo -u sd /home/sd/.bun/bin/bun run auth:admin disable former-user@company.internal
```

`reset-password` печатает временный пароль один раз; передайте его безопасным
каналом и очистите terminal scrollback/history по правилам контура. Старые
сессии отзываются, после входа пользователь обязан задать постоянный пароль.
Команды пишут тот же файловый store, поэтому не запускайте две конкурирующие
break-glass операции одновременно.

### 5.5 sber-designer.json (LLM-провайдеры)

Скопируйте `sber-designer.json` из корня репо в
`/etc/sber-designer/sber-designer.json` и оставьте только нужные провайдеры.
Формат — opencode-style, ключи через `{env:VAR}` (значения возьмутся из
env-файла; в браузер секреты не попадают):

```jsonc
{
  "agent": {
    "default": { "provider": "deepseek", "model": "deepseek-v3-pro" },
    "concurrency": { "maxTotalRuns": 10, "maxApiRuns": 4 },
  },
  "provider": {
    "deepseek": {
      "type": "openai-compatible",
      "name": "DeepSeek (on-prem)",
      "options": {
        "baseURL": "https://llm.internal:8443/v1",
        "apiKey": "{env:DEEPSEEK_API_KEY}",
      },
      "models": { "deepseek-v3-pro": { "name": "DeepSeek V3 Pro" } },
    },
  },
}
```

Подробно про провайдеры: [connect-llm-providers](connect-llm-providers.md).
Файл перечитывается по mtime — правки не требуют рестарта api.

Сейчас это **server-managed** каталог и серверные секреты: базовая модель
доступна всем разрешённым аккаунтам без ввода личного ключа. Сервер не видит
Claude Code, Codex или OpenCode, установленные на ноутбуке пользователя. В
remote UI могут появляться только CLI, установленные администратором на
server host под service user `sd`; они должны называться **Server CLI
agents**.

Этап 11 добавит в **Settings → LLM providers** второй, пользовательский путь:
personal API connection с write-only ключом. Такой ключ относится к аккаунту,
а не к проекту; он не попадает в workspace, git, `.sdproj`, браузерное
хранилище или логи и хранится зашифрованно в
`/home/sd/.sber-designer/users/<userId>/model-connections.json.enc`. До
закрытия Этапа 11 этой UI-настройки и secret store ещё нет — не выдавайте их
за готовую функцию. Ошибка personal model не должна незаметно переключать run
на server default: пользователь явно выбирает другую модель или повторяет
запрос.

## 6. Сборка web и systemd-юниты

### 6.1 Сборка web

Production-бандл по умолчанию обращается к API на том же origin, с которого
открыт web. Поэтому домен стенда не вшивается в артефакт и смена домена не
требует пересборки. `VITE_API_URL` нужен только для split-domain установки,
где web и API намеренно разнесены по разным origin:

```bash
cd /opt/sber-designer
sudo -u sd /home/sd/.bun/bin/bun run build:server
# → apps/web/dist
# → BUILD_INFO.json (version, gitSha, buildTime для API и web-маркера)
```

`build:server` вшивает в web bundle серверный startup profile. Обычный
`bun run build` остаётся local build; не раздавайте его с password API, иначе
клиент не запустит auth bootstrap. `deploy/update.sh` после `sudo -u sd`
передаёт deployment/auth profile через явный `env`, а install/build/smoke
вызывает по абсолютному `SBER_DESIGNER_BUN_PATH`. Поэтому стандартные sudo
`env_reset` и `secure_path` не превращают bundle в local и не теряют Bun.

Для split-domain варианта используйте отдельный override:

```bash
sudo -u sd env VITE_API_URL=https://api.internal /home/sd/.bun/bin/bun run build:server
```

Значение должно быть абсолютным URL. После запуска API проверьте
`curl -s http://127.0.0.1:3000/api/version`: ответ должен содержать те же
`gitSha`, `version` и `buildTime`, что записаны в `BUILD_INFO.json`.

### 6.2 Юниты

Шаблоны лежат в репозитории:

```bash
sudo cp /opt/sber-designer/deploy/systemd/sd-api.service /etc/systemd/system/sd-api.service
sudo cp /opt/sber-designer/deploy/systemd/sd-sandbox.service /etc/systemd/system/sd-sandbox.service
```

Проверьте `User=sd`, `WorkingDirectory=/opt/sber-designer/...`,
`EnvironmentFile=/etc/sber-designer/env` и путь к Bun
`/home/sd/.bun/bin/bun`. Если Bun установлен иначе, поправьте `ExecStart`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sd-sandbox sd-api
curl -s http://127.0.0.1:3000/health   # → {"ok":true}
curl -s http://127.0.0.1:3001/health   # → sandbox health
```

> Для самой первой проверки (до systemd) можно и проще:
> `sudo -u sd bash -lc 'cd /opt/sber-designer && PORT=3001 bun run --cwd services/sandbox start'`
> и во второй сессии
> `... && SBER_DESIGNER_SANDBOX_URL=http://127.0.0.1:3001 bun run --cwd services/api start`.

## 7. nginx: единый origin и access control

Основной гейт — встроенный вход sber-designer. nginx завершает TLS, раздаёт
web и проксирует API на том же origin; Basic Auth больше не обязателен.

Шаблон лежит в `deploy/nginx/sber-designer.conf`:

```bash
sudo cp /opt/sber-designer/deploy/nginx/sber-designer.conf \
  /etc/nginx/sites-available/sber-designer.conf
```

Перед включением замените `server_name`, `ssl_certificate` и
`ssl_certificate_key`. В шаблоне уже есть:

- TLS + static `apps/web/dist`;
- SPA fallback;
- `/api/` proxy;
- WebSocket upgrade для `/api/events`;
- SSE `proxy_buffering off` для `/api/chat/stream`;
- `client_max_body_size 50m`;
- закомментированная Basic Auth опция.

Важно именно **перезаписывать** `X-Forwarded-For` через `$remote_addr`, а не
добавлять присланное клиентом значение: API доверяет этому заголовку только
при `SBER_DESIGNER_TRUST_PROXY=1`.

Если стенду нужен второй независимый забор, создайте htpasswd и добавьте в
блок `server`:

```bash
sudo htpasswd -c /etc/nginx/.sd-htpasswd beta
```

```nginx
auth_basic "sber-designer beta";
auth_basic_user_file /etc/nginx/.sd-htpasswd;
```

```bash
sudo ln -s /etc/nginx/sites-available/sber-designer.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo ufw allow 443/tcp   # наружу — только nginx; 3000/3001 не открывать
```

## 8. Первый запуск и смоук

1. Откройте `https://sd-beta.internal`, войдите встроенной учётной записью и
   убедитесь, что загрузился Projects Home. Basic Auth, если вы его добавили,
   будет первым из двух последовательных гейтов.
2. Смоук с сервера (или с рабочей машины — URL через публичный origin):

```bash
cd /opt/sber-designer
sudo -u sd env \
  SBER_DESIGNER_SMOKE_WEB_URL=https://sd-beta.internal \
  SBER_DESIGNER_SMOKE_API_URL=https://sd-beta.internal \
  SBER_DESIGNER_SANDBOX_URL=http://127.0.0.1:3001 \
  SBER_DESIGNER_SMOKE_SERVICE_TOKEN=<smoke-token> \
  SBER_DESIGNER_SMOKE_CHECK_ENDPOINTS=1 \
  bun run smoke:local-mvp
```

Значение должно совпадать с записью `smoke:…` в
`SBER_DESIGNER_SERVICE_TOKENS`. Если включён опциональный Basic Auth, smoke
нужны также credentials прокси либо запуск через внутренний API origin.

3. Ручная проверка пути тестера:
   - **New Project → HTML-first** → создать в своём поддереве проектов →
     сгенерировать первый экран;
   - **подключить существующий репозиторий**: положить его на сервер в
     поддерево нужного пользователя или склонировать через UI; браузер
     файловой системы показывает **серверные** каталоги — это ожидаемо:
     проекты живут на сервере, у каждого пользователя своё поддерево;
   - открыть Storybook-проект, дождаться каталога компонентов, прогнать
     генерацию экрана и git-коммит.

## 9. Обновление стенда

Обновление выполняется одной командой на сервере:

```bash
cd /opt/sber-designer
sudo deploy/update.sh <tag-or-branch>
```

И одна команда с рабочей машины владельца:

```bash
deploy/remote-update.sh admin@SERVER <tag-or-branch>
```

Скрипт должен быть повторяемым: перейти на нужный ref, поставить
зависимости, собрать web, перезапустить `sd-sandbox`/`sd-api`, проверить
`/health`, `/api/version` и smoke. Внешний CI для этого не нужен; локальная
обёртка просто запускает тот же серверный сценарий по SSH. Если позже
появится GitHub Actions/Vercel CI, он должен запускать этот же сценарий, а не
собирать отдельную несовместимую поставку.
Имена веток резолвятся в свежий `origin/<branch>` после `fetch`; для
повторяемого релиза лучше передавать tag или commit SHA.

Важно: update меняет только checkout и процессы. Данные пользователей,
проекты, auth-store, корзина и `/etc/sber-designer/env` остаются на своих
путях и должны переживать обновление. Перед обновлением, которое меняет формат
данных или пути хранения, сначала делайте `deploy/backup.sh` и добавляйте
migration-note к релизу.

Для dry-run синтаксиса без рестарта systemd/smoke:

```bash
cd /opt/sber-designer
sudo SBER_DESIGNER_SKIP_SYSTEMCTL=1 SBER_DESIGNER_SKIP_SMOKE=1 deploy/update.sh <tag-or-branch>
```

`deploy/update.sh` можно запускать от root: `systemctl` выполняется напрямую,
а `git`/`bun` внутри checkout'а запускаются от `SBER_DESIGNER_SERVICE_USER`
(default `sd`), чтобы сборочные файлы не становились root-owned. Если у вас
настроен passwordless sudo только для пользователя `sd`, можно вызвать
`remote-update.sh sd@SERVER ...`; иначе используйте обычного admin/sudo
пользователя.

`/api/version` и web-marker проверяются endpoint-smoke: рассинхрон API и web
завершает smoke с ошибкой.

## 10. Бэкап

`deploy/backup.sh` архивирует три корня (стек файловый, БД нет):

```bash
sudo /opt/sber-designer/deploy/backup.sh /var/backups/sber-designer
```

В архив попадают:

- `/srv/sber-designer/projects`, включая `.trash/`;
- `/home/sd/.sber-designer`, включая `auth/` и `users/`;
- `/etc/sber-designer`.

Воспроизводимые каталоги `node_modules` и retention-managed run evidence
`.sber-designer/runs` в архив не входят. Исходники, `.sdproj`, design-index,
описания, git metadata, auth/users и Trash сохраняются.
После реализации personal-model части Этапа 11 каталог `users/` также будет
содержать зашифрованные personal model connections; отдельно и безопасно
храните master key восстановления, иначе одного backup недостаточно для
расшифровки этих записей.

Восстановление:

1. Остановить сервисы: `sudo systemctl stop sd-api sd-sandbox`.
2. Развернуть архив в `/` от root: `sudo tar xzf <backup>.tgz -C /`.
3. Поставить код нужной версии в `/opt/sber-designer`.
4. Выполнить `sudo -u sd /home/sd/.bun/bin/bun install --frozen-lockfile`,
   затем `sudo -u sd /home/sd/.bun/bin/bun run build:server`.
5. Запустить сервисы и проверить вход существующим пользователем.

Проекты — обычные git-репозитории: их история дополнительно защищена своими
remote'ами, если вы их настроили. Но server-only незапушенные изменения
сохраняет именно backup или Trash.

## 11. Логи и диагностика

```bash
journalctl -u sd-api -f                         # api log
journalctl -u sd-sandbox -f                     # sandbox controller
journalctl -u sd-api -o cat | grep '^\[audit\]' # audit JSON-lines
journalctl -u sd-api --since '1 hour ago'
journalctl -u sd-sandbox -p warning..alert
```

Логи идут в journald. Ротация управляется системным `journald.conf`; для
закрытой беты достаточно задать, например, `SystemMaxUse=1G` и
`MaxRetentionSec=14day` в `/etc/systemd/journald.conf` по правилам вашего
контура, затем `sudo systemctl restart systemd-journald`.

Healthcheck:

```bash
curl -fsS http://127.0.0.1:3000/health
curl -fsS http://127.0.0.1:3001/health
curl -fsS http://127.0.0.1:3000/api/version
curl -fsS https://sd-beta.internal/api/version
```

Disk hygiene:

```bash
sudo -u sd /opt/sber-designer/deploy/run-retention.sh
du -sh /srv/sber-designer/projects/*/*/node_modules 2>/dev/null || true
du -sh /srv/sber-designer/projects/*/*/.sber-designer/runs 2>/dev/null || true
```

API-reaper сам обходит все managed user workspaces. Cron ниже — независимая
safety-net на случай, если API долго не работает:

```cron
17 3 * * * sd /opt/sber-designer/deploy/run-retention.sh >>/var/log/sd-run-retention.log 2>&1
```

Типовые проблемы:

| Симптом                               | Причина / решение                                                                                                                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smoke сообщает `Build mismatch`       | API и web взяты из разных сборок — выполните `bun run build:server`, перезапустите API и атомарно обновите раздаваемый `apps/web/dist`                                                                                                                                                  |
| «Could not reach sandbox controller…» | sandbox не запущен или `SBER_DESIGNER_SANDBOX_URL` не совпадает с портом юнита                                                                                                                                                                                                          |
| Чат «зависает» на длинных ранах       | прокси буферизует SSE — проверьте `proxy_buffering off` и `proxy_read_timeout` для `/api/chat/stream`                                                                                                                                                                                   |
| События/каталог не обновляются        | WS `/api/events` не апгрейдится — секция Upgrade в nginx                                                                                                                                                                                                                                |
| Storybook проекта не стартует         | в workspace нет зависимостей — `bun install`/`npm ci` внутри проекта; смотрите `journalctl -u sd-sandbox`                                                                                                                                                                               |
| `invalid _auth value` при install     | повреждён machine-level `~/.npmrc`, а не lockfile проекта. Исправьте Nexus credentials вне checkout'а, ограничьте права файла и ротируйте значение, если оно попало в лог. `Checked … no changes` означает только cache hit и не доказывает, что чистая установка сможет скачать пакеты |
| Vite: unknown extension `.ts`         | Vite должен оставаться Node-процессом. Обновите checkout до версии с self-contained `vite.config.ts`; не заменяйте `vite` на `bunx vite` — обычный `bunx` следует Node shebang и воспроизводит ту же ошибку. Проверка: `bun run build:server` и затем обычный `bun run dev`             |
| «provider apiKey is not configured»   | env-переменная из `{env:...}` не задана в `/etc/sber-designer/env`                                                                                                                                                                                                                      |
| 401 unauthenticated                   | режим OIDC случайно включён (`SBER_DESIGNER_OIDC_ISSUER` задан) — уберите переменную для stub-режима беты                                                                                                                                                                               |
| Порт занят после падения              | остались dev-серверы проектов — `systemctl restart sd-sandbox` (reaper приберёт), при нужде `pkill -u sd -f storybook`                                                                                                                                                                  |
| Диск пухнет                           | `du -sh /srv/sber-designer/projects/*/*/node_modules /srv/sber-designer/projects/*/*/.sber-designer/runs` — reaper чистит старые runs; `node_modules` исключены из backup, но в живых проектах чистятся вручную или политикой проекта                                                   |

## 12. Известные ограничения беты (честно)

- **Deploy-путь**: default — one-command update удалённого сервера из git
  ref. Пользовательские данные лежат вне checkout'а и должны переживать
  обновления продукта.
- **Идентичность**: вход по email+паролю уже даёт атрибуцию audit/run/git
  author; committer остаётся системным git user `sd`, как у web-edits.
- **Одновременная работа в одном проекте** не координируется (last write
  wins); один агентский ран на экран/файл — параллельный запрос отклоняется.
- **Auth**: встроенные email+пароль, офлайн-капча, единый API guard и
  service tokens уже работают. Basic Auth — только опциональный второй
  забор; OIDC (Keycloak) остаётся enterprise-путём.
- **Sandbox local-spawn**: dev-серверы проектов исполняются на хосте от
  пользователя `sd` (Docker-driver — экспериментальная опция).
- **Ресурсы**: несколько одновременных Storybook-сессий требовательны к RAM
  — следите за `free -h` и лимитом `SBER_DESIGNER_SANDBOX_MAX_SESSIONS`.
- **Модели**: server-managed модель и явный `dev:server` уже работают.
  Personal API connections из UI ещё не реализованы; CLI с ноутбука
  пользователя удалённому backend недоступны.
- **Корзина**: удалённые workspace'ы не чистятся автоматически; админ вручную
  восстанавливает или purge'ит записи из Trash.
