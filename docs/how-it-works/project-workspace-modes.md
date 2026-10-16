---
updated: 2026-07-24T23:16:12Z
---

# Project workspace modes

Этот документ объясняет простыми словами, где физически лежит проект, когда
sber-designer запущен локально и когда он запущен как удаленная beta на
сервере.

Главная идея одна для всех режимов: sber-designer не заводит отдельную
"базу проекта". Он открывает обычную папку frontend-проекта и работает с ее
файлами.

## Жёсткий контракт режимов

Local и remote server — не один режим с несколькими случайными env. Они
запускаются разными entrypoint и имеют разную физическую границу:

```bash
bun run dev          # local profile, сегодняшнее поведение
bun run dev:server   # server profile для dev/staging
```

На production server вместо dev-команды работают systemd units
`sd-api`/`sd-sandbox`; обновление запускается через `deploy/remote-update.sh`.
Если web собирается вручную для password-server, используется
`bun run build:server`; обычный `bun run build` сохраняет local startup
profile.
`bun run dev:user-mode` — только локальный auth/admin harness. Он не является
remote server version.

Команды явно задают `SBER_DESIGNER_DEPLOYMENT_MODE=local|server`. Режим нельзя
выводить только из `authMode`: `dev:user-mode` использует password-auth, но
остаётся локальным test harness, а не серверной версией.

## Коротко

| Режим                                       | Где лежит проект                         | Копируется ли проект в sber-designer | Кто запускает dev-server  |
| ------------------------------------------- | ---------------------------------------- | ------------------------------------ | ------------------------- |
| Local: `bun run dev`                        | На диске разработчика                    | Нет                                  | Процесс на этой же машине |
| Local auth harness: `bun run dev:user-mode` | Локальная тестовая среда                 | Не является server contract          | Процесс на этой же машине |
| Server dev/staging: `bun run dev:server`    | В managed server workspace               | Нужен clone/workspace на server host | Серверный sandbox         |
| Remote production                           | `/srv/sber-designer/projects/<userId>/…` | Нужен clone/workspace на server host | systemd `sd-sandbox`      |

В локальном режиме ты продолжаешь работать как раньше: выбираешь папку проекта
на своем диске, и sber-designer пишет прямо туда. В remote beta браузер
пользователя не дает backend'у доступ к локальному диску, поэтому сервер
работает с серверной копией проекта.

Home rail — общая навигация обоих режимов. В local mode он остаётся на месте,
но нижнего блока пользователя нет. В server/user mode после входа там
показывается аватар только текущего пользователя с переходом в Profile и Log
out. Settings из Home содержит только системные разделы в порядке: General,
LLM providers, Agent kit, Harness setup и MCP servers. Project, Indexing, Git
and PR и Task tracker доступны только в Settings открытого проекта.

## Local dev: проект остается на твоем диске

Когда ты запускаешь:

```bash
bun run dev
```

API работает в `local` auth mode. В этом режиме нет per-user server root и нет
обязательного `/srv/sber-designer/projects`.

Web сразу открывает локальное приложение без запроса auth-status и login
экрана. `/api/config` и `/api/preview/*` остаются доступны локальному UI без
сессии, поэтому iframe канваса работает так же, как до появления server
profile. Local CORS принимает
origin текущего dev-клиента, включая другой localhost-порт или LAN-host.

Пример:

```text
/Users/me/Work/client-app/
  .git/
  package.json
  src/
  .sber-designer/
    project.sdproj
    components/*.md
    design-index/
    runs/
```

sber-designer просто запоминает абсолютный путь к этой папке в локальном
реестре:

```text
~/.sber-designer/projects.json
```

Этот файл - только список плиток на Home screen. Он не является источником
правды проекта. Если убрать запись из списка, сам проект на диске не
исчезает.

Что важно:

- проект не копируется в hidden storage sber-designer;
- Home не предлагает `Duplicate`: если нужна отдельная рабочая копия,
  пользователь сам копирует или клонирует репозиторий на диске, затем
  подключает новую папку в sber-designer;
- кнопка `Share` в редакторе скрыта, потому что local profile не является
  публичным сервером для постоянных share-ссылок;
- git status, commits, Storybook/Vite и агент работают прямо в выбранной
  папке;
- даже если в shell остались server env, local profile не использует managed
  projects root, server `system.json` и server run-retention;
- локальные CLI не фильтруются server allowlist'ом Administration;
- sandbox локально без общего лимита по умолчанию; при необходимости его
  можно явно задать через `SBER_DESIGNER_SANDBOX_MAX_SESSIONS`;
- ценное project-owned состояние лежит внутри проекта, чаще всего в
  `.sber-designer/*`;
- локальные UI-мелочи могут жить в browser localStorage, но они не должны
  влиять на генерацию, prompts или будущую работу команды.

## Local user-mode: только проверка аккаунтов и админки

Для проверки auth/admin UI можно запустить:

```bash
bun run dev:user-mode
```

Это включает `password` auth mode и dev seed `admin@local` / `admin`, чтобы
проверять login/register/Profile/Users/Administration. Эта команда не должна
использоваться как сокращённый server launch: она явно сохраняет
`deploymentMode=local`.

Проектные операции намеренно не входят в этот harness: запрос с явным
`workspacePath` получает `503 workspace_storage_not_configured`, потому что
password identity без managed root не должна обращаться к произвольным папкам.
Для проверки открытия проекта, confinement и git-атрибуции используйте
`bun run dev:server` с тестовыми projects/users roots.

Правила запуска однозначны:

- `dev` → local workspace semantics;
- `dev:user-mode` → local profile + тестовые аккаунты;
- `dev:server` → managed `<root>/<user>/...` и все ограничения server beta.

На обычном локальном `bun run dev` projects root не требуется никогда.

## Remote server beta: сервер работает с server-side clone

В remote beta пользователь открывает sber-designer в браузере:

```text
browser -> https://sd-beta.example -> nginx -> API/sandbox на сервере
```

Backend и sandbox физически работают на сервере. Они могут читать и писать
только файловую систему сервера. Они не видят папки вроде
`/Users/alex/Work/client-app` на ноутбуке пользователя.

Поэтому на сервере проект должен существовать как обычная рабочая копия:

```text
/srv/sber-designer/projects/
  <user-id>/
    client-app/
      .git/
      package.json
      src/
      .sber-designer/
        project.sdproj
        components/*.md
        design-index/
        runs/
```

Это не "база данных sber-designer". Это checkout или scaffold проекта на
сервере. sber-designer редактирует эту папку, запускает там git, npm/bun,
Storybook/Vite и agent tools.

Зачем так:

- браузер не может безопасно отдать серверу произвольный доступ к локальному
  диску пользователя;
- dev-server проекта должен запускаться там же, где лежат файлы;
- remote beta дает один общий URL для команды и не требует устанавливать
  desktop app на каждую машину.

Цена этой модели: изменения происходят в server-side workspace. Если нужно
вернуть их в основной репозиторий проекта, они должны быть закоммичены и
запушены в git remote.

### Как реально запускается remote production

Первичная установка включает systemd units:

```bash
sudo systemctl enable --now sd-sandbox sd-api
```

Обычное обновление с рабочей машины:

```bash
./deploy/remote-update.sh admin@SERVER <tag-or-branch-or-sha>
```

Это отдельный путь от `bun run dev`: systemd читает
`/etc/sber-designer/env`, использует server roots и не получает доступ к
папкам ноутбука пользователя. Оба production-unit явно задают
`SBER_DESIGNER_DEPLOYMENT_MODE=server`; `deploy/update.sh` проверяет этот
инвариант перед сборкой и рестартом.

## Модели в local и server profile

| Возможность                  | Local `bun run dev`                                     | Remote server beta                                                          |
| ---------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Базовая API-модель           | Из текущего local/project config                        | Преднастроена администратором в server config                               |
| Персональный API key из UI   | Новый account-store не включается; поведение как сейчас | Планируется в Settings → LLM providers и будет принадлежать только аккаунту |
| CLI на ноутбуке пользователя | Доступен, потому что backend на той же машине           | Недоступен серверу                                                          |
| CLI на server host           | Не относится к local mode                               | Опциональный Server CLI agent, устанавливает и включает администратор       |
| Где хранится выбор           | Текущее local persistence без миграции                  | `preferredModel` пользователя на server                                     |

## Действия, зависящие от deployment profile

| Действие                      | Local `bun run dev`                                              | Remote server beta                                      |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| Дублировать целый проект      | Скрыто: пользователь сам копирует/клонирует папку репозитория    | Доступно внутри managed user workspace                  |
| Поделиться проектом           | `Share` скрыта: local editor не публикует постоянную внешнюю URL | Доступно через server share snapshot                    |
| Открыть проект в IDE/Terminal | Доступно: backend и приложения находятся на одной машине         | Скрыто; `/api/host/*` возвращает `403`                  |
| Copy for CLI                  | Копирует prompt с локальным абсолютным `workspacePath`           | Скрыто вместе с host handoff                            |
| Дублировать экран/компонент   | Доступно: это изменение файлов уже открытого проекта             | Доступно: это изменение файлов managed server workspace |

В server profile новый пользователь сразу может работать через **Server
default**, не вводя ключ. Personal API connection — оставшаяся часть Этапа 11:
после её реализации ключ будет храниться зашифрованно в user data server и
после сохранения не будет возвращаться в browser. Он не записывается в проект,
`sber-designer.json`, `.sdproj`, git или run evidence.

Если personal API connection перестал работать, новый run получает явную
ошибку. Сервер не должен без предупреждения отправлять запрос в Server default:
это другой provider, другой биллинг и другая граница данных.

## Что лежит внутри `.sber-designer/` проекта

Внутри проекта sber-designer хранит project-owned состояние:

```text
<project>/.sber-designer/
  project.sdproj
  components/*.md
  descriptions/
  assets/
  design-index/
  previews/
  runs/
```

Что из этого важно:

- `project.sdproj` - список экранов, flow, assistant sessions и настройки,
  которые должны переезжать вместе с проектом;
- `components/*.md` - canonical Description for AI sidecars;
- `descriptions/` - старый или дополнительный слой описаний, если проект его
  использует;
- `assets/` - манифесты и project-owned asset metadata;
- `design-index/` - в основном производный индекс, который можно
  пересобрать, но внутри могут быть authored notes/answers, если они
  используются;
- `previews/cover.webp` или `cover.png` - переносимая generated project cover;
- `previews/screens/` - тяжёлые локальные Flow captures;
- `runs/` - локальные evidence/debug artifacts agent runs.

Практическое правило для git:

```text
Коммитить:      project.sdproj, components/*.md, descriptions/, assets/,
                важные authored файлы из design-index/, previews/cover.*
Не коммитить:   .sber-designer/runs/, .sber-designer/previews/screens/
```

Scaffold добавляет в `.gitignore` только:

```gitignore
.sber-designer/runs/
```

Он не должен игнорировать `project.sdproj` или descriptions. Иначе нарушается
главное правило: вся ценная правда проекта должна жить в проекте и
переноситься через git.

Project-cover maintenance отдельно поддерживает вложенный
`.sber-designer/.gitignore` с правилом `previews/screens/`. Если от старой
версии осталось слишком широкое `previews/`, оно сужается, чтобы `cover.webp`
оставался видимым git. Подробно: [Project covers](./project-covers.md).

## Что хранит sber-designer вне проекта

Есть состояние самого продукта, которое не является частью конкретного
frontend-проекта.

Локально:

```text
~/.sber-designer/projects.json
~/.sber-designer/thumbnails/
```

На server beta:

```text
/home/sd/.sber-designer/auth/
/home/sd/.sber-designer/system.json
/home/sd/.sber-designer/users/<user-id>/
  projects.json
  settings.json                 # active workspace и remote preferred model
  model-connections.json.enc    # после реализации personal API providers
  thumbnails/
```

Это:

- пользователи и сессии;
- системные настройки;
- список плиток Home screen;
- last folder, remote model preference, explicit thumbnails и
  `coverScreenId` pin;
- зашифрованные personal API connections server account (после реализации
  оставшейся части Этапа 11).

Это не заменяет проектный репозиторий. Если пользователь заново откроет или
склонирует проект, sber-designer может снова добавить его в список плиток.

Для пяти встроенных project previews registry хранит один канонический путь
`/project-preview/imageNN.webp`. Web UI подставляет парный
`imageNN-light.png`, когда app theme равна `light`; смена темы не изменяет
registry. Uploaded/API thumbnails остаются теми файлами, которые выбрал
пользователь.

Generated cover не хранится в `~/.sber-designer/thumbnails/`: это
`<workspace>/.sber-designer/previews/cover.*`. Registry хранит только pin
источника, а identity-scoped user setting `Generative thumbnail` — per-user
решение показывать/обновлять этот project-owned файл, синхронизированное между
его браузерами/сессиями через `/api/config`.

## Обновление продукта не должно трогать проекты

На server beta код sber-designer лежит отдельно:

```text
/opt/sber-designer
```

Пользовательские проекты и данные лежат отдельно:

```text
/srv/sber-designer/projects
/home/sd/.sber-designer
/etc/sber-designer
```

Поэтому update продукта должен работать так:

```text
commit/tag -> server checkout -> bun install --frozen-lockfile -> build web -> restart services
```

И при этом не удалять:

- workspace'ы пользователей;
- `.trash/`;
- auth-store;
- user registries;
- server env/config.

Если новая версия меняет формат файловых данных, нужен backup и явная
migration-note. Обычный update должен быть бесшовным: люди продолжают работать
с теми же аккаунтами и проектами, просто на новой версии sber-designer.

## Удаление пользователя на server beta

Удаление пользователя на сервере не делает `rm` сразу. Оно переносит данные в
admin Trash:

```text
/srv/sber-designer/projects/.trash/<entry-id>/
/home/sd/.sber-designer/users/.trash/<entry-id>/
```

После этого есть два пути восстановления:

1. Проект был закоммичен и запушен в git remote.
   Пользователь создает новый аккаунт и заново клонирует проект. Экраны,
   описания и `.sber-designer/project.sdproj` приезжают из git.
2. Проект не был запушен или содержит незакоммиченные изменения.
   Админ восстанавливает его из Trash через **Restore to user...**.

Если админ сделает **Purge** для проекта, который не был запушен в remote, то
re-clone уже не сможет вернуть незапушенные экраны, описания и изменения.
Поэтому Trash показывает git-risk признаки:

- uncommitted changes;
- unpushed commits;
- no remote;
- not pushed anywhere.

Перед Purge risky project админ должен понимать: восстановление через git может
быть невозможно.

## Как это будет выглядеть в будущем desktop/local agent mode

Future desktop или local-agent bridge будет ближе к `bun run dev`, чем к remote
server beta:

```text
UI где угодно -> local agent на машине пользователя -> проект на диске пользователя
```

В такой модели сервер может помогать с auth, orchestration или UI, но файловые
операции выполняет локальный агент рядом с проектом. Это отдельная
архитектурная линия, не цель server beta.

## Главное правило для обсуждений

Когда говорим "проект", всегда уточняем физическое место:

- local mode: папка проекта на диске разработчика;
- remote server beta: server-side clone/workspace под
  `/srv/sber-designer/projects/<user-id>/`;
- future desktop/local agent: папка проекта на диске пользователя плюс
  локальный bridge.

Во всех трех случаях источник правды проекта - сам project workspace и git, а
не скрытая база sber-designer.
