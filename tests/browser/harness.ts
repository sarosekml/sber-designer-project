/**
 * Local browser smoke harness (0136 R13).
 *
 * The repo's smoke script probes endpoints and then prints a checklist a human
 * is supposed to walk. Several UI tests assert against source strings, which
 * proves a file contains text, not that navigation, focus, the sandbox iframe
 * or a cookie session actually work.
 *
 * This boots the real stack — api, sandbox controller and the built web app —
 * on free ports with the offline mock provider, and drives a real Chromium.
 * Nothing here talks to a model or to the network.
 *
 * It is a *local* suite on purpose: `bun run smoke:browser`. CI does not run
 * it yet (there is no browser job), and it skips with a clear message when
 * Chromium is not installed, so `bun test` on a fresh clone is unaffected.
 */
import { processEnvironment } from '@sber-designer/shared-types';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';

import { pickAvailablePort } from '../../scripts/dev-ports';

export const REPO_ROOT = resolve(import.meta.dir, '..', '..');

export interface BrowserStack {
  webUrl: string;
  apiUrl: string;
  workspace: string;
  stop(): Promise<void>;
}

/**
 * Playwright is a devDependency; the browser binary is a separate download.
 * `executablePath()` answers where it *would* be, so the file itself is what
 * decides whether this suite can run.
 */
export async function chromiumAvailable(): Promise<boolean> {
  try {
    const { chromium } = await import('playwright');
    const path = chromium.executablePath();
    return Boolean(path) && existsSync(path);
  } catch {
    return false;
  }
}

export function skipNotice(): string {
  return [
    'Browser smoke skipped: Chromium is not installed.',
    'Install it once with:  bunx playwright install chromium',
  ].join('\n');
}

/**
 * A minimal HTML-first project: the profile scanner recognises it, so the
 * sandbox serves it with the static-html driver and no dev-server install.
 */
export async function seedHtmlProject(name = 'smoke-project'): Promise<string> {
  const base = await mkdtemp(join(tmpdir(), 'sd-browser-smoke-'));
  const workspace = join(base, name);
  await mkdir(join(workspace, 'design-system'), { recursive: true });
  await writeFile(
    join(workspace, 'index.html'),
    [
      '<!doctype html>',
      '<html lang="en">',
      '  <head><meta charset="utf-8" /><title>Smoke</title></head>',
      '  <body data-sd-screen-root>',
      '    <main><h1 id="smoke-heading">Smoke home</h1></main>',
      '  </body>',
      '</html>',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(workspace, 'design-system', 'tokens.css'),
    ':root { --sd-smoke-accent: #1f6feb; }\n',
    'utf8',
  );
  return workspace;
}

interface Service {
  name: string;
  child: ChildProcess;
}

const BROWSER_SMOKE_DIRECTORY_PREFIX = 'sd-browser-smoke-';

function assertPathInside(root: string, candidate: string, label: string): void {
  const relativePath = relative(root, resolve(candidate));
  if (relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))) return;
  throw new Error(`Browser smoke ${label} escapes its temporary root: ${candidate}`);
}

/**
 * The browser suite creates and recursively removes this directory. Refuse any
 * caller-provided workspace that was not created by seedHtmlProject(), even if
 * a future test accidentally points the harness at a real project.
 */
export async function browserSmokeRoot(workspace: string): Promise<string> {
  const temporaryRoot = await realpath(tmpdir());
  const candidate = await realpath(resolve(workspace, '..'));
  assertPathInside(temporaryRoot, candidate, 'workspace');
  if (!basename(candidate).startsWith(BROWSER_SMOKE_DIRECTORY_PREFIX)) {
    throw new Error(`Browser smoke workspace is not disposable: ${workspace}`);
  }
  return candidate;
}

function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolveReady, rejectReady) => {
    const attempt = async () => {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (response.ok || response.status === 401) return resolveReady();
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) {
        rejectReady(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(() => void attempt(), 300);
    };
    void attempt();
  });
}

/**
 * Start api + sandbox + a static server for the built web app. The web app is
 * served from `apps/web/dist`, so the suite exercises the same bundle that
 * ships — including the lazy editor/Monaco boundaries from R14.
 */
export async function startStack(options: {
  workspace: string;
  authMode?: 'local' | 'password';
  deploymentMode?: 'local' | 'server';
}): Promise<BrowserStack> {
  const smokeRoot = await browserSmokeRoot(options.workspace);
  const sandboxPort = await pickAvailablePort(3401);
  const apiPort = await pickAvailablePort(3402, undefined, new Set([sandboxPort]));
  const webPort = await pickAvailablePort(3403, undefined, new Set([sandboxPort, apiPort]));
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const sandboxUrl = `http://127.0.0.1:${sandboxPort}`;
  const webUrl = `http://127.0.0.1:${webPort}`;

  const isolatedState: NodeJS.ProcessEnv = {
    SBER_DESIGNER_DATA_ROOT: join(smokeRoot, 'state'),
    SBER_DESIGNER_USERS_ROOT: join(smokeRoot, 'state/users'),
    SBER_DESIGNER_PROJECTS_ROOT: join(smokeRoot, 'managed-projects'),
    SBER_DESIGNER_PROJECTS_REGISTRY_PATH: join(smokeRoot, 'state/projects.json'),
    SBER_DESIGNER_PROJECT_THUMBNAILS_DIR: join(smokeRoot, 'state/thumbnails'),
    SBER_DESIGNER_AGENT_RUNTIMES_PATH: join(smokeRoot, 'state/runtimes.json'),
  };
  for (const [label, path] of Object.entries(isolatedState)) {
    if (path) assertPathInside(smokeRoot, path, label);
  }

  const shared: NodeJS.ProcessEnv = {
    ...processEnvironment(process.env),
    SBER_DESIGNER_DEPLOYMENT_MODE: options.deploymentMode ?? 'local',
    SBER_DESIGNER_AUTH_MODE: options.authMode ?? 'local',
    SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD: '1',
    ...isolatedState,
    SBER_DESIGNER_SANDBOX_TOKEN: 'browser-smoke-controller-fixture',
    SBER_DESIGNER_ALLOWED_ORIGINS: webUrl,
    SBER_DESIGNER_AUTH_CAPTCHA: 'disabled',
    SBER_DESIGNER_BOOTSTRAP_ADMIN_EMAIL: 'smoke-admin@example.test',
    SBER_DESIGNER_BOOTSTRAP_ADMIN_PASSWORD: 'Browser-Smoke-Password-123!',
    SBER_DESIGNER_BUILD_INFO_PATH: join(REPO_ROOT, 'BUILD_INFO.json'),
    // Offline echo provider: no model is contacted.
    SBER_DESIGNER_CONFIG_PATH: join(options.workspace, 'sber-designer.json'),
  };

  await writeFile(
    join(options.workspace, 'sber-designer.json'),
    `${JSON.stringify(
      {
        agent: { default: { provider: 'mock', model: 'echo' } },
        provider: { mock: { type: 'mock', name: 'Mock (offline echo)', models: { echo: {} } } },
        mcpServers: {},
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const services: Service[] = [];
  const logs: string[] = [];
  const start = (name: string, cwd: string, args: string[], env: NodeJS.ProcessEnv): void => {
    const child = spawn(
      process.execPath,
      args.map((arg) => (arg.endsWith('.ts') ? resolve(REPO_ROOT, cwd, arg) : arg)),
      {
        // Bun must not auto-load the developer's .env from the repository cwd.
        cwd: smokeRoot,
        env: { ...shared, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    child.stdout?.on('data', (chunk) => {
      logs.push(`[${name}] ${String(chunk)}`);
    });
    child.stderr?.on('data', (chunk) => {
      logs.push(`[${name}] ${String(chunk)}`);
    });
    services.push({ name, child });
  };

  start('sandbox', 'services/sandbox', ['run', 'src/index.ts'], {
    PORT: String(sandboxPort),
  });
  start('api', 'services/api', ['run', 'src/index.ts'], {
    PORT: String(apiPort),
    SBER_DESIGNER_SANDBOX_URL: sandboxUrl,
  });
  // `bunx serve`-free: Bun can serve a directory with a one-liner.
  start('web', '.', ['run', 'tests/browser/static-web-server.ts'], {
    SD_WEB_PORT: String(webPort),
    SD_WEB_ROOT: resolve(REPO_ROOT, 'apps/web/dist'),
    SD_WEB_API_URL: apiUrl,
  });

  await mkdir(shared.SBER_DESIGNER_PROJECTS_ROOT!, { recursive: true });
  try {
    await Promise.all([
      waitForHttp(`${sandboxUrl}/health`),
      waitForHttp(`${apiUrl}/health`),
      waitForHttp(`${webUrl}/`),
    ]);
  } catch (error) {
    for (const { child } of services) child.kill('SIGKILL');
    throw new Error(`${String(error)}\n${logs.join('').slice(-5000)}`);
  }

  return {
    webUrl,
    apiUrl,
    workspace: options.workspace,
    async stop() {
      // SIGTERM first so the sandbox controller can stop its own sessions,
      // then SIGKILL anything still holding a port — a stale listener from a
      // previous run silently serves the *old* code on the next one.
      for (const service of services) {
        try {
          service.child.kill('SIGTERM');
        } catch {
          // already gone
        }
      }
      await new Promise((done) => setTimeout(done, 500));
      for (const service of services) {
        if (service.child.exitCode === null && service.child.signalCode === null) {
          try {
            service.child.kill('SIGKILL');
          } catch {
            // already gone
          }
        }
      }
      await new Promise((done) => setTimeout(done, 200));
      await rm(smokeRoot, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}
