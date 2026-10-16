import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Lock, X } from 'lucide-react';
import type { ProjectFlowEdge, ProjectScreen } from '@sber-designer/shared-types';

import { useFlowRuntime } from '@/hooks/useFlowRuntime';
import { useOverlayUnderlayLifecycle } from '@/hooks/useOverlayUnderlayLifecycle';
import {
  ApiError,
  apiBaseUrl,
  fetchShare,
  type ShareLockedStub,
  type ShareSnapshot,
} from '@/lib/api-client';
import { resolveBaseEdgeActivation, type OverlayAction } from '@/lib/overlay-runtime';
import { FlowOverlay } from '@/components/editor/FlowOverlay';

/**
 * Where we cache an unlocked share's password between reloads. Scoped
 * to the browser session so closing the tab forgets it.
 */
const passwordKey = (token: string) => `sd-share-pw:${token}`;

/**
 * Read-only Demo viewer for /share/<token> URLs (Phase 5.5).
 *
 * Loads the snapshot, walks the project's flow exactly like DemoCanvas
 * but without any editor chrome and without write access. Useful for
 * "send this link to the PM, they click around without VPN to the
 * editor".
 *
 * The dev-server is reached through the api's preview-share proxy
 * (Phase 6.1) — the snapshot's previewUrl never leaves the editor host,
 * so links work from anywhere the api is reachable.
 */
export function ShareViewer({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<ShareSnapshot | null>(null);
  const [locked, setLocked] = useState<ShareLockedStub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [password, setPassword] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : window.sessionStorage.getItem(passwordKey(token)),
  );

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchShare(token, password ?? undefined, ac.signal);
        if (cancelled) return;
        if ('locked' in s && s.locked) {
          setLocked(s);
          setSnapshot(null);
          // Stale cached password — drop it.
          if (password) {
            window.sessionStorage.removeItem(passwordKey(token));
            setPassword(null);
          }
          return;
        }
        const full = s as ShareSnapshot;
        setSnapshot(full);
        setLocked(null);
        setError(null);
        if (full.project.screens.length > 0) {
          setActiveScreenId((id) => id ?? full.project.screens[0]!.id);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          // Wrong password — show the prompt with an error and let the
          // user retype.
          setLocked({
            token,
            createdAt: 0,
            expiresAt: 0,
            passwordRequired: true,
            locked: true,
          });
          setSnapshot(null);
          setError('Wrong password.');
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [token, password]);

  if (locked && !snapshot) {
    return (
      <PasswordGate
        error={error}
        onSubmit={(pw) => {
          window.sessionStorage.setItem(passwordKey(token), pw);
          setError(null);
          setPassword(pw);
        }}
      />
    );
  }
  if (error && !snapshot) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-sm text-muted-foreground">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive-foreground">
          Share unavailable: {error}
        </div>
      </div>
    );
  }
  if (!snapshot) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <SharePlayer
      snapshot={snapshot}
      sharePassword={password}
      activeScreenId={activeScreenId}
      setActiveScreenId={(id) => {
        setActiveScreenId(id);
        setHistory((h) => (h[h.length - 1] === id ? h : [...h, id]));
      }}
      history={history}
      onBack={() => {
        if (history.length < 2) return;
        const prev = history[history.length - 2]!;
        setHistory((h) => h.slice(0, -1));
        setActiveScreenId(prev);
      }}
    />
  );
}

interface PlayerProps {
  snapshot: ShareSnapshot;
  /** Phase 6.3 — appended as `?p=` so the proxy unlocks iframe assets. */
  sharePassword: string | null;
  activeScreenId: string | null;
  setActiveScreenId: (id: string) => void;
  history: string[];
  onBack: () => void;
}

function SharePlayer({
  snapshot,
  sharePassword,
  activeScreenId,
  setActiveScreenId,
  history,
  onBack,
}: PlayerProps) {
  const screens: ProjectScreen[] = snapshot.project.screens;
  const flow: ProjectFlowEdge[] = snapshot.project.flow;
  const activeScreen = screens.find((s) => s.id === activeScreenId);
  const outgoing = useMemo(
    () => flow.filter((e) => e.fromScreenId === activeScreenId),
    [activeScreenId, flow],
  );
  const [overlayScreenId, setOverlayScreenId] = useState<string | null>(null);
  const overlayScreen = screens.find((s) => s.id === overlayScreenId);

  const iframeUrl = useScreenUrl(snapshot.previewUrl, snapshot.token, sharePassword, activeScreen);
  const overlayUrl = useScreenUrl(
    snapshot.previewUrl,
    snapshot.token,
    sharePassword,
    overlayScreen,
  );

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);

  const activateEdge = useCallback(
    (edge: ProjectFlowEdge) => {
      const action = resolveBaseEdgeActivation(edge, screens);
      if (action.kind === 'open-overlay') {
        setOverlayScreenId(action.screenId);
        return;
      }
      setOverlayScreenId(null);
      setActiveScreenId(action.screenId);
    },
    [screens, setActiveScreenId],
  );

  const handleOverlayAction = useCallback(
    (action: OverlayAction) => {
      switch (action.kind) {
        case 'close-overlay':
          setOverlayScreenId(null);
          return;
        case 'open-overlay':
        case 'replace-overlay':
          setOverlayScreenId(action.screenId);
          return;
        case 'navigate':
        case 'navigate-and-close':
          setOverlayScreenId(null);
          setActiveScreenId(action.screenId);
          return;
      }
    },
    [setActiveScreenId],
  );

  useEffect(() => {
    setIframeReady(false);
  }, [iframeUrl]);

  useFlowRuntime({
    iframeRef,
    // Pause the underlay runtime while a modal overlay is open (риск №3).
    enabled: Boolean(activeScreen) && !overlayScreenId,
    ready: iframeReady,
    edges: outgoing,
    onActivate: activateEdge,
  });
  useOverlayUnderlayLifecycle(activeScreenId, overlayScreenId, () => setOverlayScreenId(null));

  useEffect(() => {
    if (!overlayScreenId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOverlayScreenId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlayScreenId]);

  // on-mount edges.
  useEffect(() => {
    const e = outgoing.find((x) => x.trigger.kind === 'on-mount');
    if (!e) return;
    const t = window.setTimeout(() => activateEdge(e), 50);
    return () => window.clearTimeout(t);
  }, [activateEdge, activeScreenId, outgoing]);

  return (
    <div className="relative flex h-screen w-screen flex-col bg-black">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-card px-4 text-xs">
        <button
          onClick={() => {
            if (overlayScreenId) {
              setOverlayScreenId(null);
              return;
            }
            onBack();
          }}
          disabled={!overlayScreenId && history.length < 2}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <ArrowLeft className="size-3" />
          Back
        </button>
        <div className="flex-1 truncate text-center font-medium">
          {snapshot.project.name} · {activeScreen?.name ?? '(no screen)'}
        </div>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Open the editor"
        >
          <X className="size-3" />
          Editor
        </a>
      </div>
      <div className="min-h-0 flex-1 bg-white">
        {activeScreen && iframeUrl ? (
          <iframe
            ref={iframeRef}
            key={iframeUrl}
            title="share"
            src={iframeUrl}
            sandbox="allow-scripts allow-same-origin allow-forms"
            className="h-full w-full border-0"
            inert={overlayScreen ? true : undefined}
            onLoad={() => setIframeReady(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            This share has no screens. The author needs to add some and re-share.
          </div>
        )}
      </div>
      {overlayScreen && overlayUrl && (
        <FlowOverlay
          overlayScreen={overlayScreen}
          overlayUrl={overlayUrl}
          underlayScreenId={activeScreenId}
          screens={screens}
          flow={flow}
          onClose={() => setOverlayScreenId(null)}
          onAction={handleOverlayAction}
          className="z-40"
        />
      )}
    </div>
  );
}

/**
 * Build a viewer URL anchored on the api's preview-share proxy. We
 * never embed the raw `snapshot.previewUrl` (which is a localhost URL
 * on the editor host). Instead the recipient hits
 * `${apiBaseUrl}/api/preview-share/<token>/...` and the api forwards
 * to the dev-server.
 *
 * `previewUrl` is still passed in only as a presence check — if the
 * snapshot has no live previewUrl the proxy will 503, so there's
 * nothing useful to render.
 */
function useScreenUrl(
  previewUrl: string | null,
  token: string,
  password: string | null,
  screen: ProjectScreen | undefined,
): string | null {
  if (!previewUrl || !screen) return null;
  const proxyBase = `${apiBaseUrl.replace(/\/+$/, '')}/api/preview-share/${encodeURIComponent(token)}`;
  // Browsers can't set headers on <iframe> requests, so we have to
  // forward the share password through the URL when it's set. Same
  // tradeoff already accepted in the route — this is the editor host's
  // logs, not a public CDN.
  const pwParam = password ? `&p=${encodeURIComponent(password)}` : '';
  if (screen.kind === 'story' && screen.storyId) {
    const u = new URL(`${proxyBase}/iframe.html`);
    u.searchParams.set('id', screen.storyId);
    u.searchParams.set('viewMode', 'story');
    u.searchParams.set('shortcuts', 'false');
    u.searchParams.set('singleStory', 'true');
    if (password) u.searchParams.set('p', password);
    return u.toString();
  }
  if (screen.kind === 'page' && screen.filePath) {
    const path = screen.filePath.replace(/^src\//, '').replace(/\.tsx?$/, '');
    return `${proxyBase}/${path}${password ? `?${pwParam.slice(1)}` : ''}`;
  }
  return `${proxyBase}/${password ? `?${pwParam.slice(1)}` : ''}`;
}

function PasswordGate({
  error,
  onSubmit,
}: {
  error: string | null;
  onSubmit: (password: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value) onSubmit(value);
        }}
        className="w-[320px] rounded-md border border-border bg-card p-5 text-sm shadow-lg"
      >
        <div className="mb-3 flex items-center gap-2 text-foreground">
          <Lock className="size-4" />
          <span className="font-medium">This share is password-protected</span>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Enter the password the share creator gave you. It's never sent to anyone but the editor's
          api.
        </p>
        <input
          autoFocus
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mb-3 w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="Password"
        />
        {error ? <div className="mb-3 text-xs text-destructive">{error}</div> : null}
        <button
          type="submit"
          disabled={!value}
          className="w-full rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
