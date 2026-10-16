import { useState } from 'react';
import { FileUp, Palette, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { dispatchHtmlDesignSystemReferenceDraft } from '@/lib/html-design-system-reference';
import type {
  ImportHtmlDesignSystemFilesResult,
  ProjectDesignSystemBrowser,
} from '@/lib/api/project-index';
import { AddDesignSystemDialog } from './screens/AddDesignSystemDialog';
import { ExtractReferenceDialog } from './screens/ExtractReferenceDialog';
import { ImportDesignSystemFilesDialog } from './screens/ImportDesignSystemFilesDialog';

export function DesignSystemBootstrapCard({
  visible,
  workspacePath,
  onChanged,
}: {
  visible: boolean;
  workspacePath?: string | undefined;
  onChanged: (
    browser: ProjectDesignSystemBrowser,
    result?: ImportHtmlDesignSystemFilesResult,
  ) => void;
}) {
  const [presetOpen, setPresetOpen] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!visible) return null;
  return (
    <>
      <div className="absolute inset-0 z-20 grid place-items-center bg-muted/80 p-6 backdrop-blur-sm">
        <section className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-xl">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              HTML design system
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              Build the project component foundation
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Start with project-owned sources, extract rules from a visual reference, or import
              existing HTML, CSS, JS, and assets.
            </p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <BootstrapAction
              icon={Palette}
              title="Start from preset"
              description="Create Design.md, tokens, components, and a managed catalog."
              onClick={() => setPresetOpen(true)}
            />
            <BootstrapAction
              icon={Sparkles}
              title="Extract from reference"
              description="Create a reviewable proposal from a file, Pixso, or web URL."
              onClick={() => setExtractOpen(true)}
            />
            <BootstrapAction
              icon={FileUp}
              title="Import files"
              description="Copy examples and assets into the canonical package safely."
              onClick={() => setImportOpen(true)}
            />
          </div>
          {message && (
            <p className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {message}
            </p>
          )}
        </section>
      </div>

      <AddDesignSystemDialog
        open={presetOpen}
        workspacePath={workspacePath}
        onOpenChange={setPresetOpen}
        onConnected={(browser) => {
          setMessage('Canonical design-system sources are ready and indexed.');
          onChanged(browser);
        }}
      />
      <ExtractReferenceDialog
        open={extractOpen}
        onOpenChange={setExtractOpen}
        onCreate={(detail) => {
          dispatchHtmlDesignSystemReferenceDraft(detail);
          setMessage(
            'Reference extraction started in Assistant. Review the proposal before accept.',
          );
        }}
      />
      <ImportDesignSystemFilesDialog
        open={importOpen}
        workspacePath={workspacePath}
        onOpenChange={setImportOpen}
        onImported={(result) => {
          setMessage(
            result.imported.length > 0
              ? `Imported ${result.imported.length} file${result.imported.length === 1 ? '' : 's'} and refreshed the project index.`
              : 'No files were imported. Review the skipped-file details.',
          );
          onChanged(result.browser, result);
        }}
      />
    </>
  );
}

function BootstrapAction({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof Palette;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto min-h-28 items-start justify-start whitespace-normal p-3 text-left"
      onClick={onClick}
    >
      <span className="grid gap-2">
        <Icon className="size-4 text-primary" />
        <span className="grid gap-0.5">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs font-normal leading-relaxed text-muted-foreground">
            {description}
          </span>
        </span>
      </span>
    </Button>
  );
}
