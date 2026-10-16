import type { ProjectFlowEdge, ProjectScreenSurface } from '@sber-designer/shared-types';
import { screenSurface } from '@sber-designer/shared-types';

/** Minimal shape needed to resolve an edge's default presentation from its target. */
export type FlowTargetScreenLike = { surface?: ProjectScreenSurface | undefined };

export type FlowRuntimeBridgeEdge = {
  id: string;
  toScreenId: string;
  trigger: { kind: 'click'; selector?: string; label?: string } | { kind: 'link'; href: string };
};

export type FlowTargetElement = {
  closest: (selector: string) => unknown;
  textContent: string | null;
};

/**
 * When several edges match the same trigger (a modal reused from multiple
 * screens sharing one `Cancel` selector/label, Р-19), prefer the edge whose
 * target is `preferToScreenId` — the current underlay — so Cancel returns to
 * the screen that opened the modal. Falls back to the first match otherwise.
 */
function pickPreferredEdge(
  matches: readonly ProjectFlowEdge[],
  preferToScreenId?: string | null,
): ProjectFlowEdge | undefined {
  if (matches.length === 0) return undefined;
  if (preferToScreenId) {
    const preferred = matches.find((edge) => edge.toScreenId === preferToScreenId);
    if (preferred) return preferred;
  }
  return matches[0];
}

export function matchLinkEdge(
  edges: readonly ProjectFlowEdge[],
  href: string,
  preferToScreenId?: string | null,
): ProjectFlowEdge | undefined {
  if (!href) return undefined;
  const actual = normalizeFlowHref(href);
  if (!actual) return undefined;
  const matches = edges.filter((edge) => {
    if (edge.trigger.kind !== 'link') return false;
    const expected = normalizeFlowHref(edge.trigger.href);
    if (!expected) return false;
    if (expected === actual) return true;
    if (actual.endsWith(`/${expected}`) || expected.endsWith(`/${actual}`)) return true;
    if (isHtmlLikeHref(actual) && isHtmlLikeHref(expected)) {
      return hrefBasename(actual) === hrefBasename(expected);
    }
    return false;
  });
  return pickPreferredEdge(matches, preferToScreenId);
}

export function matchClickEdge(
  edges: readonly ProjectFlowEdge[],
  target: FlowTargetElement,
  preferToScreenId?: string | null,
): ProjectFlowEdge | undefined {
  const selectorMatches = edges.filter((edge) => {
    if (edge.trigger.kind !== 'click' || !edge.trigger.selector) return false;
    try {
      return Boolean(target.closest(edge.trigger.selector));
    } catch {
      return false;
    }
  });
  const selectorMatch = pickPreferredEdge(selectorMatches, preferToScreenId);
  if (selectorMatch) return selectorMatch;

  const text = normalizeFlowText(target.textContent ?? '');
  if (!text) return undefined;
  const labelMatches = edges.filter((edge) => {
    if (edge.trigger.kind !== 'click' || !edge.trigger.label) return false;
    return normalizeFlowText(edge.trigger.label) === text;
  });
  return pickPreferredEdge(labelMatches, preferToScreenId);
}

export function isExecutableEdge(edge: ProjectFlowEdge): boolean {
  switch (edge.trigger.kind) {
    case 'click':
      return Boolean(edge.trigger.selector?.trim() || edge.trigger.label?.trim());
    case 'link':
      return edge.trigger.href.trim().length > 0;
    case 'on-mount':
      return true;
    case 'manual':
      return false;
  }
}

/**
 * Resolve how an edge presents its target (Р-5). An explicit `edge.presentation`
 * (including `navigate`) always wins as an override; otherwise the default is
 * derived from the target screen's surface — `modal` → `overlay`, else
 * `navigate`. Pass the target so converting a screen page↔modal flips the
 * default of edges that never set an override.
 */
export function resolveEdgePresentation(
  edge: ProjectFlowEdge,
  target?: FlowTargetScreenLike | null,
): 'navigate' | 'overlay' {
  if (edge.presentation) return edge.presentation;
  return screenSurface(target) === 'modal' ? 'overlay' : 'navigate';
}

/** Override-only reader (no target). Prefer {@link resolveEdgePresentation}. */
export function edgePresentation(edge: ProjectFlowEdge): 'navigate' | 'overlay' {
  return edge.presentation ?? 'navigate';
}

export function edgeTargetMode(
  edge: ProjectFlowEdge,
  target?: FlowTargetScreenLike | null,
): 'diagram' | 'setup' | 'navigate' | 'overlay' {
  if (edge.trigger.kind === 'manual') return 'diagram';
  if (!isExecutableEdge(edge)) return 'setup';
  return resolveEdgePresentation(edge, target);
}

export function flowEdgeDisplayLabel(edge: ProjectFlowEdge): string {
  if (edge.label?.trim()) return edge.label.trim();
  switch (edge.trigger.kind) {
    case 'click':
      return edge.trigger.label ? `click "${edge.trigger.label}"` : 'click';
    case 'link':
      return `link ${edge.trigger.href}`;
    case 'on-mount':
      return 'auto redirect';
    case 'manual':
      return edge.trigger.label ?? 'diagram note';
  }
}

export function transitionStatusLabel(
  edge: ProjectFlowEdge,
  target?: FlowTargetScreenLike | null,
): string {
  switch (edgeTargetMode(edge, target)) {
    case 'overlay':
      return 'Overlay';
    case 'navigate':
      return 'Runs in Interact + Demo';
    case 'setup':
      return 'Needs setup';
    case 'diagram':
      return 'Diagram only';
  }
}

export function bridgeRuntimeEdges(edges: readonly ProjectFlowEdge[]): FlowRuntimeBridgeEdge[] {
  return edges.flatMap((edge) => {
    if (!isExecutableEdge(edge)) return [];
    switch (edge.trigger.kind) {
      case 'click': {
        const runtimeEdge: FlowRuntimeBridgeEdge = {
          id: edge.id,
          toScreenId: edge.toScreenId,
          trigger: edge.trigger,
        };
        return [runtimeEdge];
      }
      case 'link': {
        const runtimeEdge: FlowRuntimeBridgeEdge = {
          id: edge.id,
          toScreenId: edge.toScreenId,
          trigger: edge.trigger,
        };
        return [runtimeEdge];
      }
      case 'on-mount':
      case 'manual':
        return [];
    }
  });
}

/**
 * Save an edge edit without collapsing an explicit presentation override into
 * the current target-derived default. `undefined` means the user never chose a
 * presentation and the edge should keep following its target surface.
 */
export function updateFlowEdgeSettings(
  edge: ProjectFlowEdge,
  input: {
    trigger: ProjectFlowEdge['trigger'];
    label?: string;
    presentationOverride?: 'navigate' | 'overlay';
  },
): ProjectFlowEdge {
  const { label: _label, presentation: _presentation, ...rest } = edge;
  void _label;
  void _presentation;
  const label = input.label?.trim();
  return {
    ...rest,
    trigger: input.trigger,
    ...(label ? { label } : {}),
    ...(input.presentationOverride ? { presentation: input.presentationOverride } : {}),
  };
}

function normalizeFlowText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeFlowHref(value: string): string {
  let href = value.trim();
  if (!href) return '';
  if (/^[a-z][a-z0-9+.-]*:/iu.test(href)) {
    try {
      href = new URL(href).pathname;
    } catch {
      // Keep the original value and fall through to path normalization.
    }
  }
  href = href.split('#')[0]?.split('?')[0] ?? '';
  return href
    .replace(/\\/gu, '/')
    .replace(/^\.\//u, '')
    .replace(/^\/+/u, '')
    .replace(/^(?:\.\.\/)+/u, '')
    .trim();
}

function isHtmlLikeHref(value: string): boolean {
  return /\.html?$/iu.test(value);
}

function hrefBasename(value: string): string {
  return value.split('/').filter(Boolean).at(-1) ?? value;
}
