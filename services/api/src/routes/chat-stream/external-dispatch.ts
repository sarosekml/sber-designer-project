import type { PromptAttachmentEvidence } from '@sber-designer/shared-types';

import { probeClaudeCodeInvocationAuth } from '../../agent-runtimes/claude-runner';
import { smokeCheckCodexRuntime } from '../../agent-runtimes/codex-runner';
import type { AgentRunInput } from '../../agent-runtimes/adapter';
import { getAgentAdapter } from '../../agent-runtimes/adapter';
import type { ExternalRuntimeKind } from '../../agent-runtimes/agent-kit-handoff';
import { defaultRuntimeProbeCwd, detectRuntime } from '../../agent-runtimes/detection';
import {
  validateRuntimePromptBudget,
  type RuntimePromptBudgetValidation,
} from '../../agent-runtimes/prompt-delivery';
import { AGENT_RUNTIME_DEFS, getAgentRuntimeDef } from '../../agent-runtimes/registry';
import { validateExternalMcpInjectionConfig } from '../../agent-runtimes/mcp-injection';
import type { AgentRuntimeRunSession, AgentRuntimeStatus } from '../../agent-runtimes/types';
import type {
  AgentRunMcpExpectedTarget,
  AgentRunRuntimeMcpToolHealth,
  AgentRunTargetCapabilities,
  CompleteAgentRunInput,
} from '../../agent/run-recorder';
import { codexImagePaths } from './evidence';

export type ExternalRuntimeSmokeCheck = 'codex';

export interface ExternalRuntimeDispatch {
  provider: string;
  runtime: ExternalRuntimeKind;
  contextRuntimeLabel: string;
  promptRuntimeLabel: string;
  streamRuntimeLabel: string;
  notConnectedDetail: string;
  smokeCheck?: ExternalRuntimeSmokeCheck;
}

export interface BuildExternalRuntimeAdapterRunInput {
  dispatch: ExternalRuntimeDispatch;
  command: string;
  model: string | null;
  cwd: string;
  prompt: string;
  projectId?: string | null;
  apiUrl?: string | null;
  runId?: string | null;
  runtimeSession?: AgentRuntimeRunSession | null;
  promptAttachments: PromptAttachmentEvidence[];
  signal?: AbortSignal;
  timeoutMs?: number;
  onRuntimeStdoutNoise?: (reason: string) => void;
  onRuntimeEvent?: (event: string, data: Record<string, unknown>) => void | Promise<void>;
}

export interface ExternalRuntimeImageDelivery {
  mode: 'none' | 'prompt_path' | 'cli_native_arg' | 'cli_native_file' | 'mcp_resource';
  imagePaths: string[];
}

export type ExternalRuntimeAuthPreflightResult =
  | {
      ok: true;
      detail: string;
      diagnostics?: CompleteAgentRunInput['diagnostics'];
    }
  | {
      ok: false;
      code: string;
      detail: string;
      diagnostics?: CompleteAgentRunInput['diagnostics'];
    };

export type ExternalRuntimeMcpConfigPreflightResult =
  | {
      ok: true;
      detail: string;
    }
  | {
      ok: false;
      code: 'runtime_config_invalid';
      detail: string;
      diagnostics: CompleteAgentRunInput['diagnostics'];
    };

const EXTERNAL_RUNTIME_DISPATCHERS: ExternalRuntimeDispatch[] = AGENT_RUNTIME_DEFS.flatMap(
  (def) => {
    const dispatch = def.externalDispatch;
    if (!dispatch) return [];
    const contextRuntimeLabel = dispatch.contextRuntimeLabel ?? def.displayName;
    return [
      {
        provider: dispatch.provider,
        runtime: def.kind,
        contextRuntimeLabel,
        promptRuntimeLabel: dispatch.promptRuntimeLabel ?? contextRuntimeLabel,
        streamRuntimeLabel: dispatch.streamRuntimeLabel ?? contextRuntimeLabel,
        notConnectedDetail:
          dispatch.notConnectedDetail ??
          `Connect ${contextRuntimeLabel} in Settings -> LLM providers before using this model.`,
        ...(dispatch.smokeCheck ? { smokeCheck: dispatch.smokeCheck } : {}),
      },
    ];
  },
);

export function externalRuntimeDispatchForProvider(
  provider: string,
): ExternalRuntimeDispatch | null {
  return EXTERNAL_RUNTIME_DISPATCHERS.find((dispatch) => dispatch.provider === provider) ?? null;
}

export function buildExternalRuntimeAdapterRunInput(
  input: BuildExternalRuntimeAdapterRunInput,
): AgentRunInput {
  const imageDelivery = resolveExternalRuntimeImageDelivery(
    input.dispatch,
    input.promptAttachments,
  );
  return {
    command: input.command,
    model: input.model,
    cwd: input.cwd,
    prompt: input.prompt,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.apiUrl ? { apiUrl: input.apiUrl } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.runtimeSession ? { runtimeSession: input.runtimeSession } : {}),
    ...(imageDelivery.imagePaths.length > 0 ? { imagePaths: imageDelivery.imagePaths } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
    ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
    ...(input.onRuntimeStdoutNoise ? { onRuntimeStdoutNoise: input.onRuntimeStdoutNoise } : {}),
    ...(input.onRuntimeEvent ? { onRuntimeEvent: input.onRuntimeEvent } : {}),
  };
}

export function resolveExternalRuntimeImageDelivery(
  dispatch: ExternalRuntimeDispatch,
  attachments: PromptAttachmentEvidence[],
): ExternalRuntimeImageDelivery {
  const adapter = getAgentAdapter(dispatch.runtime);
  const mode = adapter.capabilities.imageDeliveryMode;
  const imagePaths = codexImagePaths(attachments);
  if (imagePaths.length === 0 || mode === 'none') return { mode: 'none', imagePaths: [] };
  if (!adapter.capabilities.rasterImageInput && mode !== 'prompt_path') {
    return { mode: 'none', imagePaths: [] };
  }
  return { mode, imagePaths };
}

export function runExternalRuntimeAdapter(input: BuildExternalRuntimeAdapterRunInput) {
  return getAgentAdapter(input.dispatch.runtime).run(buildExternalRuntimeAdapterRunInput(input));
}

export function validateExternalRuntimePromptBudget(input: {
  dispatch: ExternalRuntimeDispatch;
  prompt: string;
}): RuntimePromptBudgetValidation {
  const def = getAgentRuntimeDef(input.dispatch.runtime);
  if (!def) {
    return {
      ok: true,
      bytes: Buffer.byteLength(input.prompt, 'utf8'),
      maxBytes: Number.MAX_SAFE_INTEGER,
      mode: 'stdin',
    };
  }
  return validateRuntimePromptBudget(def, input.prompt);
}

export async function runExternalRuntimeSmokeCheck(input: {
  dispatch: ExternalRuntimeDispatch;
  command: string;
  model: string | null;
  cwd: string;
  probeCwd?: string | null;
}) {
  if (input.dispatch.smokeCheck !== 'codex')
    return { ok: true as const, detail: 'No smoke check.' };
  return await smokeCheckCodexRuntime({
    command: input.command,
    model: input.model,
    cwd: input.cwd,
    processCwd: input.probeCwd ?? defaultRuntimeProbeCwd(),
  });
}

export async function runExternalRuntimeAuthPreflight(input: {
  dispatch: ExternalRuntimeDispatch;
  command: string;
  model?: string | null;
  cwd: string;
  probeCwd?: string | null;
  detectRuntimeImpl?: typeof detectRuntime;
  claudeInvocationProbeImpl?: typeof probeClaudeCodeInvocationAuth;
}): Promise<ExternalRuntimeAuthPreflightResult> {
  const def = getAgentRuntimeDef(input.dispatch.runtime);
  if (!def?.authStatus) return { ok: true, detail: 'No auth preflight configured.' };
  const detectRuntimeImpl = input.detectRuntimeImpl ?? detectRuntime;
  const probeCwd = input.probeCwd ?? defaultRuntimeProbeCwd();
  const status: AgentRuntimeStatus = await detectRuntimeImpl(
    def,
    {
      resolveCommand: async () => ({
        command: input.command,
        selectedBin: def.primaryBin,
      }),
    },
    { cwd: input.cwd, probeCwd },
  );
  if (status.auth.status === 'ready') {
    if (input.dispatch.runtime === 'claude-code') {
      const probe = input.claudeInvocationProbeImpl ?? probeClaudeCodeInvocationAuth;
      const probeResult = await probe({
        command: input.command,
        model: input.model ?? null,
        cwd: probeCwd,
        workspaceCwd: input.cwd,
      });
      return withRuntimeStatusDiagnostics(probeResult, status);
    }
    return { ok: true, detail: `${input.dispatch.contextRuntimeLabel} auth is ready.` };
  }
  const authDiagnostic = status.diagnostics.find(
    (diagnostic) =>
      diagnostic.code.startsWith('auth_') ||
      /auth|credential|token|401|unauthorized/iu.test(diagnostic.message),
  );
  return {
    ok: false,
    code: authDiagnostic?.code ?? 'auth_required',
    detail:
      authDiagnostic?.message ??
      `${input.dispatch.contextRuntimeLabel} auth is ${status.auth.status}; reconnect it in Settings before running this model.`,
    diagnostics: {
      runtimeLaunch: {
        runtime: input.dispatch.runtime,
        command: input.command,
        ...(status.launch?.launchPath ? { launchPath: status.launch.launchPath } : {}),
        ...(status.launch?.source ? { launchSource: status.launch.source } : {}),
        ...(status.launch?.selectedBin ? { selectedBin: status.launch.selectedBin } : {}),
        args: def.authStatus.args,
        cwd: probeCwd,
        workspaceCwd: input.cwd,
        probeCwd,
        model: input.model ?? null,
        version: status.version ?? null,
        authStatus: status.auth.status,
        env: launchEnvironmentDiagnostics(),
        probe: {
          kind: 'launch',
          ok: false,
          code: authDiagnostic?.code ?? 'auth_required',
          detail:
            authDiagnostic?.message ??
            `${input.dispatch.contextRuntimeLabel} auth is ${status.auth.status}; reconnect it in Settings before running this model.`,
        },
      },
    },
  };
}

export function runExternalRuntimeMcpConfigPreflight(input: {
  dispatch: ExternalRuntimeDispatch;
  env?: Record<string, string | undefined>;
}): ExternalRuntimeMcpConfigPreflightResult {
  const def = getAgentRuntimeDef(input.dispatch.runtime);
  if (!def?.externalMcpInjection) {
    return { ok: true, detail: 'No runtime MCP injection configured.' };
  }
  const preflight = validateExternalMcpInjectionConfig({
    def,
    env: input.env ?? process.env,
  });
  if (preflight.ok) {
    return { ok: true, detail: 'Runtime MCP injection config is valid.' };
  }
  const server = def.externalMcpInjection.serverName ?? 'sber-designer';
  const detail = preflight.detail ?? 'runtime_config_invalid: Runtime MCP config is invalid.';
  return {
    ok: false,
    code: 'runtime_config_invalid',
    detail,
    diagnostics: {
      runtimeMcp: {
        runtime: input.dispatch.runtime,
        status: 'config_invalid',
        source: 'runtime-event',
        event: 'runtime.mcp_injection',
        mcpServer: server,
        mcpTool: null,
        expectedTargets: [
          {
            server,
            transport: 'stdio',
            configPath: runtimeMcpInjectionConfigPath(def.externalMcpInjection.mode, server),
          },
        ],
        detail,
      },
    },
  };
}

export function withRuntimeStatusDiagnostics<T extends ExternalRuntimeAuthPreflightResult>(
  result: T,
  status: AgentRuntimeStatus,
): T {
  const runtimeLaunch = result.diagnostics?.runtimeLaunch;
  if (!runtimeLaunch) return result;
  return {
    ...result,
    diagnostics: {
      ...result.diagnostics,
      runtimeLaunch: {
        ...runtimeLaunch,
        ...(status.launch?.launchPath ? { launchPath: status.launch.launchPath } : {}),
        ...(status.launch?.source ? { launchSource: status.launch.source } : {}),
        ...(status.launch?.selectedBin ? { selectedBin: status.launch.selectedBin } : {}),
        probeCwd: status.launch?.probeCwd ?? runtimeLaunch.probeCwd,
        version: status.version ?? runtimeLaunch.version,
        authStatus: status.auth.status,
      },
    },
  };
}

export function classifyRuntimeMcpToolHealthFromEvent(input: {
  runtime: ExternalRuntimeKind | string;
  event: string;
  data: Record<string, unknown>;
  targetCapabilities?: AgentRunTargetCapabilities;
}): AgentRunRuntimeMcpToolHealth | null {
  if (input.event === 'runtime.mcp_injection') {
    return classifyRuntimeMcpInjectionHealth(input);
  }
  const text = runtimeEventText(input.data);
  const expectedTargets = input.targetCapabilities?.mcpExpectedTargets ?? [];
  if (input.event === 'runtime.mcp_tool_result' && input.data.success === true) {
    const target = runtimeMcpTarget(input.data, text);
    const expectedTarget = expectedTargets.find(
      (item) => cleanMcpTargetPart(item.server) === cleanMcpTargetPart(target.mcpServer),
    );
    if (expectedTarget) {
      return {
        runtime: input.runtime,
        status: 'forwarded_verified',
        source: 'runtime-event',
        event: input.event,
        mcpServer: target.mcpServer ?? expectedTarget.server,
        mcpTool: target.mcpTool ?? null,
        expectedTargets: [expectedTarget],
        detail: `Project MCP forwarding was verified by a successful ${runtimeMcpTargetLabel(target) ?? expectedTarget.server} tool result.`,
      };
    }
  }
  if (/Auth\(AuthorizationRequired\)|authorization required|authentication required/iu.test(text)) {
    const target = runtimeMcpTarget(input.data, `${input.event}\n${text}`);
    const targetLabel = runtimeMcpTargetLabel(target);
    const expectedFallback = targetLabel ? null : firstExpectedMcpTarget(expectedTargets);
    const effectiveTarget = targetLabel
      ? target
      : { mcpServer: expectedFallback?.server ?? null, mcpTool: null };
    const effectiveTargetLabel = targetLabel ?? expectedFallback?.server ?? null;
    return {
      runtime: input.runtime,
      status: 'auth_failed',
      source: 'stderr',
      event: input.event,
      mcpServer: effectiveTarget.mcpServer ?? null,
      mcpTool: effectiveTarget.mcpTool ?? null,
      ...(expectedTargets.length > 0 ? { expectedTargets } : {}),
      detail: targetLabel
        ? `Project MCP authentication failed for ${targetLabel}.`
        : effectiveTargetLabel
          ? `Project MCP authentication failed for expected target ${effectiveTargetLabel}; runtime stderr did not name a server or tool.`
          : 'Project MCP authentication failed; runtime stderr did not name a server or tool.',
    };
  }
  if (!/\bmcp\b|\btool\b/iu.test(`${input.event}\n${text}`)) return null;
  if (input.targetCapabilities?.projectMcpTools) {
    return {
      runtime: input.runtime,
      status: 'forwarded',
      source: 'capabilities',
      ...(input.targetCapabilities.mcpExpectedTargets?.length
        ? { expectedTargets: input.targetCapabilities.mcpExpectedTargets }
        : {}),
      detail: 'Project MCP/tool access is available to this runtime.',
    };
  }
  if (input.targetCapabilities?.ownMcpConfig) {
    return {
      runtime: input.runtime,
      status: 'own_config',
      source: 'capabilities',
      ...(input.targetCapabilities.mcpExpectedTargets?.length
        ? { expectedTargets: input.targetCapabilities.mcpExpectedTargets }
        : {}),
      detail: 'Runtime uses its own MCP/tool configuration; project tools may not be forwarded.',
    };
  }
  return {
    runtime: input.runtime,
    status: 'not_supported',
    source: 'capabilities',
    ...(expectedTargets.length ? { expectedTargets } : {}),
    detail: 'Project MCP/tool forwarding is not supported for this runtime target.',
  };
}

function classifyRuntimeMcpInjectionHealth(input: {
  runtime: ExternalRuntimeKind | string;
  event: string;
  data: Record<string, unknown>;
}): AgentRunRuntimeMcpToolHealth | null {
  const status = stringField(input.data, 'status');
  const mode = stringField(input.data, 'mode');
  const serverName = cleanMcpTargetPart(stringField(input.data, 'serverName'));
  const detail = stringField(input.data, 'detail');
  if (status === 'forwarded_verified' || status === 'forwarded_unverified') {
    return {
      runtime: input.runtime,
      status,
      source: 'runtime-event',
      event: input.event,
      mcpServer: serverName,
      mcpTool: null,
      ...(serverName
        ? {
            expectedTargets: [
              {
                server: serverName,
                transport: 'stdio',
                configPath: runtimeMcpInjectionConfigPath(mode, serverName),
              },
            ],
          }
        : {}),
      detail:
        detail ??
        (status === 'forwarded_verified'
          ? 'Project MCP forwarding was verified by the runtime MCP list probe.'
          : 'Project MCP forwarding could not be verified by the runtime MCP list probe.'),
    };
  }
  if (status === 'applied') {
    return {
      runtime: input.runtime,
      status: 'forwarded_unverified',
      source: 'runtime-event',
      event: input.event,
      mcpServer: serverName,
      mcpTool: null,
      ...(serverName
        ? {
            expectedTargets: [
              {
                server: serverName,
                transport: 'stdio',
                configPath: runtimeMcpInjectionConfigPath(mode, serverName),
              },
            ],
          }
        : {}),
      detail:
        detail ??
        'Project MCP configuration was injected for this runtime; verification has not run yet.',
    };
  }
  if (status === 'failed') {
    const isConfigInvalid =
      /\bruntime_config_invalid\b|\bconfig(?:uration)? is invalid\b|\bunsupported legacy key\b|\bmcpServers\b/iu.test(
        detail ?? '',
      );
    return {
      runtime: input.runtime,
      status: isConfigInvalid ? 'config_invalid' : 'unavailable',
      source: 'runtime-event',
      event: input.event,
      mcpServer: serverName,
      mcpTool: null,
      detail: detail ?? 'Project MCP configuration injection failed.',
    };
  }
  return null;
}

export function initialRuntimeMcpToolHealth(input: {
  runtime: ExternalRuntimeKind | string;
  targetCapabilities: AgentRunTargetCapabilities;
}): AgentRunRuntimeMcpToolHealth {
  if (input.targetCapabilities.projectMcpTools) {
    return {
      runtime: input.runtime,
      status: 'forwarded',
      source: 'capabilities',
      ...(input.targetCapabilities.mcpExpectedTargets?.length
        ? { expectedTargets: input.targetCapabilities.mcpExpectedTargets }
        : {}),
      detail: 'Project MCP/tool access is available to this runtime.',
    };
  }
  if (input.targetCapabilities.ownMcpConfig) {
    return {
      runtime: input.runtime,
      status: 'own_config',
      source: 'capabilities',
      ...(input.targetCapabilities.mcpExpectedTargets?.length
        ? { expectedTargets: input.targetCapabilities.mcpExpectedTargets }
        : {}),
      detail: 'Runtime uses its own MCP/tool configuration; project tools may not be forwarded.',
    };
  }
  return {
    runtime: input.runtime,
    status: 'not_supported',
    source: 'capabilities',
    ...(input.targetCapabilities.mcpExpectedTargets?.length
      ? { expectedTargets: input.targetCapabilities.mcpExpectedTargets }
      : {}),
    detail: 'Project MCP/tool forwarding is not supported for this runtime target.',
  };
}

export function mergeRuntimeMcpToolHealth(
  current: AgentRunRuntimeMcpToolHealth | undefined,
  next: AgentRunRuntimeMcpToolHealth,
): AgentRunRuntimeMcpToolHealth {
  const anonymousAuthFailure =
    next.status === 'auth_failed' && /did not name a server or tool/iu.test(next.detail);
  if (current?.status === 'forwarded_verified' && anonymousAuthFailure) return current;
  return next;
}

export function formatRuntimeMcpHealthNotice(input: {
  health: AgentRunRuntimeMcpToolHealth | undefined;
  runManifestPath?: string | null | undefined;
}): string | null {
  const health = input.health;
  if (!health || (health.status !== 'auth_failed' && health.status !== 'config_invalid')) {
    return null;
  }
  const target =
    runtimeMcpTargetLabel({ mcpServer: health.mcpServer, mcpTool: health.mcpTool }) ??
    firstExpectedMcpTarget(health.expectedTargets)?.server ??
    'unknown (the CLI stderr did not include a server or tool name)';
  const expectedTargets = formatExpectedMcpTargets(health.expectedTargets);
  const details = runtimeMcpDetailsHint(input.runManifestPath);
  if (health.status === 'config_invalid') {
    return [
      '',
      '',
      'sber-designer: Project MCP configuration is invalid.',
      `Runtime: ${health.runtime || 'external runtime'}.`,
      `MCP target: ${target}.`,
      expectedTargets ? `Expected targets: ${expectedTargets}.` : '',
      health.detail,
      details,
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    '',
    '',
    'sber-designer: Project MCP tools were unavailable.',
    `Runtime: ${health.runtime || 'external runtime'}.`,
    `MCP target: ${target}.`,
    expectedTargets ? `Expected targets: ${expectedTargets}.` : '',
    'The run continued without those tools, so component reuse may be less accurate.',
    details,
  ]
    .filter(Boolean)
    .join('\n');
}

function runtimeEventText(data: Record<string, unknown>): string {
  const values: string[] = [];
  for (const value of Object.values(data)) {
    if (typeof value === 'string') values.push(value);
  }
  return values.join('\n');
}

function stringField(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function runtimeMcpInjectionConfigPath(mode: string | null, serverName: string): string {
  if (mode === 'claude-mcp-json') return `.mcp.json#mcpServers.${serverName}`;
  if (mode === 'opencode-env-content') {
    return `OPENCODE_CONFIG_CONTENT#mcp.${serverName}`;
  }
  if (mode === 'codex-config-args') return `codex --config#mcp_servers.${serverName}`;
  return `runtime-mcp#mcpServers.${serverName}`;
}

function runtimeMcpTarget(
  data: Record<string, unknown>,
  text: string,
): { mcpServer?: string | null; mcpTool?: string | null } {
  const mcpServer =
    findNamedStringValue(data, [
      'mcpserver',
      'mcpserverkey',
      'server',
      'serverkey',
      'servername',
    ]) ??
    textMatch(text, [
      /\b(?:mcp[-_\s]*)?server(?:key|name)?\s*[:=]\s*["'`]?([a-z0-9_.:@/-]+)/iu,
      /\b(?:mcp[-_\s]*)?server\s+["'`]([^"'`]+)["'`]/iu,
      /\bfor\s+(project\s+mcp)\b/iu,
    ]);
  const mcpTool =
    findNamedStringValue(data, ['mcptool', 'mcptoolname', 'tool', 'toolname']) ??
    textMatch(text, [
      /\b(?:mcp[-_\s]*)?tool(?:name)?\s*[:=]\s*["'`]?([a-z0-9_.:@/-]+)/iu,
      /\b(?:mcp[-_\s]*)?tool\s+["'`]([^"'`]+)["'`]/iu,
    ]);
  return {
    mcpServer: cleanMcpTargetPart(mcpServer),
    mcpTool: cleanMcpTargetPart(mcpTool),
  };
}

function runtimeMcpTargetLabel(input: {
  mcpServer?: string | null | undefined;
  mcpTool?: string | null | undefined;
}): string | null {
  const server = cleanMcpTargetPart(input.mcpServer);
  const tool = cleanMcpTargetPart(input.mcpTool);
  if (server && tool) return `${server}.${tool}`;
  return server ?? tool ?? null;
}

function firstExpectedMcpTarget(
  targets: AgentRunMcpExpectedTarget[] | undefined,
): AgentRunMcpExpectedTarget | null {
  return targets?.find((target) => Boolean(cleanMcpTargetPart(target.server))) ?? null;
}

function formatExpectedMcpTargets(targets: AgentRunMcpExpectedTarget[] | undefined): string | null {
  const formatted =
    targets
      ?.map((target) => formatExpectedMcpTarget(target))
      .filter((value): value is string => Boolean(value))
      .slice(0, 5) ?? [];
  if (formatted.length === 0) return null;
  const suffix =
    targets && targets.length > formatted.length
      ? `, and ${targets.length - formatted.length} more`
      : '';
  return `${formatted.join(', ')}${suffix}`;
}

function formatExpectedMcpTarget(target: AgentRunMcpExpectedTarget): string | null {
  const server = cleanMcpTargetPart(target.server);
  if (!server) return null;
  const details = [
    target.transport ? cleanMcpTargetPart(target.transport) : null,
    target.tools?.length ? `tools: ${target.tools.slice(0, 4).join(', ')}` : null,
    target.configPath ? `config: ${target.configPath}` : null,
  ].filter((value): value is string => Boolean(value));
  return details.length > 0 ? `${server} (${details.join('; ')})` : server;
}

function runtimeMcpDetailsHint(runManifestPath?: string | null): string {
  if (!runManifestPath) {
    return 'Details: open the run manifest diagnostics.runtimeMcp and external-runtime/events.jsonl.';
  }
  const runRoot = runManifestPath.replace(/[\\/]run-manifest\.json$/u, '');
  const eventsPath = `${runRoot}/external-runtime/events.jsonl`;
  return `Details: open ${runManifestPath} diagnostics.runtimeMcp and ${eventsPath}.`;
}

function findNamedStringValue(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== 'object') return null;
  const wanted = new Set(keys);
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]+/giu, '').toLowerCase();
    if (wanted.has(normalizedKey) && typeof child === 'string') return child;
    const nested = findNamedStringValue(child, keys);
    if (nested) return nested;
  }
  return null;
}

function textMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1];
  }
  return null;
}

function cleanMcpTargetPart(value: string | null | undefined): string | null {
  const cleaned = value?.trim().replace(/[",.;:)]+$/u, '');
  return cleaned || null;
}

function launchEnvironmentDiagnostics() {
  const authOverrideNames = [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
    'OPENAI_API_KEY',
    'CODEX_HOME',
  ].filter((name) => Boolean(process.env[name]));
  return {
    home: process.env.HOME || null,
    pathEntries: (process.env.PATH ?? '').split(':').filter(Boolean).length,
    authOverrideNames,
  };
}
