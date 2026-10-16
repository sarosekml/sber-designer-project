/**
 * 0136 R06 / R07 — MCP policy must enforce, and shared configuration must be
 * portable.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  assertMcpServerAllowed,
  resolveMcpPolicy,
  validateMcpServerPolicy,
  type McpPolicy,
} from '../services/api/src/mcp/security';
import { mergeConfigLayers } from '../services/api/src/config-store';
import type { NormalizedMcpServer } from '../services/api/src/mcp/types';

const REPO_ROOT = resolve(import.meta.dir, '..');

function remoteServer(url: string, key = 'remote'): NormalizedMcpServer {
  return {
    key,
    namespace: key,
    transport: 'streamable-http',
    enabled: true,
    configEnabled: true,
    runtimeEnabled: true,
    entry: { type: 'streamable-http', url } as NormalizedMcpServer['entry'],
    configHash: 'sha256:test',
  };
}

function stdioServer(command: string, key = 'stdio'): NormalizedMcpServer {
  return {
    key,
    namespace: key,
    transport: 'stdio',
    enabled: true,
    configEnabled: true,
    runtimeEnabled: true,
    entry: { type: 'stdio', command, args: [] } as NormalizedMcpServer['entry'],
    configHash: 'sha256:test',
  };
}

const OPEN: McpPolicy = {
  profile: 'open',
  allowedRemoteHosts: [],
  allowedStdioCommands: [],
  allowRemote: true,
  allowStdio: true,
};

function restricted(overrides: Partial<McpPolicy> = {}): McpPolicy {
  return { ...OPEN, profile: 'restricted', ...overrides };
}

describe('0136 R06 policy profile selection', () => {
  test('local deployments stay open, server deployments are restricted', () => {
    expect(resolveMcpPolicy({}).profile).toBe('open');
    expect(resolveMcpPolicy({ SBER_DESIGNER_DEPLOYMENT_MODE: 'local' }).profile).toBe('open');
    expect(resolveMcpPolicy({ SBER_DESIGNER_DEPLOYMENT_MODE: 'server' }).profile).toBe(
      'restricted',
    );
  });

  test('the profile can be set explicitly in either direction', () => {
    expect(resolveMcpPolicy({ SBER_DESIGNER_MCP_POLICY: 'restricted' }).profile).toBe('restricted');
    expect(
      resolveMcpPolicy({
        SBER_DESIGNER_DEPLOYMENT_MODE: 'server',
        SBER_DESIGNER_MCP_POLICY: 'open',
      }).profile,
    ).toBe('open');
  });
});

describe('0136 R06 the open profile keeps warning without blocking', () => {
  test('a remote endpoint is allowed and still carries its warning', () => {
    const result = validateMcpServerPolicy(remoteServer('https://example.com/mcp'), {
      policy: OPEN,
    });
    expect(result.allowed).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain('mcp_remote_server');
  });

  test('a disabled server is never evaluated', () => {
    const server = { ...remoteServer('https://example.com/mcp'), enabled: false };
    expect(validateMcpServerPolicy(server, { policy: restricted() }).allowed).toBe(true);
  });
});

describe('0136 R06 the restricted profile denies by default', () => {
  test('an unlisted remote host is blocked, a listed one is allowed', () => {
    const policy = restricted({ allowedRemoteHosts: ['mcp.internal.example'] });
    const blocked = validateMcpServerPolicy(remoteServer('https://public.example.com/mcp'), {
      policy,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.diagnostics.some((d) => d.code === 'mcp_policy_denied')).toBe(true);

    expect(
      validateMcpServerPolicy(remoteServer('https://mcp.internal.example/mcp'), { policy }).allowed,
    ).toBe(true);
    // A listed domain also covers its subdomains.
    expect(
      validateMcpServerPolicy(remoteServer('https://a.mcp.internal.example/mcp'), { policy })
        .allowed,
    ).toBe(true);
  });

  test('a loopback or private endpoint requires an explicit allowlist entry', () => {
    const policy = restricted();
    expect(
      validateMcpServerPolicy(remoteServer('http://127.0.0.1:3667/mcp'), { policy }).allowed,
    ).toBe(false);
    expect(
      validateMcpServerPolicy(remoteServer('http://10.1.2.3:8080/mcp'), { policy }).allowed,
    ).toBe(false);
  });

  test('stdio commands must be allowlisted', () => {
    const policy = restricted({ allowedStdioCommands: ['bun'] });
    expect(validateMcpServerPolicy(stdioServer('bun'), { policy }).allowed).toBe(true);
    expect(validateMcpServerPolicy(stdioServer('sh'), { policy }).allowed).toBe(false);
    expect(validateMcpServerPolicy(stdioServer('/usr/bin/bun'), { policy }).allowed).toBe(false);
  });

  test('each transport can be switched off entirely', () => {
    expect(
      validateMcpServerPolicy(stdioServer('bun'), {
        policy: restricted({ allowStdio: false, allowedStdioCommands: ['bun'] }),
      }).allowed,
    ).toBe(false);
    expect(
      validateMcpServerPolicy(remoteServer('https://mcp.internal.example/mcp'), {
        policy: restricted({ allowRemote: false, allowedRemoteHosts: ['mcp.internal.example'] }),
      }).allowed,
    ).toBe(false);
  });

  test('assertMcpServerAllowed now actually throws', () => {
    const policy = restricted({ allowedRemoteHosts: ['mcp.internal.example'] });
    expect(() =>
      assertMcpServerAllowed(remoteServer('https://public.example.com/mcp'), { policy }),
    ).toThrow(/blocked by deployment policy/u);
    expect(() =>
      assertMcpServerAllowed(remoteServer('https://mcp.internal.example/mcp'), { policy }),
    ).not.toThrow();
  });
});

describe('0136 R07 shared configuration is portable', () => {
  const template = JSON.parse(readFileSync(resolve(REPO_ROOT, 'sber-designer.json'), 'utf8')) as {
    mcpServers: Record<string, Record<string, unknown>>;
  };

  test('the tracked template carries no machine-specific paths', () => {
    const serialized = JSON.stringify(template);
    expect(serialized).not.toMatch(/\/Users\//u);
    expect(serialized).not.toMatch(/\/home\/[a-z]/u);
    expect(serialized).not.toMatch(/C:\\\\Users/u);
  });

  test('optional MCP servers ship disabled in the template', () => {
    for (const [key, entry] of Object.entries(template.mcpServers)) {
      expect(`${key}:${entry.enabled === true}`).toBe(`${key}:false`);
    }
  });

  test('the browser fallback config ships no MCP wiring', () => {
    const fallback = JSON.parse(
      readFileSync(resolve(REPO_ROOT, 'apps/web/public/sber-designer.json'), 'utf8'),
    ) as { mcpServers?: Record<string, unknown> };
    expect(Object.keys(fallback.mcpServers ?? {})).toEqual([]);
    expect(JSON.stringify(fallback)).not.toMatch(/\/Users\//u);
  });
});

describe('0136 R07 the local overlay merges over the template', () => {
  test('objects merge, scalars and arrays replace, null removes', () => {
    const merged = mergeConfigLayers(
      {
        agent: { default: { provider: 'deepseek', model: 'deepseek-v4-pro' } },
        mcpServers: {
          keep: { type: 'stdio', command: 'bun', args: ['a', 'b'], enabled: false },
          drop: { type: 'stdio', command: 'bun' },
        },
      },
      {
        agent: { default: { provider: 'gigachat' } },
        mcpServers: {
          keep: { enabled: true, args: ['c'] },
          drop: null,
          added: { type: 'stdio', command: 'node' },
        },
      },
    ) as Record<string, any>;

    expect(merged.agent.default).toEqual({ provider: 'gigachat', model: 'deepseek-v4-pro' });
    expect(merged.mcpServers.keep).toEqual({
      type: 'stdio',
      command: 'bun',
      args: ['c'],
      enabled: true,
    });
    expect(merged.mcpServers.drop).toBeUndefined();
    expect(merged.mcpServers.added).toEqual({ type: 'stdio', command: 'node' });
  });

  test('an absent overlay leaves the template untouched', () => {
    const base = { agent: { default: { provider: 'deepseek' } } };
    expect(mergeConfigLayers(base, {})).toEqual(base);
  });
});
