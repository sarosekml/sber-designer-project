---
updated: 2026-06-11T09:02:48+03:00
---

# MCP and integrations

## Product-owned MCP

sber-designer поддерживает product-owned MCP servers в `sber-designer.json`.
Это outbound tools, которые API-agent может использовать через backend broker.

Кодовые точки:

- `services/api/src/mcp/config.ts`;
- `services/api/src/routes/mcp.ts`;
- `services/api/src/agent/toolset.ts` (реестр; реализации в `agent/tools/*`);
- `packages/llm-gateway/src/schema.ts`.

## Config

Примерная форма:

```json
{
  "mcpServers": {
    "pixso": {
      "transport": "stdio",
      "command": "...",
      "args": [],
      "env": {},
      "allowedTools": [],
      "disabledTools": []
    }
  }
}
```

Поддерживаемые transports:

- stdio;
- http;
- streamable-http / streamableHttp;
- remote.

Secrets и headers должны редактироваться осторожно и не попадать на frontend в
открытом виде.

## Runtime state

UI может подключать/отключать MCP servers and tools. Runtime overrides проекта
хранятся в `.sdproj.mcpSettings`, если они влияют на проектный behavior.

Routes:

- status;
- reload;
- connect/disconnect/restart;
- enable/disable server;
- list tools;
- enable/disable tool;
- reset overrides.

## Safety

MCP config нормализуется:

- namespace validation;
- config hash;
- disabled/allowed tool filtering;
- disk write root policy;
- remote server diagnostics;
- tool safety metadata.

Agent prompt должен видеть только разрешенные tools. Если tool disabled, агент
не должен пытаться его вызвать.

## API mode vs CLI runtime

Product MCP tools доступны API-agent loop. CLI runtimes используют свои MCP
настройки. sber-designer может включить в handoff информацию, что проект имеет
MCP integration, но не подменяет конфиг внешнего CLI.

## Design-source integrations

Pixso/Figma links and selected-frame flows передаются как design-source
directive. На MVP агент должен использовать explicit ask-only flow:

- пользователь дает ссылку или выбирает source;
- sber-designer сохраняет directive/evidence;
- агент читает только подтвержденный source;
- generated screen строится через project components and tokens, а не через
  raw copy external markup.

## Inbound/project MCP

`packages/proj-mcp` существует как поверхность для внешних IDE/agents, которые
могут управлять проектом через протокол. Это отдельное направление и не
заменяет product-owned MCP для API-agent.
