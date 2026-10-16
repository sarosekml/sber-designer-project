import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';

import { sourceAt, formatLoc, type SourceKind, type SourceLoc } from '@/lib/dom-source';
import { isUsableDomTestId } from '@/lib/dom-selection';
import {
  buildLayerSnapshotFromDocument,
  normalizeLayerTree,
  type LayerSnapshotNode,
} from '@/lib/layer-tree';
import { LIVE_INSPECT_STYLE_PROPERTIES, type LiveInspectStyles } from '@/lib/live-inspect';
import { useDesignStore } from '@/stores/design-store';
import { useEditorStore, type SelectedNode } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';

interface DomOverlayProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  variant?: 'design' | 'code';
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface HitResult {
  tagName: string;
  loc: SourceLoc;
  sourceKind?: SourceKind;
  domPath?: string;
  componentPath?: string[];
  rect: Rect;
  text?: string;
  selector?: string;
  componentName?: string;
  componentLoc?: SourceLoc;
  attributes?: Record<string, string>;
  selectionNotice?: string;
  inspectId?: string;
  computedStyles?: LiveInspectStyles;
}

interface BridgeResultEvent {
  type: 'sber-designer:hit-test-result';
  requestId: number;
  hit: HitResult | null;
}

interface BridgeLayersResultEvent {
  type: 'sber-designer:layers-result';
  requestId: number;
  tree: LayerSnapshotNode | null;
}

interface BridgeLayersChangedEvent {
  type: 'sber-designer:layers-changed';
  tree: LayerSnapshotNode | null;
}

/**
 * Design-mode overlay above the canvas iframe.
 *
 * Resolves a DOM hit-test to its JSX source location through
 * @/lib/dom-source — first via React Fiber `_debugSource` (works on any
 * React+Vite project, including Storybook iframes), then via the legacy
 * `data-sd-loc` attribute (used by demo-target.html and Phase-1
 * Webpack/non-React sandbox flows). See ADR-0007.
 *
 * Same-origin DOM access only — Phase-1 swaps in postMessage when the
 * sandbox runs on a separate origin/Docker.
 */
export function DomOverlay({ iframeRef, variant = 'design' }: DomOverlayProps) {
  const setSelected = useEditorStore((s) => s.setSelected);
  const selected = useEditorStore((s) => s.selected);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const project = useProjectStore((s) => s.project);
  const setLayerTree = useDesignStore((s) => s.setLayerTree);
  const activeScreen = project?.screens.find((screen) => screen.id === activeScreenId) ?? null;

  const [hoverRect, setHoverRect] = useState<Rect | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const pending = useRef(new Map<number, (hit: HitResult | null) => void>());
  const pendingLayerTree = useRef(new Map<number, (tree: LayerSnapshotNode | null) => void>());
  const nextRequestId = useRef(1);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as Partial<
        BridgeResultEvent | BridgeLayersResultEvent | BridgeLayersChangedEvent
      > | null;
      if (!data) return;
      if (data.type === 'sber-designer:hit-test-result') {
        if (typeof data.requestId !== 'number') return;
        const resolve = pending.current.get(data.requestId);
        if (!resolve) return;
        pending.current.delete(data.requestId);
        resolve(data.hit ?? null);
        return;
      }
      if (data.type === 'sber-designer:layers-result') {
        if (typeof data.requestId !== 'number') return;
        const resolve = pendingLayerTree.current.get(data.requestId);
        if (!resolve) return;
        pendingLayerTree.current.delete(data.requestId);
        resolve(data.tree ?? null);
        return;
      }
      if (data.type === 'sber-designer:layers-changed') {
        setLayerTree(normalizeLayerTree(data.tree ?? null, { activeScreen }));
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      pending.current.clear();
      pendingLayerTree.current.clear();
    };
  }, [
    activeScreen?.filePath,
    activeScreen?.implementationFilePath,
    activeScreen?.id,
    setLayerTree,
  ]);

  const hitAt = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>): Promise<HitResult | null> => {
      const overlay = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - overlay.left;
      const y = e.clientY - overlay.top;
      const iframe = iframeRef.current;
      if (!iframe) return null;

      try {
        const doc = iframe.contentDocument;
        if (doc) {
          const hit = sourceAt(doc, x, y);
          if (hit) {
            const rect = toRect(hit.element.getBoundingClientRect());
            const inspectId = ensureInspectId(hit.element);
            return {
              tagName: hit.element.tagName,
              loc: hit.loc,
              sourceKind: hit.sourceKind,
              domPath: hit.domPath,
              rect,
              inspectId,
              computedStyles: computedStyleSnapshot(hit.element),
              ...(hit.componentPath ? { componentPath: hit.componentPath } : {}),
              ...(hit.componentName ? { componentName: hit.componentName } : {}),
              ...(hit.componentLoc ? { componentLoc: hit.componentLoc } : {}),
              ...(hit.selectionNotice ? { selectionNotice: hit.selectionNotice } : {}),
              ...describeElement(hit.element),
            };
          }
        }
      } catch {
        // Cross-origin iframe: use the injected postMessage bridge below.
      }

      return hitAtViaBridge(iframe, x, y, nextRequestId, pending);
    },
    [iframeRef],
  );

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const overlay = e.currentTarget.getBoundingClientRect();
      setHoverPoint({
        x: e.clientX - overlay.left,
        y: e.clientY - overlay.top,
      });
      void hitAt(e).then((hit) => {
        if (!hit) {
          setHoverRect(null);
          setHoverLabel(null);
          return;
        }
        setHoverRect(toPlainRect(hit.rect));
        setHoverLabel(`${hit.tagName.toLowerCase()} @ ${formatLoc(hit.loc)}`);
      });
    },
    [hitAt],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      void hitAt(e).then((hit) => {
        if (!hit) {
          setSelected(null);
          return;
        }
        const loc = formatLoc(hit.loc);
        const identity = hit.selector ?? hit.text ?? loc;
        const selectedIdentity = selected?.selector ?? selected?.text ?? selected?.loc;
        if (
          selected?.loc === loc &&
          selected.tagName === hit.tagName &&
          selectedIdentity === identity
        ) {
          setSelected(null);
          return;
        }
        const attrs = hit.attributes ?? {};
        const node: SelectedNode = {
          loc,
          sourceKind: hit.sourceKind ?? inferSourceKind(loc),
          ...(hit.domPath ? { domPath: hit.domPath } : {}),
          ...(hit.componentPath ? { componentPath: hit.componentPath } : {}),
          tagName: hit.tagName,
          rect: toPlainRect(hit.rect),
          ...(hit.text ? { text: hit.text } : {}),
          ...(hit.selector ? { selector: hit.selector } : {}),
          ...(hit.componentName ? { componentName: hit.componentName } : {}),
          ...(hit.componentLoc ? { componentLoc: formatLoc(hit.componentLoc) } : {}),
          ...(Object.keys(attrs).length > 0 ? { attributes: attrs } : {}),
          ...(hit.selectionNotice ? { selectionNotice: hit.selectionNotice } : {}),
          ...(hit.inspectId ? { inspectId: hit.inspectId } : {}),
          ...(hit.computedStyles ? { computedStyles: hit.computedStyles } : {}),
        };
        setSelected(node);
      });
    },
    [hitAt, selected?.loc, selected?.tagName, setSelected],
  );

  useEffect(() => {
    let cancelled = false;
    let cleanupObserver: (() => void) | null = null;
    const iframe = iframeRef.current;
    const applySnapshot = (snapshot: LayerSnapshotNode | null) => {
      if (!cancelled) {
        setLayerTree(normalizeLayerTree(snapshot, { activeScreen }));
      }
    };
    const sync = async () => {
      cleanupObserver?.();
      cleanupObserver = null;
      if (cancelled) return;
      const iframe = iframeRef.current;
      if (!iframe) {
        applySnapshot(null);
        return;
      }
      const bridgeSnapshot = await requestLayerTreeViaBridge(
        iframe,
        nextRequestId,
        pendingLayerTree,
      );
      if (cancelled) return;
      if (bridgeSnapshot) {
        applySnapshot(bridgeSnapshot);
        return;
      }
      try {
        const doc = iframe.contentDocument;
        if (!doc) {
          applySnapshot(null);
          return;
        }
        applySnapshot(buildLayerSnapshotFromDocument(doc));
        cleanupObserver = observeLayerSnapshots(doc, applySnapshot);
      } catch {
        applySnapshot(null);
      }
    };
    void sync();
    const handleLoad = () => void sync();
    iframe?.addEventListener('load', handleLoad);
    return () => {
      cancelled = true;
      iframe?.removeEventListener('load', handleLoad);
      cleanupObserver?.();
      setLayerTree(null);
    };
  }, [
    activeScreen?.filePath,
    activeScreen?.implementationFilePath,
    activeScreen?.id,
    iframeRef,
    setLayerTree,
  ]);

  const handleLeave = useCallback(() => {
    setHoverRect(null);
    setHoverLabel(null);
    setHoverPoint(null);
  }, []);

  return (
    <div
      className="absolute inset-0 z-10 cursor-crosshair"
      onClick={handleClick}
      onMouseLeave={handleLeave}
      onMouseMove={handleMove}
    >
      {hoverRect && (
        <Outline
          rect={hoverRect}
          stroke={variant === 'code' ? 'oklch(0.72 0.2 315 / 0.58)' : 'oklch(0.7 0.18 259 / 0.55)'}
          fill={variant === 'code' ? 'oklch(0.72 0.2 315 / 0.08)' : 'oklch(0.7 0.18 259 / 0.08)'}
          label={hoverLabel}
          variant={variant}
        />
      )}
      {selected && (
        <Outline
          rect={selected.rect}
          stroke={variant === 'code' ? 'oklch(0.72 0.2 315 / 1)' : 'oklch(0.7 0.18 259 / 1)'}
          fill="transparent"
          label={`${selected.componentName ?? selected.tagName.toLowerCase()} @ ${
            selected.selector ?? selected.loc
          }`}
          strokeWidth={2}
          variant={variant}
        />
      )}
      {hoverPoint && <CursorMarker point={hoverPoint} variant={variant} />}
    </div>
  );
}

function describeElement(
  element: HTMLElement,
): Pick<HitResult, 'attributes' | 'selector' | 'text'> {
  const attributes = selectedAttributes(element);
  const text = normalizeText(element.innerText || element.textContent || '');
  const selector = preferredSelector(element, attributes);
  return {
    ...(text ? { text } : {}),
    ...(selector ? { selector } : {}),
    ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
  };
}

function toRect(rect: DOMRect): Rect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function requestLayerTreeViaBridge(
  iframe: HTMLIFrameElement,
  nextRequestId: MutableRefObject<number>,
  pendingLayerTree: MutableRefObject<Map<number, (tree: LayerSnapshotNode | null) => void>>,
): Promise<LayerSnapshotNode | null> {
  const target = iframe.contentWindow;
  if (!target) return Promise.resolve(null);
  const requestId = nextRequestId.current++;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      pendingLayerTree.current.delete(requestId);
      resolve(null);
    }, 700);
    pendingLayerTree.current.set(requestId, (tree) => {
      window.clearTimeout(timer);
      resolve(tree);
    });
    target.postMessage({ type: 'sber-designer:list-layers', requestId }, '*');
  });
}

function observeLayerSnapshots(
  doc: Document,
  onSnapshot: (snapshot: LayerSnapshotNode | null) => void,
): () => void {
  const target = doc.body ?? doc.documentElement;
  if (!target || typeof MutationObserver === 'undefined') return () => {};
  let raf: number | null = null;
  const schedule = () => {
    if (raf !== null) return;
    raf = window.requestAnimationFrame(() => {
      raf = null;
      onSnapshot(buildLayerSnapshotFromDocument(doc));
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(target, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
  });
  return () => {
    if (raf !== null) window.cancelAnimationFrame(raf);
    observer.disconnect();
  };
}

function toPlainRect(rect: Rect): Rect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

let sameOriginInspectSequence = 1;

function ensureInspectId(element: HTMLElement): string {
  const existing = element.getAttribute('data-sd-inspect-id');
  if (existing) return existing;
  const next = `sd-inspect-${sameOriginInspectSequence++}`;
  element.setAttribute('data-sd-inspect-id', next);
  return next;
}

function computedStyleSnapshot(element: HTMLElement): LiveInspectStyles {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style) return {};
  const snapshot: LiveInspectStyles = {};
  for (const property of LIVE_INSPECT_STYLE_PROPERTIES) {
    const value = style[property];
    if (typeof value === 'string' && value) {
      snapshot[property] = value;
    }
  }
  return snapshot;
}

function selectedAttributes(element: HTMLElement): Record<string, string> {
  const names = [
    'data-sd-flow-id',
    'data-sd-label',
    'data-sd-nav-group',
    'data-testid',
    'id',
    'href',
    'aria-label',
    'role',
  ];
  const attrs: Record<string, string> = {};
  for (const name of names) {
    const value = element.getAttribute(name);
    if (name === 'data-testid' && !isUsableDomTestId(value)) continue;
    if (value) attrs[name] = value;
  }
  return attrs;
}

function preferredSelector(element: HTMLElement, attrs: Record<string, string>): string | null {
  const tag = element.tagName.toLowerCase();
  if (attrs['data-sd-flow-id']) {
    return `[data-sd-flow-id="${escapeCssString(attrs['data-sd-flow-id'])}"]`;
  }
  if (attrs.id) return `#${escapeCssIdent(attrs.id)}`;
  if (attrs['data-testid']) {
    return `[data-testid="${escapeCssString(attrs['data-testid'])}"]`;
  }
  if (attrs['aria-label']) {
    return `${tag}[aria-label="${escapeCssString(attrs['aria-label'])}"]`;
  }
  return null;
}

function inferSourceKind(loc: string): SourceKind {
  if (loc.startsWith('dom://')) return 'dom-fallback';
  return 'react-source';
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeCssIdent(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

function hitAtViaBridge(
  iframe: HTMLIFrameElement,
  x: number,
  y: number,
  nextRequestId: MutableRefObject<number>,
  pending: MutableRefObject<Map<number, (hit: HitResult | null) => void>>,
): Promise<HitResult | null> {
  const target = iframe.contentWindow;
  if (!target) return Promise.resolve(null);
  const requestId = nextRequestId.current++;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      pending.current.delete(requestId);
      resolve(null);
    }, 700);
    pending.current.set(requestId, (hit) => {
      window.clearTimeout(timer);
      resolve(hit);
    });
    target.postMessage({ type: 'sber-designer:hit-test', requestId, x, y }, '*');
  });
}

function Outline({
  rect,
  stroke,
  fill,
  label,
  strokeWidth = 1.5,
  variant = 'design',
}: {
  rect: Rect;
  stroke: string;
  fill: string;
  label: string | null;
  strokeWidth?: number;
  variant?: 'design' | 'code';
}) {
  return (
    <>
      <div
        className="absolute"
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          outline: `${strokeWidth}px solid ${stroke}`,
          outlineOffset: -1,
          background: fill,
        }}
      />
      {label && (
        <div
          className="absolute rounded px-1.5 py-0.5 font-mono text-[10px] leading-tight text-primary-foreground shadow"
          style={{
            left: `clamp(4px, ${rect.x}px, calc(100% - 328px))`,
            top: Math.max(0, rect.y - 18),
            maxWidth: 320,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            background: 'oklch(0.623 0.214 259 / 0.84)',
            ...(variant === 'code' ? { background: 'oklch(0.62 0.22 315 / 0.86)' } : {}),
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
          }}
          title={label}
        >
          {label}
        </div>
      )}
    </>
  );
}

function CursorMarker({
  point,
  variant = 'design',
}: {
  point: Point;
  variant?: 'design' | 'code';
}) {
  const background =
    variant === 'code' ? 'oklch(0.62 0.22 315 / 0.84)' : 'oklch(0.623 0.214 259 / 0.82)';
  const shadow =
    variant === 'code'
      ? '0 0 0 3px oklch(0.62 0.22 315 / 0.24)'
      : '0 0 0 3px oklch(0.623 0.214 259 / 0.24)';
  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left: point.x,
        top: point.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className="h-2.5 w-2.5 rounded-full border border-primary-foreground shadow"
        style={{
          background,
          boxShadow: shadow,
        }}
      />
    </div>
  );
}

// Keep this re-export so dom-source consumers outside the overlay can pull it.
export type { SourceLoc };
