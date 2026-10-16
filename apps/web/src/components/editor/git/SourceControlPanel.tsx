import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  GitBranch,
  GitGraph,
  GitPullRequestArrow,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  checkoutGitBranch,
  commitChanges,
  createGitBranch,
  listGitBranches,
  pushWorkingBranch,
  sendPr,
  type GitBranchRef,
  type GitChange,
  type SendPrResult,
} from '@/lib/api/git';
import { openGitGraph } from '@/lib/git-events';
import { cn } from '@/lib/utils';
import { useGitStore } from '@/stores/git-store';
import {
  ChangesList,
  DiffSection,
  NoRepoState,
  PrForm,
  ResultBanner,
  errorMessage,
} from './SourceControlChanges';
import {
  branchNameForMessage,
  deriveSelection,
  isProtectedBranch,
  previewBranchAction,
  selectAllPaths,
} from './source-control-state';

interface SourceControlPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type BranchTargetMode = 'current' | 'existing' | 'new';

/**
 * Source Control panel (task 0110 B3/B4) — the one Git surface, modelled on
 * VS Code SCM. A single list of every uncommitted change (no ownership), a
 * commit box, and an inline PR step. All data comes from the single git store;
 * the panel never fetches on its own except the explicit Refresh button.
 */
export function SourceControlPanel({ open, onOpenChange }: SourceControlPanelProps) {
  const status = useGitStore((s) => s.status);
  const loading = useGitStore((s) => s.loading);
  const refresh = useGitStore((s) => s.refresh);
  const setStatus = useGitStore((s) => s.setStatus);

  const changes = useMemo(() => status?.changes ?? [], [status]);
  // Newline-joined so paths that contain spaces stay intact across re-inits.
  const pathSig = useMemo(() => changes.map((c) => c.path).join('\n'), [changes]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [diffTarget, setDiffTarget] = useState<GitChange | null>(null);
  const [prMode, setPrMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendPrResult | null>(null);
  const [branches, setBranches] = useState<GitBranchRef[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchLoadError, setBranchLoadError] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<BranchTargetMode>('current');
  const [targetBranch, setTargetBranch] = useState('');
  const [newBranchName, setNewBranchName] = useState(() => branchNameForMessage('update'));

  const session = status?.session ?? null;
  const currentBranch = status?.currentBranch ?? null;
  const branch = currentBranch;
  const baseBranch = status?.baseBranch ?? null;
  const hasOpenPr = Boolean(session?.prUrl && session.status === 'review-open');
  const repoReady = Boolean(status?.isGitRepo && status?.boundaryOk);
  const repoUnavailable = Boolean(status && (!status.isGitRepo || !status.boundaryOk));
  const localBranches = useMemo(
    () => branches.filter((branchRef) => !branchRef.isRemote),
    [branches],
  );

  // Refresh on open (single store).
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open || !repoReady) return;
    const ctrl = new AbortController();
    setBranchesLoading(true);
    setBranchLoadError(null);
    listGitBranches(ctrl.signal)
      .then((res) => setBranches(res.branches))
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setBranchLoadError(errorMessage(err));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setBranchesLoading(false);
      });
    return () => ctrl.abort();
  }, [open, repoReady, currentBranch]);

  useEffect(() => {
    if (!open) return;
    const preferredBranch =
      session?.status === 'review-open' && session.workingBranch
        ? session.workingBranch
        : currentBranch;
    setTargetMode(preferredBranch && preferredBranch !== currentBranch ? 'existing' : 'current');
    setTargetBranch(preferredBranch ?? '');
    setNewBranchName(branchNameForMessage(message || 'update'));
    // Initialise from the status snapshot when the panel opens or the current
    // branch changes after a mutation; message edits should not reset the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentBranch, session?.status, session?.workingBranch]);

  // Initialise selection to "all" on open and whenever the set of paths changes.
  useEffect(() => {
    if (!open) return;
    setSelected(selectAllPaths(changes));
    // Keyed on `pathSig` (a stable string), not the `changes` array identity, so
    // a background poll returning the same paths keeps the user's selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pathSig]);

  // Reset transient UI when the panel closes.
  useEffect(() => {
    if (!open) {
      setPrMode(false);
      setError(null);
      setResult(null);
      setDiffTarget(null);
    }
  }, [open]);

  const { selectedPaths, allSelected } = deriveSelection(changes, selected);
  const selectedConflicts = useMemo(
    () =>
      changes
        .filter((change) => selected.has(change.path) && change.kind === 'conflicted')
        .map((change) => change.path),
    [changes, selected],
  );
  const selectedTargetBranch =
    targetMode === 'new'
      ? newBranchName.trim()
      : targetMode === 'existing'
        ? targetBranch.trim()
        : currentBranch;
  const targetReady =
    targetMode === 'new'
      ? newBranchName.trim().length > 0
      : targetMode === 'existing'
        ? targetBranch.trim().length > 0
        : Boolean(currentBranch);
  const canCommit =
    selectedPaths.length > 0 && !busy && targetReady && selectedConflicts.length === 0;
  const commitPushBlocked = isProtectedBranch(selectedTargetBranch);
  const prBranchPreview =
    targetMode === 'new'
      ? `Will create ${newBranchName.trim() || 'a new branch'} from ${baseBranch ?? currentBranch ?? 'the base branch'} and open a PR`
      : previewBranchAction({
          hasOpenPr,
          prNumber: session?.prNumber ?? null,
          workingBranch: session?.workingBranch ?? null,
          currentBranch: targetMode === 'existing' ? targetBranch || null : currentBranch,
          baseBranch,
          message,
        });

  const toggle = (path: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const toggleAll = () => setSelected(() => (allSelected ? new Set() : selectAllPaths(changes)));

  const runAction = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reloadBranches = async () => {
    setBranchesLoading(true);
    setBranchLoadError(null);
    try {
      const res = await listGitBranches();
      setBranches(res.branches);
    } catch (err) {
      setBranchLoadError(errorMessage(err));
    } finally {
      setBranchesLoading(false);
    }
  };

  const ensureTargetBranch = async () => {
    if (targetMode === 'new') {
      const branchName = newBranchName.trim();
      if (!branchName) throw new Error('Enter a branch name before committing.');
      const res = await createGitBranch({
        branch: branchName,
        ...(baseBranch ? { baseBranch } : {}),
      });
      setStatus(res.status);
      setTargetMode('current');
      setTargetBranch(res.branch ?? branchName);
      await reloadBranches();
      return;
    }

    if (targetMode === 'existing') {
      const branchName = targetBranch.trim();
      if (!branchName) throw new Error('Select a branch before committing.');
      if (branchName !== currentBranch) {
        const res = await checkoutGitBranch({ branch: branchName });
        setStatus(res.status);
        setTargetMode('current');
        setTargetBranch(res.branch ?? branchName);
        await reloadBranches();
      }
    }
  };

  const handleTargetMode = (mode: BranchTargetMode) => {
    if (mode === 'new' && newBranchName === branchNameForMessage('update')) {
      setNewBranchName(branchNameForMessage(message || 'update'));
    }
    if (mode === 'existing' && !targetBranch.trim()) {
      setTargetBranch(localBranches[0]?.name ?? currentBranch ?? '');
    }
    setTargetMode(mode);
  };

  const handleCommit = (push: boolean) =>
    runAction(async () => {
      await ensureTargetBranch();
      const res = await commitChanges({
        paths: selectedPaths,
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      setStatus(res.status);
      if (push) {
        const pushed = await pushWorkingBranch();
        setStatus(pushed.status);
      }
      setMessage('');
    });

  const handleSendPr = (input: { title: string; body: string; draft: boolean }) =>
    runAction(async () => {
      await ensureTargetBranch();
      const res = await sendPr({
        paths: selectedPaths,
        ...(message.trim() ? { message: message.trim() } : {}),
        ...(input.title.trim() ? { title: input.title.trim() } : {}),
        ...(input.body.trim() ? { body: input.body.trim() } : {}),
        ...(input.draft ? { draft: true } : {}),
      });
      setResult(res);
      if (res.status) setStatus(res.status);
      setPrMode(false);
      setMessage('');
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]"
        aria-describedby={undefined}
      >
        <PanelHeader
          branch={branch}
          baseBranch={baseBranch}
          ahead={status?.ahead ?? 0}
          behind={status?.behind ?? 0}
          repoReady={repoReady}
          loading={loading}
          onRefresh={() => void refresh()}
        />

        {repoUnavailable ? (
          <NoRepoState reason={status?.reason ?? null} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {result && <ResultBanner result={result} onDismiss={() => setResult(null)} />}
            {error && (
              <div className="mx-3 mt-3 break-words rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                {error}
              </div>
            )}

            {prMode ? (
              <PrForm
                defaultTitle={message.trim() || 'Update from sber-designer'}
                selectedPaths={selectedPaths}
                branchPreview={prBranchPreview}
                hasOpenPr={hasOpenPr}
                busy={busy}
                onBack={() => setPrMode(false)}
                onSend={handleSendPr}
              />
            ) : (
              <CommitBox
                message={message}
                onMessage={setMessage}
                canCommit={canCommit}
                commitPushDisabled={commitPushBlocked}
                commitPushDisabledReason={
                  commitPushBlocked
                    ? 'Create or select a feature branch before pushing.'
                    : undefined
                }
                hasOpenPr={hasOpenPr}
                currentBranch={currentBranch}
                baseBranch={baseBranch}
                branches={localBranches}
                branchesLoading={branchesLoading}
                branchLoadError={branchLoadError}
                targetMode={targetMode}
                targetBranch={targetBranch}
                newBranchName={newBranchName}
                selectedTargetBranch={selectedTargetBranch}
                selectedConflicts={selectedConflicts}
                onTargetMode={handleTargetMode}
                onTargetBranch={setTargetBranch}
                onNewBranchName={setNewBranchName}
                onCommit={() => void handleCommit(false)}
                onCommitPush={() => void handleCommit(true)}
                onOpenPr={() => {
                  setError(null);
                  setPrMode(true);
                }}
              />
            )}

            <ChangesList
              changes={changes}
              selected={selected}
              allSelected={allSelected}
              activePath={diffTarget?.path ?? null}
              disabled={busy}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onOpenDiff={setDiffTarget}
            />

            {diffTarget && (
              <DiffSection change={diffTarget} onCollapse={() => setDiffTarget(null)} />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------- header --------------------------------------------------------

function PanelHeader({
  branch,
  baseBranch,
  ahead,
  behind,
  repoReady,
  loading,
  onRefresh,
}: {
  branch: string | null;
  baseBranch: string | null;
  ahead: number;
  behind: number;
  repoReady: boolean;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3 pr-12">
      <span className="text-sm font-semibold">Source Control</span>
      {branch && (
        <span
          className="inline-flex min-w-0 items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground"
          title={baseBranch ? `${branch} · base ${baseBranch}` : branch}
        >
          <GitBranch className="size-3 shrink-0" />
          <span className="max-w-[160px] truncate">{branch}</span>
        </span>
      )}
      {(ahead > 0 || behind > 0) && (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {behind > 0 && (
            <span className="inline-flex items-center">
              <ArrowDown className="size-3" />
              {behind}
            </span>
          )}
          {ahead > 0 && (
            <span className="inline-flex items-center">
              <ArrowUp className="size-3" />
              {ahead}
            </span>
          )}
        </span>
      )}
      <div className="ml-auto flex items-center gap-0.5">
        <IconButton title="Open Git Graph" onClick={openGitGraph} disabled={!repoReady}>
          <GitGraph className="size-4" />
        </IconButton>
        <IconButton title="Refresh" onClick={onRefresh}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </IconButton>
      </div>
    </div>
  );
}

// ---------- commit box ----------------------------------------------------

function CommitBox({
  message,
  onMessage,
  canCommit,
  commitPushDisabled,
  commitPushDisabledReason,
  hasOpenPr,
  currentBranch,
  baseBranch,
  branches,
  branchesLoading,
  branchLoadError,
  targetMode,
  targetBranch,
  newBranchName,
  selectedTargetBranch,
  selectedConflicts,
  onTargetMode,
  onTargetBranch,
  onNewBranchName,
  onCommit,
  onCommitPush,
  onOpenPr,
}: {
  message: string;
  onMessage: (v: string) => void;
  canCommit: boolean;
  commitPushDisabled: boolean;
  commitPushDisabledReason: string | undefined;
  hasOpenPr: boolean;
  currentBranch: string | null;
  baseBranch: string | null;
  branches: GitBranchRef[];
  branchesLoading: boolean;
  branchLoadError: string | null;
  targetMode: BranchTargetMode;
  targetBranch: string;
  newBranchName: string;
  selectedTargetBranch: string | null;
  selectedConflicts: string[];
  onTargetMode: (mode: BranchTargetMode) => void;
  onTargetBranch: (branch: string) => void;
  onNewBranchName: (branch: string) => void;
  onCommit: () => void;
  onCommitPush: () => void;
  onOpenPr: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-border p-3">
      <BranchTargetControl
        currentBranch={currentBranch}
        baseBranch={baseBranch}
        branches={branches}
        branchesLoading={branchesLoading}
        branchLoadError={branchLoadError}
        targetMode={targetMode}
        targetBranch={targetBranch}
        newBranchName={newBranchName}
        selectedTargetBranch={selectedTargetBranch}
        onTargetMode={onTargetMode}
        onTargetBranch={onTargetBranch}
        onNewBranchName={onNewBranchName}
      />
      <Textarea
        value={message}
        onChange={(e) => onMessage(e.target.value)}
        rows={2}
        placeholder="Commit message (blank uses an auto message)"
        className="resize-none text-sm"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={!canCommit} onClick={onCommit}>
          Commit
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!canCommit || commitPushDisabled}
          onClick={onCommitPush}
          title={commitPushDisabledReason}
        >
          Commit &amp; Push
        </Button>
        <Button size="sm" disabled={!canCommit} onClick={onOpenPr}>
          <GitPullRequestArrow />
          {hasOpenPr ? 'Update PR' : 'Create PR'}
        </Button>
      </div>
      {selectedConflicts.length > 0 && (
        <div className="mt-2 break-words text-[11px] text-destructive">
          Resolve conflicts before committing: {selectedConflicts.join(', ')}
        </div>
      )}
    </div>
  );
}

function BranchTargetControl({
  currentBranch,
  baseBranch,
  branches,
  branchesLoading,
  branchLoadError,
  targetMode,
  targetBranch,
  newBranchName,
  selectedTargetBranch,
  onTargetMode,
  onTargetBranch,
  onNewBranchName,
}: {
  currentBranch: string | null;
  baseBranch: string | null;
  branches: GitBranchRef[];
  branchesLoading: boolean;
  branchLoadError: string | null;
  targetMode: BranchTargetMode;
  targetBranch: string;
  newBranchName: string;
  selectedTargetBranch: string | null;
  onTargetMode: (mode: BranchTargetMode) => void;
  onTargetBranch: (branch: string) => void;
  onNewBranchName: (branch: string) => void;
}) {
  const targetLabel =
    targetMode === 'new' ? newBranchName.trim() || 'new branch' : (selectedTargetBranch ?? 'none');

  return (
    <div className="mb-2 rounded-md border border-border bg-muted/20 p-2">
      <div className="mb-2 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">Target</span>
        <span className="inline-flex min-w-0 items-center gap-1">
          <GitBranch className="size-3 shrink-0" />
          <span className="truncate" title={currentBranch ?? undefined}>
            {currentBranch ?? 'no branch'}
          </span>
        </span>
        {baseBranch && <span className="ml-auto shrink-0">base {baseBranch}</span>}
      </div>

      <div className="grid grid-cols-3 gap-1">
        <BranchModeButton
          active={targetMode === 'current'}
          disabled={!currentBranch}
          onClick={() => onTargetMode('current')}
        >
          Current
        </BranchModeButton>
        <BranchModeButton
          active={targetMode === 'existing'}
          disabled={branches.length === 0}
          onClick={() => onTargetMode('existing')}
        >
          Branch
        </BranchModeButton>
        <BranchModeButton active={targetMode === 'new'} onClick={() => onTargetMode('new')}>
          <Plus className="size-3" />
          New
        </BranchModeButton>
      </div>

      {targetMode === 'existing' && (
        <select
          value={targetBranch}
          onChange={(event) => onTargetBranch(event.target.value)}
          disabled={branchesLoading || branches.length === 0}
          className="mt-2 h-8 w-full rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
        >
          <option value="">Select branch</option>
          {branches.map((branch) => (
            <option key={branch.name} value={branch.name}>
              {branch.name}
              {branch.isCurrent ? ' (current)' : ''}
            </option>
          ))}
        </select>
      )}

      {targetMode === 'new' && (
        <input
          value={newBranchName}
          onChange={(event) => onNewBranchName(event.target.value)}
          className="mt-2 h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="sd/update"
        />
      )}

      <div className="mt-2 min-h-4 truncate text-[11px] text-muted-foreground" title={targetLabel}>
        Commit target: {targetLabel}
      </div>
      {branchLoadError && (
        <div className="mt-1 break-words text-[11px] text-destructive">{branchLoadError}</div>
      )}
    </div>
  );
}

function BranchModeButton({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1 rounded border border-border px-2 text-[11px] transition-colors disabled:opacity-50',
        active
          ? 'border-primary/60 bg-primary/10 text-primary'
          : 'bg-background text-muted-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}

// ---------- changes list --------------------------------------------------

function IconButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
