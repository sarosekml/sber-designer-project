import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GitBranch,
  GitGraph,
  GitPullRequestArrow,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import { BuildVersionLabel } from '@/components/build-info/BuildVersionLabel';
import { ApiError, syncGitRemote } from '@/lib/api-client';
import { editorFooterLocation } from '@/lib/editor-location';
import { openGitGraph, openSourceControl } from '@/lib/git-events';
import { cn } from '@/lib/utils';
import { useCatalogStore } from '@/stores/catalog-store';
import { useEditorStore } from '@/stores/editor-store';
import { useGitStore } from '@/stores/git-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';

/**
 * VS Code-style status bar (task 0096 → 0110). Always-visible footer: current
 * branch, ahead/behind, connected project path, provider and PR state. Per the
 * 0110 footer directive the two dedicated Git buttons stay — Graph and Send PR
 * — with the uncommitted-change count folded into the Send PR button; the
 * branch chip and Send PR both open the Source Control panel (no ownership,
 * no duplicate entry points). Reads the single git store; never fetches on its
 * own except the ahead/behind Fetch action.
 */
export function StatusBar() {
  const session = useSandboxStore((s) => s.session);
  const status = useGitStore((s) => s.status);
  const setStatus = useGitStore((s) => s.setStatus);
  const canvasView = useEditorStore((s) => s.canvasView);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const activeComponentId = useEditorStore((s) => s.activeComponentId);
  const project = useProjectStore((s) => s.project);
  const catalog = useCatalogStore((s) => s.catalog);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  if (!session) {
    return (
      <footer className="flex h-6 shrink-0 items-center gap-2 border-t border-border bg-card px-3 text-[11px] text-muted-foreground">
        <GitBranch className="size-3 opacity-60" />
        <span>No project connected</span>
        <BuildVersionLabel className="ml-auto" />
      </footer>
    );
  }

  const branch = status?.currentBranch ?? null;
  const prStatus = status?.session?.status;
  const reviewUrl = status?.session?.prUrl ?? status?.session?.compareUrl ?? null;
  const repoReady = Boolean(status?.isGitRepo && status?.boundaryOk);
  const repoUnavailable = Boolean(status && (!status.isGitRepo || !status.boundaryOk));
  const totalChanges = status?.counts.total ?? 0;
  const activeScreen = project?.screens.find((screen) => screen.id === activeScreenId) ?? null;
  const activeComponent =
    catalog?.components.find((component) => component.id === activeComponentId) ?? null;
  const locationPath = editorFooterLocation({
    canvasView,
    activeScreen,
    activeComponent,
    workspacePath: session.workspacePath,
  });

  const handleSync = async (syncToBase: boolean) => {
    if (!status || syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await syncGitRemote({ syncToBase });
      setStatus(res.status);
    } catch (err) {
      setSyncError(
        err instanceof ApiError
          ? `${err.code ?? 'error'}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <footer className="flex h-6 min-w-0 shrink-0 items-center gap-1 border-t border-border bg-card px-2 text-[11px] text-muted-foreground">
      <StatusButton
        onClick={() => openSourceControl('changes')}
        disabled={!repoReady}
        title={
          branch
            ? `Branch ${branch}${status?.baseBranch ? ` · base ${status.baseBranch}` : ''} — open Source Control`
            : 'Open Source Control'
        }
      >
        <GitBranch className="size-3" />
        <span className="max-w-[240px] truncate">{branch ?? 'no branch'}</span>
      </StatusButton>

      {status && (status.ahead > 0 || status.behind > 0) && (
        <StatusButton
          onClick={() => void handleSync(false)}
          disabled={syncing}
          title={`${status.ahead} ahead / ${status.behind} behind origin/${status.baseBranch ?? 'base'} — fetch and refresh`}
        >
          {status.behind > 0 && (
            <span className="inline-flex items-center">
              <ArrowDown className="size-3" />
              {status.behind}
            </span>
          )}
          {status.ahead > 0 && (
            <span className="inline-flex items-center">
              <ArrowUp className="size-3" />
              {status.ahead}
            </span>
          )}
        </StatusButton>
      )}

      <Sep />
      <ProjectLocation locationPath={locationPath} status={session.status} />

      {repoUnavailable && (
        <span
          className="inline-flex items-center gap-1 text-warning"
          title={status?.reason ?? 'Git unavailable'}
        >
          <AlertTriangle className="size-3" />
          {status?.isGitRepo ? 'Open repo root' : 'Not a Git repo'}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        {status?.provider && status.provider !== 'unknown' && (
          <span className="capitalize">{status.provider}</span>
        )}
        {reviewUrl && (
          <a
            href={reviewUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'inline-flex items-center gap-1 hover:underline',
              prStatus === 'merged' ? 'text-success' : 'text-primary',
            )}
            title="Open the pull/merge request"
          >
            {prStatus === 'merged' ? 'Merged' : 'PR open'}
            <ExternalLink className="size-3" />
          </a>
        )}
        {prStatus === 'merged' && (
          <StatusButton
            onClick={() => void handleSync(true)}
            disabled={syncing}
            title={
              syncError ??
              `Fast-forward ${status?.session?.baseBranch ?? 'base'} and clear this session`
            }
          >
            {syncing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Sync to {status?.session?.baseBranch ?? 'base'}
          </StatusButton>
        )}
        <StatusButton onClick={openGitGraph} disabled={!repoReady} title="Open Git Graph">
          <GitGraph className="size-3" />
          Graph
        </StatusButton>
        <StatusButton
          onClick={() => openSourceControl('changes')}
          disabled={!repoReady}
          title={
            totalChanges > 0
              ? `${totalChanges} uncommitted change${totalChanges === 1 ? '' : 's'} — branch + commit + push + PR`
              : 'Branch + commit + push + open PR'
          }
        >
          <GitPullRequestArrow className="size-3" />
          {reviewUrl ? 'Update PR' : 'Send PR'}
          {totalChanges > 0 && <span className="text-warning">· {totalChanges}</span>}
        </StatusButton>
        <Sep />
        <BuildVersionLabel className="px-1" />
      </div>
    </footer>
  );
}

function ProjectLocation({
  locationPath,
  status,
}: {
  locationPath: string;
  status: 'starting' | 'ready' | 'failed' | 'stopped';
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5" title={locationPath}>
      <SessionDot status={status} />
      <span className="min-w-0 truncate">{locationPath}</span>
    </div>
  );
}

function SessionDot({ status }: { status: 'starting' | 'ready' | 'failed' | 'stopped' }) {
  const color =
    status === 'ready'
      ? 'bg-success'
      : status === 'failed'
        ? 'bg-destructive'
        : status === 'starting'
          ? 'bg-warning animate-pulse'
          : 'bg-muted-foreground';
  return <span className={`inline-block size-1.5 shrink-0 rounded-full ${color}`} aria-hidden />;
}

function StatusButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-3 w-px bg-border" aria-hidden="true" />;
}
