---
id: ADR-0014
title: Tool calling and agent loop
status: Accepted
date: 2026-05-08
scope: built-in agent execution
refines:
  - ADR-0009
  - ADR-0012
  - ADR-0013
---

# ADR-0014: Tool-calling в `llm-gateway` и agent loop в `/api/chat`

- **Дата:** 2026-05-08
- **Статус:** Accepted
- **Контекст:** Phase 2 step 2.

## Контекст

Phase 2.1 даёт `ast-bridge` + `/api/patch`, но **только внешний
Claude Code** ими пользуется (через `proj-mcp`). Встроенный агент в
`apps/web` остаётся text-only — его ответы это просто строки, без
способности менять код или читать состояние редактора.

Чтобы **встроенный agent сравнялся с Claude Code в bridge-mode**,
нужны две вещи:

1. **Tool-calling в `llm-gateway`** — чтобы провайдер (GigaChat,
   vLLM, OpenAI, Anthropic) умел просить вызвать тулзу.
2. **Agent loop в `/api/chat`** — чтобы api сам выполнил запрошенные
   тулзы и продолжил разговор до финального ответа модели.

OpenAI Chat Completions API уже стандартно описывает это через
`tools[]` + `tool_choice` в request, и `tool_calls[]` в assistant
message. Anthropic делает аналогично через `tools` + `tool_use` в
content blocks. GigaChat / vLLM / DeepSeek — все адаптировались под
OpenAI shape. Унификация под OpenAI wire format даёт нам ~95% покрытия
бесплатно.

## Решение

### `llm-gateway` API расширение

```ts
type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Present on assistant messages that asked for tools. */
  toolCalls?: ToolCall[];
  /** Present on role:'tool' messages — links the result to the call. */
  toolCallId?: string;
}

interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for inputs. We accept zod via zodToJsonSchema at the api layer. */
  parameters: Record<string, unknown>;
}

interface ToolCall {
  id: string;
  name: string;
  /** JSON-serialised arguments object. */
  arguments: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolSpec[];
  toolChoice?: 'auto' | 'required' | 'none' | { name: string };
  // ...existing temperature/maxTokens/model
}

interface ChatResponse {
  text: string;
  /** When the model wants to use tools. text may be empty in this case. */
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'other';
  // ...existing usage/provider/model
}
```

The OpenAI-compatible adapter wires these directly into the
`/v1/chat/completions` body fields. Mock adapter ignores `tools`
unless a special directive is present (see Testing).

### `/api/chat` agent loop

```
1. attach system prompt (ADR-0012)
2. inject tools (toolset built from api capabilities)
3. call gateway.chat()
4. if response.toolCalls is non-empty AND iteration < MAX:
     for each toolCall:
       execute → append role:'tool' message with toolCallId + result
     append the assistant message (with toolCalls) too
     loop back to step 3
5. else: return the final transcript to the browser
```

`MAX` defaults to **6** iterations — protects against runaway loops
without truncating realistic multi-step refactors.

### Toolset (Phase 2.2 baseline)

Один и тот же набор thin wrappers, что у `proj-mcp` — но дёргается
**из api**, без HTTP self-call. Это исключает циклы и упрощает аудит.

| Tool              | Что делает                   | Backed by                                               |
| ----------------- | ---------------------------- | ------------------------------------------------------- |
| `apply_patch`     | structured AST ops, ADR-0013 | `@sber-designer/ast-bridge` `applyOps`                  |
| `read_file`       | read workspace-relative file | `safe-fs`                                               |
| `list_components` | live storybook catalog       | `@sber-designer/storybook-indexer` `indexFromStorybook` |
| `get_selection`   | latest editor selection      | `state-store`                                           |
| `set_mode`        | switch the editor mode       | `state-store` + publish `editor.mode-changed`           |
| `post_message`    | push markdown to chat        | `event-bus` publish `editor.message`                    |

Каждая тулза описывается единым `ServerTool` интерфейсом
(zod input schema + handler). Превращение в `ToolSpec` (с
`zodToJsonSchema`) делается один раз на старте при сборке `tools[]`.

### Возврат browser'у

Browser получает **полный transcript** — включая tool calls и tool
results. Это нужно UI чтобы рендерить ход «AI listed components → AI
applied 3 ops → done». В Phase 2.3 на frontend появится
`<ToolCallBubble>`-компонент для этого.

В audit-логе пишем по строке per-iteration: `iteration N tool=apply_patch
ok=true latency=120ms`.

### Совместимость с PoC-2 mock

Mock-провайдер по-прежнему возвращает `[mock:...] echo → ...`. Но если
последнее user-сообщение содержит специальный тэг
`<call:apply_patch>{...}</call>` — мы парсим его и возвращаем как
`toolCall`. Это даёт offline integration test: «mock с подсказкой
вернёт toolCall — agent loop его выполнит — мы видим патч на диске».

### Что мы НЕ делаем сейчас

- **Anthropic native shape (`tools` + `tool_use` content blocks)** —
  Phase 2.4. Сейчас Anthropic пользователи идут через OpenAI-compatible
  proxy (Anthropic API через aigateway или Bedrock).
- **Streaming chunks** — Phase 2.5. Сейчас агент отдаёт цельный
  transcript за один POST.
- **Параллельные tool calls в одной итерации** — OpenAI поддерживает,
  но мы выполняем последовательно (atomicity и аудит проще).
- **Cost tracking / token budget enforcement** — Phase 4.

## Что меняется

- `apps/web/src/hooks/useChat.ts` шлёт ту же шейп — фактически
  ничего не меняет на стороне клиента в этой итерации (Phase 2.3
  добавит UI для tool calls).
- `chat-store.ts` расширяется чтобы хранить tool messages.
- `proj-mcp` остаётся как был — внешний Claude Code продолжает
  работать через MCP, **независимо** от встроенного agent loop.

## Последствия

- Каждый chat-message может закончиться 0..N итерациями LLM-вызовов.
  Latency растёт; для долгих цепочек нужен Phase 2.5 streaming.
- Toolset — **server-only**. Браузер не получает определения тулзов
  и не может их вызвать напрямую (защита от cross-tool privilege
  escalation).
- Для аудита/безопасности появляется единая точка: «всё, что агент
  потрогал в проекте, прошло через `services/api` toolset».

## Ссылки

- [OpenAI tool calling](https://platform.openai.com/docs/guides/function-calling)
  — wire format, который мы зеркалим.
- [Anthropic tool use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
  — для Phase 2.4 native adapter.
- ADR-0009 — почему всё через `services/api`.
- ADR-0012 — system prompt assembly (теперь дополняется toolset).
- ADR-0013 — `apply_patch` operation set.
