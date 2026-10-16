/**
 * Tiny WebSocket client for /api/events with linear backoff reconnect.
 *
 * Usage:
 *   const bus = createEventBusClient({ url, onEvent });
 *   bus.start();   // open + auto-reconnect
 *   bus.stop();    // close, no reconnect
 *
 * Events are typed via the EditorEvent shape in @sber-designer/proj-mcp's
 * server (mirrored here). We don't pull a runtime schema in the browser
 * to keep the bundle small; api validates with zod before publishing.
 */

export type EditorEvent =
  | {
      type: 'editor.message';
      text: string;
      source: 'proj-mcp' | 'agent' | 'user';
      meta?: { provider?: string; model?: string };
    }
  | { type: 'editor.mode-changed'; mode: 'interact' | 'design' | 'code' }
  | {
      type: 'editor.selection-changed';
      selection: {
        loc: string;
        tagName: string;
        text?: string;
        selector?: string;
        componentName?: string;
        componentLoc?: string;
        attributes?: Record<string, string>;
        rect: { x: number; y: number; width: number; height: number };
      } | null;
    }
  | { type: 'proj-mcp.tool-call'; tool: string; argsSummary: string }
  | { type: 'project.changed'; reason?: string }
  | { type: 'storybook.reload-pending'; path?: string }
  | { type: 'storybook.reload-cleared' };

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed';

export interface EventBusClient {
  start(): void;
  stop(): void;
  status(): ConnectionStatus;
  send(event: EditorEvent): void;
}

interface CreateOptions {
  url: string;
  onEvent: (event: EditorEvent) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  /** Backoff window. Default: 1s → max 8s. */
  minReconnectMs?: number;
  maxReconnectMs?: number;
}

export function createEventBusClient(opts: CreateOptions): EventBusClient {
  const minDelay = opts.minReconnectMs ?? 1000;
  const maxDelay = opts.maxReconnectMs ?? 8000;

  let ws: WebSocket | null = null;
  let stopped = true;
  let reconnectMs = minDelay;
  let timer: number | null = null;
  let _status: ConnectionStatus = 'idle';

  const setStatus = (next: ConnectionStatus) => {
    _status = next;
    opts.onStatusChange?.(next);
  };

  const connect = () => {
    if (stopped) return;
    setStatus('connecting');
    try {
      ws = new WebSocket(opts.url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('event-bus: failed to construct WebSocket', err);
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      setStatus('open');
      reconnectMs = minDelay;
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(typeof e.data === 'string' ? e.data : '');
        // Skip control frames the server may send (__hello__, __error__).
        if (
          data &&
          typeof data === 'object' &&
          typeof data.type === 'string' &&
          !data.type.startsWith('__')
        ) {
          opts.onEvent(data as EditorEvent);
        }
      } catch {
        // ignore malformed frames
      }
    };
    ws.onerror = () => {
      // onclose follows; reconnect handled there.
    };
    ws.onclose = () => {
      setStatus('closed');
      ws = null;
      if (!stopped) scheduleReconnect();
    };
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    if (timer != null) window.clearTimeout(timer);
    const delay = reconnectMs;
    reconnectMs = Math.min(maxDelay, reconnectMs * 2);
    timer = window.setTimeout(() => {
      timer = null;
      connect();
    }, delay);
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      reconnectMs = minDelay;
      connect();
    },
    stop() {
      stopped = true;
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
      ws?.close();
      ws = null;
      setStatus('idle');
    },
    status() {
      return _status;
    },
    send(event) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
      // dropped silently if not open — caller should handle delivery
      // semantics if it matters (PoC fire-and-forget for editor.* events)
    },
  };
}
