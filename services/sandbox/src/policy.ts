import { processEnvironment } from '@sber-designer/shared-types';
/**
 * Sandbox controller access policy (0136 R01 / R05).
 *
 * The controller starts processes. Until now it took `workspacePath`,
 * `command` and `args` from any caller that could open a socket to it:
 * no authentication, CORS reflecting whatever Origin arrived, and an
 * export with no `hostname`, which means Bun's default `0.0.0.0`. The
 * deploy instructions asked an operator to close the port in a firewall;
 * the code did not require it.
 *
 * Four rules live here, all overridable so local development stays the
 * convenient path it was:
 *
 *   bind      — loopback by default; a non-loopback bind is an explicit
 *               opt-in and, in server mode, requires a token as well.
 *   auth      — a shared token between api and controller. Required in
 *               server mode; optional in local mode, where the loopback
 *               bind is the boundary.
 *   workspace — an optional allowlist of roots a session may be started
 *               in, checked canonically so a symlink cannot widen it.
 *   launch    — which commands may be spawned at all.
 *
 * Environment for the child process is built by `buildSandboxChildEnv`:
 * the controller used to pass `...process.env` straight through, so a
 * connected project's dev-script inherited every auth, service and
 * provider secret in `/etc/sber-designer/env`.
 */
import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export type SandboxDeploymentMode = 'local' | 'server';

export interface SandboxPolicy {
  mode: SandboxDeploymentMode;
  hostname: string;
  token: string | null;
  workspaceRoots: string[];
  allowedCommands: ReadonlySet<string>;
}

export type SandboxEnvironment = Record<string, string | undefined>;

/** Commands the controller is willing to spawn as a dev-server. */
export const DEFAULT_ALLOWED_COMMANDS = [
  'bun',
  'bunx',
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'node',
  'static-html',
] as const;

export const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', '::1', 'localhost']);

export function resolveSandboxMode(env: SandboxEnvironment = process.env): SandboxDeploymentMode {
  return env.SBER_DESIGNER_DEPLOYMENT_MODE?.trim() === 'server' ? 'server' : 'local';
}

export function resolveSandboxPolicy(env: SandboxEnvironment = process.env): SandboxPolicy {
  const mode = resolveSandboxMode(env);
  const hostname = (env.SBER_DESIGNER_SANDBOX_HOST?.trim() || '127.0.0.1').toLowerCase();
  const token = env.SBER_DESIGNER_SANDBOX_TOKEN?.trim() || null;
  const workspaceRoots = splitList(env.SBER_DESIGNER_SANDBOX_WORKSPACE_ROOTS).map((entry) =>
    canonical(resolve(entry)),
  );
  const extraCommands = splitList(env.SBER_DESIGNER_SANDBOX_ALLOWED_COMMANDS);
  const allowedCommands = new Set<string>([...DEFAULT_ALLOWED_COMMANDS, ...extraCommands]);

  return { mode, hostname, token, workspaceRoots, allowedCommands };
}

/**
 * The address the controller actually binds. A misconfigured policy is never
 * rewarded with a wider bind: it falls back to loopback, and
 * {@link startupRefusal} makes the controller refuse its own API surface.
 */
export function resolveSandboxBindHostname(env: SandboxEnvironment = process.env): string {
  const policy = resolveSandboxPolicy(env);
  return startupRefusal(policy) ? '127.0.0.1' : policy.hostname;
}

/**
 * Configurations the controller must refuse to start with, rather than
 * start and hope a firewall is in place.
 */
export function startupRefusal(policy: SandboxPolicy): string | null {
  const loopback = isLoopbackHostname(policy.hostname);
  if (policy.mode === 'server' && !policy.token) {
    return 'SBER_DESIGNER_SANDBOX_TOKEN is required in server deployment mode: the controller starts processes and must authenticate the api.';
  }
  if (!loopback && !policy.token) {
    return `Refusing to bind the sandbox controller to ${policy.hostname} without SBER_DESIGNER_SANDBOX_TOKEN. Bind to 127.0.0.1 or configure a token shared with the api.`;
  }
  return null;
}

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname.replace(/^\[/u, '').replace(/\]$/u, '').toLowerCase());
}

export interface SandboxAuthResult {
  ok: boolean;
  status: 401 | 403;
  error: string;
  detail: string;
}

const AUTH_OK: SandboxAuthResult = { ok: true, status: 401, error: '', detail: '' };

/**
 * Authorize one controller request. Without a configured token the
 * controller is loopback-only, and the bind is the boundary — that is the
 * default local-development contract and it stays working.
 */
export function authorizeSandboxRequest(
  policy: SandboxPolicy,
  headers: { get(name: string): string | null },
): SandboxAuthResult {
  if (!policy.token) {
    if (isLoopbackHostname(policy.hostname)) return AUTH_OK;
    return {
      ok: false,
      status: 403,
      error: 'sandbox_unconfigured',
      detail: 'Controller is reachable off-loopback without a configured token.',
    };
  }
  const supplied =
    headers.get('x-sber-designer-sandbox-token')?.trim() ||
    bearer(headers.get('authorization')) ||
    '';
  if (!supplied) {
    return {
      ok: false,
      status: 401,
      error: 'sandbox_unauthorized',
      detail: 'Missing sandbox controller token.',
    };
  }
  if (!timingSafeEqual(supplied, policy.token)) {
    return {
      ok: false,
      status: 403,
      error: 'sandbox_forbidden',
      detail: 'Sandbox controller token is not valid.',
    };
  }
  return AUTH_OK;
}

/** An empty allowlist means "any workspace" — the local default. */
export function isAllowedWorkspace(policy: SandboxPolicy, workspacePath: string): boolean {
  if (policy.workspaceRoots.length === 0) return true;
  const candidate = canonical(resolve(workspacePath));
  return policy.workspaceRoots.some((root) => isSameOrChild(root, candidate));
}

export interface LaunchVerdict {
  allowed: boolean;
  detail: string;
}

export function isAllowedLaunch(
  policy: SandboxPolicy,
  command: string,
  args: readonly string[],
): LaunchVerdict {
  const normalized = command.trim();
  if (!normalized) return { allowed: false, detail: 'Empty command.' };
  // A path, a shell invocation or a metacharacter means the caller is
  // choosing an executable rather than a known package-manager entry point.
  if (/[\\/]/u.test(normalized)) {
    return { allowed: false, detail: `Command must be a bare name, got "${normalized}".` };
  }
  if (!policy.allowedCommands.has(normalized)) {
    return {
      allowed: false,
      detail: `Command "${normalized}" is not in the sandbox launch allowlist (${[...policy.allowedCommands].sort().join(', ')}).`,
    };
  }
  for (const arg of args) {
    if (typeof arg !== 'string' || arg.includes('\0')) {
      return { allowed: false, detail: 'Arguments must be NUL-free strings.' };
    }
  }
  return { allowed: true, detail: '' };
}

/**
 * Variables the spawned dev-server actually needs, plus the ones a build
 * toolchain cannot run without. Everything else — auth secrets, service
 * tokens, provider keys — stays with the controller (0136 R05).
 */
export function buildSandboxChildEnv(
  parentEnv: SandboxEnvironment,
  overrides: Record<string, string> = {},
): Record<string, string> {
  const child = processEnvironment(parentEnv);
  // Escape hatch for a project that genuinely needs one more variable.
  for (const name of splitList(parentEnv.SBER_DESIGNER_SANDBOX_ENV_PASSTHROUGH)) {
    const value = parentEnv[name];
    if (typeof value === 'string') child[name] = value;
  }
  return { ...child, ...overrides };
}

export function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[,:\n]/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function bearer(header: string | null): string {
  const match = /^Bearer\s+(.+)$/iu.exec(header?.trim() ?? '');
  return match?.[1]?.trim() ?? '';
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isSameOrChild(parentPath: string, childPath: string): boolean {
  if (parentPath === childPath) return true;
  const rel = relative(parentPath, childPath);
  return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel);
}

function canonical(absPath: string): string {
  try {
    return realpathSync(absPath);
  } catch {
    return absPath;
  }
}
