/**
 * Walk an iframe DOM element to its JSX source location.
 *
 * Strategy (per ADR-0007):
 *   1. React Fiber `_debugSource` (default) — works on any React+Vite/Next/CRA
 *      project in development without a custom Babel plugin, because
 *      @vitejs/plugin-react / Next / CRA all enable
 *      @babel/plugin-transform-react-jsx-source automatically.
 *   2. Fallback to `data-sd-loc="file:line:col"` attribute — used by the
 *      hand-built fixture in apps/web/public/demo-target/, and by Phase-1
 *      Webpack/non-React sandbox flows.
 *
 * Inspired by ericclemmons/click-to-component (MIT).
 */

export interface SourceLoc {
  file: string;
  line: number;
  column: number;
}

export type SourceKind = 'react-source' | 'sd-loc' | 'dom-fallback';

export interface SourceHit {
  element: HTMLElement;
  loc: SourceLoc;
  sourceKind: SourceKind;
  domPath: string;
  componentPath?: string[];
  componentName?: string;
  componentLoc?: SourceLoc;
  selectionNotice?: string;
}

interface MinimalFiber {
  return: MinimalFiber | null;
  _debugSource?: { fileName: string; lineNumber: number; columnNumber?: number } | null;
  _debugOwner?: MinimalFiber | null;
  type?: unknown;
}

/** Resolve the topmost meaningful element with a known source location at a point. */
export function sourceAt(doc: Document, x: number, y: number): SourceHit | null {
  const hit = doc.elementFromPoint(x, y) as HTMLElement | null;
  if (!hit) return null;
  const source = sourceForElement(hit);
  if (source.element === hit || source.sourceKind === 'dom-fallback') return source;
  return {
    ...source,
    selectionNotice: selectionFallbackNotice(hit, source.element),
  };
}

export function sourceForElement(hit: HTMLElement): SourceHit {
  // Try Fiber-based detection first.
  const fiberHit = climbToFiberSource(hit);
  if (fiberHit) return fiberHit;

  // Fallback: explicit data-sd-loc tag (used by demo-target fixture).
  const tagged = hit.closest<HTMLElement>('[data-sd-loc]');
  if (tagged) {
    const raw = tagged.getAttribute('data-sd-loc')!;
    const parsed = parseSdLoc(raw);
    if (parsed) {
      return withComponentBoundary(tagged, {
        element: tagged,
        loc: parsed,
        sourceKind: 'sd-loc',
        domPath: cssPath(tagged),
      });
    }
  }

  return withComponentBoundary(hit, {
    element: hit,
    loc: {
      file: `dom://${cssPath(hit)}`,
      line: 0,
      column: 0,
    },
    sourceKind: 'dom-fallback',
    domPath: cssPath(hit),
  });
}

function climbToFiberSource(start: HTMLElement): SourceHit | null {
  let cur: HTMLElement | null = start;
  while (cur) {
    const fiber = getFiber(cur);
    const src = fiber ? findDebugSource(fiber) : null;
    if (src) {
      return withComponentBoundary(cur, {
        element: cur,
        loc: {
          file: src.fileName,
          line: src.lineNumber,
          column: src.columnNumber ?? 0,
        },
        sourceKind: 'react-source',
        domPath: cssPath(cur),
      });
    }
    cur = cur.parentElement;
  }
  return null;
}

function withComponentBoundary(element: HTMLElement, hit: SourceHit): SourceHit {
  const boundary = componentBoundaryFor(element);
  const componentPath = hit.componentPath ?? componentPathFor(element);
  if (!boundary) {
    return {
      ...hit,
      ...(componentPath.length > 0 ? { componentPath } : {}),
    };
  }
  return {
    ...hit,
    componentName: boundary.name,
    ...(boundary.loc ? { componentLoc: boundary.loc } : {}),
    ...(componentPath.length > 0 ? { componentPath } : {}),
  };
}

function componentBoundaryFor(element: HTMLElement): { name: string; loc?: SourceLoc } | null {
  const parent = getFiber(element)?.return ?? null;
  const name = componentName(parent?.type);
  if (!name) return null;
  const src = parent ? findDebugSource(parent) : null;
  return {
    name,
    ...(src
      ? {
          loc: {
            file: src.fileName,
            line: src.lineNumber,
            column: src.columnNumber ?? 0,
          },
        }
      : {}),
  };
}

function componentName(type: unknown): string | null {
  if (!type) return null;
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name ?? null;
  }
  if (typeof type !== 'object') return null;
  const record = type as {
    displayName?: string;
    name?: string;
    render?: { displayName?: string; name?: string };
    type?: { displayName?: string; name?: string };
  };
  return (
    record.displayName ??
    record.name ??
    record.render?.displayName ??
    record.render?.name ??
    record.type?.displayName ??
    record.type?.name ??
    null
  );
}

function componentPathFor(element: HTMLElement): string[] {
  const path: string[] = [];
  let cur = getFiber(element);
  let safety = 64;
  while (cur && safety-- > 0 && path.length < 12) {
    const name = componentName(cur.type);
    if (name && path[path.length - 1] !== name) path.push(name);
    cur = cur.return ?? null;
  }
  return path;
}

function selectionFallbackNotice(clicked: HTMLElement, selected: HTMLElement): string {
  return `Selected nearest source-backed ancestor ${selected.tagName} because the clicked ${clicked.tagName} has no direct source target.`;
}

function getFiber(node: HTMLElement): MinimalFiber | null {
  // React stores its fiber under a key like __reactFiber$abc123.
  const key = Object.keys(node).find((k) => k.startsWith('__reactFiber$'));
  if (!key) return null;
  return (node as unknown as Record<string, MinimalFiber | undefined>)[key] ?? null;
}

function findDebugSource(fiber: MinimalFiber): MinimalFiber['_debugSource'] | null {
  let cur: MinimalFiber | null = fiber;
  let safety = 64;
  while (cur && safety-- > 0) {
    if (cur._debugSource) return cur._debugSource;
    if (cur._debugOwner?._debugSource) return cur._debugOwner._debugSource;
    cur = cur.return ?? null;
  }
  return null;
}

function parseSdLoc(raw: string): SourceLoc | null {
  // Format: "path/to/file.tsx:LL:CC"
  const m = /^(.+):(\d+):(\d+)$/.exec(raw);
  if (!m) return null;
  return { file: m[1]!, line: Number(m[2]), column: Number(m[3]) };
}

export function formatLoc(loc: SourceLoc): string {
  return `${loc.file}:${loc.line}:${loc.column}`;
}

export function cssPath(element: HTMLElement): string {
  const parts: string[] = [];
  let cur: HTMLElement | null = element;
  while (cur && cur !== cur.ownerDocument.body && parts.length < 6) {
    let part = cur.tagName.toLowerCase();
    if (cur.id) {
      part += `#${cur.id}`;
      parts.unshift(part);
      break;
    }
    const className = Array.from(cur.classList).slice(0, 2).join('.');
    if (className) part += `.${className}`;
    const parent: HTMLElement | null = cur.parentElement;
    if (parent) {
      const tagName = cur.tagName;
      const siblings = Array.from(parent.children).filter((item) => item.tagName === tagName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
    }
    parts.unshift(part);
    cur = parent;
  }
  return parts.join(' > ') || element.tagName.toLowerCase();
}
