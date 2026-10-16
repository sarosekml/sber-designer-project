import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { getGitDiff, type GitFileDiff } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export interface GitDiffViewProps {
  /** Base ref/sha. With `head`, diffs base..head; alone, diffs working tree vs base. */
  base?: string;
  head?: string;
  /** When set, renders the unified patch for this single path (working tree). */
  path?: string;
  /** Pre-rename path, to label a renamed file "old → new". */
  origPath?: string;
  /** Diff the index instead of the working tree. */
  staged?: boolean;
}

/**
 * Shared git diff surface (task 0110 B2, extracted from GitGraphDialog).
 *
 * Two modes from the same loader:
 *   - range (`base`+`head`) → the changed-files list with +/- counts, used by
 *     the Git Graph commit-details panel;
 *   - single file (`path`) → the colourised unified patch, used by the Source
 *     Control panel. Untracked files work via the backend's --no-index diff.
 */
export function GitDiffView({ base, head, path, origPath, staged }: GitDiffViewProps) {
  const [diff, setDiff] = useState<GitFileDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base && !head && !path) {
      setDiff(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDiff(null);
    getGitDiff({
      ...(base ? { base } : {}),
      ...(head ? { head } : {}),
      ...(path ? { path } : {}),
      ...(origPath ? { origPath } : {}),
      ...(staged ? { staged } : {}),
    })
      .then((d) => {
        if (!cancelled) setDiff(d);
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
  }, [base, head, path, origPath, staged]);

  if (loading) {
    return (
      <Centered>
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading diff…
      </Centered>
    );
  }
  if (error) {
    return <Centered className="text-destructive-foreground">{error}</Centered>;
  }
  // Single-file mode → unified patch.
  if (path) {
    if (!diff?.patch) {
      return <Centered>No textual diff to show.</Centered>;
    }
    return <PatchBody patch={diff.patch} truncated={diff.truncated ?? false} />;
  }
  // Range mode → changed-files list.
  if (!diff || diff.files.length === 0) {
    return <Centered>No file changes.</Centered>;
  }
  return (
    <ul className="divide-y divide-border/60">
      {diff.files.map((file) => (
        <li key={file.path} className="flex items-center gap-2 px-2 py-1 text-xs" title={file.path}>
          <Badge
            variant="outline"
            className={cn('w-16 shrink-0 justify-center px-1', statusChip(file.status))}
          >
            {file.status}
          </Badge>
          <span className="min-w-0 flex-1 truncate font-mono">{file.path}</span>
          {file.binary ? (
            <span className="shrink-0 text-muted-foreground">binary</span>
          ) : (
            <span className="shrink-0 font-mono">
              <span className="text-success">+{file.additions}</span>{' '}
              <span className="text-destructive">−{file.deletions}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function PatchBody({ patch, truncated }: { patch: string; truncated?: boolean }) {
  const lines = patch.split('\n');
  return (
    <div className="overflow-auto font-mono text-[11px] leading-[1.5]">
      <pre className="min-w-max">
        {lines.map((line, i) => (
          <div key={i} className={cn('whitespace-pre px-3', patchLineClass(line))}>
            {line || ' '}
          </div>
        ))}
      </pre>
      {truncated && (
        <div className="px-3 py-1 text-[11px] italic text-muted-foreground">
          Diff truncated — file is large.
        </div>
      )}
    </div>
  );
}

/** Colour a unified-diff line by its leading marker. */
function patchLineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'text-muted-foreground';
  if (line.startsWith('@@')) return 'bg-info/10 text-info';
  if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('new file'))
    return 'text-muted-foreground';
  if (line.startsWith('+')) return 'bg-success/10 text-success';
  if (line.startsWith('-')) return 'bg-destructive/10 text-destructive';
  return 'text-foreground/80';
}

function statusChip(status: string): string {
  switch (status) {
    case 'added':
      return 'border-success/40 text-success';
    case 'deleted':
      return 'border-destructive/40 text-destructive';
    case 'renamed':
    case 'copied':
      return 'border-info/40 text-info';
    default:
      return 'border-warning/40 text-warning';
  }
}

function Centered({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full min-h-16 items-center justify-center px-4 text-center text-xs text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}
