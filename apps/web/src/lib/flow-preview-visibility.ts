export interface FlowPreviewNodeRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlowPreviewViewport {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
  buffer?: number;
}

export function livePreviewScreenIds(
  nodes: readonly FlowPreviewNodeRect[],
  viewport: FlowPreviewViewport,
): Set<string> {
  if (viewport.width <= 0 || viewport.height <= 0 || viewport.zoom <= 0) {
    return new Set(nodes.map((node) => node.id));
  }

  const buffer = viewport.buffer ?? 240;
  const left = -viewport.x / viewport.zoom - buffer;
  const top = -viewport.y / viewport.zoom - buffer;
  const right = (viewport.width - viewport.x) / viewport.zoom + buffer;
  const bottom = (viewport.height - viewport.y) / viewport.zoom + buffer;

  return new Set(
    nodes
      .filter((node) =>
        rectanglesIntersect(
          { left: node.x, top: node.y, right: node.x + node.width, bottom: node.y + node.height },
          { left, top, right, bottom },
        ),
      )
      .map((node) => node.id),
  );
}

function rectanglesIntersect(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}
