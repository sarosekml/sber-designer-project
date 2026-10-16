import type { ProviderEntryT, SberDesignerConfig } from '@sber-designer/llm-gateway';

import { CLAUDE_CODE_RUNTIME_PROVIDER } from './agent-runtimes/claude-runner';
import { CODEX_RUNTIME_PROVIDER } from './agent-runtimes/codex-runner';
import { GIGACODE_RUNTIME_PROVIDER } from './agent-runtimes/gigacode-runner';
import { KIMI_RUNTIME_PROVIDER } from './agent-runtimes/kimi-runner';
import { OPENCODE_RUNTIME_PROVIDER } from './agent-runtimes/opencode-runner';
import { getAgentRuntimeDef } from './agent-runtimes/registry';
import type { AgentRuntimeImageDeliveryMode } from './agent-runtimes/types';
import type { AgentRunMcpExpectedTarget } from './agent/run-record/types';

export type AgentModelKind = 'api' | 'cli';
export type AgentRuntimeKind = 'api' | 'codex' | 'opencode' | 'claude-code' | 'kimi' | 'gigacode';
export type AgentImageInputMode = 'inline' | 'cli-native' | 'cli-files-warning' | 'none';

export interface AgentModelTarget {
  kind: AgentModelKind;
  runtimeKind: AgentRuntimeKind;
  provider: string;
  model: string;
  label: string;
  imageInputMode: AgentImageInputMode;
  imageInputFailureDetail?: string;
  capabilities: {
    streaming: boolean;
    toolCalls: boolean;
    imageDeliveryMode: AgentRuntimeImageDeliveryMode | 'inline';
    rasterImageInput: boolean;
    svgSourceInput: boolean;
    nativeFileInput: boolean;
    ownMcpConfig: boolean;
    projectMcpTools: boolean;
    mcpExpectedTargets: AgentRunMcpExpectedTarget[];
  };
  diagnostics: AgentModelTargetDiagnostic[];
}

export interface AgentModelTargetDiagnostic {
  severity: 'warning' | 'error';
  code: string;
  detail: string;
}

export interface ResolveAgentModelTargetInput {
  config: Pick<SberDesignerConfig, 'agent' | 'provider' | 'mcpServers'>;
  active: { provider: string; model: string };
}

export function resolveAgentModelTarget(input: ResolveAgentModelTargetInput): AgentModelTarget {
  const { active } = input;
  const cliRuntime = cliRuntimeKindForProvider(active.provider);
  const mcpExpectedTargets = mcpExpectedTargetsFromConfig(input.config.mcpServers);
  if (cliRuntime) return resolveCliTarget(active, cliRuntime, mcpExpectedTargets);

  const provider = input.config.provider[active.provider];
  return resolveApiTarget(active, provider, mcpExpectedTargets);
}

export function isCliRuntimeProvider(provider: string): boolean {
  return cliRuntimeKindForProvider(provider) !== null;
}

export function cliRuntimeKindForProvider(
  provider: string,
): Exclude<AgentRuntimeKind, 'api'> | null {
  if (provider === CODEX_RUNTIME_PROVIDER) return 'codex';
  if (provider === OPENCODE_RUNTIME_PROVIDER) return 'opencode';
  if (provider === CLAUDE_CODE_RUNTIME_PROVIDER) return 'claude-code';
  if (provider === KIMI_RUNTIME_PROVIDER) return 'kimi';
  if (provider === GIGACODE_RUNTIME_PROVIDER) return 'gigacode';
  return null;
}

function resolveCliTarget(
  active: { provider: string; model: string },
  runtimeKind: Exclude<AgentRuntimeKind, 'api'>,
  mcpExpectedTargets: AgentRunMcpExpectedTarget[],
): AgentModelTarget {
  const runtimeLabel = labelForCliRuntime(runtimeKind);
  const runtimeDef = getAgentRuntimeDef(runtimeKind);
  const attachmentCapabilities = runtimeDef?.attachmentCapabilities ?? {
    imageInputMode: 'none' as const,
    imageDeliveryMode: 'none' as const,
    rasterImageInput: false,
    svgSourceInput: true,
    nativeFileInput: false,
  };
  const managedMcpTarget = managedRuntimeMcpExpectedTarget(runtimeDef);
  const expectedTargets = managedMcpTarget
    ? [...mcpExpectedTargets, managedMcpTarget]
    : mcpExpectedTargets;
  return {
    kind: 'cli',
    runtimeKind,
    provider: active.provider,
    model: active.model,
    label: cliRuntimeModelLabel(runtimeLabel, active.model),
    imageInputMode: attachmentCapabilities.imageInputMode,
    capabilities: {
      streaming: true,
      toolCalls: false,
      imageDeliveryMode: attachmentCapabilities.imageDeliveryMode,
      rasterImageInput: attachmentCapabilities.rasterImageInput,
      svgSourceInput: attachmentCapabilities.svgSourceInput,
      nativeFileInput: attachmentCapabilities.nativeFileInput,
      ownMcpConfig: true,
      projectMcpTools: Boolean(managedMcpTarget),
      mcpExpectedTargets: expectedTargets,
    },
    diagnostics: [],
  };
}

function managedRuntimeMcpExpectedTarget(
  runtimeDef: ReturnType<typeof getAgentRuntimeDef>,
): AgentRunMcpExpectedTarget | null {
  const injection = runtimeDef?.externalMcpInjection;
  if (!injection) return null;
  const server = injection.serverName ?? 'sber-designer';
  return {
    server,
    transport: 'stdio',
    configPath: runtimeMcpInjectionConfigPath(injection.mode, server),
  };
}

function runtimeMcpInjectionConfigPath(mode: string, serverName: string): string {
  if (mode === 'claude-mcp-json') return `.mcp.json#mcpServers.${serverName}`;
  if (mode === 'opencode-env-content') {
    return `OPENCODE_CONFIG_CONTENT#mcp.${serverName}`;
  }
  if (mode === 'codex-config-args') return `codex --config#mcp_servers.${serverName}`;
  return `runtime-mcp#mcpServers.${serverName}`;
}

function resolveApiTarget(
  active: { provider: string; model: string },
  provider: ProviderEntryT | undefined,
  mcpExpectedTargets: AgentRunMcpExpectedTarget[],
): AgentModelTarget {
  const diagnostics: AgentModelTargetDiagnostic[] = [];
  if (!provider) {
    diagnostics.push({
      severity: 'error',
      code: 'provider_not_found',
      detail: `Provider "${active.provider}" was not found in the LLM config.`,
    });
  }
  const model = provider?.models?.[active.model];
  if (provider && !model) {
    diagnostics.push({
      severity: 'warning',
      code: 'model_not_found',
      detail: `Model "${active.model}" is not listed under provider "${active.provider}".`,
    });
  }
  const unresolvedApiKey = unresolvedEnvPlaceholder(provider?.options?.apiKey);
  if (unresolvedApiKey) {
    diagnostics.push({
      severity: 'error',
      code: 'provider_env_unresolved',
      detail: `Provider "${active.provider}" needs env-var ${unresolvedApiKey} on the server before it can run.`,
    });
  }
  const modelLabel = model?.name ? `${model.name} (${active.model})` : active.model;
  const imageInputFailureDetail = modelImageInputFailureDetail(model?.imageInput);
  const vision = model?.vision === true && !imageInputFailureDetail;
  if (imageInputFailureDetail) {
    diagnostics.push({
      severity: 'warning',
      code: 'provider_image_transport_failed',
      detail: imageInputFailureDetail,
    });
  }
  return {
    kind: 'api',
    runtimeKind: 'api',
    provider: active.provider,
    model: active.model,
    label: modelLabel,
    imageInputMode: vision ? 'inline' : 'none',
    ...(imageInputFailureDetail ? { imageInputFailureDetail } : {}),
    capabilities: {
      streaming: true,
      toolCalls: true,
      imageDeliveryMode: vision ? 'inline' : 'none',
      rasterImageInput: vision,
      svgSourceInput: true,
      nativeFileInput: false,
      ownMcpConfig: false,
      projectMcpTools: true,
      mcpExpectedTargets,
    },
    diagnostics,
  };
}

function mcpExpectedTargetsFromConfig(
  mcpServers: SberDesignerConfig['mcpServers'],
): AgentRunMcpExpectedTarget[] {
  return Object.entries(mcpServers)
    .filter(([, server]) => server.enabled !== false)
    .map(([name, server]) => {
      const tools = server.allowedTools?.filter((tool) => tool.trim()).slice(0, 12) ?? [];
      return {
        server: name,
        transport: normalizeMcpTransport(server.type),
        ...(tools.length > 0 ? { tools } : {}),
        configPath: `sber-designer.json#mcpServers.${name}`,
      };
    });
}

function normalizeMcpTransport(type: string): string {
  if (type === 'streamableHttp') return 'streamable-http';
  return type;
}

function labelForCliRuntime(runtimeKind: Exclude<AgentRuntimeKind, 'api'>): string {
  if (runtimeKind === 'codex') return 'Codex CLI';
  if (runtimeKind === 'opencode') return 'OpenCode';
  if (runtimeKind === 'kimi') return 'Kimi Code CLI';
  if (runtimeKind === 'gigacode') return 'GigaCode CLI';
  return 'Claude Code';
}

function modelImageInputFailureDetail(
  imageInput: NonNullable<NonNullable<ProviderEntryT['models']>[string]['imageInput']> | undefined,
): string | null {
  if (!imageInput) return null;
  const transportBlocksNativeVision =
    imageInput.transport === 'text-only-with-ocr' || imageInput.transport === 'none';
  const verificationFailed = imageInput.verification?.startsWith('failed-') === true;
  if (!transportBlocksNativeVision && !verificationFailed) return null;
  const failure = imageInput.lastFailureMessage?.trim();
  return failure
    ? failure
    : 'The selected model has no verified native raster image transport in this provider adapter.';
}

/**
 * CLI runtime label (0081 Track A). The raw `default` sentinel is shown as a
 * first-class `Default (CLI config)` instead of an opaque `Codex CLI (default)`.
 */
function cliRuntimeModelLabel(runtimeLabel: string, model: string): string {
  const isDefault = !model || model.trim().toLowerCase() === 'default';
  return isDefault ? `${runtimeLabel} · Default (CLI config)` : `${runtimeLabel} · ${model.trim()}`;
}

function unresolvedEnvPlaceholder(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^\{env:[A-Z0-9_]+\}$/u.test(trimmed) ? trimmed : null;
}
