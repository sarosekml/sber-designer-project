import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Palette, RefreshCw, Upload } from 'lucide-react';
import {
  DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID,
  type HtmlDesignSystemPresetId,
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { HtmlDesignSystemPresetPicker } from '../HtmlDesignSystemPresetPicker';
import {
  regenerateHtmlDesignSystemPreview,
  saveHtmlDesignSystemSources,
  type ProjectDesignSystemBrowser,
  type RegenerateDesignSystemPreviewResult,
} from '@/lib/api/project-index';

interface AddDesignSystemDialogProps {
  open: boolean;
  workspacePath?: string | undefined;
  onOpenChange: (open: boolean) => void;
  onConnected?: (browser: ProjectDesignSystemBrowser) => void;
}

interface SourceDraft {
  designMd: string;
  tokensCss: string;
  componentsCss: string;
  designSystemHtml: string;
}

const EMPTY_DRAFT: SourceDraft = {
  designMd: '',
  tokensCss: '',
  componentsCss: '',
  designSystemHtml: '',
};

const REQUIRED_SOURCE_KEYS = ['designMd', 'tokensCss', 'componentsCss'] as const;

export function buildAddDesignSystemDialogState(input: {
  workspacePath?: string | undefined;
  submitting: boolean;
  draft: SourceDraft;
}): {
  hasAnySource: boolean;
  missingRequired: Array<(typeof REQUIRED_SOURCE_KEYS)[number]>;
  canSubmit: boolean;
} {
  const hasAnySource = Object.values(input.draft).some((value) => value.trim().length > 0);
  const missingRequired = REQUIRED_SOURCE_KEYS.filter((key) => !input.draft[key].trim());
  return {
    hasAnySource,
    missingRequired,
    canSubmit: Boolean(input.workspacePath) && hasAnySource && !input.submitting,
  };
}

export function buildRebuildPreviewMessage(result: RegenerateDesignSystemPreviewResult): string {
  const base = `Rebuilt design-system/index.html from ${result.tokenCount} tokens and ${result.componentClassCount} component classes`;
  if (!result.descriptionSections.keepDescriptions) {
    return `${base} without Description for AI sections.`;
  }
  if (result.descriptionSections.restored > 0) {
    return `${base}. Restored ${result.descriptionSections.restored} Description for AI sections.`;
  }
  if (result.descriptionSections.layerCount > 0) {
    return `${base}. Description for AI sections were already up to date.`;
  }
  return `${base}.`;
}

export function AddDesignSystemDialog({
  open,
  workspacePath,
  onOpenChange,
  onConnected,
}: AddDesignSystemDialogProps) {
  const [draft, setDraft] = useState<SourceDraft>(EMPTY_DRAFT);
  const [presetId, setPresetId] = useState<HtmlDesignSystemPresetId>(
    DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID,
  );
  const [browser, setBrowser] = useState<ProjectDesignSystemBrowser | null>(null);
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [keepDescriptionSections, setKeepDescriptionSections] = useState(true);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setDraft(EMPTY_DRAFT);
    setPresetId(DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID);
    setBrowser(null);
    setChangedFiles([]);
    setError(null);
    setSubmitting(false);
    setRebuilding(false);
    setKeepDescriptionSections(true);
    setPreviewMessage(null);
  }, [open]);

  const dialogState = useMemo(
    () => buildAddDesignSystemDialogState({ workspacePath, submitting, draft }),
    [draft, submitting, workspacePath],
  );
  const missingRequired = dialogState.missingRequired;
  const canSubmit = dialogState.canSubmit;
  const htmlDesignSystem = browser?.projectProfile?.htmlDesignSystem;
  const previewTokens = browser?.tokens.slice(0, 6) ?? [];
  const descriptionSectionCount =
    browser?.components.filter((component) => hasDescriptionLayer(component)).length ?? 0;

  const submit = async () => {
    if (!workspacePath || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    setBrowser(null);
    setChangedFiles([]);
    try {
      const result = await saveHtmlDesignSystemSources({
        workspacePath,
        sources: {
          designMd: draft.designMd,
          tokensCss: draft.tokensCss,
          componentsCss: draft.componentsCss,
          designSystemHtml: draft.designSystemHtml,
        },
      });
      setBrowser(result.browser);
      setChangedFiles(result.changedFiles);
      onConnected?.(result.browser);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const usePreset = async () => {
    if (!workspacePath || submitting) return;
    setSubmitting(true);
    setError(null);
    setBrowser(null);
    setChangedFiles([]);
    try {
      const result = await saveHtmlDesignSystemSources({ workspacePath, presetId });
      setBrowser(result.browser);
      setChangedFiles(result.changedFiles);
      setDraft(EMPTY_DRAFT);
      onConnected?.(result.browser);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const rebuildPreview = async () => {
    if (!workspacePath || rebuilding) return;
    setRebuilding(true);
    setError(null);
    setPreviewMessage(null);
    try {
      const result = await regenerateHtmlDesignSystemPreview({
        workspacePath,
        keepDescriptions: keepDescriptionSections,
      });
      setPreviewMessage(buildRebuildPreviewMessage(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(860px,calc(100vh-2rem))] w-[min(980px,calc(100vw-2rem))] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="size-5 text-primary" />
            Add design system
          </DialogTitle>
          <DialogDescription>
            Paste or choose the static HTML design-system sources. They will be saved to the project
            design-system/ package and indexed immediately.
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-2 rounded-md border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Start with a preset</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Writes a complete nine-section Design.md and matching CSS tokens to this project.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => void usePreset()}
              disabled={!workspacePath || submitting || rebuilding}
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Palette className="size-3.5" />
              )}
              Use preset
            </Button>
          </div>
          <HtmlDesignSystemPresetPicker
            value={presetId}
            onChange={setPresetId}
            disabled={submitting || rebuilding}
          />
        </section>

        <div className="grid gap-3 md:grid-cols-2">
          <SourceTextarea
            id="design-md"
            label="Design.md"
            value={draft.designMd}
            accept=".md,text/markdown,text/plain"
            placeholder="# Design&#10;&#10;Describe colors, typography, spacing, and component rules."
            onChange={(value) => setDraft((current) => ({ ...current, designMd: value }))}
          />
          <SourceTextarea
            id="tokens-css"
            label="tokens.css"
            value={draft.tokensCss}
            accept=".css,text/css,text/plain"
            placeholder=":root {&#10;  --color-brand: #14532d;&#10;  --space-4: 16px;&#10;}"
            onChange={(value) => setDraft((current) => ({ ...current, tokensCss: value }))}
          />
          <SourceTextarea
            id="components-css"
            label="components.css"
            value={draft.componentsCss}
            accept=".css,text/css,text/plain"
            placeholder=".button {&#10;  color: var(--color-brand);&#10;}"
            onChange={(value) => setDraft((current) => ({ ...current, componentsCss: value }))}
          />
          <SourceTextarea
            id="design-system-html"
            label="design-system/index.html"
            value={draft.designSystemHtml}
            accept=".html,text/html,text/plain"
            placeholder="Optional preview page for the design system."
            onChange={(value) => setDraft((current) => ({ ...current, designSystemHtml: value }))}
          />
        </div>

        {!workspacePath && (
          <p className="rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
            Connect a workspace before adding design-system sources.
          </p>
        )}
        {workspacePath && !dialogState.hasAnySource && (
          <p className="text-xs text-muted-foreground">
            Add at least one design-system source before saving.
          </p>
        )}
        {dialogState.hasAnySource && missingRequired.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Still needed for connected status: {missingRequired.map(sourceLabel).join(', ')}.
          </p>
        )}
        {error && (
          <p className="rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
            {error}
          </p>
        )}
        {htmlDesignSystem && (
          <div className="rounded-md border border-border bg-card px-3 py-2 text-xs">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2 className="size-3.5 text-success" />
              Design system {htmlDesignSystem.status}
            </div>
            <p className="mt-1 text-muted-foreground">
              Updated {changedFiles.length} file{changedFiles.length === 1 ? '' : 's'}
              {changedFiles.length > 0 ? `: ${changedFiles.slice(0, 5).join(', ')}` : ''}.
            </p>
            {htmlDesignSystem.missingRequired.length > 0 && (
              <p className="mt-1 text-warning">
                Still missing: {htmlDesignSystem.missingRequired.join(', ')}.
              </p>
            )}
            {previewTokens.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {previewTokens.map((token) => (
                  <span
                    key={token.id}
                    className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {token.name}: {token.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {previewMessage && (
          <p className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            {previewMessage}
          </p>
        )}

        <DialogFooter>
          <label className="mr-auto inline-flex min-h-9 items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={keepDescriptionSections}
              disabled={rebuilding || submitting}
              onChange={(event) => setKeepDescriptionSections(event.currentTarget.checked)}
            />
            <span>
              Keep Description for AI sections
              {descriptionSectionCount > 0 ? ` (${descriptionSectionCount})` : ''}
            </span>
          </label>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void rebuildPreview()}
            disabled={!workspacePath || rebuilding || submitting}
            title="Rebuild design-system/index.html from the canonical design-system package"
          >
            {rebuilding ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Rebuild preview
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            Save sources
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourceTextarea({
  id,
  label,
  value,
  accept,
  placeholder,
  required,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  accept: string;
  placeholder: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
        <label className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border border-border px-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground">
          <Upload className="size-3" />
          Choose file
          <input
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              void file.text().then(onChange);
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        className="min-h-36 resize-y font-mono text-[11px]"
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

function sourceLabel(key: (typeof REQUIRED_SOURCE_KEYS)[number]): string {
  if (key === 'designMd') return 'design-system/Design.md';
  if (key === 'tokensCss') return 'design-system/tokens.css';
  return 'design-system/components.css';
}

function hasDescriptionLayer(component: ProjectDesignSystemBrowser['components'][number]): boolean {
  return Boolean((component as { descriptionLayer?: unknown }).descriptionLayer);
}
