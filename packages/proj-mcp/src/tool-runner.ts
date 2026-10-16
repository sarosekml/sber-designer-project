/**
 * Transport-independent tool execution. Both the stdio MCP server
 * (server.ts) and the HTTP server (http-server.ts) hand off to these
 * helpers — keeps the validation / error shape consistent.
 */
import { zodToJsonSchema } from 'zod-to-json-schema';

import type { ProjMcpContext } from './context';
import type { ToolDefinition } from './tools';

// Type aliases, not interfaces: only an alias gets an implicit index
// signature, which is what the MCP SDK's ServerResult requires of a handler
// return value. As interfaces these were structurally identical but not
// assignable, which is the whole of the two server.ts errors.
export type ListToolsResponse = {
  tools: { name: string; description: string; inputSchema: Record<string, unknown> }[];
};

export type CallToolResponse = {
  content: { type: 'text'; text: string }[];
  isError: boolean;
};

export function listTools(tools: ToolDefinition[]): ListToolsResponse {
  return {
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema, { target: 'jsonSchema7' }) as Record<
        string,
        unknown
      >,
    })),
  };
}

export async function callTool(
  tools: ToolDefinition[],
  toolName: string,
  args: unknown,
  ctx: ProjMcpContext,
): Promise<CallToolResponse> {
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) return errorResult(`Unknown tool: ${toolName}`);

  const parse = tool.inputSchema.safeParse(args ?? {});
  if (!parse.success) {
    return errorResult(`Invalid input for "${tool.name}": ${parse.error.message}`);
  }

  try {
    const out = await tool.handler(parse.data, ctx);
    return {
      content: [{ type: 'text', text: JSON.stringify(out, null, 2) }],
      isError: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResult(`Tool "${tool.name}" failed: ${msg}`);
  }
}

function errorResult(message: string): CallToolResponse {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
