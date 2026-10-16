import { normalizeMcpNamespace } from './config';
import type {
  McpDiagnostic,
  McpToolSelectionMode,
  NormalizedMcpServer,
  ProductMcpRuntimeTool,
} from './types';

export const DEFAULT_MAX_MCP_TOOLS_PER_SERVER = 64;

export interface McpToolExposure<T extends ProductMcpRuntimeTool = ProductMcpRuntimeTool> {
  upstreamCount: number;
  candidateCount: number;
  exposedTools: T[];
  hiddenTools: T[];
  limit: number;
  truncated: boolean;
}

export interface McpToolState {
  configuredDisabled: boolean;
  runtimeDisabled: boolean;
  hiddenByLimit: boolean;
  blockedBySelectionLimit: boolean;
  blockedBySelectionMinimum: boolean;
  canToggle: boolean;
  enabled: boolean;
}

export interface McpToolSelection<
  T extends ProductMcpRuntimeTool = ProductMcpRuntimeTool,
> extends McpToolExposure<T> {
  selectionMode: McpToolSelectionMode;
  selectedToolCount: number;
  discoveredToolCount: number;
  stateForTool(toolName: string): McpToolState;
}

export function selectMcpTools<T extends ProductMcpRuntimeTool>(input: {
  server: NormalizedMcpServer;
  tools: T[];
  maxToolsPerServer?: number;
}): McpToolSelection<T> {
  const limit = input.maxToolsPerServer ?? DEFAULT_MAX_MCP_TOOLS_PER_SERVER;
  const upstreamByName = new Map<string, T>();
  for (const tool of input.tools) {
    if (!upstreamByName.has(tool.name)) upstreamByName.set(tool.name, tool);
  }

  const configuredDisabled = new Set(input.server.entry.disabledTools ?? []);
  const configuredAllowed = input.server.entry.allowedTools;

  const orderedCandidates = configuredAllowed
    ? configuredAllowed
        .map((toolName) => upstreamByName.get(toolName))
        .filter((tool): tool is T => Boolean(tool))
    : input.tools;

  const candidateUniverse = orderedCandidates.filter(
    (tool, index, arr) =>
      arr.findIndex((candidate) => candidate.name === tool.name) === index &&
      !configuredDisabled.has(tool.name),
  );
  const candidateByName = new Map(candidateUniverse.map((tool) => [tool.name, tool] as const));
  const explicitSelectedTools = input.server.toolSelection?.selectedTools;
  const legacyOverrides = explicitSelectedTools ? null : input.server.toolOverrides;
  const selectionMode: McpToolSelectionMode =
    explicitSelectedTools || legacyOverrides ? 'explicit' : 'auto';
  const candidates =
    selectionMode === 'auto'
      ? candidateUniverse
      : selectedCandidateTools({
          explicitSelectedTools,
          legacyOverrides,
          candidateUniverse,
          candidateByName,
          limit,
        });
  const exposedTools = candidates.slice(0, limit);
  const hiddenTools = candidates.slice(limit);
  const exposedNames = new Set(exposedTools.map((tool) => tool.name));
  const hiddenNames = new Set(hiddenTools.map((tool) => tool.name));
  const allowedSet = configuredAllowed ? new Set(configuredAllowed) : null;
  const selectedToolCount = exposedTools.length;

  return {
    upstreamCount: input.tools.length,
    candidateCount: candidates.length,
    exposedTools,
    hiddenTools,
    limit,
    truncated: hiddenTools.length > 0,
    selectionMode,
    selectedToolCount,
    discoveredToolCount: input.tools.length,
    stateForTool(toolName: string): McpToolState {
      const isConfiguredDisabled = configuredDisabled.has(toolName);
      const outsideAllowed = allowedSet ? !allowedSet.has(toolName) : false;
      const hiddenByLimit = hiddenNames.has(toolName);
      const enabled = exposedNames.has(toolName);
      const selectable = candidateByName.has(toolName);
      const configuredUnavailable = isConfiguredDisabled || outsideAllowed || !selectable;
      const blockedBySelectionLimit =
        !enabled && !configuredUnavailable && selectedToolCount >= limit;
      const blockedBySelectionMinimum = enabled && selectedToolCount <= 1;
      return {
        configuredDisabled: configuredUnavailable,
        runtimeDisabled: selectionMode === 'explicit' && !enabled && !configuredUnavailable,
        hiddenByLimit,
        blockedBySelectionLimit,
        blockedBySelectionMinimum,
        canToggle: !configuredUnavailable && !blockedBySelectionLimit && !blockedBySelectionMinimum,
        enabled,
      };
    },
  };
}

function selectedCandidateTools<T extends ProductMcpRuntimeTool>(input: {
  explicitSelectedTools: string[] | undefined;
  legacyOverrides: NormalizedMcpServer['toolOverrides'] | null | undefined;
  candidateUniverse: T[];
  candidateByName: Map<string, T>;
  limit: number;
}): T[] {
  if (input.explicitSelectedTools) {
    return uniqueToolNames(input.explicitSelectedTools)
      .map((toolName) => input.candidateByName.get(toolName))
      .filter((tool): tool is T => Boolean(tool));
  }

  const disabled = new Set(
    Object.entries(input.legacyOverrides ?? {})
      .filter(([, override]) => override.enabled === false)
      .map(([toolName]) => toolName),
  );
  const enabled = Object.entries(input.legacyOverrides ?? {})
    .filter(([, override]) => override.enabled === true)
    .map(([toolName]) => toolName);
  const selectedNames = input.candidateUniverse
    .slice(0, input.limit)
    .map((tool) => tool.name)
    .filter((toolName) => !disabled.has(toolName));
  for (const toolName of enabled) {
    if (selectedNames.length >= input.limit) break;
    if (!selectedNames.includes(toolName) && input.candidateByName.has(toolName)) {
      selectedNames.push(toolName);
    }
  }
  return selectedNames
    .map((toolName) => input.candidateByName.get(toolName))
    .filter((tool): tool is T => Boolean(tool));
}

function uniqueToolNames(toolNames: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const toolName of toolNames) {
    if (seen.has(toolName)) continue;
    seen.add(toolName);
    unique.push(toolName);
  }
  return unique;
}

export function mcpToolsTruncatedDiagnostic(exposure: McpToolExposure): McpDiagnostic | null {
  if (!exposure.truncated) return null;
  return {
    level: 'warning',
    code: 'mcp_tools_truncated',
    message: mcpToolsTruncatedMessage(exposure.limit, exposure.hiddenTools.length),
  };
}

export function mcpToolsTruncatedMessage(limit: number, hiddenCount: number): string {
  const hiddenWord = hiddenCount === 1 ? 'tool is' : 'tools are';
  return `Only the first ${limit} MCP tools are available for this server. ${hiddenCount} ${hiddenWord} hidden.`;
}

export function canonicalMcpToolName(serverNamespace: string, toolName: string): string {
  return `mcp__${normalizeMcpNamespace(serverNamespace)}__${normalizeMcpNamespace(toolName)}`;
}
