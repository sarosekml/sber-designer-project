import { z } from 'zod';

import { getProductMcpManager } from '../mcp/manager';
import type { McpFrontendServerSummary, McpToolSummary } from '../mcp/types';
import type { ServerTool } from './types';

const ListProductMcpToolsInput = z
  .object({
    serverKey: z.string().min(1).optional(),
    query: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    includeSchemas: z.boolean().optional(),
  })
  .strict();

const CallProductMcpToolInput = z
  .object({
    serverKey: z.string().min(1),
    toolName: z.string().min(1),
    arguments: z.unknown().optional(),
  })
  .strict();

export const listProductMcpTools: ServerTool<z.infer<typeof ListProductMcpToolsInput>, unknown> = {
  name: 'list_product_mcp_tools',
  description:
    'List product-owned MCP servers and tools available to API-mode agents. Use before guessing MCP tool names; returns canonical direct names, upstream names, exposure state, and diagnostics.',
  inputSchema: ListProductMcpToolsInput,
  safety: 'read',
  handler: async (input) => {
    const manager = getProductMcpManager();
    await manager.startEnabledServers({ reason: 'agent' });
    const summary = await manager.getSummary();
    const limit = input.limit ?? 64;
    const query = input.query?.toLocaleLowerCase();
    const servers = summary.servers
      .filter((server) => !input.serverKey || server.key === input.serverKey)
      .map((server) => ({
        key: server.key,
        namespace: server.namespace,
        status: server.status,
        ...(server.serverInfo ? { serverInfo: server.serverInfo } : {}),
        diagnostics: server.diagnostics,
        toolCount: server.toolCount,
        selectionMode: server.selectionMode,
        selectionLimit: server.selectionLimit,
        selectedToolCount: server.selectedToolCount,
        discoveredToolCount: server.discoveredToolCount,
        tools: filterTools(server, query)
          .slice(0, limit)
          .map((tool) => compactTool(tool, { includeSchemas: input.includeSchemas === true })),
      }));
    return { servers };
  },
};

export const callProductMcpTool: ServerTool<z.infer<typeof CallProductMcpToolInput>, unknown> = {
  name: 'call_product_mcp_tool',
  description:
    'Call a product-owned MCP tool by server key and upstream or canonical tool name. Use this only after listing MCP tools or when direct MCP tool specs are hidden by the tool limit.',
  inputSchema: CallProductMcpToolInput,
  safety: 'external-effect',
  handler: async (input) => {
    const manager = getProductMcpManager();
    await manager.startEnabledServers({ reason: 'agent' });
    const summary = await manager.getSummary();
    const server = summary.servers.find((candidate) => candidate.key === input.serverKey);
    if (!server) throw new Error(`Unknown MCP server "${input.serverKey}".`);
    const tool = resolveTool(server, input.toolName);
    if (!tool) {
      throw new Error(
        `Unknown MCP tool "${input.toolName}" on server "${input.serverKey}". Use list_product_mcp_tools first.`,
      );
    }
    if (tool.configuredDisabled || tool.runtimeDisabled) {
      throw new Error(`MCP tool "${tool.name}" is disabled.`);
    }
    return manager.callTool({
      serverKey: input.serverKey,
      toolName: tool.name,
      input: input.arguments ?? {},
    });
  },
};

export const PRODUCT_MCP_BROKER_TOOLS: ServerTool[] = [
  listProductMcpTools,
  callProductMcpTool,
] as ServerTool[];

function filterTools(
  server: McpFrontendServerSummary,
  query: string | undefined,
): McpToolSummary[] {
  if (!query) return server.tools;
  return server.tools.filter((tool) =>
    [tool.name, tool.displayName, tool.description, tool.canonicalName]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(query)),
  );
}

function compactTool(tool: McpToolSummary, options: { includeSchemas: boolean }) {
  return {
    name: tool.name,
    canonicalName: tool.canonicalName,
    enabled: tool.enabled,
    configuredDisabled: tool.configuredDisabled,
    runtimeDisabled: tool.runtimeDisabled,
    hiddenByLimit: tool.hiddenByLimit,
    blockedBySelectionLimit: tool.blockedBySelectionLimit,
    blockedBySelectionMinimum: tool.blockedBySelectionMinimum,
    canToggle: tool.canToggle,
    ...(tool.displayName ? { displayName: tool.displayName } : {}),
    ...(tool.description ? { description: tool.description } : {}),
    ...(options.includeSchemas && tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
  };
}

function resolveTool(
  server: McpFrontendServerSummary,
  toolNameOrCanonicalName: string,
): McpToolSummary | undefined {
  return server.tools.find(
    (tool) =>
      tool.name === toolNameOrCanonicalName || tool.canonicalName === toolNameOrCanonicalName,
  );
}
