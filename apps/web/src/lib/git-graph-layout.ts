import type { GitCommitNode } from '@/lib/api-client';

/**
 * Swim-lane layout for the Git Graph viewer (task 0096). Assigns each commit a
 * column and records the edges to its parents, VS Code Git Graph style. Pure
 * and synchronous so it can be unit-tested without the DOM.
 *
 * Commits must be in `git log --date-order` order (parents appear below their
 * children). The renderer turns columns + edges into SVG dots and curves.
 */
export const LANE_COLORS = [
  '#3b82f6',
  '#ec4899',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
  '#14b8a6',
  '#a855f7',
  '#eab308',
];

export function laneColor(index: number): string {
  const i = ((index % LANE_COLORS.length) + LANE_COLORS.length) % LANE_COLORS.length;
  return LANE_COLORS[i] ?? '#3b82f6';
}

export interface GraphEdge {
  childRow: number;
  childCol: number;
  /** Column the edge runs in for its vertical span. */
  laneCol: number;
  parent: string;
  color: string;
  /** 'merge' curves near the child (new lane); 'continue' curves near the parent. */
  kind: 'continue' | 'merge';
}

export interface GraphLayout {
  cols: number[];
  colors: string[];
  edges: GraphEdge[];
  maxCol: number;
}

export function layoutGraph(commits: GitCommitNode[]): GraphLayout {
  const cols: number[] = Array.from({ length: commits.length }, () => 0);
  const colors: string[] = Array.from({ length: commits.length }, () => laneColor(0));
  const edges: GraphEdge[] = [];

  // Each lane tracks the sha it is currently waiting to draw next.
  const lanes: ({ expect: string; color: string } | null)[] = [];

  const firstFree = (): number => {
    const idx = lanes.indexOf(null);
    if (idx >= 0) return idx;
    lanes.push(null);
    return lanes.length - 1;
  };

  commits.forEach((commit, i) => {
    // Column = a lane already waiting for this commit, else a fresh lane (a tip).
    let myCol = lanes.findIndex((l) => l?.expect === commit.sha);
    let myColor: string;
    if (myCol === -1) {
      myCol = firstFree();
      myColor = laneColor(myCol);
    } else {
      myColor = lanes[myCol]?.color ?? laneColor(myCol);
    }
    cols[i] = myCol;
    colors[i] = myColor;

    // Free every lane waiting for this commit — they converge here. Their edges
    // were recorded earlier and resolve to (myCol, i) at render time.
    for (let l = 0; l < lanes.length; l++) {
      if (lanes[l]?.expect === commit.sha) lanes[l] = null;
    }

    const parents = commit.parents;
    if (parents.length > 0) {
      // First parent continues straight down in this column.
      const p0 = parents[0]!;
      lanes[myCol] = { expect: p0, color: myColor };
      edges.push({
        childRow: i,
        childCol: myCol,
        laneCol: myCol,
        parent: p0,
        color: myColor,
        kind: 'continue',
      });

      // Extra parents are merges — reuse an existing waiting lane or open a new one.
      for (let k = 1; k < parents.length; k++) {
        const pk = parents[k]!;
        let laneCol = lanes.findIndex((l) => l?.expect === pk);
        let color: string;
        if (laneCol === -1) {
          laneCol = firstFree();
          color = laneColor(laneCol);
          lanes[laneCol] = { expect: pk, color };
        } else {
          color = lanes[laneCol]?.color ?? laneColor(laneCol);
        }
        edges.push({ childRow: i, childCol: myCol, laneCol, parent: pk, color, kind: 'merge' });
      }
    }
  });

  const maxCol = cols.reduce((m, c) => Math.max(m, c), 0);
  return { cols, colors, edges, maxCol };
}
