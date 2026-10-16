import { useState } from 'react';
import { ChevronUp, ExternalLink, GitBranch, GitPullRequestArrow, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { GitChange, SendPrResult } from '@/lib/api/git';
import { ApiError } from '@/lib/api/http';
import { cn } from '@/lib/utils';
import { GitDiffView } from './GitDiffView';
import { changeBadge, defaultPrBody, splitChangePath } from './source-control-state';

export function ChangesList({
  changes,
  selected,
  allSelected,
  activePath,
  disabled,
  onToggle,
  onToggleAll,
  onOpenDiff,
}: {
  changes: GitChange[];
  selected: Set<string>;
  allSelected: boolean;
  activePath: string | null;
  disabled: boolean;
  onToggle: (path: string) => void;
  onToggleAll: () => void;
  onOpenDiff: (change: GitChange) => void;
}) {
  if (changes.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
        No uncommitted changes.
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <input
          type="checkbox"
          aria-label="Select all changes"
          checked={allSelected}
          disabled={disabled}
          onChange={onToggleAll}
          className="size-3.5 accent-primary"
        />
        <span>Changes · {changes.length}</span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {changes.map((change) => (
          <ChangeRow
            key={change.path}
            change={change}
            checked={selected.has(change.path)}
            active={activePath === change.path}
            disabled={disabled}
            onToggle={() => onToggle(change.path)}
            onOpenDiff={() => onOpenDiff(change)}
          />
        ))}
      </ul>
    </div>
  );
}

function ChangeRow({
  change,
  checked,
  active,
  disabled,
  onToggle,
  onOpenDiff,
}: {
  change: GitChange;
  checked: boolean;
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
  onOpenDiff: () => void;
}) {
  const badge = changeBadge(change.kind);
  const { name, dir } = splitChangePath(change.path);
  const title = change.origPath ? `${change.origPath} → ${change.path}` : change.path;
  return (
    <li
      className={cn(
        'flex items-center gap-2 px-3 py-1 text-xs hover:bg-accent/50',
        active && 'bg-accent',
      )}
    >
      <input
        type="checkbox"
        aria-label={`Select ${change.path}`}
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="size-3.5 shrink-0 accent-primary"
      />
      <button
        type="button"
        onClick={onOpenDiff}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        title={title}
      >
        <span
          className={cn('w-3 shrink-0 text-center font-mono', badge.className)}
          title={badge.title}
        >
          {badge.letter}
        </span>
        <span className="min-w-0 flex-1 truncate">
          <span className="text-foreground">{name}</span>
          {dir && <span className="ml-1.5 text-[10px] text-muted-foreground">{dir}</span>}
          {change.origPath && (
            <span className="ml-1.5 text-[10px] italic text-muted-foreground">
              ← {splitChangePath(change.origPath).name}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

export function DiffSection({ change, onCollapse }: { change: GitChange; onCollapse: () => void }) {
  return (
    <div className="flex h-[40%] shrink-0 flex-col border-t border-border">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-1.5">
        <span
          className="min-w-0 truncate font-mono text-[11px] text-muted-foreground"
          title={change.path}
        >
          {change.origPath ? `${change.origPath} → ${change.path}` : change.path}
        </span>
        <button
          type="button"
          onClick={onCollapse}
          className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
          title="Collapse diff"
        >
          <ChevronUp className="size-3" />
          Collapse
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto border-t border-border bg-background/40">
        <GitDiffView
          base="HEAD"
          path={change.path}
          {...(change.origPath ? { origPath: change.origPath } : {})}
        />
      </div>
    </div>
  );
}

export function PrForm({
  defaultTitle,
  selectedPaths,
  branchPreview,
  hasOpenPr,
  busy,
  onBack,
  onSend,
}: {
  defaultTitle: string;
  selectedPaths: string[];
  branchPreview: string;
  hasOpenPr: boolean;
  busy: boolean;
  onBack: () => void;
  onSend: (input: { title: string; body: string; draft: boolean }) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState(() => defaultPrBody(selectedPaths));
  const [draft, setDraft] = useState(false);
  return (
    <div className="shrink-0 border-b border-border p-3">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">
        {hasOpenPr ? 'Update pull request' : 'New pull request'}
      </div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
        Title
      </label>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={busy}
        className="mb-2 block w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
      />
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
        Body
      </label>
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        disabled={busy}
        rows={4}
        className="mb-2 resize-none text-xs"
      />
      <label className="mb-2 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.target.checked)}
          className="size-3.5 accent-primary"
        />
        Draft
      </label>
      <div className="mb-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        {branchPreview}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={busy || selectedPaths.length === 0}
          onClick={() => onSend({ title, body, draft })}
        >
          {busy ? <Loader2 className="animate-spin" /> : <GitPullRequestArrow />}
          Send
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

export function ResultBanner({
  result,
  onDismiss,
}: {
  result: SendPrResult;
  onDismiss: () => void;
}) {
  const url = result.prUrl ?? result.compareUrl ?? null;
  return (
    <div className="mx-3 mt-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {result.committed ? `Committed ${result.committedCount} file(s)` : 'Pushed'} to{' '}
          <code className="break-all">{result.branch}</code>
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
        >
          {result.prUrl ? 'Open pull request' : 'Open compare page'}
          <ExternalLink className="size-3" />
        </a>
      )}
      {result.note && !url && (
        <div className="mt-1 break-words text-[11px] text-muted-foreground">{result.note}</div>
      )}
    </div>
  );
}

export function NoRepoState({ reason }: { reason: string | null }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-xs text-muted-foreground">
      <GitBranch className="size-5 opacity-50" />
      <p className="break-words">{reason ?? 'Git is unavailable for this workspace.'}</p>
      <a
        href="/how-it-works/git-and-pr-workflow"
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:underline"
      >
        How Git works in sber-designer
      </a>
    </div>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return `${error.code ?? 'error'}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
