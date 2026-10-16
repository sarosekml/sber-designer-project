import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from 'lucide-react';
import {
  HTML_DESIGN_SYSTEM_IMPORT_MAX_FILES,
  HTML_DESIGN_SYSTEM_IMPORT_MAX_FILE_BYTES,
  HTML_DESIGN_SYSTEM_IMPORT_MAX_TOTAL_BYTES,
  classifyHtmlDesignSystemImportFileName,
} from '@sber-designer/shared-types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  importHtmlDesignSystemFiles,
  type ImportHtmlDesignSystemFilesResult,
} from '@/lib/api/project-index';

export const DESIGN_SYSTEM_IMPORT_ACCEPT = [
  '.html',
  '.htm',
  '.css',
  '.js',
  '.mjs',
  '.cjs',
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
].join(',');

export function buildImportDesignSystemDialogState(
  files: readonly Pick<File, 'name' | 'size'>[],
  submitting: boolean,
): { canSubmit: boolean; error: string | null; totalBytes: number } {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const oversized = files.find((file) => file.size > HTML_DESIGN_SYSTEM_IMPORT_MAX_FILE_BYTES);
  const error =
    files.length > HTML_DESIGN_SYSTEM_IMPORT_MAX_FILES
      ? `Choose at most ${HTML_DESIGN_SYSTEM_IMPORT_MAX_FILES} files.`
      : oversized
        ? `${oversized.name} exceeds the 10 MB file limit.`
        : totalBytes > HTML_DESIGN_SYSTEM_IMPORT_MAX_TOTAL_BYTES
          ? 'The selected files exceed the 50 MB total limit.'
          : null;
  return { canSubmit: files.length > 0 && !submitting && !error, error, totalBytes };
}

export function ImportDesignSystemFilesDialog({
  open,
  workspacePath,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  workspacePath?: string | undefined;
  onOpenChange: (open: boolean) => void;
  onImported: (result: ImportHtmlDesignSystemFilesResult) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportHtmlDesignSystemFilesResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const state = useMemo(
    () => buildImportDesignSystemDialogState(files, submitting),
    [files, submitting],
  );

  useEffect(() => {
    if (open) return;
    setFiles([]);
    setSubmitting(false);
    setResult(null);
    setError(null);
  }, [open]);

  const submit = async () => {
    if (!workspacePath || !state.canSubmit) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const next = await importHtmlDesignSystemFiles({ workspacePath, files });
      setResult(next);
      onImported(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(720px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="size-5 text-primary" />
            Import design-system files
          </DialogTitle>
          <DialogDescription>
            HTML, CSS, and JS examples go to design-system/refs/. Images and fonts go to
            design-system/assets/. Existing files are never overwritten.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="design-system-import-files">Files</Label>
            <Input
              id="design-system-import-files"
              type="file"
              multiple
              accept={DESIGN_SYSTEM_IMPORT_ACCEPT}
              disabled={submitting}
              onChange={(event) => {
                setFiles(Array.from(event.currentTarget.files ?? []));
                setResult(null);
                setError(null);
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Up to 20 files, 10 MB each, 50 MB total. Design.md, tokens.css, and components.css are
              routed to their canonical source paths when those paths are empty.
            </p>
          </div>

          {files.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/20 p-2 text-xs">
              {files.map((file, index) => {
                const classification = classifyHtmlDesignSystemImportFileName(file.name);
                return (
                  <li key={`${file.name}-${index}`} className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {classification?.kind ?? 'unsupported'} · {formatBytes(file.size)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {(state.error || error) && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {state.error ?? error}
            </p>
          )}

          {result && (
            <div className="rounded-md border border-border bg-card px-3 py-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <CheckCircle2 className="size-3.5 text-success" />
                Imported {result.imported.length} file{result.imported.length === 1 ? '' : 's'}
              </div>
              {result.imported.length > 0 && (
                <p className="mt-1 text-muted-foreground">
                  {result.imported.map((file) => file.targetPath).join(', ')}
                </p>
              )}
              {result.skipped.length > 0 && (
                <p className="mt-1 text-warning">
                  Skipped {result.skipped.length}:{' '}
                  {result.skipped.map((file) => file.name).join(', ')}
                </p>
              )}
              {result.reindexJobId && (
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  Reindex: {result.reindexJobId}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!workspacePath || !state.canSubmit || result !== null}
          >
            {submitting ? <Loader2 className="animate-spin" /> : <FileUp />}
            Import files
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
