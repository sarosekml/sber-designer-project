import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getGitGraph,
  type GitCommitNode,
  type GitGraphResponse,
  type GitProvider,
} from '@/lib/api-client';
import { openSourceControl } from '@/lib/git-events';
import { layoutGraph } from '@/lib/git-graph-layout';
import { cn } from '@/lib/utils';
import { useGitStore } from '@/stores/git-store';
import { GitDiffView } from './git/GitDiffView';

interface GitGraphDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Geometry — mirrors VS Code Git Graph (mhutchie): per-row swim lanes, r=4 dots,
// background-coloured "shadow" under each line for clean crossings, and a
// symmetric cubic bezier (control offset 0.8·rowH) for column transitions.
const GRAPH_LIMIT = 400;
const ROW_H = 30;
const LANE_W = 16;
const DOT_R = 4;
const PAD_X = 12;
const D_ROUND = 0.8 * ROW_H;
const BG = 'hsl(var(--background))';
const MUTED = '#808080';
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

// Min heights kept for each pane while dragging the divider (task 0110).
const MIN_TOP_PX = 160;
const MIN_BOTTOM_PX = 140;

/**
 * Git Graph viewer (task 0096). First-party VS Code Git Graph-style renderer:
 * an SVG swim-lane column (drawn from `git log` parents) aligned with a table
 * of Description / Date / Author / Commit. Rendering techniques adapted from
 * mhutchie/vscode-git-graph (MIT): shadow halos, symmetric per-row beziers,
 * hollow HEAD vertex, and an uncommitted-changes node.
 */
export function GitGraphDialog({ open, onOpenChange }: GitGraphDialogProps) {
  const status = useGitStore((s) => s.status);
  const [graph, setGraph] = useState<GitGraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  // Draggable split between the commit list (top) and the detail pane (bottom).
  // `null` → the detail pane defaults to half the area; a number is a dragged px.
  const splitRef = useRef<HTMLDivElement>(null);
  const [detailHeight, setDetailHeight] = useState<number | null>(null);

  const repoUnavailable = Boolean(status && (!status.isGitRepo || !status.boundaryOk));

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = splitRef.current;
    if (!container) return;
    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const next = Math.min(
        Math.max(rect.bottom - ev.clientY, MIN_BOTTOM_PX),
        rect.height - MIN_TOP_PX,
      );
      setDetailHeight(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    if (!open) {
      setSelectedSha(null);
      setDetailHeight(null);
      return;
    }
    if (repoUnavailable) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getGitGraph({ limit: GRAPH_LIMIT, all: true })
      .then((g) => {
        if (!cancelled) setGraph(g);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, repoUnavailable]);

  const commits = graph?.commits ?? [];
  const layout = useMemo(() => layoutGraph(commits), [commits]);
  const rowIndexBySha = useMemo(() => {
    const m = new Map<string, number>();
    commits.forEach((c, i) => m.set(c.sha, i));
    return m;
  }, [commits]);

  const uncommitted = status?.counts.total ?? 0;
  const hasUncommitted = uncommitted > 0;
  const rowOffset = hasUncommitted ? 1 : 0;

  const graphWidth = PAD_X * 2 + (layout.maxCol + 1) * LANE_W;
  const svgHeight = (commits.length + rowOffset) * ROW_H;
  const gridTemplate = `${graphWidth}px minmax(0,1fr) 168px 128px 76px`;

  const xOf = (col: number) => PAD_X + col * LANE_W + LANE_W / 2;
  const yOf = (row: number) => (row + rowOffset) * ROW_H + ROW_H / 2;

  // One-row column transition from (xa, yTop) to (xb, yTop+ROW_H): a symmetric
  // cubic bezier (control offset 0.8·rowH) for clean rounded lane crossings.
  const trans = (xa: number, xb: number, yTop: number) => {
    const yBot = yTop + ROW_H;
    return `C${xa},${(yTop + D_ROUND).toFixed(1)} ${xb},${(yBot - D_ROUND).toFixed(1)} ${xb},${yBot.toFixed(1)}`;
  };

  const edgePaths = layout.edges.map((edge) => {
    const cx = xOf(edge.childCol);
    const cy = yOf(edge.childRow);
    const laneX = xOf(edge.laneCol);
    const parentRow = rowIndexBySha.get(edge.parent);
    const lockedTop = edge.kind === 'merge';

    if (parentRow === undefined) {
      const d =
        laneX === cx
          ? `M${cx},${cy}L${laneX},${svgHeight}`
          : `M${cx},${cy}${trans(cx, laneX, cy)}L${laneX},${svgHeight}`;
      return { d, color: edge.color };
    }

    const px = xOf(layout.cols[parentRow] ?? 0);
    const py = yOf(parentRow);
    if (cx === laneX && laneX === px) {
      return { d: `M${cx},${cy}L${px},${py}`, color: edge.color };
    }

    let d = `M${cx},${cy}`;
    if (lockedTop) {
      // merge: curve out near the child, then run down the lane to the parent
      d += trans(cx, laneX, cy);
      d += laneX === px ? `L${px},${py}` : `L${laneX},${py - ROW_H}${trans(laneX, px, py - ROW_H)}`;
    } else {
      // continue/converge: run down the lane, curve into the parent at the bottom
      d += `L${laneX},${py - ROW_H}${trans(laneX, px, py - ROW_H)}`;
    }
    return { d, color: edge.color };
  });

  const headIndex = graph?.head ? rowIndexBySha.get(graph.head) : undefined;
  const headCol = headIndex !== undefined ? (layout.cols[headIndex] ?? 0) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100vh-3rem)] w-[calc(100vw-3rem)] max-w-[1200px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-10">
          <DialogTitle>Git Graph</DialogTitle>
          <DialogDescription>
            Commit history for {status?.currentBranch ?? 'this repository'}. Click a commit to see
            its changes.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="shrink-0 break-words border-b border-destructive/40 bg-destructive/10 px-5 py-2 text-xs text-destructive-foreground">
            {error}
          </div>
        )}

        {repoUnavailable ? (
          <Centered>{status?.reason ?? 'Git is unavailable for this workspace.'}</Centered>
        ) : loading && commits.length === 0 ? (
          <Centered>
            <Loader2 className="mr-2 inline size-4 animate-spin" />
            Loading history…
          </Centered>
        ) : commits.length === 0 ? (
          <Centered>No commits to show.</Centered>
        ) : (
          <div ref={splitRef} className="flex min-h-0 flex-1 flex-col">
            <div
              className="grid shrink-0 items-center gap-3 border-b border-border bg-muted/30 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <span>Graph</span>
              <span>Description</span>
              <span>Date</span>
              <span>Author</span>
              <span>Commit</span>
            </div>

            <div className="relative min-h-0 flex-1 overflow-auto">
              <svg
                width={graphWidth}
                height={svgHeight}
                className="pointer-events-none absolute left-4 top-0 z-10"
              >
                {/* shadow halos first (one wide bg stroke per line), then coloured lines on top */}
                {edgePaths.map((edge, i) => (
                  <path
                    key={`s${i}`}
                    d={edge.d}
                    fill="none"
                    stroke={BG}
                    strokeOpacity={0.75}
                    strokeWidth={4}
                  />
                ))}
                {hasUncommitted && headIndex !== undefined && (
                  <path
                    d={`M${xOf(headCol)},${ROW_H / 2}L${xOf(headCol)},${yOf(headIndex)}`}
                    fill="none"
                    stroke={BG}
                    strokeOpacity={0.75}
                    strokeWidth={4}
                  />
                )}
                {edgePaths.map((edge, i) => (
                  <path key={`l${i}`} d={edge.d} fill="none" stroke={edge.color} strokeWidth={2} />
                ))}
                {hasUncommitted && headIndex !== undefined && (
                  <path
                    d={`M${xOf(headCol)},${ROW_H / 2}L${xOf(headCol)},${yOf(headIndex)}`}
                    fill="none"
                    stroke={MUTED}
                    strokeWidth={2}
                    strokeDasharray="2 2"
                  />
                )}

                {/* vertices */}
                {hasUncommitted && (
                  <circle
                    cx={xOf(headCol)}
                    cy={ROW_H / 2}
                    r={DOT_R}
                    fill={BG}
                    stroke={MUTED}
                    strokeWidth={2}
                  />
                )}
                {commits.map((commit, i) => {
                  const isHead = graph?.head === commit.sha;
                  const color = layout.colors[i] ?? '#3b82f6';
                  return isHead ? (
                    <circle
                      key={commit.sha}
                      cx={xOf(layout.cols[i] ?? 0)}
                      cy={yOf(i)}
                      r={DOT_R}
                      fill={BG}
                      stroke={color}
                      strokeWidth={2}
                    />
                  ) : (
                    <circle
                      key={commit.sha}
                      cx={xOf(layout.cols[i] ?? 0)}
                      cy={yOf(i)}
                      r={DOT_R}
                      fill={color}
                      stroke={BG}
                      strokeWidth={1}
                      strokeOpacity={0.75}
                    />
                  );
                })}
              </svg>

              <div>
                {hasUncommitted && (
                  <button
                    type="button"
                    onClick={() => openSourceControl('changes')}
                    className="grid w-full items-center gap-3 px-4 text-left transition-colors hover:bg-accent/50"
                    style={{ gridTemplateColumns: gridTemplate, height: ROW_H }}
                    title="Open Source Control"
                  >
                    <span aria-hidden="true" />
                    <span className="truncate text-[13px] italic text-muted-foreground">
                      Uncommitted Changes ({uncommitted})
                    </span>
                    <span className="text-xs text-muted-foreground">*</span>
                    <span className="text-xs text-muted-foreground">*</span>
                    <span className="font-mono text-xs text-muted-foreground">*</span>
                  </button>
                )}
                {commits.map((commit) => (
                  <button
                    type="button"
                    key={commit.sha}
                    onClick={() => setSelectedSha(commit.sha)}
                    className={cn(
                      'grid w-full items-center gap-3 px-4 text-left transition-colors hover:bg-accent/50',
                      selectedSha === commit.sha && 'bg-accent',
                    )}
                    style={{ gridTemplateColumns: gridTemplate, height: ROW_H }}
                  >
                    <span aria-hidden="true" />
                    <span className="flex min-w-0 items-center gap-1.5">
                      {parseRefs(commit.refs).map((ref) => (
                        <RefChip key={ref.label + ref.type} label={ref.label} type={ref.type} />
                      ))}
                      <span className="truncate text-[13px]" title={commit.subject}>
                        {commit.subject}
                      </span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {formatDate(commit.date)}
                    </span>
                    <span
                      className="truncate text-xs text-muted-foreground"
                      title={commit.authorEmail}
                    >
                      {commit.author}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {commit.sha.slice(0, 7)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize commit details"
              onMouseDown={startResize}
              className="group flex h-2 shrink-0 cursor-row-resize items-center justify-center border-t border-border transition-colors hover:border-primary/50"
            >
              <div className="h-1 w-10 rounded-full bg-border transition-colors group-hover:bg-primary/60" />
            </div>

            <div
              className="min-h-0 shrink-0"
              style={{ height: detailHeight !== null ? `${detailHeight}px` : '50%' }}
            >
              <CommitDetail
                commit={selectedSha ? (commits.find((c) => c.sha === selectedSha) ?? null) : null}
                provider={status?.provider}
                remoteUrl={status?.remoteUrl ?? null}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CommitDetail({
  commit,
  provider,
  remoteUrl,
}: {
  commit: GitCommitNode | null;
  provider: GitProvider | undefined;
  remoteUrl: string | null;
}) {
  const [copied, setCopied] = useState(false);

  if (!commit) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Select a commit to see its changes.
      </div>
    );
  }

  const webUrl = buildCommitWebUrl(provider, remoteUrl, commit.sha);
  const copy = () => {
    void navigator.clipboard.writeText(commit.sha).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden px-5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium" title={commit.subject}>
            {commit.subject}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="font-mono">{commit.sha.slice(0, 10)}</span>
            <span>·</span>
            <span>{commit.author}</span>
            <span>·</span>
            <span>{formatDate(commit.date)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={copy} title="Copy full SHA">
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'SHA'}
          </Button>
          {webUrl && (
            <a
              href={webUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-accent"
              title="Open commit on remote"
            >
              Open <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-background/40">
        <GitDiffView base={commit.parents[0] ?? EMPTY_TREE} head={commit.sha} />
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

type RefType = 'head' | 'branch' | 'remote' | 'tag';

function parseRefs(refs: string[]): { label: string; type: RefType }[] {
  const out: { label: string; type: RefType }[] = [];
  for (const ref of refs) {
    if (ref.endsWith('/HEAD')) continue;
    if (ref.startsWith('HEAD -> ')) out.push({ label: ref.slice(8), type: 'head' });
    else if (ref === 'HEAD') out.push({ label: 'HEAD', type: 'head' });
    else if (ref.startsWith('tag: ')) out.push({ label: ref.slice(5), type: 'tag' });
    else if (ref.includes('/')) out.push({ label: ref, type: 'remote' });
    else out.push({ label: ref, type: 'branch' });
  }
  return out;
}

function RefChip({ label, type }: { label: string; type: RefType }) {
  const styles: Record<RefType, string> = {
    head: 'border-success/40 bg-success/15 text-success',
    branch: 'border-primary/40 bg-primary/10 text-primary',
    remote: 'border-border bg-muted/50 text-muted-foreground',
    tag: 'border-warning/40 bg-warning/15 text-warning',
  };
  return (
    <Badge
      variant="outline"
      className={cn('shrink-0 px-1.5 py-0 text-[10px] font-medium', styles[type])}
      title={type === 'tag' ? `tag: ${label}` : label}
    >
      {label}
    </Badge>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildCommitWebUrl(
  provider: GitProvider | undefined,
  remoteUrl: string | null,
  sha: string,
): string | null {
  if (!provider || !remoteUrl) return null;
  const parsed = parseOwnerRepo(remoteUrl);
  if (!parsed) return null;
  switch (provider) {
    case 'github':
      return `${parsed.origin}/${parsed.ownerRepo}/commit/${sha}`;
    case 'gitlab':
      return `${parsed.origin}/${parsed.ownerRepo}/-/commit/${sha}`;
    case 'bitbucket':
      return `${parsed.origin}/${parsed.ownerRepo}/commits/${sha}`;
    default:
      return null;
  }
}

function parseOwnerRepo(remoteUrl: string): { origin: string; ownerRepo: string } | null {
  const ssh = /^git@([^:]+):(.+?)(?:\.git)?$/.exec(remoteUrl);
  const https = /^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/.exec(remoteUrl);
  const sshUrl = /^ssh:\/\/git@([^:/]+)(?::\d+)?\/(.+?)(?:\.git)?$/.exec(remoteUrl);
  const m = ssh ?? https ?? sshUrl;
  if (!m || !m[1] || !m[2]) return null;
  return { origin: `https://${m[1]}`, ownerRepo: m[2] };
}
