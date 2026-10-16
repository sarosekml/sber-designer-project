---
updated: 2026-07-21T01:16:10+03:00
---

# Open project in IDE and Copy for CLI

Handoff в правой части верхней панели передаёт уже подключённый проект из
sber-designer в локальную IDE, файловый менеджер, терминал или внешний coding
agent. Это действие пользователя над workspace, а не запуск Assistant.

## Как пользоваться

Кнопка показывается в Edit только для проекта с `workspacePath` и только в
local profile.

1. Нажмите основную часть split-кнопки, чтобы сразу открыть проект в последнем
   выбранном приложении. Если предпочтения ещё нет, используется первое
   найденное приложение.
2. Нажмите стрелку, чтобы выбрать другое приложение.
3. Во вкладке **Open with editor** доступны:
   - **Copy path** — копирует абсолютный путь workspace;
   - **Installed** — приложения, найденные на машине;
   - **Not installed** — известные приложения, которые probe не нашёл. Они
     остаются кликабельными, а backend возвращает понятную ошибку, если запуск
     действительно невозможен.
4. Во вкладке **Copy for CLI** нажмите Claude Code, Codex CLI, opencode или
   **Any coding agent**. В clipboard попадёт prompt с абсолютным путём,
   shell-safe `cd`, требованием прочитать инструкции репозитория, сохранить
   текущие изменения и проверить результат.

Выбранное приложение хранится только в browser localStorage под ключом
`sber-designer.handoff-preferred-app`. Оно не записывается в `.sdproj`, git,
assistant session или run evidence.

## Какие приложения поддерживаются

Каталог фиксирован в коде. Произвольную команду из браузера передать нельзя.

- IDE: Cursor, VS Code, Windsurf, Zed, Qoder, Antigravity, WebStorm,
  IntelliJ IDEA и Xcode на macOS;
- файловые менеджеры: Finder, Explorer или Linux File Manager;
- терминалы: Terminal и Warp на macOS.

Backend ищет CLI-команду в `PATH`. На macOS также проверяются стандартные
`.app`-директории, поэтому GUI-приложение может быть найдено без CLI shim.
Для desktop/GUI запуска к `PATH` добавляются стандартные Homebrew и system
bin-директории.

## API и безопасность

Web использует два endpoint-а:

- `GET /api/host/apps` возвращает каталог для текущей платформы и признак
  `available`;
- `POST /api/host/open-in` принимает только `appId`. Путь не приходит из
  браузера: backend берёт активный `requestWorkspacePath()`.

Запускается только запись фиксированного каталога. Процесс стартует detached,
без shell, а API ждёт событие `spawn` или `error` до ответа. Поэтому пробелы и
shell-метасимволы в пути не превращаются в команду. Windows `.cmd`/`.bat`
shim оборачивается в экранированный `cmd.exe /d /s /c`; остальные executable
получают workspace отдельным argv.

В server profile оба endpoint-а возвращают `403 host_tools_disabled`, а кнопка
не рендерится: сервер не должен открывать приложения на общей host-машине по
клику удалённого браузера.

## Граница с Assistant и Harness

Open in IDE и Copy for CLI не зарегистрированы как agent tools и не меняют
Ask / Plan / Design permissions. Они не запускают direction picker, wireframe,
Design Jury, Screen readiness DoR или finalization. Скопированный CLI prompt
тоже не создаёт run автоматически: пользователь сам вставляет его во внешний
agent и при необходимости подключает project MCP по инструкции
[Connect Claude Code](../integrations/connect-claude-code.md).

## Ограничения

- Открывается корень проекта, а не конкретный файл и строка.
- Пользовательские команды и project-specific каталог приложений не
  поддерживаются.
- В Remote server beta локальные IDE и CLI ноутбука недоступны backend-у.
- Если ни одно приложение не найдено, UI оставляет fallback-кнопку системного
  файлового менеджера.
