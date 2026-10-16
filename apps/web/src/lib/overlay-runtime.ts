/**
 * Overlay flow runtime (0132.2). Pure activation model shared by the three
 * players (Interact canvas, Demo, Share). Keeps the "one overlay at a time,
 * replace-not-stack" rule (Р-6) and the underlay-aware Cancel resolution
 * (Р-19) out of the components so it can be tested directly.
 */
import type { ProjectFlowEdge, ProjectScreen } from '@sber-designer/shared-types';

import { resolveEdgePresentation, type FlowTargetScreenLike } from './flow-runtime';

export type OverlayAction =
  /** Open the target as a modal overlay above the current underlay. */
  | { kind: 'open-overlay'; screenId: string }
  /** Swap the currently open overlay for a new one (no stacking). */
  | { kind: 'replace-overlay'; screenId: string }
  /** Dismiss the overlay, keeping the underlay as-is. */
  | { kind: 'close-overlay' }
  /** Navigate the base/underlay screen (no overlay involved). */
  | { kind: 'navigate'; screenId: string }
  /** Dismiss the overlay and navigate the underlay to a different screen. */
  | { kind: 'navigate-and-close'; screenId: string };

export function shouldCloseStaleOverlay(
  openedFromScreenId: string | null,
  activeScreenId: string | null,
): boolean {
  return openedFromScreenId !== null && openedFromScreenId !== activeScreenId;
}

/** The two outcomes an edge from the underlay can produce. */
export type BaseEdgeActivation =
  | { kind: 'open-overlay'; screenId: string }
  | { kind: 'navigate'; screenId: string };

function targetScreen(
  screens: readonly ProjectScreen[],
  toScreenId: string,
): FlowTargetScreenLike | undefined {
  return screens.find((screen) => screen.id === toScreenId);
}

/**
 * Activation of an edge whose source is the underlay (base) screen. An edge
 * into a modal (or an explicit `overlay`) opens the overlay; anything else
 * navigates the base screen.
 */
export function resolveBaseEdgeActivation(
  edge: ProjectFlowEdge,
  screens: readonly ProjectScreen[],
): BaseEdgeActivation {
  if (resolveEdgePresentation(edge, targetScreen(screens, edge.toScreenId)) === 'overlay') {
    return { kind: 'open-overlay', screenId: edge.toScreenId };
  }
  return { kind: 'navigate', screenId: edge.toScreenId };
}

/**
 * Activation of an edge whose source is the currently open overlay (modal).
 * A modal→modal overlay edge replaces (never stacks); a `navigate` back to the
 * underlay just closes; any other navigate closes and moves the underlay.
 */
export function resolveOverlayEdgeActivation(
  edge: ProjectFlowEdge,
  screens: readonly ProjectScreen[],
  underlayScreenId: string | null,
): OverlayAction {
  if (resolveEdgePresentation(edge, targetScreen(screens, edge.toScreenId)) === 'overlay') {
    return { kind: 'replace-overlay', screenId: edge.toScreenId };
  }
  if (underlayScreenId && edge.toScreenId === underlayScreenId) {
    return { kind: 'close-overlay' };
  }
  return { kind: 'navigate-and-close', screenId: edge.toScreenId };
}
