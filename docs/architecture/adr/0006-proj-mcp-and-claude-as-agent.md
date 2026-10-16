---
id: ADR-0006
title: proj-mcp and external agents
status: Accepted
date: 2026-05-08
scope: inbound and outbound MCP
---

# ADR-0006: `proj-mcp` (inbound MCP) и режим «Claude as agent»

- **Дата:** 2026-05-08
- **Статус:** Accepted
- **Контекст:** Phase 0 PoC-2.

## Контекст

Запрос пользователя: помимо встроенного агента (через `llm-gateway`),
дать возможность использовать **внешнего Claude Code** как агент в
sber-designer — пользователь работает в своём Claude Code, но действия
влияют на проект в редакторе.

Изучили подходы:

### Builder.io Fusion ([docs/fusion-connect-to-a-local-mcp-server](https://www.builder.io/c/docs/fusion-connect-to-a-local-mcp-server))

- MCP только **outbound** — Fusion как клиент подключается к локальным MCP-серверам
  через `mcp.json` в корне проекта, transport `stdio`.
- Tool naming: `mcp__servername__toolname`.
- Fusion **не выставляет** себя как MCP-сервер для внешних агентов.

### openpencil ([README](https://github.com/ZSeven-W/openpencil#mcp-server))

- Делает наоборот: выставляет `pen-mcp` сервер.
- Один-клик install в Claude Code / Codex / Gemini / OpenCode / Kiro / Copilot.
- Транспорты: stdio (по умолчанию) и HTTP fallback.
- Внешние агенты получают тулы для редактирования `.op` файлов.

## Решение

**Делаем и outbound, и inbound MCP.**

### Outbound — как у Builder

Секция `mcpServers` в `sber-designer.json` (см. ADR-0005). Встроенный
агент видит инструменты как `mcp__name__tool` и зовёт их при необходимости
(базы данных, Jira, внутренние сервисы).

### Inbound — `@sber-designer/proj-mcp`

Запускается как отдельный процесс рядом с `services/api`:

```bash
bunx @sber-designer/proj-mcp           # stdio (default)
bunx @sber-designer/proj-mcp --http    # HTTP/SSE на :3030/mcp
```

**Тулы (Phase 0–1 baseline):**

| Tool                      | Что делает                                                   |
| ------------------------- | ------------------------------------------------------------ |
| `ping`                    | Sanity-check, возвращает версию и проект-id                  |
| `catalog_list_components` | Выдаёт компоненты из storybook-indexer (placeholder Phase 0) |
| `catalog_get_component`   | Детали + screenshot                                          |
| `ast_read_file`           | Читает файл из workspace                                     |
| `ast_apply_patch`         | Применяет ts-morph patch и триггерит HMR                     |
| `editor_get_selection`    | Что сейчас выделено в Design mode                            |
| `editor_set_mode`         | Переключает Interact/Design/Code                             |
| `editor_post_message`     | Отправляет сообщение в editor chat (видно пользователю)      |
| `sandbox_get_url`         | URL текущего sandbox dev-сервера                             |
| `sandbox_screenshot`      | PNG скрин canvas                                             |
| `git_create_pr`           | Branch + commit + push + MR                                  |

Naming следуем MCP-конвенции (snake_case), без `mcp__` префикса —
он добавляется на стороне клиента.

### Mode "Claude as agent"

Это **псевдо-провайдер** в LLM gateway (`type: "claude-code"` из ADR-0005).
Когда пользователь его выбирает:

1. Editor chat **не отправляет** запросы в LLM напрямую.
2. На правой панели появляется блок-инструкция: «Connect Claude Code» —
   с конкретной командой `claude mcp add sber-designer ...` или JSON-snippet
   для `~/.claude.json`.
3. Пользователь идёт в свой Claude Code (terminal или IDE), пишет:
   `"Look at the Design selection in sber-designer and refactor it..."`.
4. Claude Code через MCP читает selection / patches файлы / постит сообщения
   обратно в editor chat (тул `editor_post_message`).
5. В editor chat пользователь видит **transcript** того, что делает Claude Code —
   сообщения и diff'ы файлов. Это даёт «однотипное» UX: что внутренний агент,
   что Claude Code выглядят как один разговор.

### Транспорты

- **stdio** — для локальной разработки на машине пользователя; Claude Code
  и Cursor умеют это из коробки.
- **HTTP/SSE** — для удалённых случаев (Claude Code запущен не на той же машине,
  где сервер sber-designer). Phase 1+.
- **WebSocket** для editor↔mcp моста (когда MCP-server — отдельный процесс,
  а chat — в браузере). Phase 1.

### Безопасность

- `proj-mcp` биндится только на `127.0.0.1` по умолчанию.
- HTTP-режим требует bearer-token (`SBER_DESIGNER_MCP_TOKEN`), генерируется
  при `bun run mcp:start --http`.
- В Phase 4 — RBAC-scoped MCP: разные пользователи видят разный набор тулов.

## Что мы НЕ делаем

- Не пытаемся быть совместимы с Builder-style `mcp.json` (формат тот же
  по сути, но naming `mcp__` мы не наследуем — это деталь Claude Code-клиента).
- Не делаем «магазин» поддерживаемых внешних агентов в Phase 0.
  Поддерживаем только Claude Code в bridge-mode; OpenCode / Codex CLI / Gemini
  CLI добавляем в Phase 2 (см. ROADMAP).

## Последствия

- Архитектура двупроцессная: `services/api` хранит state (selection, mode,
  open file, chat transcript), `proj-mcp` — отдельный процесс, общается с
  api по WebSocket. Это сложнее, но позволяет MCP жить и без браузера
  (для CI, для CLI).
- В PoC-2 реализуем **минимальный stdio-сервер с тулами `ping`, `ast_read_file`,
  `ast_apply_patch`, `editor_post_message` (no-op stub)**, чтобы доказать что
  Claude Code может подключиться. Полный набор тулов — Phase 1.

## Ссылки

- [Builder Fusion local MCP](https://www.builder.io/c/docs/fusion-connect-to-a-local-mcp-server)
- [openpencil pen-mcp](https://github.com/ZSeven-W/openpencil#mcp-server)
- [Model Context Protocol](https://modelcontextprotocol.io)
- ADR-0005 — конфиг провайдеров
