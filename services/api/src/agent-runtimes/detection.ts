import { buildRuntimeChildEnv } from './child-env';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';

import type {
  AgentRuntimeDef,
  AgentRuntimeAuthParser,
  AgentRuntimeMcpServer,
  AgentRuntimeModel,
  AgentRuntimeModelParser,
  AgentRuntimeStatus,
  ResolvedRuntimeCommand,
  RuntimeCommandResult,
} from './types';
import { resolveRuntimeLaunch } from './launch-resolution';
import { classifyRuntimeFailure } from './failure-taxonomy';
import { readGigaCodeState, type GigaCodeStateSnapshot } from './gigacode-state';

const execFileAsync = promisify(execFile);

export interface RuntimeDetectionHost {
  resolveCommand?: (def: AgentRuntimeDef) => Promise<ResolvedRuntimeCommand | null>;
  runCommand?: (
    command: string,
    args: string[],
    options?: { timeoutMs?: number; cwd?: string; env?: Record<string, string | undefined> },
  ) => Promise<RuntimeCommandResult>;
  readGigaCodeState?: () => Promise<GigaCodeStateSnapshot>;
}

export interface RuntimeDetectionContext {
  cwd?: string | null;
  probeCwd?: string | null;
}

export async function detectRuntime(
  def: AgentRuntimeDef,
  host: RuntimeDetectionHost = {},
  context: RuntimeDetectionContext = {},
): Promise<AgentRuntimeStatus> {
  const resolveCommand = host.resolveCommand ?? resolveRuntimeCommand;
  const runCommand = host.runCommand ?? runRuntimeCommand;
  const probeCwd = context.probeCwd ?? defaultRuntimeProbeCwd();
  const resolved = await resolveCommand(def);
  if (!resolved) return unavailableStatus(def, 'not_found', `${def.displayName} was not found.`);

  const diagnostics: AgentRuntimeStatus['diagnostics'] = [...(resolved.diagnostics ?? [])];
  let version: string | null = null;
  let help = '';
  let providers: string[] = [];
  let authStatus: AgentRuntimeStatus['auth']['status'] = 'unknown';
  let authMessage: string | undefined;
  let authAction: AgentRuntimeStatus['auth']['action'];
  let models: AgentRuntimeModel[] = def.fallbackModels ?? [];
  let selectedModel: string | undefined;
  let mcpServers: AgentRuntimeMcpServer[] = [];

  version = await detectRuntimeVersion(def, resolved.command, runCommand, probeCwd, diagnostics);

  if (def.helpArgs) {
    try {
      const result = await runCommand(resolved.command, def.helpArgs, {
        timeoutMs: 3000,
        cwd: probeCwd,
      });
      help = stripAnsi(result.stdout);
    } catch (err) {
      diagnostics.push({
        code: 'help_failed',
        message: safeErrorMessage(err),
        severity: 'warning',
      });
    }
  }

  if (def.authStatus) {
    try {
      const result = await runCommand(resolved.command, def.authStatus.args, {
        timeoutMs: def.authStatus.timeoutMs,
        cwd: probeCwd,
      });
      const parsed = parseAuthStatus(def.authStatus.parser, combineOutput(result));
      providers = parsed.providers;
      authStatus = parsed.status;
      authMessage = parsed.message;
      authAction = parsed.action;
    } catch (err) {
      const output = outputFromCommandError(err);
      if (output) {
        const parsed = parseAuthStatus(def.authStatus.parser, output);
        providers = parsed.providers;
        authStatus = parsed.status;
        authMessage = parsed.message;
        authAction = parsed.action;
      } else {
        authStatus = 'failed';
        diagnostics.push(classifyRuntimeFailure('auth', safeErrorMessage(err)));
      }
    }
  }

  if (def.kind === 'gigacode') {
    const legacyAuthReady = authStatus === 'ready';
    const state = await (host.readGigaCodeState ?? readGigaCodeState)();
    diagnostics.push(...state.diagnostics);
    if (state.auth === 'ready') {
      authStatus = 'ready';
      providers = ['gigacode'];
      authMessage = undefined;
      authAction = undefined;
      models = state.models;
      if (state.configuredModel && models.some((model) => model.id === state.configuredModel)) {
        selectedModel = state.configuredModel;
      } else if (state.configuredModel) {
        diagnostics.push({
          code: 'gigacode_model_unavailable',
          message:
            'The model selected in GigaCode settings is not present in the current catalogue.',
          severity: 'warning',
          phase: 'models',
          retryHint: 'check_config',
        });
      }
      if (models.length === 0) {
        diagnostics.push({
          code: 'gigacode_models_unavailable',
          message:
            'GigaCode did not expose any usable chat models. Refresh after GigaCode updates.',
          severity: 'error',
          phase: 'models',
          retryHint: 'check_config',
        });
      }
    } else if (state.auth === 'missing' && legacyAuthReady) {
      authStatus = 'ready';
      providers = ['gigacode'];
      authMessage =
        'Using legacy GigaCode authentication detection because local state is unavailable.';
      authAction = undefined;
    } else {
      authStatus = state.auth === 'invalid' ? 'failed' : 'none';
      providers = [];
      models = [];
      authMessage =
        state.auth === 'expired'
          ? 'GigaCode authentication has expired. Run `gigacode auth` and check again.'
          : 'Run `gigacode auth` and sign in before starting a run.';
      authAction = 'sign-in';
    }
  }

  if (def.listModels) {
    try {
      const result = await runCommand(resolved.command, def.listModels.args, {
        timeoutMs: def.listModels.timeoutMs,
        cwd: probeCwd,
      });
      const parsedModels = parseRuntimeModels(def.kind, result.stdout, def.listModels.parser);
      if (parsedModels.length > 0) models = parsedModels;
    } catch (err) {
      diagnostics.push(classifyRuntimeFailure('models', safeErrorMessage(err)));
    }
  }

  if (def.listMcp) {
    try {
      const result = await runCommand(resolved.command, def.listMcp.args, {
        timeoutMs: def.listMcp.timeoutMs,
        cwd: probeCwd,
      });
      mcpServers = parseMcpServers(def.kind, combineOutput(result));
    } catch (err) {
      diagnostics.push(classifyRuntimeFailure('mcp', safeErrorMessage(err)));
    }
  }

  const runJson =
    def.kind === 'opencode'
      ? help.includes('--format') || help.includes('format')
      : help.includes('--output-format') || help.includes('--json') || def.chatHandoff;
  const modelFlag = help.includes('--model') || models.length > 0;
  const sessionCapabilities = runtimeSessionCapabilities(def, help);
  if (def.kind === 'opencode' && help && !runJson) {
    diagnostics.push({
      code: 'capability_missing_format',
      message: 'OpenCode version too old: --format json was not found in help output.',
      severity: 'error',
    });
  }

  return {
    kind: def.kind,
    displayName: def.displayName,
    installed: true,
    connected: authStatus === 'ready',
    command: resolved.command,
    version,
    launch: {
      command: resolved.command,
      selectedBin: resolved.selectedBin,
      ...(resolved.launchPath ? { launchPath: resolved.launchPath } : {}),
      ...(resolved.source ? { source: resolved.source } : {}),
      probeCwd,
    },
    auth: {
      status: authStatus,
      providers,
      ...(authMessage ? { message: authMessage } : {}),
      ...(authAction ? { action: authAction } : {}),
    },
    models,
    ...(selectedModel ? { selectedModel } : {}),
    mcpServers,
    capabilities: {
      modelList: Boolean(def.listModels),
      mcpList: Boolean(def.listMcp),
      runJson,
      modelFlag,
      promptViaStdin: def.promptViaStdin,
      jsonEventStream: def.streamFormat === 'json-event-stream',
      cancel: true,
      usesOwnMcpConfig: true,
      supportsProjectMcpHandoff: true,
      chatHandoff: def.chatHandoff,
      ...sessionCapabilities,
      ...def.attachmentCapabilities,
    },
    diagnostics,
  };
}

async function detectRuntimeVersion(
  def: AgentRuntimeDef,
  command: string,
  runCommand: NonNullable<RuntimeDetectionHost['runCommand']>,
  probeCwd: string,
  diagnostics: AgentRuntimeStatus['diagnostics'],
): Promise<string | null> {
  const attempts = [def.versionArgs, ...(def.versionFallbackArgs ?? [])];
  let lastError: unknown = null;

  for (const args of attempts) {
    try {
      const result = await runCommand(command, args, {
        timeoutMs: def.versionProbeTimeoutMs ?? 3000,
        cwd: probeCwd,
      });
      const version = firstNonEmptyLine(stripAnsi(combineOutput(result)));
      if (version) return version;
      lastError = new Error(`No version output from ${args.join(' ')}`);
    } catch (err) {
      lastError = err;
    }
  }

  diagnostics.push({
    code: 'version_failed',
    message: safeErrorMessage(lastError),
    severity: 'warning',
  });
  return null;
}

export async function resolveRuntimeCommand(
  def: AgentRuntimeDef,
): Promise<ResolvedRuntimeCommand | null> {
  return await resolveRuntimeLaunch(def);
}

export function defaultRuntimeProbeCwd(): string {
  return tmpdir();
}

export async function runRuntimeCommand(
  command: string,
  args: string[],
  options: { timeoutMs?: number; cwd?: string; env?: Record<string, string | undefined> } = {},
): Promise<RuntimeCommandResult> {
  const result = await execFileAsync(command, args, {
    timeout: options.timeoutMs ?? 5000,
    maxBuffer: 8 * 1024 * 1024,
    cwd: options.cwd,
    env: buildRuntimeChildEnv(process.env, options.env),
  });
  return {
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  };
}

export function parseRuntimeModels(
  runtime: AgentRuntimeModel['runtime'],
  stdout: string,
  parser: AgentRuntimeModelParser = 'provider-model-lines',
): AgentRuntimeModel[] {
  if (parser === 'codex-debug-models') return parseCodexModels(stdout);
  const seen = new Set<string>();
  const models: AgentRuntimeModel[] = [];
  for (const rawLine of stdout.split(/\r?\n/)) {
    const id = sanitizeExternalModel(stripAnsi(rawLine));
    if (!id || seen.has(id)) continue;
    const slash = id.indexOf('/');
    if (slash <= 0 || slash >= id.length - 1) continue;
    seen.add(id);
    models.push({
      runtime,
      id,
      provider: id.slice(0, slash),
      model: id.slice(slash + 1),
      label: id,
    });
  }
  return models;
}

export function sanitizeExternalModel(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^[a-zA-Z0-9._:@/-]+$/.test(trimmed)) return null;
  if (!trimmed.includes('/')) return null;
  return trimmed;
}

function unavailableStatus(
  def: AgentRuntimeDef,
  code: string,
  message: string,
): AgentRuntimeStatus {
  return {
    kind: def.kind,
    displayName: def.displayName,
    installed: false,
    connected: false,
    command: null,
    version: null,
    auth: { status: 'unknown', providers: [] },
    models: [],
    mcpServers: [],
    capabilities: {
      modelList: Boolean(def.listModels),
      mcpList: Boolean(def.listMcp),
      runJson: false,
      modelFlag: false,
      promptViaStdin: def.promptViaStdin,
      jsonEventStream: def.streamFormat === 'json-event-stream',
      cancel: false,
      usesOwnMcpConfig: true,
      supportsProjectMcpHandoff: true,
      chatHandoff: def.chatHandoff,
      includePartialMessages: false,
      sessionSpecify: false,
      sessionResume: false,
      sessionCapture: false,
      ...def.attachmentCapabilities,
    },
    diagnostics: [{ code, message, severity: 'warning' }],
  };
}

function runtimeSessionCapabilities(
  def: AgentRuntimeDef,
  help: string,
): Pick<
  AgentRuntimeStatus['capabilities'],
  'includePartialMessages' | 'sessionSpecify' | 'sessionResume' | 'sessionCapture'
> {
  const flags = {
    includePartialMessages: helpCapabilityFlagPresent(
      help,
      def.helpCapabilityFlags?.includePartialMessages,
    ),
    sessionId: helpCapabilityFlagPresent(help, def.helpCapabilityFlags?.sessionId),
    sessionResume: helpCapabilityFlagPresent(help, def.helpCapabilityFlags?.sessionResume),
    execResume: helpCapabilityFlagPresent(help, def.helpCapabilityFlags?.execResume),
  };
  const canResume = Boolean(def.session && (flags.sessionResume || flags.execResume));
  return {
    includePartialMessages: flags.includePartialMessages,
    sessionSpecify: Boolean(def.session?.style === 'specify' && flags.sessionId && canResume),
    sessionResume: canResume,
    sessionCapture: Boolean(def.session?.style === 'capture' && canResume),
  };
}

function helpCapabilityFlagPresent(help: string, needles: string[] | undefined): boolean {
  const normalizedHelp = help.toLowerCase();
  return Boolean(
    normalizedHelp &&
    needles?.some((needle) => normalizedHelp.includes(needle.trim().toLowerCase())),
  );
}

function parseAuthStatus(
  parser: AgentRuntimeAuthParser,
  stdout: string,
): AgentRuntimeStatus['auth'] {
  const text = stripAnsi(stdout);
  if (parser === 'claude-auth-status') {
    try {
      const parsed = JSON.parse(text) as { loggedIn?: boolean; authMethod?: string };
      return {
        status: parsed.loggedIn ? 'ready' : 'none',
        providers: parsed.loggedIn ? ['anthropic'] : [],
        ...(parsed.authMethod ? { message: `authMethod=${parsed.authMethod}` } : {}),
      };
    } catch {
      return {
        status: /logged\s*in|authenticated/i.test(text) ? 'ready' : 'unknown',
        providers: /logged\s*in|authenticated/i.test(text) ? ['anthropic'] : [],
      };
    }
  }
  if (parser === 'codex-login-status') {
    const ready = /logged in|authenticated/i.test(text);
    return { status: ready ? 'ready' : 'none', providers: ready ? ['openai'] : [] };
  }
  if (parser === 'gigacode-auth-status') {
    if (/Authentication is managed by the GigaCode backend/i.test(text)) {
      return { status: 'unknown', providers: [] };
    }
    const ready = /Status:\s*Configured/i.test(text) && !/not\s+authenticated/i.test(text);
    return {
      status: ready ? 'ready' : 'none',
      providers: ready ? ['gigacode'] : [],
      ...(ready
        ? {}
        : {
            message: 'Run `gigacode auth` and sign in before starting a run.',
            action: 'sign-in' as const,
          }),
    };
  }
  if (parser === 'kimi-doctor') {
    const ready = /\bOK\s+config\.toml\b/i.test(text) && /config files are valid/i.test(text);
    return {
      status: ready ? 'ready' : 'none',
      providers: ready ? ['kimi'] : [],
      message: ready
        ? 'Kimi Code configuration is valid; credentials are verified by the CLI when a run starts.'
        : 'Run `kimi`, then use /login and select Kimi Platform or Kimi Code OAuth.',
    };
  }
  const providers = parseOpenCodeProviders(text);
  return { status: providers.length > 0 ? 'ready' : 'none', providers };
}

export function parseOpenCodeProviders(stdout: string): string[] {
  const providers = new Set<string>();
  const knownProviders = ['openrouter', 'anthropic', 'openai', 'google', 'groq', 'ollama'];
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^ERROR\b/i.test(line) || /credentials/i.test(line)) continue;
    for (const provider of knownProviders) {
      if (new RegExp(`\\b${provider}\\b`, 'i').test(line)) providers.add(provider);
    }
    const match = line.match(/[●│└\s]*([A-Za-z][A-Za-z0-9._-]+)\s+(?:api|oauth|token)\b/i);
    if (match?.[1]) providers.add(match[1].toLowerCase());
  }
  return [...providers];
}

export function parseMcpServers(
  runtime: AgentRuntimeMcpServer['runtime'],
  stdout: string,
): AgentRuntimeMcpServer[] {
  const servers: AgentRuntimeMcpServer[] = [];
  const seen = new Set<string>();
  for (const rawLine of stripAnsi(stdout).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (
      !line ||
      /^Name\s+/i.test(line) ||
      /^Checking\b/i.test(line) ||
      /^Configured MCP servers:?$/i.test(line) ||
      /^\[(error|warn|warning|info|debug)\]/i.test(line) ||
      /^Warning:/i.test(line)
    ) {
      continue;
    }
    const parsed = parseMcpLine(runtime, line);
    if (!parsed || seen.has(parsed.name)) continue;
    seen.add(parsed.name);
    servers.push(parsed);
  }
  return servers;
}

function parseMcpLine(
  runtime: AgentRuntimeMcpServer['runtime'],
  line: string,
): AgentRuntimeMcpServer | null {
  const opencodeTreeMatch = line.match(
    /^(?:[●○]\s+)?([✓✗])\s+([A-Za-z0-9._:-]+)\s+(enabled|disabled|connected|failed)\b(?:\s+(.*))?$/i,
  );
  if (opencodeTreeMatch?.[2]) {
    const detail = opencodeTreeMatch[4]?.trim() ?? '';
    return {
      runtime,
      name: opencodeTreeMatch[2],
      status: opencodeTreeMatch[1] === '✗' ? 'failed' : normalizeMcpStatus(opencodeTreeMatch[3]),
      transport: inferMcpTransport(detail),
      ...(detail ? { detail } : {}),
    };
  }

  // GigaCode: `✓ name: <command> (stdio) - Connected` — the status word trails the
  // dash instead of leading it, so neither the OpenCode nor the Claude shape fits.
  const gigacodeMatch = line.match(/^([✓✗●])\s+([A-Za-z0-9._:-]+):\s+(.+?)\s+-\s+(.+)$/);
  if (gigacodeMatch?.[2]) {
    const detail = gigacodeMatch[3]?.trim() ?? '';
    const statusText = gigacodeMatch[4]?.trim().toLowerCase();
    const status =
      gigacodeMatch[1] === '✗'
        ? 'failed'
        : gigacodeMatch[1] === '●' && /^(pending approval|disabled)$/.test(statusText ?? '')
          ? 'disabled'
          : normalizeMcpStatus(statusText);
    return {
      runtime,
      name: gigacodeMatch[2],
      status,
      transport: inferMcpTransport(detail),
      ...(detail ? { detail } : {}),
    };
  }

  const claudeMatch = line.match(/^([^:]+):\s+(.+?)\s+-\s+([✓✗])\s+(.+)$/);
  if (claudeMatch?.[1]) {
    const detail = claudeMatch[2]?.trim() ?? '';
    const ok = claudeMatch[3] === '✓';
    return {
      runtime,
      name: claudeMatch[1].trim(),
      status: ok ? 'connected' : 'failed',
      transport: inferMcpTransport(detail),
      detail,
    };
  }

  const fields = line
    .split(/\s{2,}/)
    .map((field) => field.trim())
    .filter(Boolean);
  if (fields.length < 2) return null;
  const name = fields[0];
  if (!name || !/^[A-Za-z0-9._:-]+$/.test(name)) return null;
  const statusText = line.match(/\b(enabled|disabled|connected|failed)\b/i)?.[1];
  const status = normalizeMcpStatus(statusText);
  const detail = fields.slice(1, Math.max(2, fields.length - 2)).join(' ');
  return {
    runtime,
    name,
    status,
    transport: inferMcpTransport(fields.slice(1).join(' ')),
    ...(detail ? { detail } : {}),
  };
}

function normalizeMcpStatus(value: string | undefined): AgentRuntimeMcpServer['status'] {
  const normalized = value?.toLowerCase();
  if (
    normalized === 'enabled' ||
    normalized === 'disabled' ||
    normalized === 'connected' ||
    normalized === 'failed'
  ) {
    return normalized;
  }
  return 'unknown';
}

function inferMcpTransport(detail: string): AgentRuntimeMcpServer['transport'] {
  if (/https?:\/\//i.test(detail)) return 'http';
  if (detail.trim()) return 'stdio';
  return 'unknown';
}

function parseCodexModels(stdout: string): AgentRuntimeModel[] {
  try {
    const parsed = JSON.parse(stdout) as {
      models?: {
        slug?: string;
        id?: string;
        name?: string;
        display_name?: string;
        visibility?: string;
      }[];
    };
    const seen = new Set<string>(['default']);
    const models: AgentRuntimeModel[] = (parsed.models ?? [])
      .filter((model) => model.visibility !== 'hidden')
      .map((model) => ({
        id: (model.slug ?? model.id ?? '').trim(),
        label: (model.display_name ?? model.name ?? model.slug ?? model.id ?? '').trim(),
      }))
      .filter((model) => {
        if (!model.id || seen.has(model.id)) return false;
        seen.add(model.id);
        return true;
      })
      .slice(0, 50)
      .map((model) => ({
        runtime: 'codex',
        id: model.id,
        provider: 'codex',
        model: model.id,
        label: `Codex CLI · ${model.label || model.id}`,
      }));
    return [
      {
        runtime: 'codex',
        id: 'default',
        provider: 'codex',
        model: 'default',
        label: 'Codex CLI · default',
      },
      ...models,
    ];
  } catch {
    return [];
  }
}

function firstNonEmptyLine(value: string): string | null {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? null
  );
}

function stripAnsi(value: string): string {
  const escape = String.fromCharCode(27);
  return value.replace(new RegExp(`${escape}\\[[0-?]*[ -/]*[@-~]`, 'g'), '');
}

function combineOutput(result: RuntimeCommandResult): string {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function outputFromCommandError(err: unknown): string | null {
  const value = err as { stdout?: unknown; stderr?: unknown };
  const output = `${String(value.stdout ?? '')}\n${String(value.stderr ?? '')}`.trim();
  return output || null;
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) return redact(stripAnsi(err.message));
  return redact(stripAnsi(String(err)));
}

function redact(message: string): string {
  return message.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]');
}
