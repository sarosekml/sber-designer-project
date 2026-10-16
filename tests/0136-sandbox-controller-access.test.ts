/**
 * 0136 R01 / R04 / R05 — the sandbox controller starts processes, so reaching
 * its port must not be the same thing as being allowed to use it.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sandboxServer from '../services/sandbox/src/index';
import {
  authorizeSandboxRequest,
  buildSandboxChildEnv,
  isAllowedLaunch,
  isAllowedWorkspace,
  resolveSandboxBindHostname,
  resolveSandboxPolicy,
  startupRefusal,
  type SandboxPolicy,
} from '../services/sandbox/src/policy';
import {
  isServableStaticPath,
  readStaticHtmlPreviewResponse,
} from '../services/sandbox/src/static-html-session';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

function policy(overrides: Partial<SandboxPolicy> = {}): SandboxPolicy {
  return {
    mode: 'local',
    hostname: '127.0.0.1',
    token: null,
    workspaceRoots: [],
    allowedCommands: new Set(['bun', 'npm', 'static-html']),
    ...overrides,
  };
}

function headers(entries: Record<string, string> = {}): Headers {
  return new Headers(entries);
}

describe('0136 R01 controller bind and authentication', () => {
  test('binds loopback by default instead of Bun’s 0.0.0.0', () => {
    expect(resolveSandboxPolicy({}).hostname).toBe('127.0.0.1');
    expect(resolveSandboxBindHostname({})).toBe('127.0.0.1');
  });

  test('server mode refuses to run without a controller token', () => {
    expect(startupRefusal(policy({ mode: 'server' }))).toMatch(/SANDBOX_TOKEN is required/u);
    expect(startupRefusal(policy({ mode: 'server', token: 'secret' }))).toBeNull();
  });

  test('a non-loopback bind without a token is refused and falls back to loopback', () => {
    expect(startupRefusal(policy({ hostname: '0.0.0.0' }))).toMatch(/Refusing to bind/u);
    expect(
      resolveSandboxBindHostname({
        SBER_DESIGNER_SANDBOX_HOST: '0.0.0.0',
      }),
    ).toBe('127.0.0.1');
    expect(
      resolveSandboxBindHostname({
        SBER_DESIGNER_SANDBOX_HOST: '0.0.0.0',
        SBER_DESIGNER_SANDBOX_TOKEN: 'secret',
      }),
    ).toBe('0.0.0.0');
  });

  test('a configured token is required, compared in full, and accepted both ways', () => {
    const configured = policy({ token: 'shared-token' });
    expect(authorizeSandboxRequest(configured, headers()).status).toBe(401);
    expect(authorizeSandboxRequest(configured, headers({ authorization: 'Bearer nope' })).ok).toBe(
      false,
    );
    expect(
      authorizeSandboxRequest(configured, headers({ authorization: 'Bearer shared-token' })).ok,
    ).toBe(true);
    expect(
      authorizeSandboxRequest(
        configured,
        headers({ 'x-sber-designer-sandbox-token': 'shared-token' }),
      ).ok,
    ).toBe(true);
  });

  test('without a token the controller is usable only because it is loopback-bound', () => {
    expect(authorizeSandboxRequest(policy(), headers()).ok).toBe(true);
    const exposed = authorizeSandboxRequest(policy({ hostname: '0.0.0.0' }), headers());
    expect(exposed.ok).toBe(false);
    expect(exposed.status).toBe(403);
  });
});

describe('0136 R01 workspace and launch allowlists', () => {
  test('an empty workspace allowlist keeps local development unrestricted', () => {
    expect(isAllowedWorkspace(policy(), '/anywhere/at/all')).toBe(true);
  });

  test('a configured allowlist confines sessions to its roots', async () => {
    const base = await mkdtemp(join(tmpdir(), 'sd-0136-roots-'));
    temporaryDirectories.push(base);
    const allowed = join(base, 'projects');
    const outside = join(base, 'elsewhere');
    await mkdir(allowed, { recursive: true });
    await mkdir(outside, { recursive: true });

    const confined = policy({ workspaceRoots: [allowed] });
    expect(isAllowedWorkspace(confined, join(allowed, 'app'))).toBe(true);
    expect(isAllowedWorkspace(confined, outside)).toBe(false);
    expect(isAllowedWorkspace(confined, join(allowed, '..', 'elsewhere'))).toBe(false);
  });

  test('only allowlisted bare commands may be spawned', () => {
    const p = policy();
    expect(isAllowedLaunch(p, 'bun', ['run', 'dev']).allowed).toBe(true);
    expect(isAllowedLaunch(p, '/usr/bin/curl', []).allowed).toBe(false);
    expect(isAllowedLaunch(p, '../../bin/sh', ['-c', 'id']).allowed).toBe(false);
    expect(isAllowedLaunch(p, 'sh', ['-c', 'id']).allowed).toBe(false);
    expect(isAllowedLaunch(p, 'bun', ['run\0evil']).allowed).toBe(false);
  });

  test('the route refuses a command outside the allowlist', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'sd-0136-launch-'));
    temporaryDirectories.push(workspace);
    const response = await sandboxServer.fetch(
      new Request('http://localhost/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspacePath: workspace, command: 'sh', args: ['-c', 'id'] }),
      }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('command_not_allowed');
  });
});

describe('0136 R05 child process environment', () => {
  test('secrets stay with the controller and are not inherited by the dev-server', () => {
    const child = buildSandboxChildEnv(
      {
        PATH: '/usr/bin',
        HOME: '/home/sd',
        SBER_DESIGNER_AUTH_SECRET: 'auth-secret',
        SBER_DESIGNER_SERVICE_TOKENS: 'smoke:token',
        ANTHROPIC_API_KEY: 'provider-key',
        GIGACHAT_CREDENTIALS: 'provider-key',
      },
      { PORT: '6006' },
    );
    expect(child.PATH).toBe('/usr/bin');
    expect(child.HOME).toBe('/home/sd');
    expect(child.PORT).toBe('6006');
    expect(child.SBER_DESIGNER_AUTH_SECRET).toBeUndefined();
    expect(child.SBER_DESIGNER_SERVICE_TOKENS).toBeUndefined();
    expect(child.ANTHROPIC_API_KEY).toBeUndefined();
    expect(child.GIGACHAT_CREDENTIALS).toBeUndefined();
  });

  test('a project that needs one more variable can be opted in explicitly', () => {
    const child = buildSandboxChildEnv({
      PATH: '/usr/bin',
      MY_PROJECT_FLAG: 'on',
      SECRET: 'no',
      SBER_DESIGNER_SANDBOX_ENV_PASSTHROUGH: 'MY_PROJECT_FLAG',
    });
    expect(child.MY_PROJECT_FLAG).toBe('on');
    expect(child.SECRET).toBeUndefined();
  });
});

describe('0136 R04 static preview publishes assets, not project files', () => {
  test('classifies servable and blocked paths', () => {
    expect(isServableStaticPath('index.html')).toBe(true);
    expect(isServableStaticPath('assets/app.css')).toBe(true);
    expect(isServableStaticPath('fonts/inter.woff2')).toBe(true);
    expect(isServableStaticPath('.env')).toBe(false);
    expect(isServableStaticPath('.env.local')).toBe(false);
    expect(isServableStaticPath('.git/config')).toBe(false);
    expect(isServableStaticPath('.sber-designer/project.sdproj')).toBe(false);
    expect(isServableStaticPath('.agents/skills/x/SKILL.md')).toBe(false);
    expect(isServableStaticPath('server.key')).toBe(false);
    expect(isServableStaticPath('.npmrc')).toBe(false);
  });

  test('a request for .env no longer returns the file', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'sd-0136-static-'));
    temporaryDirectories.push(workspace);
    await writeFile(join(workspace, '.env'), 'SD_MARKER=leaked', 'utf8');
    await mkdir(join(workspace, '.git'), { recursive: true });
    await writeFile(join(workspace, '.git', 'config'), '[remote]', 'utf8');
    await writeFile(join(workspace, 'index.html'), '<html><body>ok</body></html>', 'utf8');

    const env = await readStaticHtmlPreviewResponse(workspace, '/.env');
    expect(env.status).toBe(404);
    expect(String(env.body)).not.toContain('leaked');

    const git = await readStaticHtmlPreviewResponse(workspace, '/.git/config');
    expect(git.status).toBe(404);

    const page = await readStaticHtmlPreviewResponse(workspace, '/index.html');
    expect(page.status).toBe(200);
    expect(String(page.body)).toContain('ok');
  });

  test('percent-encoded and traversal spellings do not reopen the surface', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'sd-0136-static-enc-'));
    temporaryDirectories.push(workspace);
    await writeFile(join(workspace, '.env'), 'SD_MARKER=leaked', 'utf8');

    for (const url of ['/%2Eenv', '/./.env', '/sub/../.env', '/.git/../.env']) {
      const response = await readStaticHtmlPreviewResponse(workspace, url);
      expect(String(response.body)).not.toContain('leaked');
    }
  });
});
