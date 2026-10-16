---
id: ADR-0009
title: services/api as the backend edge
status: Accepted
date: 2026-05-08
scope: browser to backend boundary
---

# ADR-0009: `services/api` — единая edge-точка между браузером и backend-зависимостями

- **Дата:** 2026-05-08
- **Статус:** Accepted
- **Контекст:** начало Phase 1, первая итерация.

## Контекст

PoC-2 уже даёт `@sber-designer/llm-gateway` с реальным `chat()` через
OpenAI-совместимый wire format. PoC-3 даёт `services/sandbox` с REST.
Однако в Phase-0 оба ходовых пути имеют слабые места:

1. **`apps/web` загружает `sber-designer.json` напрямую через
   `fetch('/sber-designer.json')`** — конфиг кладётся в `apps/web/public/`
   с `{env:VAR}` placeholders, которые браузер резолвить не умеет.
   В итоге `apiKey` остаётся текстовым плейсхолдером, и реальный chat
   из браузера невозможен.
2. **`apps/web` дёргает `services/sandbox` напрямую** на `:3001`. Это
   работает локально, но в любом не-локальном развёртывании браузер
   видит и контроллер, и dev-сервер sandbox'а — без auth/audit.

## Решение

Вводим `services/api` — Bun + Hono backend на `:3000`, который
становится **единственной точкой выхода `apps/web` наружу**. Всё, что
ниже — `llm-gateway`, `services/sandbox`, в дальнейшем `git-worker`,
`storybook-indexer-svc`, `proj-mcp` bridge — живёт за ним.

```
   apps/web :5173
        │  (only talks to api)
        ▼
   services/api :3000  ← server-side env, audit, auth
        │            │            │
        ▼            ▼            ▼
   llm-gateway   services/sandbox   (Phase 1+)  proj-mcp / git-worker / etc.
```

### Что в первой итерации

| Endpoint          | Что делает                                                                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`     | Liveness.                                                                                                                                                                                      |
| `GET /api/config` | Парсит `sber-designer.json` zod-схемой, **резолвит `{env:VAR}` на сервере**, **вырезает `apiKey` и любые секреты** из ответа (браузер видит только публичные поля), отдаёт frontend-safe view. |
| `POST /api/chat`  | Принимает `ChatRequest`, идёт через `llm-gateway` с уже-резолвенным конфигом, возвращает `ChatResponse`. Здесь живут все вызовы к GigaChat / vLLM / OpenAI.                                    |

### Принципы

- **Server-side secret resolution.** `parseConfig({ env: process.env })`
  вызывается только на сервере. Никогда не пробрасываем `apiKey` или
  `headers.Authorization` в браузер.
- **Stateless.** Текущий конфиг читается с диска на каждый запрос
  (или из кэша с `mtime`-инвалидацией). Никаких глобальных состояний.
- **CORS только для local dev.** В production frontend и api живут на
  одном origin (через reverse-proxy), CORS отключается.
- **Audit log.** Каждый вызов `/api/chat` идёт в JSON-line log
  (project, user-stub, provider, model, prompt-hash, tokens, latency).
  В Phase 1+ переносится в PostgreSQL.

### Что НЕ делаем в этой итерации

- **Auth.** Заглушка `x-sber-designer-user` header (доверяем). Keycloak
  OIDC — следующая итерация Phase 1.
- **WebSocket bridge** для `proj-mcp` ↔ editor — отдельная итерация.
- **Proxy `/api/sandbox/*` → `services/sandbox`.** Сейчас браузер всё
  ещё ходит на `:3001` напрямую. Это закроется параллельно с auth.
- **Streaming chat (SSE).** Проще доказать связку non-streaming сначала.

## Как это меняет PoC-2

- `apps/web/public/sber-designer.json` остаётся как **fallback** для
  случая «api недоступен» — useConfigLoader сначала пробует
  `/api/config`, при ошибке откатывается к `/sber-designer.json`
  (как PoC-2). Это гарантирует, что редактор всё ещё открывается без
  backend для UX-разработки.
- `claude-code-bridge` псевдо-провайдер не зовёт `/api/chat` (как и
  раньше — `chat()` бросает осознанно).

## Последствия

- Появляется явная Phase-1 зависимость: оба `services/sandbox` и
  `services/api` должны быть запущены для полной работы редактора.
  Один общий script `bun run dev:all` (concurrent runner) добавим
  следующим заходом.
- Архитектурное правило: **`apps/web` импортирует `@sber-designer/shared-types`
  и `@sber-designer/llm-gateway` только для типов**. Любой реальный
  вызов LLM идёт через `fetch('/api/chat')`. Существующий
  `createGateway()` теперь живёт только на сервере.

> **0136 update:** политика форвардинга обоих прокси превью, публикуемые
> пути static preview и целостность `.sdproj` — в
> [ADR-0019](0019-access-boundaries-and-project-integrity.md).
