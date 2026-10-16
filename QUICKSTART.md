# Quick Start

Требуется **Bun >= 1.2** (проверено на 1.2.13) и Node.js >= 20. Текстовый
`bun.lock` читается только Bun 1.2+.

Все команды выполняются из корня клонированного репозитория. Если после
клонирования папка называется `sber-designer-project`, перейти в неё можно
относительным путём:

```bash
cd sber-designer-project
```

## Локальный профиль

```bash
bun install --frozen-lockfile
bun run dev
```

```bash
# Выполнить во втором терминале; если dev-all напечатал другой web-порт, подставить его ниже.
open http://localhost:5173
```

## Проверки

```bash
bun run build:info   # метка сборки; её читают vite.config и тесты версии
bun run typecheck
bun run test
bun run lint
bun run format:check
```

## Локальный browser smoke

Реальный Chromium поверх собранного бандла, offline mock-провайдер, ничего не
уходит в сеть. Браузер ставится один раз.

```bash
bunx playwright install chromium
bun run build
bun run smoke:browser
```

## Личные настройки

Всё, что работает только на вашей машине (MCP-сервер с абсолютным путём, другой
default provider), — в `sber-designer.local.json`. Файл в `.gitignore` и
накладывается поверх `sber-designer.json`; шаблон —
`sber-designer.local.example.json`.

## Серверный профиль для локального теста

```bash
bun install --frozen-lockfile
mkdir -p tmp/server-test/home tmp/server-test/projects tmp/server-test/users
```

```bash
HOME="$PWD/tmp/server-test/home" \
SBER_DESIGNER_PROJECTS_ROOT="$PWD/tmp/server-test/projects" \
SBER_DESIGNER_USERS_ROOT="$PWD/tmp/server-test/users" \
SBER_DESIGNER_BOOTSTRAP_ADMIN_EMAIL="admin@example.local" \
SBER_DESIGNER_BOOTSTRAP_ADMIN_PASSWORD="change-this-local-test-password" \
SBER_DESIGNER_CAPTCHA="register" \
bun run dev:server
```

```bash
# Выполнить во втором терминале; если dev-all напечатал другой web-порт, подставить его ниже.
open http://localhost:5173
```

## Повторный запуск серверного теста с сохранёнными данными

```bash
HOME="$PWD/tmp/server-test/home" \
SBER_DESIGNER_PROJECTS_ROOT="$PWD/tmp/server-test/projects" \
SBER_DESIGNER_USERS_ROOT="$PWD/tmp/server-test/users" \
SBER_DESIGNER_BOOTSTRAP_ADMIN_EMAIL="admin@example.local" \
SBER_DESIGNER_BOOTSTRAP_ADMIN_PASSWORD="change-this-local-test-password" \
SBER_DESIGNER_CAPTCHA="register" \
bun run dev:server
```

```bash
# Выполнить во втором терминале; если dev-all напечатал другой web-порт, подставить его ниже.
open http://localhost:5173
```

## Production-сборка серверного web

```bash
bun install --frozen-lockfile
bun run build:server
```
