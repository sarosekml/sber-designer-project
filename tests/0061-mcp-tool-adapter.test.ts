import { expect, test } from 'bun:test';

import { parseConfig } from '../packages/llm-gateway/src/config';
import { normalizeMcpServers } from '../services/api/src/mcp/config';
import { adaptMcpTools, mcpToolName } from '../services/api/src/mcp/tool-adapter';

function configWith(mcpServers: Record<string, unknown>) {
  return parseConfig({
    agent: { default: { provider: 'mock', model: 'echo' } },
    provider: {
      mock: {
        type: 'mock',
        name: 'Mock',
        models: { echo: { name: 'echo' } },
      },
    },
    mcpServers,
  });
}

test('adapts connected MCP inventory into namespaced server tools', async () => {
  const [server] = normalizeMcpServers(
    configWith({
      'talk-to-pixso': {
        type: 'streamable-http',
        url: 'http://127.0.0.1:18412/mcp',
        allowedTools: ['read_document', 'write_document'],
        disabledTools: ['write_document'],
        toolSafety: { write_document: 'write' },
      },
    }),
  );
  const calls: unknown[] = [];

  const result = adaptMcpTools({
    servers: [server!],
    inventories: {
      'talk-to-pixso': {
        tools: [
          {
            name: 'read_document',
            description: 'Read Pixso document data.',
            inputSchema: {
              type: 'object',
              properties: { nodeId: { type: 'string' } },
              required: ['nodeId'],
            },
          },
          {
            name: 'write_document',
            description: 'Write Pixso document data.',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'extra',
            description: 'Extra tool.',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
    },
    callTool: async (input) => {
      calls.push(input);
      return { ok: true };
    },
  });

  expect(result.diagnostics).toEqual([]);
  expect(result.tools.map((tool) => tool.name)).toEqual(['mcp__talk_to_pixso__read_document']);
  expect(result.tools[0]?.parametersJsonSchema).toEqual({
    type: 'object',
    properties: { nodeId: { type: 'string' } },
    required: ['nodeId'],
  });
  expect(result.tools[0]?.safety).toBe('read');

  await result.tools[0]?.handler({ nodeId: '12:34' }, minimalToolContext());

  expect(calls).toEqual([
    {
      serverKey: 'talk-to-pixso',
      toolName: 'read_document',
      input: { nodeId: '12:34' },
    },
  ]);
});

test('exposes first 64 tools from large MCP inventories and warns about hidden tools', () => {
  const [server] = normalizeMcpServers(
    configWith({
      large: {
        type: 'streamable-http',
        url: 'http://127.0.0.1:18412/mcp',
      },
    }),
  );
  const tools = Array.from({ length: 65 }, (_, index) => ({
    name: `tool_${index}`,
    description: `Tool ${index}`,
    inputSchema: { type: 'object', properties: {} },
  }));

  const result = adaptMcpTools({
    servers: [server!],
    inventories: { large: { tools } },
    maxToolsPerServer: 64,
    callTool: async () => ({ ok: true }),
  });

  expect(result.tools).toHaveLength(64);
  expect(result.tools[0]?.name).toBe(mcpToolName('large', 'tool_0'));
  expect(result.tools[63]?.name).toBe(mcpToolName('large', 'tool_63'));
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'mcp_tools_truncated',
      level: 'warning',
      message: 'Only the first 64 MCP tools are available for this server. 1 tool is hidden.',
    }),
  );

  const [narrowed] = normalizeMcpServers(
    configWith({
      large: {
        type: 'streamable-http',
        url: 'http://127.0.0.1:18412/mcp',
        allowedTools: ['tool_64'],
      },
    }),
  );
  const narrowedResult = adaptMcpTools({
    servers: [narrowed!],
    inventories: { large: { tools } },
    maxToolsPerServer: 64,
    callTool: async () => ({ ok: true }),
  });

  expect(narrowedResult.tools.map((tool) => tool.name)).toEqual([mcpToolName('large', 'tool_64')]);
});

function minimalToolContext() {
  return {
    user: 'test-user',
    workspacePath: null,
    canvasUrl: null,
  };
}
