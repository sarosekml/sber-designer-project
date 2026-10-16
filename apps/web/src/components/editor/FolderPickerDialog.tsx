import { useEffect, useState } from 'react';
import { ArrowLeft, Folder, Home, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError, fsList, type FsListResult } from '@/lib/api-client';

interface FolderPickerDialogProps {
  open: boolean;
  /** Initial directory to land on. Defaults to $HOME on the server. */
  initialPath?: string;
  /**
   * Title shown at the top — useful when the picker is reused for
   * "pick repo to connect" vs. "pick parent for new project".
   */
  title?: string;
  description?: string;
  onSelect: (absolutePath: string) => void;
  onClose: () => void;
}

export interface FolderPickerDialogStackModel {
  modal: boolean;
  overlayClassName: string;
  contentClassName: string;
}

export function buildFolderPickerDialogStackModel(): FolderPickerDialogStackModel {
  return {
    modal: true,
    overlayClassName: 'z-[69]',
    contentClassName: 'z-[70] max-h-[min(760px,calc(100vh-2rem))] overflow-hidden sm:max-w-xl',
  };
}

/**
 * Reads /api/fs/list to walk the user's file system. Shows directories
 * only, click to descend, "Use this folder" picks the current path
 * and dismisses.
 *
 * Browsers don't expose absolute paths through native folder pickers
 * (the File System Access API hands out opaque handles), so we go
 * through the api which has fs access. The api restricts reads to
 * $HOME (extend via SBER_DESIGNER_FS_ROOTS) so a stray fetch can't
 * enumerate /etc.
 */
export function FolderPickerDialog({
  open,
  initialPath,
  title = 'Pick a folder',
  description,
  onSelect,
  onClose,
}: FolderPickerDialogProps) {
  const [data, setData] = useState<FsListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string | undefined>(initialPath);
  const stack = buildFolderPickerDialogStackModel();

  // Re-load whenever the picker (re-)opens or the path changes.
  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    fsList(currentPath, ac.signal)
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((err) => {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return;
        const message =
          err instanceof ApiError
            ? `${err.code ?? 'error'}: ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [open, currentPath]);

  // Reset path when reopened with a different initialPath.
  useEffect(() => {
    if (open) setCurrentPath(initialPath);
  }, [open, initialPath]);

  const handleEnter = (name: string) => {
    if (!data) return;
    setCurrentPath(joinPath(data.path, name));
  };

  const handleUp = () => {
    if (data?.parent) setCurrentPath(data.parent);
  };

  const handleSelect = () => {
    if (!data) return;
    onSelect(data.path);
    onClose();
  };

  return (
    <Dialog modal={stack.modal} open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={stack.contentClassName} overlayClassName={stack.overlayClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {/* Path breadcrumb / current */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
          <Folder className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono" title={data?.path ?? ''}>
            {data?.path ?? (loading ? 'loading…' : '')}
          </span>
          {data?.isHome ? <Home className="size-3 shrink-0 text-muted-foreground" /> : null}
        </div>

        {/* Up + scroll list */}
        <div className="flex h-72 flex-col rounded-md border border-border bg-background">
          <button
            type="button"
            onClick={handleUp}
            disabled={!data?.parent || loading}
            className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <ArrowLeft className="size-3.5" />
            <span>Up</span>
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            {!loading && error && (
              <div className="px-3 py-2 text-xs text-destructive-foreground">{error}</div>
            )}
            {!loading && !error && data && (
              <ul className="grid">
                {data.entries.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-muted-foreground">(empty folder)</li>
                ) : (
                  data.entries.map((entry) => (
                    <li key={entry.name}>
                      <button
                        type="button"
                        onClick={() => entry.isDir && handleEnter(entry.name)}
                        disabled={!entry.isDir}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        {entry.isDir ? (
                          <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <span className="size-3.5 shrink-0" />
                        )}
                        <span className="truncate">{entry.name}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={!data || loading} onClick={handleSelect}>
            Use this folder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function joinPath(base: string, child: string): string {
  if (base.endsWith('/')) return base + child;
  return `${base}/${child}`;
}
