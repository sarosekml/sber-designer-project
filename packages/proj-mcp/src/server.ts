/**
 * Hosts our tool registry behind the official MCP SDK server. Transport
 * is plumbed in by `bin.ts` (stdio in PoC-2; HTTP/SSE in Phase 1).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { type ProjMcpContext } from './context';
import { callTool, listTools } from './tool-runner';
import { ALL_TOOLS, type ToolDefinition } from './tools';

export interface CreateServerOptions {
  context: ProjMcpContext;
  tools?: ToolDefinition[];
}

export function createMcpServer({ context, tools = ALL_TOOLS }: CreateServerOptions): Server {
  const server = new Server(
    { name: 'sber-designer', version: context.version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => listTools(tools));

  server.setRequestHandler(CallToolRequestSchema, async (req) =>
    callTool(tools, req.params.name, req.params.arguments, context),
  );

  return server;
}
