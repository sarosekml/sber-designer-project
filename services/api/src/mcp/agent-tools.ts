import type { ServerTool } from '../agent/types';
import { CLAUDE_CODE_RUNTIME_PROVIDER } from '../agent-runtimes/claude-runner';
import { CODEX_RUNTIME_PROVIDER } from '../agent-runtimes/codex-runner';
import { GIGACODE_RUNTIME_PROVIDER } from '../agent-runtimes/gigacode-runner';
import { KIMI_RUNTIME_PROVIDER } from '../agent-runtimes/kimi-runner';
import { OPENCODE_RUNTIME_PROVIDER } from '../agent-runtimes/opencode-runner';
import { adaptMcpTools } from './tool-adapter';
import { getProductMcpManager } from './manager';
import type { McpDiagnostic } from './types';

export async function loadMcpToolsForAgentContext(input: {
  activeProviderType: string;
  activeAgentName: string | null;
  maxToolsPerServer?: number;
}): Promise<{
  tools: ServerTool[];
  diagnostics: McpDiagnostic[];
  promptBlock: string;
}> {
  if (isCliRuntimeProvider(input.activeProviderType)) {
    return { tools: [], diagnostics: [], promptBlock: '' };
  }

  const manager = getProductMcpManager();
  const connected = await manager.getConnectedInventories({ connectEnabled: true });
  const adapted = adaptMcpTools({
    servers: connected.servers,
    inventories: connected.inventories,
    callTool: (toolInput) => manager.callTool(toolInput),
    ...(input.maxToolsPerServer ? { maxToolsPerServer: input.maxToolsPerServer } : {}),
  });

  return {
    tools: adapted.tools,
    diagnostics: [...connected.diagnostics, ...adapted.diagnostics],
    promptBlock: connected.promptBlock,
  };
}

function isCliRuntimeProvider(providerTypeOrId: string): boolean {
  return (
    providerTypeOrId === OPENCODE_RUNTIME_PROVIDER ||
    providerTypeOrId === CLAUDE_CODE_RUNTIME_PROVIDER ||
    providerTypeOrId === CODEX_RUNTIME_PROVIDER ||
    providerTypeOrId === KIMI_RUNTIME_PROVIDER ||
    providerTypeOrId === GIGACODE_RUNTIME_PROVIDER
  );
}
