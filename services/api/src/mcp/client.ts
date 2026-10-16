import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { CallToolResult, ListToolsResult } from '@modelcontextprotocol/sdk/types.js';

import type { NormalizedMcpServer } from './types';
import type { ProductMcpRuntimeClient } from './manager';

export function createMcpRuntimeClient(server: NormalizedMcpServer): ProductMcpRuntimeClient {
  const client = new Client({ name: 'sber-designer-api', version: '0.0.0' }, { capabilities: {} });
  const transport =
    server.transport === 'stdio'
      ? createStdioTransport(server)
      : createStreamableHttpTransport(server);
  const timeout = server.entry.timeoutMs;

  return {
    async connect() {
      await client.connect(transport as Transport, { timeout });
      const serverInfo = client.getServerVersion();
      const instructions = client.getInstructions();
      return {
        ...(serverInfo
          ? {
              serverInfo: {
                ...(serverInfo.name ? { name: serverInfo.name } : {}),
                ...(serverInfo.version ? { version: serverInfo.version } : {}),
              },
            }
          : {}),
        ...(instructions ? { instructions } : {}),
      };
    },
    async listTools() {
      const result = (await client.listTools(undefined, { timeout })) as ListToolsResult;
      return {
        tools: result.tools.map((tool) => ({
          name: tool.name,
          ...(tool.title ? { title: tool.title } : {}),
          ...(tool.description ? { description: tool.description } : {}),
          inputSchema: tool.inputSchema as Record<string, unknown>,
        })),
      };
    },
    async callTool(input) {
      return client.callTool(
        { name: input.name, arguments: asToolArguments(input.arguments) },
        undefined,
        { timeout },
      ) as Promise<CallToolResult>;
    },
    async close() {
      await client.close().catch(() => undefined);
      await transport.close().catch(() => undefined);
    },
  };
}

function createStdioTransport(server: NormalizedMcpServer): StdioClientTransport {
  const entry = server.entry;
  if (entry.type !== 'stdio') {
    throw new Error(`MCP server "${server.key}" is not configured for stdio.`);
  }
  return new StdioClientTransport({
    command: entry.command,
    args: entry.args,
    ...(entry.cwd ? { cwd: entry.cwd } : {}),
    ...(entry.env ? { env: entry.env } : {}),
    stderr: 'pipe',
  });
}

function createStreamableHttpTransport(server: NormalizedMcpServer): StreamableHTTPClientTransport {
  const entry = server.entry;
  if (!('url' in entry)) {
    throw new Error(`MCP server "${server.key}" is missing a Streamable HTTP URL.`);
  }
  const url = new URL(entry.url);
  return new StreamableHTTPClientTransport(url, {
    // A permitted host must not redirect tool payloads/credentials to an
    // endpoint the deployment policy never approved.
    requestInit: { redirect: 'error', ...(entry.headers ? { headers: entry.headers } : {}) },
  });
}

function asToolArguments(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
