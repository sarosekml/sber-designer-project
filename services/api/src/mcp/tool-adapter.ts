import { z } from 'zod';

import type { ServerTool, ServerToolSafety, ToolContext } from '../agent/types';
import { normalizeMcpNamespace } from './config';
import type { McpDiagnostic, NormalizedMcpServer } from './types';
import {
  DEFAULT_MAX_MCP_TOOLS_PER_SERVER,
  mcpToolsTruncatedDiagnostic,
  selectMcpTools,
} from './tool-selection';

export interface McpRemoteToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpToolInventory {
  tools: McpRemoteToolDescriptor[];
}

export interface McpToolCallInput {
  serverKey: string;
  toolName: string;
  input: unknown;
}

export type McpToolCaller = (input: McpToolCallInput) => Promise<unknown>;

export interface AdaptMcpToolsInput {
  servers: NormalizedMcpServer[];
  inventories: Record<string, McpToolInventory | undefined>;
  callTool: McpToolCaller;
  maxToolsPerServer?: number;
}

export interface AdaptedMcpTool extends ServerTool {
  source: 'mcp';
  mcpServerKey: string;
  mcpToolName: string;
  safety: ServerToolSafety;
}

export interface AdaptMcpToolsResult {
  tools: AdaptedMcpTool[];
  diagnostics: McpDiagnostic[];
}

export function adaptMcpTools(input: AdaptMcpToolsInput): AdaptMcpToolsResult {
  const diagnostics: McpDiagnostic[] = [];
  const tools: AdaptedMcpTool[] = [];
  const maxTools = input.maxToolsPerServer ?? DEFAULT_MAX_MCP_TOOLS_PER_SERVER;

  for (const server of input.servers) {
    if (!server.enabled) continue;
    const inventory = input.inventories[server.key] ?? input.inventories[server.namespace];
    if (!inventory) continue;

    const selection = selectMcpTools({
      server,
      tools: inventory.tools,
      maxToolsPerServer: maxTools,
    });
    const truncation = mcpToolsTruncatedDiagnostic(selection);
    if (truncation) diagnostics.push(truncation);

    for (const descriptor of selection.exposedTools) {
      tools.push(createMcpTool(server, descriptor, input.callTool));
    }
  }

  return { tools, diagnostics };
}

export function mcpToolName(serverKeyOrNamespace: string, upstreamToolName: string): string {
  return `mcp__${normalizeMcpNamespace(serverKeyOrNamespace)}__${normalizeMcpNamespace(
    upstreamToolName,
  )}`;
}

function createMcpTool(
  server: NormalizedMcpServer,
  descriptor: McpRemoteToolDescriptor,
  callTool: McpToolCaller,
): AdaptedMcpTool {
  const safety = safetyForTool(server, descriptor.name);
  return {
    source: 'mcp',
    mcpServerKey: server.key,
    mcpToolName: descriptor.name,
    name: mcpToolName(server.namespace, descriptor.name),
    description:
      descriptor.description ??
      `Call "${descriptor.name}" on product-owned MCP server "${server.key}".`,
    inputSchema: z.unknown(),
    parametersJsonSchema: descriptor.inputSchema ?? { type: 'object', properties: {} },
    safety,
    handler: async (toolInput: unknown, _ctx: ToolContext) =>
      callTool({
        serverKey: server.key,
        toolName: descriptor.name,
        input: toolInput,
      }),
  };
}

function safetyForTool(server: NormalizedMcpServer, toolName: string): ServerToolSafety {
  return server.entry.toolSafety?.[toolName] ?? 'read';
}
