import { buildRuntimeChildEnv } from './child-env';
import { assertExternalRuntimePolicy } from '../mcp/security';
import type { AgentStreamEvent } from '../agent/stream';
import { buildClaudeCodeRunArgs, runClaudeCodeHandoff } from './claude-runner';
import { buildCodexRunArgs, runCodexHandoff } from './codex-runner';
import { buildGigaCodeRunArgs, runGigaCodeHandoff } from './gigacode-runner';
import { buildKimiRunArgs, runKimiHandoff } from './kimi-runner';
import {
  prepareExternalMcpInjection,
  verifyExternalMcpInjection,
  type AppliedExternalMcpInjection,
  type ExternalMcpInjectionVerification,
  type ExternalMcpInjectionResult,
} from './mcp-injection';
import { buildOpenCodeRunArgs, runOpenCodeHandoff } from './opencode-runner';
import { assertRuntimePromptBudget, resolveRuntimePromptDelivery } from './prompt-delivery';
import { AGENT_RUNTIME_DEFS, getAgentRuntimeDef } from './registry';
import type {
  AgentRuntimeDef,
  AgentRuntimeKind,
  AgentRuntimeRunSession,
  RuntimeDiagnostic,
} from './types';

export type AgentPromptDeliveryMode = 'stdin' | 'file' | 'argv';

export interface AgentCapabilities {
  promptDelivery: AgentPromptDeliveryMode;
  streamFormat: AgentRuntimeDef['streamFormat'];
  eventParser: AgentRuntimeDef['eventParser'];
  chatHandoff: boolean;
  modelList: boolean;
  mcpList: boolean;
  imageDeliveryMode: AgentRuntimeDef['attachmentCapabilities']['imageDeliveryMode'];
  rasterImageInput: boolean;
  svgSourceInput: boolean;
  nativeFileInput: boolean;
}

export interface AgentRunInput {
  command: string;
  model: string | null;
  cwd: string;
  prompt: string;
  runtimeSession?: AgentRuntimeRunSession | null;
  imagePaths?: string[];
  projectId?: string | null;
  apiUrl?: string | null;
  runId?: string | null;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  onRuntimeStdoutNoise?: (reason: string) => void;
  onRuntimeEvent?: (event: string, data: Record<string, unknown>) => void | Promise<void>;
  runtimeConfigArgs?: string[];
}

export interface AgentBuildArgsInput {
  model: string | null;
  cwd: string;
  imagePaths?: string[];
}

export interface AgentAdapter {
  kind: AgentRuntimeKind;
  displayName: string;
  def: AgentRuntimeDef;
  capabilities: AgentCapabilities;
  diagnostics: RuntimeDiagnostic[];
  buildArgs(input: AgentBuildArgsInput): string[];
  run(input: AgentRunInput): AsyncGenerator<AgentStreamEvent>;
}

export function listAgentAdapters(): AgentAdapter[] {
  return AGENT_RUNTIME_DEFS.map(createAgentAdapter);
}

export function getAgentAdapter(kind: AgentRuntimeKind): AgentAdapter {
  const def = getAgentRuntimeDef(kind);
  if (!def) throw new Error(`Unknown agent runtime adapter: ${kind}`);
  return createAgentAdapter(def);
}

function createAgentAdapter(def: AgentRuntimeDef): AgentAdapter {
  return {
    kind: def.kind,
    displayName: def.displayName,
    def,
    capabilities: capabilitiesFromDef(def),
    diagnostics: [],
    buildArgs: (input) => buildRunArgs(def.kind, input),
    run: (input) => runRuntime(def, input),
  };
}

function capabilitiesFromDef(def: AgentRuntimeDef): AgentCapabilities {
  const promptDelivery = resolveRuntimePromptDelivery(def);
  return {
    promptDelivery: promptDelivery.mode,
    streamFormat: def.streamFormat,
    eventParser: def.eventParser,
    chatHandoff: def.chatHandoff,
    modelList: Boolean(def.listModels),
    mcpList: Boolean(def.listMcp),
    ...def.attachmentCapabilities,
  };
}

function buildRunArgs(kind: AgentRuntimeKind, input: AgentBuildArgsInput): string[] {
  switch (kind) {
    case 'claude-code':
      return buildClaudeCodeRunArgs(input.model, input.imagePaths ?? []);
    case 'codex':
      return buildCodexRunArgs(input.model, input.cwd, input.imagePaths ?? []);
    case 'opencode':
      return buildOpenCodeRunArgs(input.model, input.cwd);
    case 'kimi':
      return buildKimiRunArgs(input.model);
    case 'gigacode':
      return buildGigaCodeRunArgs(input.model);
  }
}

async function* runRuntime(
  def: AgentRuntimeDef,
  input: AgentRunInput,
): AsyncGenerator<AgentStreamEvent> {
  assertExternalRuntimePolicy();
  assertRuntimePromptBudget(def, input.prompt);
  const injection = await prepareExternalMcpInjection({
    def,
    cwd: input.cwd,
    env: { ...buildRuntimeChildEnv(process.env), ...(input.env ?? {}) },
    projectId: input.projectId ?? null,
    apiUrl: input.apiUrl ?? process.env.SBER_DESIGNER_API_URL ?? null,
    runId: input.runId ?? null,
  });
  // A probe is diagnostic work. Skip it when the caller has no runtime-event
  // consumer; otherwise a standalone adapter run pays the CLI list timeout
  // without being able to persist or display the result.
  if (def.externalMcpInjection && input.onRuntimeEvent) {
    const verification = await verifyExternalMcpInjection({
      def,
      command: input.command,
      cwd: input.cwd,
      injection,
      env: externalMcpVerificationEnv(input.env, injection.env),
    });
    await input.onRuntimeEvent?.(
      'runtime.mcp_injection',
      runtimeMcpInjectionEvent(injection, verification),
    );
  }
  try {
    yield* runRuntimeProcess(def.kind, {
      ...input,
      env: { ...(input.env ?? {}), ...injection.env },
      runtimeConfigArgs: injection.args,
    });
  } finally {
    await injection.cleanup();
  }
}

export function externalMcpVerificationEnv(
  inputEnv: Record<string, string | undefined> | null | undefined,
  injectionEnv: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return { ...buildRuntimeChildEnv(process.env), ...(inputEnv ?? {}), ...injectionEnv };
}

function runRuntimeProcess(
  kind: AgentRuntimeKind,
  input: AgentRunInput,
): AsyncGenerator<AgentStreamEvent> {
  switch (kind) {
    case 'claude-code':
      return runClaudeCodeHandoff({
        command: input.command,
        model: input.model,
        cwd: input.cwd,
        prompt: input.prompt,
        ...(input.runtimeConfigArgs ? { runtimeConfigArgs: input.runtimeConfigArgs } : {}),
        ...(input.runtimeSession ? { runtimeSession: input.runtimeSession } : {}),
        ...(input.imagePaths ? { imagePaths: input.imagePaths } : {}),
        ...(input.env ? { env: input.env } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
        ...(input.onRuntimeStdoutNoise ? { onRuntimeStdoutNoise: input.onRuntimeStdoutNoise } : {}),
        ...(input.onRuntimeEvent ? { onRuntimeEvent: input.onRuntimeEvent } : {}),
      });
    case 'codex':
      return runCodexHandoff({
        command: input.command,
        model: input.model,
        cwd: input.cwd,
        prompt: input.prompt,
        ...(input.runtimeSession ? { runtimeSession: input.runtimeSession } : {}),
        ...(input.imagePaths ? { imagePaths: input.imagePaths } : {}),
        ...(input.env ? { env: input.env } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
        ...(input.onRuntimeStdoutNoise ? { onRuntimeStdoutNoise: input.onRuntimeStdoutNoise } : {}),
        ...(input.onRuntimeEvent ? { onRuntimeEvent: input.onRuntimeEvent } : {}),
        ...(input.runtimeConfigArgs ? { configArgs: input.runtimeConfigArgs } : {}),
      });
    case 'opencode':
      return runOpenCodeHandoff({
        command: input.command,
        model: input.model,
        cwd: input.cwd,
        prompt: input.prompt,
        ...(input.env ? { env: input.env } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
        ...(input.onRuntimeStdoutNoise ? { onRuntimeStdoutNoise: input.onRuntimeStdoutNoise } : {}),
      });
    case 'kimi':
      return runKimiHandoff({
        command: input.command,
        model: input.model,
        cwd: input.cwd,
        prompt: input.prompt,
        ...(input.runtimeSession ? { runtimeSession: input.runtimeSession } : {}),
        ...(input.env ? { env: input.env } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
        ...(input.onRuntimeStdoutNoise ? { onRuntimeStdoutNoise: input.onRuntimeStdoutNoise } : {}),
        ...(input.onRuntimeEvent ? { onRuntimeEvent: input.onRuntimeEvent } : {}),
      });
    case 'gigacode':
      return runGigaCodeHandoff({
        command: input.command,
        model: input.model,
        cwd: input.cwd,
        prompt: input.prompt,
        ...(input.runtimeSession ? { runtimeSession: input.runtimeSession } : {}),
        ...(input.env ? { env: input.env } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
        ...(input.onRuntimeStdoutNoise ? { onRuntimeStdoutNoise: input.onRuntimeStdoutNoise } : {}),
        ...(input.onRuntimeEvent ? { onRuntimeEvent: input.onRuntimeEvent } : {}),
      });
  }
}

function runtimeMcpInjectionEvent(
  injection: ExternalMcpInjectionResult,
  verification: ExternalMcpInjectionVerification | null,
): Record<string, unknown> {
  return {
    status: verification?.status ?? injection.status,
    mode: injection.mode,
    detail: verification?.detail ?? injection.detail,
    ...('serverName' in injection
      ? { serverName: (injection as AppliedExternalMcpInjection).serverName }
      : {}),
  };
}
