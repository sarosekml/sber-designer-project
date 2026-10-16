/**
 * MCP deployment policy (0136 R06).
 *
 * `validateMcpServerPolicy` used to ignore its options and return
 * `{ allowed: true }` for every enabled server, so `assertMcpServerAllowed`
 * could never refuse anything: the function existed, the policy did not.
 *
 * There are two profiles, chosen by deployment mode:
 *
 *   open (local default)
 *     Anything the developer configured runs. A remote endpoint still
 *     produces the warning diagnostic the editor shows, because "your
 *     context may be sent here" is true regardless of policy.
 *
 *   restricted (server mode, or `SBER_DESIGNER_MCP_POLICY=restricted`)
 *     Deny by default. A remote endpoint must match an allowlisted host,
 *     a stdio server must match an allowlisted command, and each transport
 *     can be switched off entirely. The allowlists are deployment
 *     configuration, not source: this file must not carry any customer's
 *     addresses.
 *
 * The same verdict is used by autoconnect, explicit connect, reload,
 * tool calls and external handoff, so a project-level override cannot widen
 * what the deployment allows — a project can only disable a server.
 */
import type { McpDiagnostic, McpSecurityOptions, NormalizedMcpServer } from './types';

export type McpPolicyProfile = 'open' | 'restricted';

export interface McpSecurityResult {
  allowed: boolean;
  diagnostics: McpDiagnostic[];
}

export interface McpPolicy {
  profile: McpPolicyProfile;
  allowedRemoteHosts: string[];
  allowedStdioCommands: string[];
  allowRemote: boolean;
  allowStdio: boolean;
}

type PolicyEnvironment = Record<string, string | undefined>;

export function resolveMcpPolicy(env: PolicyEnvironment = process.env): McpPolicy {
  const explicit = env.SBER_DESIGNER_MCP_POLICY?.trim().toLowerCase();
  const profile: McpPolicyProfile =
    explicit === 'restricted'
      ? 'restricted'
      : explicit === 'open'
        ? 'open'
        : env.SBER_DESIGNER_DEPLOYMENT_MODE?.trim() === 'server'
          ? 'restricted'
          : 'open';
  return {
    profile,
    allowedRemoteHosts: splitList(env.SBER_DESIGNER_MCP_ALLOWED_REMOTE_HOSTS),
    allowedStdioCommands: splitList(env.SBER_DESIGNER_MCP_ALLOWED_COMMANDS),
    allowRemote: env.SBER_DESIGNER_MCP_ALLOW_REMOTE?.trim() !== '0',
    allowStdio: env.SBER_DESIGNER_MCP_ALLOW_STDIO?.trim() !== '0',
  };
}

export function assertMcpServerAllowed(
  server: NormalizedMcpServer,
  options: McpSecurityOptions = {},
): void {
  const result = validateMcpServerPolicy(server, options);
  if (result.allowed) return;
  const detail = result.diagnostics
    .filter((diagnostic) => diagnostic.level === 'error')
    .map((diagnostic) => diagnostic.message)
    .join(' ');
  throw new Error(detail || `MCP server "${server.key}" is not allowed by policy.`);
}

export function validateMcpServerPolicy(
  server: NormalizedMcpServer,
  options: McpSecurityOptions = {},
): McpSecurityResult {
  const diagnostics: McpDiagnostic[] = [];
  if (!server.enabled) return { allowed: true, diagnostics };

  const policy = options.policy ?? resolveMcpPolicy();
  const remote = isRemoteMcpServer(server);

  if (remote) {
    diagnostics.push({
      level: 'warning',
      code: 'mcp_remote_server',
      message: `Remote MCP server "${server.key}": tool calls and selected context may be sent to this endpoint.`,
    });
  }

  if (policy.profile === 'open') return { allowed: true, diagnostics };

  // Restricted profile: deny by default, allow by explicit configuration.
  if (server.transport === 'stdio') {
    if (!policy.allowStdio) {
      diagnostics.push(denied(server.key, 'stdio transport is disabled by deployment policy.'));
      return { allowed: false, diagnostics };
    }
    const command = 'command' in server.entry ? server.entry.command : '';
    const allowedCommands = merge(policy.allowedStdioCommands, options.allowedCommands);
    if (!isAllowedCommand(command, allowedCommands)) {
      diagnostics.push(
        denied(
          server.key,
          `stdio command "${command}" is not in SBER_DESIGNER_MCP_ALLOWED_COMMANDS.`,
        ),
      );
      return { allowed: false, diagnostics };
    }
    return { allowed: true, diagnostics };
  }

  if (!policy.allowRemote) {
    diagnostics.push(denied(server.key, 'remote endpoints are disabled by deployment policy.'));
    return { allowed: false, diagnostics };
  }

  const host = serverHost(server);
  if (host === null) {
    diagnostics.push(denied(server.key, 'endpoint URL could not be parsed.'));
    return { allowed: false, diagnostics };
  }
  const allowedHosts = merge(policy.allowedRemoteHosts, options.allowedRemoteHosts);
  if (!isAllowedHost(host, allowedHosts)) {
    diagnostics.push(
      denied(server.key, `host "${host}" is not in SBER_DESIGNER_MCP_ALLOWED_REMOTE_HOSTS.`),
    );
    return { allowed: false, diagnostics };
  }
  return { allowed: true, diagnostics };
}

function denied(key: string, reason: string): McpDiagnostic {
  return {
    level: 'error',
    code: 'mcp_policy_denied',
    message: `MCP server "${key}" is blocked by deployment policy: ${reason}`,
  };
}

/** `example.com` also allows `api.example.com`; `*` is not a wildcard. */
export function isAllowedHost(host: string, allowed: readonly string[]): boolean {
  const candidate = normalizeHost(host);
  return allowed.some((entry) => {
    const normalized = normalizeHost(entry);
    if (!normalized) return false;
    return candidate === normalized || candidate.endsWith(`.${normalized}`);
  });
}

/** Bare names only: a path means the caller is choosing an executable. */
export function isAllowedCommand(command: string, allowed: readonly string[]): boolean {
  const normalized = command.trim();
  if (!normalized || /[\\/]/u.test(normalized)) return false;
  return allowed.some((entry) => entry.trim() === normalized);
}

function serverHost(server: NormalizedMcpServer): string | null {
  if (!('url' in server.entry)) return null;
  try {
    const url = new URL(server.entry.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return normalizeHost(url.hostname);
  } catch {
    return null;
  }
}

/** External CLIs load their own project/user MCP configs outside our broker. */
export function assertExternalRuntimePolicy(policy: McpPolicy = resolveMcpPolicy()): void {
  if (policy.profile === 'restricted') {
    throw new Error(
      'external_runtime_policy_unsupported: External CLI configuration cannot be constrained by the restricted MCP policy. Use the built-in runtime; isolated external runners are tracked in 0400.',
    );
  }
}

function merge(fromEnv: readonly string[], fromOptions: readonly string[] | undefined): string[] {
  return [...fromEnv, ...(fromOptions ?? [])];
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[,\n]/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^\[/u, '').replace(/\]$/u, '');
}

function isLocalOrPrivateHost(host: string): boolean {
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
    return true;
  }
  if (host.endsWith('.local')) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/u.test(host)) return true;
  const private172 = /^172\.(\d{1,2})\.\d{1,3}\.\d{1,3}$/u.exec(host);
  return private172 ? Number(private172[1]) >= 16 && Number(private172[1]) <= 31 : false;
}

export function isRemoteMcpServer(server: NormalizedMcpServer): boolean {
  if (!('url' in server.entry)) return false;
  const host = serverHost(server);
  return host === null ? true : !isLocalOrPrivateHost(host);
}
