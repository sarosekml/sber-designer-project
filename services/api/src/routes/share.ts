/**
 * /api/share — read-only project snapshots (Phase 5.5).
 *
 *   POST   /api/share          { ttlMs? }     → ShareSnapshot
 *   GET    /api/share/:token                  → ShareSnapshot
 *   DELETE /api/share/:token                  → 204
 *
 * POST snapshots the active project + the latest known previewUrl from
 * state-store. The token returns a stable URL the user copies into a
 * chat / email; opening it in apps/web shows the prototype in
 * read-only Demo mode.
 *
 * GET is **public** — the editor's read-only viewer needs to reach it
 * without an auth header. The token itself is the access control.
 */
import { Hono } from 'hono';
import { z } from 'zod';

import { audit } from '../audit';
import { getUser } from '../auth';
import { getProject } from '../project-store';
import { createShare, dropShare, getShare, verifySharePassword } from '../share-store';
import { getState } from '../state-store';

const CreateInput = z
  .object({
    ttlMs: z
      .number()
      .int()
      .positive()
      .max(7 * 24 * 60 * 60 * 1000)
      .optional(),
    /**
     * Optional password gate (Phase 6.3). If set, viewers must supply
     * the same string via `x-share-password` header or `?p=` query.
     */
    password: z.string().min(4).max(128).optional(),
  })
  .strict();

export const shareRouter = new Hono()
  .post('/', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => ({}));
    const parse = CreateInput.safeParse(raw ?? {});
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }
    const project = getProject();
    if (!project.workspacePath) {
      return c.json(
        { error: 'no_project', detail: 'No active project. Connect or bootstrap first.' },
        400,
      );
    }
    const snapshot = createShare({
      project,
      previewUrl: getState().canvasUrl ?? null,
      createdBy: user,
      ...(parse.data.ttlMs ? { ttlMs: parse.data.ttlMs } : {}),
      ...(parse.data.password ? { password: parse.data.password } : {}),
    });
    audit({
      kind: 'config',
      user,
      errorMessage: `share create token=${snapshot.token.slice(0, 8)}… ttl=${snapshot.expiresAt - snapshot.createdAt}ms password=${snapshot.passwordRequired}`,
    });
    return c.json(snapshot);
  })
  .get('/:token', (c) => {
    const token = c.req.param('token');
    const snapshot = getShare(token);
    if (!snapshot) {
      return c.json({ error: 'not_found_or_expired' }, 404);
    }
    // Phase 6.3 gate. Password is accepted via header (preferred) or
    // a `?p=` query param (fallback for embed contexts without header
    // control). The presence of `passwordRequired` lets the viewer
    // decide between a password prompt and immediate render — so we
    // only 401 if an attempt was made and failed. A first request
    // with no password just gets the metadata back and the client
    // re-asks the user.
    const supplied = c.req.header('x-share-password') ?? c.req.query('p');
    const verdict = verifySharePassword(token, supplied);
    const viewer = anonAudience(c);
    if (verdict === 'forbidden' && supplied) {
      audit({
        kind: 'event',
        user: 'share',
        errorMessage: `share open denied token=${token.slice(0, 8)}… ${viewer}`,
      });
      return c.json({ error: 'invalid_password' }, 401);
    }
    if (verdict === 'ok' || verdict === 'unlocked') {
      audit({
        kind: 'event',
        user: 'share',
        errorMessage: `share open token=${token.slice(0, 8)}… ${viewer}`,
      });
    }
    // For locked shares without a password attempt: return only the
    // gate-relevant fields so we don't leak project contents.
    if (snapshot.passwordRequired && verdict !== 'ok') {
      return c.json(
        {
          token: snapshot.token,
          createdAt: snapshot.createdAt,
          expiresAt: snapshot.expiresAt,
          passwordRequired: true,
          locked: true,
        },
        200,
      );
    }
    return c.json(snapshot);
  })
  .delete('/:token', (c) => {
    const ok = dropShare(c.req.param('token'));
    return c.body(null, ok ? 204 : 404);
  });

/**
 * Best-effort viewer identifier for the audit log. Public shares have
 * no logged-in user, so we lean on whatever the proxy/load-balancer
 * gave us — never anything that uniquely tracks a real person.
 */
function anonAudience(c: { req: { header: (k: string) => string | undefined } }): string {
  const fwd = c.req.header('x-forwarded-for') ?? '';
  const ip = fwd.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';
  const ua = (c.req.header('user-agent') ?? 'unknown').slice(0, 80);
  return `ip=${ip} ua="${ua.replaceAll('"', "'")}"`;
}
