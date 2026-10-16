import { Hono } from 'hono';
import { upgradeWebSocket } from 'hono/bun';

import { audit } from '../audit';
import { getUser } from '../auth';
import { EditorEventSchema, publish, subscribe, subscriberCount } from '../event-bus';

/**
 * Two surfaces:
 *   - GET  /api/events         WebSocket subscribe (apps/web)
 *   - POST /api/events/publish HTTP push (proj-mcp, CLI)
 *
 * Both validate with the same zod schema. WS client may also publish by
 * sending a JSON message — useful for editor → proj-mcp direction
 * (Phase 1 step 3 will use this for editor.mode-changed etc).
 */
export const eventsRouter = new Hono()
  .post('/publish', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parsed = EditorEventSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
    }
    publish(parsed.data);
    audit({
      kind: 'config',
      user,
      errorMessage: `event:${parsed.data.type} subs=${subscriberCount()}`,
    });
    return c.json({ ok: true, subscribers: subscriberCount() });
  })
  .get(
    '/',
    upgradeWebSocket(() => {
      // One unsubscribe per socket. Captured in onOpen, called in onClose.
      let unsub: (() => void) | null = null;

      return {
        onOpen(_event, ws) {
          unsub = subscribe((event) => {
            try {
              ws.send(JSON.stringify(event));
            } catch {
              // socket closed mid-fanout
            }
          });
          ws.send(JSON.stringify({ type: '__hello__', subscribers: subscriberCount() }));
        },
        onMessage(event, ws) {
          // Optional client-publish path. Mostly for the editor to push
          // editor.mode-changed / editor.selection-changed without HTTP.
          try {
            const raw = typeof event.data === 'string' ? JSON.parse(event.data) : null;
            const parsed = EditorEventSchema.safeParse(raw);
            if (!parsed.success) {
              ws.send(
                JSON.stringify({
                  type: '__error__',
                  detail: parsed.error.message,
                }),
              );
              return;
            }
            publish(parsed.data);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            ws.send(JSON.stringify({ type: '__error__', detail: message }));
          }
        },
        onClose() {
          unsub?.();
          unsub = null;
        },
        onError() {
          unsub?.();
          unsub = null;
        },
      };
    }),
  );
