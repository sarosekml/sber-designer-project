/**
 * /api/sandbox/* — thin proxy in front of services/sandbox.
 *
 * Why proxy: phase 1.1 had apps/web call services/sandbox directly on
 * :3001. That worked locally but left a second public-facing service
 * with no auth. With this in place, apps/web only ever talks to
 * services/api, and we can put a bearer-token in front of the
 * controller in Phase 1.9 without touching the frontend.
 *
 * Translation:
 *   POST   /api/sandbox/sessions              → POST   <controller>/api/sessions
 *   GET    /api/sandbox/sessions              → GET    <controller>/api/sessions
 *   GET    /api/sandbox/sessions/:id          → GET    <controller>/api/sessions/:id
 *   DELETE /api/sandbox/sessions/:id          → DELETE <controller>/api/sessions/:id
 *
 * Controller URL is configurable via `SBER_DESIGNER_SANDBOX_URL`
 * (default: `http://localhost:3001`). Request and response bodies pass
 * through verbatim.
 *
 * 0136 R01 — the controller now authenticates its caller. When
 * `SBER_DESIGNER_SANDBOX_TOKEN` is set (required in server mode) every
 * forwarded request carries it. Local development without a token keeps
 * working: the controller is loopback-bound and accepts unauthenticated
 * requests only on loopback.
 */
import { Hono, type Context } from 'hono';
import { scanProjectProfile } from '@sber-designer/design-indexer';

import { audit } from '../audit';
import { getUser } from '../auth';
import { patchState } from '../state-store';

const SANDBOX_URL = (process.env.SBER_DESIGNER_SANDBOX_URL ?? 'http://localhost:3001').replace(
  /\/+$/,
  '',
);

/** Headers every controller call carries. Read lazily so tests can set it. */
export function sandboxControllerHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const token = process.env.SBER_DESIGNER_SANDBOX_TOKEN?.trim();
  return token ? { ...extra, 'x-sber-designer-sandbox-token': token } : { ...extra };
}

export const sandboxRouter = new Hono()
  .post('/sessions', async (c) => {
    const user = getUser(c);
    const body = await prepareSandboxSessionRequest(await c.req.text());
    try {
      const res = await fetch(`${SANDBOX_URL}/api/sessions`, {
        method: 'POST',
        headers: sandboxControllerHeaders({ 'content-type': 'application/json' }),
        body,
      });
      const data = await res.text();
      syncSandboxState(data);
      audit({
        kind: 'config',
        user,
        errorMessage: `sandbox create status=${res.status}`,
      });
      return c.body(data, res.status as 200, {
        'content-type': res.headers.get('content-type') ?? 'application/json',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `sandbox create: ${message}` });
      return c.json(
        {
          error: 'sandbox_unreachable',
          detail: `Could not reach sandbox controller at ${SANDBOX_URL}: ${message}`,
        },
        502,
      );
    }
  })
  .get('/sessions', async (c) => {
    return forward(`${SANDBOX_URL}/api/sessions`, c);
  })
  .get('/sessions/:id', async (c) => {
    return forward(`${SANDBOX_URL}/api/sessions/${encodeURIComponent(c.req.param('id'))}`, c);
  })
  .delete('/sessions/:id', async (c) => {
    const user = getUser(c);
    const id = c.req.param('id');
    try {
      const res = await fetch(`${SANDBOX_URL}/api/sessions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: sandboxControllerHeaders(),
      });
      audit({ kind: 'config', user, errorMessage: `sandbox stop id=${id} status=${res.status}` });
      return c.body(null, res.status as 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'sandbox_unreachable', detail: message }, 502);
    }
  });

export async function prepareSandboxSessionRequest(body: string): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return body;
  const record = parsed as Record<string, unknown>;
  if (typeof record.command === 'string' && record.command.trim()) return body;
  if (Array.isArray(record.args) && record.args.length > 0) return body;
  const workspacePath = typeof record.workspacePath === 'string' ? record.workspacePath.trim() : '';
  if (!workspacePath) return body;

  const profile = await scanProjectProfile(workspacePath).catch(() => null);
  if (profile?.kind !== 'html-css' || profile.renderProbe !== 'static-html') return body;
  return JSON.stringify({ ...record, command: 'static-html', args: [] });
}

async function forward(url: string, c: Context) {
  try {
    const res = await fetch(url, { headers: sandboxControllerHeaders() });
    const text = await res.text();
    syncSandboxState(text);
    return c.body(text, res.status as 200, {
      'content-type': res.headers.get('content-type') ?? 'application/json',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: 'sandbox_unreachable', detail: message }, 502);
  }
}

export function syncSandboxState(text: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return;
  }
  const session = selectSandboxSessionForState(parsed);
  if (!session) return;

  const previewUrl = typeof session.previewUrl === 'string' ? session.previewUrl : null;
  const status = typeof session.status === 'string' ? session.status : null;
  patchState({
    workspacePath: session.workspacePath,
    canvasUrl: status === 'ready' ? previewUrl : null,
  });
}

export function selectSandboxSessionForState(parsed: unknown): {
  workspacePath: string;
  previewUrl?: unknown;
  status?: unknown;
} | null {
  const sessions = Array.isArray(parsed) ? parsed : [parsed];
  const valid = sessions
    .map((session, index) => ({ session, index }))
    .filter(
      (entry): entry is { session: Record<string, unknown>; index: number } =>
        Boolean(entry.session) &&
        typeof entry.session === 'object' &&
        !Array.isArray(entry.session) &&
        typeof (entry.session as { workspacePath?: unknown }).workspacePath === 'string',
    );
  if (valid.length === 0) return null;

  const ready = valid.filter(
    ({ session }) => session.status === 'ready' && typeof session.previewUrl === 'string',
  );
  const candidates = ready.length > 0 ? ready : valid;
  const latest = candidates.reduce((best, candidate) =>
    sandboxSessionSortKey(candidate) >= sandboxSessionSortKey(best) ? candidate : best,
  );
  return latest.session as {
    workspacePath: string;
    previewUrl?: unknown;
    status?: unknown;
  };
}

function sandboxSessionSortKey(input: { session: Record<string, unknown>; index: number }): number {
  const readyAt = input.session.readyAt;
  if (typeof readyAt === 'number' && Number.isFinite(readyAt)) return readyAt;
  const startedAt = input.session.startedAt;
  if (typeof startedAt === 'number' && Number.isFinite(startedAt)) return startedAt;
  return input.index;
}
