# @sber-designer/llm-gateway

Single chokepoint for every LLM call in sber-designer.

## Why a chokepoint

- **Pluggability.** Customers swap GigaChat ↔ vLLM ↔ Anthropic without
  touching agent code.
- **On-prem compliance.** All requests / responses go through one place
  that we can log, redact, and audit.
- **Testing.** A `mock` adapter makes deterministic agent tests cheap.

## Config format

opencode-style JSON (`sber-designer.json` in repo root). See ADR-0005.

```json
{
  "$schema": "https://sber-designer.example/schema.json",
  "agent": {
    "default": { "provider": "gigachat", "model": "GigaChat-Max" }
  },
  "provider": {
    "gigachat": {
      "type": "openai-compatible",
      "name": "GigaChat",
      "options": {
        "baseURL": "https://gigachat.devices.sberbank.ru/api/v1",
        "apiKey": "{env:GIGACHAT_API_KEY}"
      },
      "models": {
        "GigaChat-Max": { "name": "GigaChat Max", "limit": { "context": 32000 } }
      }
    }
  },
  "mcpServers": {}
}
```

`{env:VAR}` placeholders resolve at load time using `process.env` (or an
override map for tests).

## Provider types

| `type`              | Status             | Notes                                                                                                                                                         |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openai-compatible` | ✅ implemented     | Chat Completions + streaming. Works with GigaChat, vLLM, OpenAI, DeepSeek, Together AI, llama.cpp, LM Studio.                                                 |
| `anthropic`         | ✅ implemented     | Native `/v1/messages` + streaming, system prompt, tool_result injection. Default `baseURL` is `https://api.anthropic.com`; override for self-hosted gateways. |
| `mock`              | ✅ implemented     | Deterministic echo + mock streaming. Default fallback.                                                                                                        |
| `claude-code`       | ✅ pseudo-provider | Bridge mode for the user's external Claude Code via `proj-mcp` (ADR-0006). The api refuses direct chat calls for this provider.                               |

## Public API

```ts
import { createGateway, parseConfig } from '@sber-designer/llm-gateway';

const cfg = parseConfig(JSON.parse(rawJson));
const gateway = createGateway(cfg);

const reply = await gateway.chat({
  messages: [{ role: 'user', content: 'Compose a dashboard from MetricCard.' }],
});
console.log(reply.text);
```

`gateway.listVisibleModels()` returns the dropdown list for the Settings UI,
with `agent.restrict` already applied.

Model entries can mark raster image support with `vision: true`. The web app
and API resolve an `AgentModelTarget` before each run: text-only API targets
reject PNG/JPEG/WebP attachments before the provider call, while vision-capable
API targets pass image content through the gateway. SVG attachments are treated
as source/context and can still pass through text-only targets within the
configured size limit.

`agent.attachments.svgMaxBytes` can override the default SVG limit.
`agent.concurrency` configures run limits and same-screen/same-file conflict
policy used by the API coordinator.

## Tool calling

Mirrors the OpenAI Chat Completions shape — works unchanged for any
OpenAI-compatible provider (GigaChat, vLLM, DeepSeek, Together AI,
llama.cpp, LM Studio, OpenAI proper). See ADR-0014.

```ts
const reply = await gateway.chat({
  messages: [{ role: 'user', content: 'List my components.' }],
  tools: [
    {
      name: 'list_components',
      description: 'Return all components in the connected project.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  ],
  toolChoice: 'auto', // also: 'required' | 'none' | { name: 'list_components' }
});

if (reply.toolCalls) {
  for (const call of reply.toolCalls) {
    const args = JSON.parse(call.arguments);
    // execute the tool in your app, then continue the conversation:
    await gateway.chat({
      messages: [
        ...prior,
        { role: 'assistant', content: '', toolCalls: reply.toolCalls },
        { role: 'tool', toolCallId: call.id, content: JSON.stringify(result) },
      ],
      tools,
    });
  }
}
```

The mock provider supports a `<call:tool_name>{json}</call>` directive
in the user message — useful for offline integration tests of agent
loops without a live provider.

## Image content

OpenAI-compatible providers receive user message content arrays unchanged, so
`image_url` parts remain provider-native. Tool messages and assistant
tool-call messages are flattened to text because the OpenAI tool protocol
requires text content there.

Anthropic providers map data URL and HTTP image references to native Anthropic
image blocks for both non-streaming and streaming calls. Unsupported image URLs
fall back to a short text placeholder instead of silently disappearing.

## Current gaps

- JSON-mode / structured outputs.
- Cost-aware "Auto" mode (Builder Fusion has it).
- Encrypted secrets store (`auth.json`); env-vars only for now.
- Live provider validation still requires project credentials; tests cover the
  request-shaping and preflight paths, not every vendor endpoint.
