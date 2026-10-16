import type { ProjectFlowEdge, ProjectScreen } from '@sber-designer/shared-types';

export const FLOW_HANDLES = {
  sourceLeft: 'source-left',
  sourceRight: 'source-right',
  targetLeft: 'target-left',
  targetRight: 'target-right',
} as const;

export interface FlowConnectionInput {
  source?: string | null;
  target?: string | null;
}

export interface FlowEdgeHandles {
  sourceHandle: string;
  targetHandle: string;
}

export function createFlowEdgeFromConnection(
  connection: FlowConnectionInput,
  existingEdges: readonly ProjectFlowEdge[],
  now = Date.now(),
): ProjectFlowEdge | null {
  if (!connection.source || !connection.target) return null;
  const baseId = `flow-${now}-${connection.source}-${connection.target}`;
  const id = uniqueFlowEdgeId(baseId, existingEdges);
  return {
    id,
    fromScreenId: connection.source,
    toScreenId: connection.target,
    trigger: { kind: 'click' },
  };
}

export function outgoingFlowEdges(
  edges: readonly ProjectFlowEdge[],
  screenId: string | null | undefined,
): ProjectFlowEdge[] {
  if (!screenId) return [];
  return edges.filter((edge) => edge.fromScreenId === screenId);
}

export function flowEdgeHandles(
  edge: Pick<ProjectFlowEdge, 'fromScreenId' | 'toScreenId'>,
  screens: readonly ProjectScreen[],
): FlowEdgeHandles {
  const sourceX = screenOrderX(edge.fromScreenId, screens);
  const targetX = screenOrderX(edge.toScreenId, screens);
  const forward = sourceX <= targetX;
  return forward
    ? { sourceHandle: FLOW_HANDLES.sourceRight, targetHandle: FLOW_HANDLES.targetLeft }
    : { sourceHandle: FLOW_HANDLES.sourceLeft, targetHandle: FLOW_HANDLES.targetRight };
}

function uniqueFlowEdgeId(baseId: string, edges: readonly ProjectFlowEdge[]): string {
  if (!edges.some((edge) => edge.id === baseId)) return baseId;
  let index = 2;
  while (edges.some((edge) => edge.id === `${baseId}-${index}`)) {
    index += 1;
  }
  return `${baseId}-${index}`;
}

function screenOrderX(screenId: string, screens: readonly ProjectScreen[]): number {
  const index = screens.findIndex((screen) => screen.id === screenId);
  if (index < 0) return Number.MAX_SAFE_INTEGER;
  return screens[index]?.position?.x ?? index;
}

/**
 * 0138 C1: controlled node selection. `activeScreenId` is the single source
 * of screen selection (sidebar clicks and Flow clicks alike), so every node's
 * `selected` flag is derived from it — React Flow's transient selection would
 * be wiped the next time nodes are rebuilt from project state.
 */
export function applyFlowNodeSelection<T extends { id: string }>(
  nodes: readonly T[],
  activeScreenId: string | null,
): (T & { selected: boolean })[] {
  return nodes.map((node) => ({ ...node, selected: node.id === activeScreenId }));
}
