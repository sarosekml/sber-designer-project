/** Export screen dialog: html / jpeg / screen.design.md. */
import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { ProjectScreen } from '@sber-designer/shared-types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  buildHtmlSnapshot,
  buildHtmlSnapshotFromHtml,
  downloadTextFile,
  requestHtmlSnapshotFromIframe,
} from '@/lib/html-export';
import { useProjectStore } from '@/stores/project-store';
import { Field } from './dialog-shared';

type ExportFormat = 'html' | 'jpeg' | 'screen-design-md';

export function ExportScreenDialog({
  screen,
  project,
  activeScreenId,
  onOpenChange,
}: {
  screen: ProjectScreen | null;
  project: ReturnType<typeof useProjectStore.getState>['project'];
  activeScreenId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [format, setFormat] = useState<ExportFormat>('html');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const open = screen !== null;

  useEffect(() => {
    if (!open) return;
    setFormat('html');
    setMessage(null);
    setError(null);
    setIsExporting(false);
  }, [open, screen?.id]);

  const exportHtml = async () => {
    if (!screen) return;
    setMessage(null);
    setError(null);
    if (activeScreenId !== screen.id) {
      setError('The screen is still loading. Try Export again in a moment.');
      return;
    }
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="canvas"]');
    if (!iframe) {
      setError('Canvas iframe is not available yet.');
      return;
    }

    setIsExporting(true);
    try {
      const iframeDocument = getSameOriginIframeDocument(iframe);
      const snapshot = iframeDocument?.documentElement
        ? buildHtmlSnapshot(iframeDocument, getIframeSourceUrl(iframe), screen.name)
        : buildHtmlSnapshotFromHtml(await requestHtmlSnapshotFromIframe(iframe), screen.name);
      downloadTextFile(snapshot.fileName, snapshot.html, 'text/html;charset=utf-8');
      setMessage(`Downloaded ${snapshot.fileName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    if (format === 'html') {
      void exportHtml();
      return;
    }
    setError(null);
    setMessage(
      format === 'jpeg'
        ? 'JPEG export is planned for the next iteration.'
        : 'screen.design.md export is planned for the next iteration.',
    );
  };

  const template = project?.screenDesignExportTemplate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export screen</DialogTitle>
          <DialogDescription>
            Export the selected screen. HTML is available now; JPEG and screen.design.md are
            prepared as future formats.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
            <div className="font-medium">{screen?.name}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {screen?.kind === 'story' ? screen.storyId : screen?.filePath}
            </div>
          </div>

          <Field label="Export format">
            <div className="[&_[data-slot=native-select-wrapper]]:w-full">
              <NativeSelect
                value={format}
                onChange={(event) => setFormat(event.target.value as ExportFormat)}
                className="h-10 w-full"
              >
                <NativeSelectOption value="html">HTML</NativeSelectOption>
                <NativeSelectOption value="jpeg">JPEG</NativeSelectOption>
                <NativeSelectOption value="screen-design-md">screen.design.md</NativeSelectOption>
              </NativeSelect>
            </div>
          </Field>

          {format === 'screen-design-md' && (
            <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              {template ? (
                <>
                  Template loaded:{' '}
                  <span className="font-mono text-foreground">{template.path}</span>
                </>
              ) : (
                'No screen.design.md template is loaded in Project settings yet.'
              )}
            </div>
          )}

          {message && (
            <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleExport} disabled={!screen || isExporting}>
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getSameOriginIframeDocument(iframe: HTMLIFrameElement): Document | null {
  try {
    return iframe.contentDocument;
  } catch {
    return null;
  }
}

function getIframeSourceUrl(iframe: HTMLIFrameElement): string {
  try {
    return iframe.contentWindow?.location.href || iframe.src;
  } catch {
    return iframe.src;
  }
}
