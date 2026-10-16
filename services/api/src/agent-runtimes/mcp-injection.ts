import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  AgentRuntimeDef,
  AgentRuntimeExternalMcpInjectionMode,
  RuntimeCommandResult,
} from './types';
import { parseMcpServers, runRuntimeCommand } from './detection';

type RuntimeEnv = Record<string, string | undefined>;

export const DEFAULT_PROJ_MCP_PACKAGE_ROOT = fileURLToPath(
  new URL('../../../../packages/proj-mcp/', import.meta.url),
);

export type ExternalMcpInjectionResult =
  | AppliedExternalMcpInjection
  | {
      status: 'skipped' | 'failed';
      mode: AgentRuntimeExternalMcpInjectionMode | null;
      env: RuntimeEnv;
      args: string[];
      detail: string;
      cleanup(): Promise<void>;
    };

export interface AppliedExternalMcpInjection {
  status: 'applied';
  mode: AgentRuntimeExternalMcpInjectionMode;
  serverName: string;
  env: RuntimeEnv;
  args: string[];
  detail: string;
  cleanup(): Promise<void>;
}

export interface ExternalMcpInjectionVerification {
  status: 'forwarded_verified' | 'forwarded_unverified';
  serverName: string;
  detail: string;
}

export interface ExternalMcpInjectionConfigPreflight {
  ok: boolean;
  mode: AgentRuntimeExternalMcpInjectionMode | null;
  code?: 'runtime_config_invalid';
  detail?: string;
}

type ExternalMcpProbeCommand = (
  command: string,
  args: string[],
  options?: { timeoutMs?: number; cwd?: string; env?: RuntimeEnv },
) => Promise<RuntimeCommandResult>;

export async function prepareExternalMcpInjection(input: {
  def: AgentRuntimeDef;
  cwd: string;
  env?: RuntimeEnv;
  projectId?: string | null;
  apiUrl?: string | null;
  runId?: string | null;
  packageRoot?: string;
}): Promise<ExternalMcpInjectionResult> {
  const injection = input.def.externalMcpInjection;
  if (!injection) {
    return {
      status: 'skipped',
      mode: null,
      env: {},
      args: [],
      detail: `${input.def.displayName} does not declare project MCP injection.`,
      cleanup: async () => undefined,
    };
  }

  if (injection.mode === 'claude-mcp-json') {
    return await prepareClaudeMcpJsonInjection({
      cwd: input.cwd,
      preferredServerName: injection.serverName ?? 'sber-designer',
      config: buildProjMcpServerConfig(input),
    });
  }

  if (injection.mode === 'opencode-env-content') {
    const preflight = validateExternalMcpInjectionConfig({
      def: input.def,
      env: input.env ?? process.env,
    });
    if (!preflight.ok) {
      return {
        status: 'failed',
        mode: 'opencode-env-content',
        env: {},
        args: [],
        detail: preflight.detail ?? 'runtime_config_invalid: OpenCode MCP config is invalid.',
        cleanup: async () => undefined,
      };
    }
    return prepareOpenCodeEnvContentInjection({
      env: input.env ?? process.env,
      preferredServerName: injection.serverName ?? 'sber-designer',
      config: buildProjMcpServerConfig(input),
    });
  }

  if (injection.mode === 'codex-config-args') {
    return prepareCodexConfigArgsInjection({
      preferredServerName: injection.serverName ?? 'sber-designer',
      config: buildProjMcpServerConfig(input),
    });
  }

  return {
    status: 'skipped',
    mode: injection.mode,
    env: {},
    args: [],
    detail: `Project MCP injection mode is not implemented: ${injection.mode}.`,
    cleanup: async () => undefined,
  };
}

export function validateExternalMcpInjectionConfig(input: {
  def: AgentRuntimeDef;
  env?: RuntimeEnv;
}): ExternalMcpInjectionConfigPreflight {
  const injection = input.def.externalMcpInjection;
  if (!injection) return { ok: true, mode: null };
  if (injection.mode !== 'opencode-env-content') return { ok: true, mode: injection.mode };

  const before = input.env?.OPENCODE_CONFIG_CONTENT?.trim() || null;
  const parsed = parseOptionalJsonObject(before);
  if (!parsed.ok) {
    return {
      ok: false,
      mode: injection.mode,
      code: 'runtime_config_invalid',
      detail:
        'runtime_config_invalid: Existing OPENCODE_CONFIG_CONTENT is not valid JSON; sber-designer left it untouched.',
    };
  }
  if (Object.hasOwn(parsed.value, 'mcpServers')) {
    return {
      ok: false,
      mode: injection.mode,
      code: 'runtime_config_invalid',
      detail:
        'runtime_config_invalid: OPENCODE_CONFIG_CONTENT contains unsupported legacy key "mcpServers"; use OPENCODE_CONFIG_CONTENT#mcp.<name>.',
    };
  }
  return { ok: true, mode: injection.mode };
}

export async function verifyExternalMcpInjection(input: {
  def: AgentRuntimeDef;
  command: string;
  cwd: string;
  injection: ExternalMcpInjectionResult;
  env?: RuntimeEnv;
  runCommand?: ExternalMcpProbeCommand;
}): Promise<ExternalMcpInjectionVerification | null> {
  if (input.injection.status !== 'applied') return null;
  const serverName = input.injection.serverName;
  if (!input.def.listMcp) {
    return {
      status: 'forwarded_unverified',
      serverName,
      detail: `${input.def.displayName} does not expose a listMcp probe; project MCP injection was applied but not verified.`,
    };
  }
  const runCommand = input.runCommand ?? runRuntimeCommand;
  try {
    const commandOptions: {
      timeoutMs: number;
      cwd: string;
      env?: RuntimeEnv;
    } = {
      timeoutMs: input.def.listMcp.timeoutMs,
      cwd: input.cwd,
    };
    if (input.env) commandOptions.env = input.env;
    const injectionArgs =
      input.def.kind === 'claude-code'
        ? [
            ...withoutOptionPair(input.injection.args, '--allowedTools'),
            // Both Claude flags above accept variadic values. This terminates
            // --mcp-config before the `mcp list` subcommand and isolates the
            // probe to the injected run-scoped server.
            '--strict-mcp-config',
          ]
        : input.injection.args;
    const result = await runCommand(
      input.command,
      [...injectionArgs, ...input.def.listMcp.args],
      commandOptions,
    );
    const servers = parseMcpServers(input.def.kind, combineOutput(result));
    const match = servers.find((server) => server.name === serverName);
    if (match && match.status !== 'failed' && match.status !== 'disabled') {
      return {
        status: 'forwarded_verified',
        serverName,
        detail: `Project MCP server "${serverName}" is visible in ${input.def.displayName} MCP list (${match.status}).`,
      };
    }
    return {
      status: 'forwarded_unverified',
      serverName,
      detail: match
        ? `Project MCP server "${serverName}" is present but reported status "${match.status}".`
        : `Project MCP server "${serverName}" was not found in ${input.def.displayName} MCP list after injection.`,
    };
  } catch (err) {
    return {
      status: 'forwarded_unverified',
      serverName,
      detail: `Project MCP injection was applied, but ${input.def.displayName} MCP list probe failed: ${safeErrorMessage(err)}`,
    };
  }
}

async function prepareClaudeMcpJsonInjection(input: {
  cwd: string;
  preferredServerName: string;
  config: ProjMcpServerConfig;
}): Promise<ExternalMcpInjectionResult> {
  const path = join(input.cwd, '.mcp.json');
  const before = await readOptionalText(path);
  const parsed = parseOptionalJsonObject(before);
  if (!parsed.ok) {
    return {
      status: 'failed',
      mode: 'claude-mcp-json',
      env: {},
      args: [],
      detail: 'Existing .mcp.json is not valid JSON; sber-designer left it untouched.',
      cleanup: async () => undefined,
    };
  }

  const serverName = chooseServerName(parsed.value.mcpServers, input.preferredServerName);
  const next = withManagedMcpServersServer(parsed.value, serverName, input.config);
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');

  // Claude Code print mode cannot ask interactively for MCP permission. Pass
  // the per-run config explicitly and auto-allow only read-only or run-scoped
  // project tools. Filesystem, screen, git and reindex mutations stay gated.
  const allowedTools = claudeProjectMcpAllowedTools(serverName);

  let cleaned = false;
  return {
    status: 'applied',
    mode: 'claude-mcp-json',
    serverName,
    env: {},
    args: ['--mcp-config', path, '--allowedTools', allowedTools.join(',')],
    detail: `Injected project MCP server "${serverName}" into workspace .mcp.json.`,
    cleanup: async () => {
      if (cleaned) return;
      cleaned = true;
      if (before === null) {
        await unlink(path).catch((err) => {
          if (!isNotFoundError(err)) throw err;
        });
        return;
      }
      await writeFile(path, before, 'utf8');
    },
  };
}

function claudeProjectMcpAllowedTools(serverName: string): string[] {
  const prefix = `mcp__${serverName}__`;
  return [
    'ping',
    'tail_run_events',
    'ast_read_file',
    'catalog_list_components',
    'get_project_index_status',
    'search_project_index',
    'get_usage_card',
    'list_patterns',
    'get_pattern',
    'list_undescribed_components',
    'get_component_description_source',
    'editor_get_selection',
    'update_component_selection',
  ].map((tool) => `${prefix}${tool}`);
}

function prepareOpenCodeEnvContentInjection(input: {
  env: RuntimeEnv;
  preferredServerName: string;
  config: ProjMcpServerConfig;
}): ExternalMcpInjectionResult {
  const before = input.env.OPENCODE_CONFIG_CONTENT?.trim() || null;
  const parsed = parseOptionalJsonObject(before);
  if (!parsed.ok) {
    return {
      status: 'failed',
      mode: 'opencode-env-content',
      env: {},
      args: [],
      detail:
        'Existing OPENCODE_CONFIG_CONTENT is not valid JSON; sber-designer left it untouched.',
      cleanup: async () => undefined,
    };
  }
  const serverName = chooseServerName(parsed.value.mcp, input.preferredServerName);
  const next = withManagedOpenCodeMcpServer(parsed.value, serverName, input.config);
  return {
    status: 'applied',
    mode: 'opencode-env-content',
    serverName,
    env: {
      OPENCODE_CONFIG_CONTENT: JSON.stringify(next),
    },
    args: [],
    detail: `Injected project MCP server "${serverName}" into OPENCODE_CONFIG_CONTENT.`,
    cleanup: async () => undefined,
  };
}

function prepareCodexConfigArgsInjection(input: {
  preferredServerName: string;
  config: ProjMcpServerConfig;
}): ExternalMcpInjectionResult {
  const serverName = input.preferredServerName;
  const configKey = `mcp_servers.${serverName}`;
  return {
    status: 'applied',
    mode: 'codex-config-args',
    serverName,
    env: {},
    args: [
      '-c',
      `${configKey}.command=${JSON.stringify(input.config.command)}`,
      '-c',
      `${configKey}.args=${JSON.stringify(input.config.args)}`,
    ],
    detail: `Injected project MCP server "${serverName}" through Codex per-run config arguments.`,
    cleanup: async () => undefined,
  };
}

interface ProjMcpServerConfig {
  command: string;
  args: string[];
}

function buildProjMcpServerConfig(input: {
  cwd: string;
  projectId?: string | null;
  apiUrl?: string | null;
  runId?: string | null;
  packageRoot?: string;
}): ProjMcpServerConfig {
  const packageRoot =
    input.packageRoot ??
    process.env.SBER_DESIGNER_PROJ_MCP_PACKAGE_ROOT ??
    DEFAULT_PROJ_MCP_PACKAGE_ROOT;
  const command = process.env.SBER_DESIGNER_PROJ_MCP_COMMAND?.trim() || 'bun';
  const args = [join(packageRoot, 'src/bin.ts'), '--workspace', input.cwd];
  if (input.projectId?.trim()) args.push('--project-id', input.projectId.trim());
  if (input.apiUrl?.trim()) args.push('--api-url', input.apiUrl.trim());
  if (input.runId?.trim()) args.push('--run-id', input.runId.trim());
  return { command, args };
}

function withManagedMcpServersServer(
  rootValue: Record<string, unknown>,
  serverName: string,
  config: ProjMcpServerConfig,
): Record<string, unknown> {
  const root = { ...rootValue };
  const servers = isRecord(root.mcpServers) ? { ...root.mcpServers } : {};
  root.mcpServers = {
    ...servers,
    [serverName]: config,
  };
  return root;
}

function withManagedOpenCodeMcpServer(
  rootValue: Record<string, unknown>,
  serverName: string,
  config: ProjMcpServerConfig,
): Record<string, unknown> {
  const root = { ...rootValue };
  const servers = isRecord(root.mcp) ? { ...root.mcp } : {};
  root.mcp = {
    ...servers,
    [serverName]: {
      type: 'local',
      command: [config.command, ...config.args],
      enabled: true,
    },
  };
  return root;
}

function chooseServerName(value: unknown, preferred: string): string {
  const servers = isRecord(value) ? value : {};
  if (!Object.hasOwn(servers, preferred)) return preferred;
  const managed = `${preferred}-managed`;
  if (!Object.hasOwn(servers, managed)) return managed;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${managed}-${index}`;
    if (!Object.hasOwn(servers, candidate)) return candidate;
  }
  return `${managed}-${Date.now()}`;
}

async function readOptionalText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (isNotFoundError(err)) return null;
    throw err;
  }
}

function parseOptionalJsonObject(
  value: string | null,
): { ok: true; value: Record<string, unknown> } | { ok: false } {
  if (!value) return { ok: true, value: {} };
  try {
    const parsed = JSON.parse(value);
    return { ok: true, value: isRecord(parsed) ? parsed : {} };
  } catch {
    return { ok: false };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && 'code' in err && err.code === 'ENOENT';
}

function combineOutput(result: RuntimeCommandResult): string {
  return [result.stdout, result.stderr].filter(Boolean).join('\n');
}

function safeErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function withoutOptionPair(args: string[], option: string): string[] {
  const next: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === option) {
      index += 1;
      continue;
    }
    const value = args[index];
    if (value !== undefined) next.push(value);
  }
  return next;
}
