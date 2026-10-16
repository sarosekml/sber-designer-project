/**
 * sber-designer sandbox controller. Two drivers under one REST surface:
 *
 *   SBER_DESIGNER_SANDBOX_DRIVER=local   (default)  — child_process spawn.
 *   SBER_DESIGNER_SANDBOX_DRIVER=docker            — docker run + bind mount.
 *
 * Access policy lives in ./policy (0136 R01): loopback bind by default,
 * token auth between api and controller, workspace and launch allowlists.
 *
 * REST:
 *   POST   /api/sessions   { workspacePath, command?, args? }   → SessionInfo
 *   GET    /api/sessions                                        → SessionInfo[]
 *   GET    /api/sessions/:id                                    → SessionInfo
 *   DELETE /api/sessions/:id                                    → 204
 *
 * See ADR-0008 (refined in Phase 4 with the docker driver).
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { existsSync, statSync } from 'node:fs';

import {
  DockerSession,
  dockerAvailable,
  ensureImagePulled,
  listWarmCaches,
} from './docker-session';
import {
  authorizeSandboxRequest,
  isAllowedLaunch,
  isAllowedWorkspace,
  isLoopbackHostname,
  resolveSandboxBindHostname,
  resolveSandboxPolicy,
  startupRefusal,
  type SandboxPolicy,
} from './policy';
import { Session, pickFreePort, resolveWorkspace, type SessionInfo } from './session';
import { idsToReapBeforeCapacity, idsToReapForWorkspace } from './session-reaper';
import { resolveSandboxMaxSessions, sandboxCapacityError } from './session-budget';
import { StaticHtmlSession } from './static-html-session';

type DriverKind = 'local' | 'docker';

const DRIVER: DriverKind =
  (process.env.SBER_DESIGNER_SANDBOX_DRIVER as DriverKind) === 'docker' ? 'docker' : 'local';

interface ManagedSession {
  driver: DriverKind;
  toJSON(): SessionInfo;
  stop(): Promise<void> | void;
}

const sessions = new Map<string, ManagedSession>();

const CreateSessionInput = z
  .object({
    workspacePath: z.string().min(1),
    command: z.string().min(1).default('bun'),
    args: z.array(z.string()).default(['run', 'storybook']),
  })
  .strict();

/**
 * Resolved on first use rather than at import: a controller that is imported
 * by a test or a tool should not fail to load because the ambient environment
 * happens to describe a deployment.
 */
let policyCache: SandboxPolicy | null = null;
function policy(): SandboxPolicy {
  policyCache ??= resolveSandboxPolicy();
  return policyCache;
}

const app = new Hono();

// The only browser-reachable surface is the api, which proxies /api/sandbox.
// Reflecting an arbitrary Origin back would let any page script the
// controller once it can reach the port, so CORS stays off by default and
// opens only for origins an operator names explicitly.
const CORS_ORIGINS = (process.env.SBER_DESIGNER_SANDBOX_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
if (CORS_ORIGINS.length > 0) {
  app.use(
    '*',
    cors({
      origin: (origin) => (origin && CORS_ORIGINS.includes(origin) ? origin : null),
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['authorization', 'content-type', 'x-sber-designer-sandbox-token'],
    }),
  );
}

// Everything below /api is controller surface: it lists, starts and stops
// processes. /health stays open so a supervisor can probe it.
app.use('/api/*', async (c, next) => {
  // A configuration the policy refuses fails closed: the surface is off until
  // an operator fixes it, rather than open while a warning scrolls past.
  const requestOrigin = c.req.header('origin');
  const host = new URL(c.req.url).hostname;
  if (!policy().token && !isLoopbackHostname(host)) {
    return c.json({ error: 'sandbox_host_forbidden' }, 403);
  }
  // CORS controls response access, not whether a simple request executes.
  if (requestOrigin && !CORS_ORIGINS.includes(requestOrigin)) {
    return c.json({ error: 'sandbox_origin_forbidden' }, 403);
  }
  const refusal = startupRefusal(policy());
  if (refusal) return c.json({ error: 'sandbox_misconfigured', detail: refusal }, 503);
  const verdict = authorizeSandboxRequest(policy(), c.req.raw.headers);
  if (!verdict.ok) return c.json({ error: verdict.error, detail: verdict.detail }, verdict.status);
  await next();
});

app.get('/health', async (c) => {
  const base = { ok: true, driver: DRIVER, sessions: sessions.size };
  if (DRIVER !== 'docker') return c.json(base);
  // Phase 6.5 — surface warm-cache count so the editor can show
  // "previously connected to N workspaces, fast cold-start available".
  const warmCaches = await listWarmCaches().catch(() => [] as string[]);
  return c.json({ ...base, warmCaches: warmCaches.length });
});

app.get('/api/sessions', (c) => c.json([...sessions.values()].map((s) => s.toJSON())));

app.post('/api/sessions', async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parse = CreateSessionInput.safeParse(raw);
  if (!parse.success) {
    return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
  }
  const workspacePath = resolveWorkspace(parse.data.workspacePath);
  if (!existsSync(workspacePath)) {
    return c.json({ error: 'workspace_not_found', workspacePath }, 400);
  }
  if (!statSync(workspacePath).isDirectory()) {
    return c.json({ error: 'workspace_not_a_directory', workspacePath }, 400);
  }
  if (!isAllowedWorkspace(policy(), workspacePath)) {
    return c.json(
      {
        error: 'workspace_not_allowed',
        detail:
          'This workspace is outside SBER_DESIGNER_SANDBOX_WORKSPACE_ROOTS. Widen the allowlist to start sessions here.',
        workspacePath,
      },
      403,
    );
  }
  const launch = isAllowedLaunch(policy(), parse.data.command, parse.data.args);
  if (!launch.allowed) {
    return c.json({ error: 'command_not_allowed', detail: launch.detail }, 403);
  }

  // One live session per workspace (task 9999 LIVE-3): stop prior sessions for
  // this workspace so zombie Storybook instances don't pile up on stale ports.
  const staleIds = idsToReapForWorkspace(
    [...sessions.values()].map((s) => {
      const info = s.toJSON();
      return { id: info.id, workspacePath: info.workspacePath };
    }),
    workspacePath,
  );
  for (const id of staleIds) {
    const stale = sessions.get(id);
    if (!stale) continue;
    try {
      await stale.stop();
    } catch {
      // best effort — still drop it from the map below
    }
    sessions.delete(id);
  }
  if (staleIds.length > 0) {
    process.stderr.write(
      `[sandbox] reaped ${staleIds.length} stale session(s) for ${workspacePath}\n`,
    );
  }

  const inactiveIds = idsToReapBeforeCapacity(
    [...sessions.values()].map((session) => {
      const info = session.toJSON();
      return { id: info.id, status: info.status };
    }),
  );
  for (const id of inactiveIds) sessions.delete(id);

  const capacity = sandboxCapacityError(sessions.size, resolveSandboxMaxSessions());
  if (capacity) return c.json(capacity, 429);

  if (DRIVER === 'docker') {
    if (!(await dockerAvailable())) {
      return c.json(
        {
          error: 'docker_unavailable',
          detail: 'SBER_DESIGNER_SANDBOX_DRIVER=docker requires the Docker daemon to be reachable.',
        },
        503,
      );
    }
    const ds = new DockerSession(workspacePath, parse.data.command, parse.data.args);
    const wrapper: ManagedSession = {
      driver: 'docker',
      toJSON: () => ds.toJSON(),
      stop: () => ds.stop(),
    };
    sessions.set(ds.id, wrapper);
    void ds.start();
    return c.json(ds.toJSON(), 201);
  }

  const port = await pickFreePort();
  if (parse.data.command === 'static-html') {
    const staticSession = new StaticHtmlSession(workspacePath, port, parse.data.args);
    const wrapper: ManagedSession = {
      driver: 'local',
      toJSON: () => staticSession.toJSON(),
      stop: () => staticSession.stop(),
    };
    sessions.set(staticSession.id, wrapper);
    await staticSession.start();
    return c.json(staticSession.toJSON(), 201);
  }

  const local = new Session(
    workspacePath,
    parse.data.command,
    withPreferredPort(parse.data.command, parse.data.args, port),
    port,
  );
  const wrapper: ManagedSession = {
    driver: 'local',
    toJSON: () => local.toJSON(),
    stop: () => local.stop(),
  };
  sessions.set(local.id, wrapper);
  local.start();
  return c.json(local.toJSON(), 201);
});

app.get('/api/sessions/:id', (c) => {
  const session = sessions.get(c.req.param('id'));
  if (!session) return c.json({ error: 'not_found' }, 404);
  return c.json(session.toJSON());
});

app.delete('/api/sessions/:id', async (c) => {
  const session = sessions.get(c.req.param('id'));
  if (!session) return c.json({ error: 'not_found' }, 404);
  await session.stop();
  sessions.delete(c.req.param('id'));
  return c.body(null, 204);
});

const port = Number(process.env.PORT ?? 3001);

export default {
  port,
  // Bun defaults to 0.0.0.0 when `hostname` is absent. The controller can
  // start processes, so it binds loopback unless an operator opts out and
  // configures a token (see startupRefusal in ./policy).
  hostname: resolveSandboxBindHostname(),
  fetch: app.fetch,
};

const shutdown = async (signal: string) => {
  process.stderr.write(
    `[sandbox] received ${signal}, stopping ${sessions.size} sessions (driver=${DRIVER})\n`,
  );
  await Promise.all([...sessions.values()].map((s) => s.stop()));
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

const STARTUP_REFUSAL = startupRefusal(policy());
process.stderr.write(
  `[sandbox] listening on http://${resolveSandboxBindHostname()}:${port} · driver=${DRIVER}` +
    ` · mode=${policy().mode} · auth=${policy().token ? 'token' : 'loopback-only'}` +
    ` · sessions=${resolveSandboxMaxSessions() ?? 'unlimited'}\n`,
);
if (STARTUP_REFUSAL) {
  process.stderr.write(`[sandbox] REFUSING /api requests: ${STARTUP_REFUSAL}\n`);
} else if (!policy().token && isLoopbackHostname(policy().hostname)) {
  process.stderr.write(
    '[sandbox] no SBER_DESIGNER_SANDBOX_TOKEN configured: the loopback bind is the only boundary.\n',
  );
}

// Phase 6.5 — eager image pre-pull when the docker driver is on.
// Background; first session no longer pays "docker pull" if the image
// happens to be missing locally. No-op when image already present.
if (DRIVER === 'docker') {
  void (async () => {
    const r = await ensureImagePulled();
    if (r.pulled) {
      process.stderr.write(`[sandbox] pre-pulled image ${r.image}\n`);
    } else if (r.error) {
      process.stderr.write(`[sandbox] image pre-pull skipped: ${r.error}\n`);
    }
  })();
}

function withPreferredPort(command: string, args: string[], port: number): string[] {
  const isPackageScript =
    (command === 'bun' || command === 'npm' || command === 'pnpm' || command === 'yarn') &&
    args[0] === 'run';
  if (!isPackageScript) return args;
  const scriptName = args[1] ?? '';
  if (!/storybook|dev|start/i.test(scriptName)) return args;

  // Package scripts often hard-code a port (for example Storybook's
  // `storybook dev -p 6006`). The sandbox has already reserved a free
  // port; append CLI overrides so "open previous project" does not
  // collide with an existing Storybook process on 6006.
  if (command === 'yarn') return [...args, '--port', String(port), '--host', '127.0.0.1'];
  return [...args, '--', '--port', String(port), '--host', '127.0.0.1'];
}
