---
id: ADR-0010
title: Editor to proj-mcp bridge
status: Accepted
date: 2026-05-08
scope: editor events and shared state
refines:
  - ADR-0009
---

# ADR-0010: Editor ↔ proj-mcp bridge через services/api (events + state)

- **Дата:** 2026-05-08
- **Статус:** Accepted
- **Контекст:** Phase 1 step 2.

## Контекст

PoC-2 поднял `proj-mcp` как stdio MCP-сервер, в который подключается
внешний Claude Code. Но `proj-mcp` живёт в **отдельном процессе** от
браузерного редактора, и тулзы вроде `editor_post_message` /
`editor_get_selection` остались no-op stub'ами с пометкой «Phase 1
WebSocket bridge».

Сейчас этот мост строим — через уже существующий `services/api`
(ADR-0009), а не как отдельный процесс. Один edge-сервис, один
происхождение для всех клиентов.

## Решение

Двунаправленный мост между `proj-mcp` и `apps/web` через `services/api`:

```
   apps/web :5173                              proj-mcp (stdio, Claude Code-launched)
         │                                              │
         │  WS /api/events  (subscribe)                 │  HTTP POST /api/events/publish
         │  POST /api/state (push selection)            │  HTTP GET  /api/state (read selection)
         ▼                                              ▼
                       services/api :3000  ←  in-memory event-bus + state-store
```

### Каналы

1. **Events (push, fire-and-forget).** Любая сторона может опубликовать
   событие, оно дойдёт до всех подписчиков. Используется для:
   - `proj-mcp` → editor: `editor.message`, `proj-mcp.tool-call` (Claude
     Code сделал что-то — пользователь видит в чате).
   - editor → `proj-mcp`: `editor.mode-changed`, `editor.selection-changed`
     (агент может реагировать). В PoC-2 пока односторонне (proj-mcp →
     editor); двусторонняя — следующая итерация.
2. **State (pull, latest-wins).** Идеально для «текущее значение»,
   которое обновляется часто и не хочется засорять канал событий:
   - `editor.selection`, `editor.mode`, `editor.canvasUrl`,
     `editor.openProject`.
     `proj-mcp.editor_get_selection` делает обычный HTTP GET.

### Транспорт

- **WebSocket `/api/events`** через `hono/bun` — стандартный паттерн из
  [Hono docs](https://hono.dev/helpers/websocket). Один-к-многим
  подписка, JSON-сообщения по схеме (zod).
- **HTTP POST `/api/events/publish`** для не-WS клиентов (proj-mcp,
  CLI). Тело — то же `EditorEvent` JSON.
- **HTTP GET / POST `/api/state`** — простой last-write-wins KV.

### Формат событий

```ts
type EditorEvent =
  | { type: 'editor.message'; text: string; source: 'proj-mcp' | 'agent' | 'user' }
  | { type: 'editor.mode-changed'; mode: 'interact' | 'design' | 'code' }
  | { type: 'editor.selection-changed'; selection: SelectedNode | null }
  | { type: 'proj-mcp.tool-call'; tool: string; argsSummary: string };
```

`source` отличает «прилетело извне через MCP» от собственных событий —
UI может рендерить разные стили.

### Аутентификация

- Phase 1 step 2: `x-sber-designer-user` header (как у `/api/chat`).
  WebSocket принимает токен через query-string `?user=...`.
- Phase 4: bearer-token, ротация, OIDC integration.

### Multi-project / multi-user

PoC-2 — single-user, single-project, single-process. Соответственно:

- Один глобальный pub-sub.
- Одна in-memory state-map (`Record<string, unknown>`).

В Phase 1 step 3 (multi-tenancy) добавляем `projectId` в каждое
сообщение и шардим bus по проекту. Сейчас не нужно — over-engineering.

### Persistence

In-memory намеренно. Браузер реконнектится → получает текущий state из
GET `/api/state`. Историю событий нигде не храним; chat transcript
живёт в `apps/web/stores/chat-store` и пополняется поступающими
`editor.message` событиями.

## Что НЕ делаем в этой итерации

- Не делаем backpressure / replay / persistent log. Если клиент пропал
  — пропустил события за время оффлайна. Phase 4.
- Не реализуем editor → proj-mcp путь (хотя API готов). Сейчас интерес
  односторонний: показать что Claude Code пишет.
- Не делаем `editor_set_mode` тулзу — рискованно без аккуратной UX.
- Не оборачиваем events в Server-Sent Events fallback. WS работает на
  локалхосте надёжно.

## Ссылки

- [Hono WebSocket helper](https://hono.dev/helpers/websocket)
- [ADR-0006](./0006-proj-mcp-and-claude-as-agent.md) — почему inbound MCP вообще
- [ADR-0009](./0009-services-api-edge.md) — почему всё через `services/api`
