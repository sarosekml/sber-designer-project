/**
 * Loading and resolving sber-designer.json.
 *
 * Precedence (highest first):
 *   1. workspace overrides (`~/.config/sber-designer/config.json`) — only
 *      `agent.default` is honored from here, never provider definitions.
 *   2. project config (`<repo>/sber-designer.json`).
 *   3. built-in defaults (mock provider, agent.default = mock/echo).
 *
 * env-substitution: any string of the shape `{env:VAR_NAME}` in `apiKey`,
 * `headers.*`, `mcpServers.*.env.*` is resolved at load time using the
 * provided env map (defaults to `process.env` when running in Node).
 */
import { SberDesignerConfigSchema, type SberDesignerConfig } from './schema';

const ENV_REF_RE = /^\{env:([A-Z0-9_]+)\}$/;

export interface LoadOptions {
  /** Override env source (mostly for tests). */
  env?: Record<string, string | undefined>;
  /** When true, missing env-vars throw; when false, leave the placeholder. */
  strictEnv?: boolean;
}

export interface PromptAttachmentLimits {
  textMaxBytes: number;
  imageMaxBytes: number;
  svgMaxBytes: number;
}

export interface AgentConcurrencyLimits {
  maxTotalRuns: number;
  maxApiRuns: number;
  maxCliRuns: number;
  sameScreenPolicy: 'reject' | 'queue';
  sameFilePolicy: 'reject' | 'queue';
}

export interface AgentContextBudgetPolicy {
  warningTokens: number;
  degradePromptBytes?: number;
  blockPromptBytes?: number;
}

export type AgentDirectionPickerMode = 'off' | 'screens' | 'always';

export const DEFAULT_PROMPT_ATTACHMENT_LIMITS: PromptAttachmentLimits = {
  textMaxBytes: 256 * 1024,
  imageMaxBytes: 5 * 1024 * 1024,
  svgMaxBytes: 5 * 1024 * 1024,
};

export const DEFAULT_AGENT_CONCURRENCY_LIMITS: AgentConcurrencyLimits = {
  maxTotalRuns: 10,
  maxApiRuns: 4,
  maxCliRuns: 10,
  sameScreenPolicy: 'reject',
  sameFilePolicy: 'reject',
};

export const DEFAULT_AGENT_CONTEXT_BUDGET: AgentContextBudgetPolicy = {
  warningTokens: 200_000,
};

/** Built-in fallback so the editor boots even with no config at all. */
export const BUILTIN_DEFAULTS: SberDesignerConfig = {
  agent: { default: { provider: 'mock', model: 'echo' } },
  provider: {
    mock: {
      type: 'mock',
      name: 'Mock (offline echo)',
      models: { echo: { name: 'echo' } },
    },
  },
  mcpServers: {},
};

export function parseConfig(json: unknown, opts: LoadOptions = {}): SberDesignerConfig {
  const parsed = SberDesignerConfigSchema.parse(json);
  return resolveEnvReferences(parsed, opts);
}

export function promptAttachmentLimitsFromConfig(
  cfg: Pick<SberDesignerConfig, 'agent'> | null | undefined,
): PromptAttachmentLimits {
  return {
    ...DEFAULT_PROMPT_ATTACHMENT_LIMITS,
    ...(cfg?.agent.attachments?.svgMaxBytes
      ? { svgMaxBytes: cfg.agent.attachments.svgMaxBytes }
      : {}),
  };
}

export function agentConcurrencyFromConfig(
  cfg: Pick<SberDesignerConfig, 'agent'> | null | undefined,
): AgentConcurrencyLimits {
  const concurrency = cfg?.agent.concurrency;
  return {
    ...DEFAULT_AGENT_CONCURRENCY_LIMITS,
    ...(concurrency?.maxTotalRuns !== undefined ? { maxTotalRuns: concurrency.maxTotalRuns } : {}),
    ...(concurrency?.maxApiRuns !== undefined ? { maxApiRuns: concurrency.maxApiRuns } : {}),
    ...(concurrency?.maxCliRuns !== undefined ? { maxCliRuns: concurrency.maxCliRuns } : {}),
    ...(concurrency?.sameScreenPolicy !== undefined
      ? { sameScreenPolicy: concurrency.sameScreenPolicy }
      : {}),
    ...(concurrency?.sameFilePolicy !== undefined
      ? { sameFilePolicy: concurrency.sameFilePolicy }
      : {}),
  };
}

export function agentContextBudgetFromConfig(
  cfg: Pick<SberDesignerConfig, 'agent'> | null | undefined,
): AgentContextBudgetPolicy {
  const budget = cfg?.agent.contextBudget;
  return {
    ...DEFAULT_AGENT_CONTEXT_BUDGET,
    ...(budget?.warningTokens !== undefined ? { warningTokens: budget.warningTokens } : {}),
    ...(budget?.degradePromptBytes !== undefined
      ? { degradePromptBytes: budget.degradePromptBytes }
      : {}),
    ...(budget?.blockPromptBytes !== undefined
      ? { blockPromptBytes: budget.blockPromptBytes }
      : {}),
  };
}

export function directionPickerModeFromConfig(
  cfg: Pick<SberDesignerConfig, 'agent'> | null | undefined,
): AgentDirectionPickerMode {
  return cfg?.agent.directionPicker ?? 'off';
}

export function shouldPresentDirectionPicker(
  cfg: Pick<SberDesignerConfig, 'agent'> | null | undefined,
  scope: 'screen' | 'other',
): boolean {
  const mode = directionPickerModeFromConfig(cfg);
  return mode === 'always' || (mode === 'screens' && scope === 'screen');
}

function resolveEnvReferences(
  cfg: SberDesignerConfig,
  { env = nodeEnv(), strictEnv = false }: LoadOptions,
): SberDesignerConfig {
  const resolveString = (s: string | undefined): string | undefined => {
    if (s === undefined) return undefined;
    const m = ENV_REF_RE.exec(s);
    if (!m) return s;
    const key = m[1]!;
    const v = env[key];
    if (v === undefined) {
      if (strictEnv) throw new Error(`Missing required env var: ${key}`);
      return s;
    }
    return v;
  };

  const resolved: SberDesignerConfig = structuredClone(cfg);
  for (const provider of Object.values(resolved.provider)) {
    if (provider.options) {
      provider.options.apiKey = resolveString(provider.options.apiKey);
      if (provider.options.headers) {
        for (const k of Object.keys(provider.options.headers)) {
          provider.options.headers[k] = resolveString(provider.options.headers[k]) ?? '';
        }
      }
    }
  }
  for (const server of Object.values(resolved.mcpServers)) {
    if (server.type === 'stdio' && server.env) {
      for (const k of Object.keys(server.env)) {
        server.env[k] = resolveString(server.env[k]) ?? '';
      }
    }
    if (isHttpMcpServer(server) && server.headers) {
      for (const k of Object.keys(server.headers)) {
        server.headers[k] = resolveString(server.headers[k]) ?? '';
      }
    }
  }
  return resolved;
}

function isHttpMcpServer(
  server: SberDesignerConfig['mcpServers'][string],
): server is Extract<
  SberDesignerConfig['mcpServers'][string],
  { type: 'http' | 'streamable-http' | 'streamableHttp' | 'remote' }
> {
  return (
    server.type === 'http' ||
    server.type === 'streamable-http' ||
    server.type === 'streamableHttp' ||
    server.type === 'remote'
  );
}

function nodeEnv(): Record<string, string | undefined> {
  // Lazy reference to allow this package to be imported in browser bundles.
  // The browser never resolves env-vars; it only displays them as `{env:...}`.
  if (typeof globalThis !== 'undefined') {
    const proc = (
      globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }
    ).process;
    if (proc?.env) return proc.env;
  }
  return {};
}

/**
 * Filters the visible (provider, model) pairs by `agent.restrict`. Used to
 * populate the Settings dialog dropdown.
 */
export function listVisibleModels(
  cfg: SberDesignerConfig,
): { provider: string; model: string; label: string }[] {
  const restrict = cfg.agent.restrict;
  const restrictedProviders = restrict?.enabled ? new Set(restrict.providers ?? []) : null;
  const restrictedModels = restrict?.enabled ? new Set(restrict.models ?? []) : null;

  const out: { provider: string; model: string; label: string }[] = [];
  for (const [providerKey, provider] of Object.entries(cfg.provider)) {
    if (restrictedProviders && !restrictedProviders.has(providerKey)) continue;
    for (const [modelKey, model] of Object.entries(provider.models ?? {})) {
      if (restrictedModels && !restrictedModels.has(modelKey)) continue;
      out.push({
        provider: providerKey,
        model: modelKey,
        label: `${provider.name} · ${model.name ?? modelKey}`,
      });
    }
  }
  return out;
}
