import { useEffect, useMemo, useState } from 'react';
import { FileImage, Globe2, Link2, Loader2, Sparkles } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import {
  createHtmlDesignSystemReferenceDraftDetail,
  type HtmlDesignSystemReferenceDraftDetail,
  type HtmlDesignSystemReferenceSourceKind,
} from '@/lib/html-design-system-reference';
import { cn } from '@/lib/utils';
import { ACCEPTED_ATTACHMENTS } from '../chat/attachments';

interface ExtractReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (detail: HtmlDesignSystemReferenceDraftDetail) => void;
}

export function buildExtractReferenceDialogState(input: {
  sourceKind: HtmlDesignSystemReferenceSourceKind;
  files: readonly File[];
  referenceUrl: string;
  submitting: boolean;
}): {
  sourceReady: boolean;
  canSubmit: boolean;
} {
  const sourceReady =
    input.sourceKind === 'attachment'
      ? input.files.length > 0
      : input.referenceUrl.trim().length > 0;
  return {
    sourceReady,
    canSubmit: sourceReady && !input.submitting,
  };
}

export function ExtractReferenceDialog({
  open,
  onOpenChange,
  onCreate,
}: ExtractReferenceDialogProps) {
  const [sourceKind, setSourceKind] = useState<HtmlDesignSystemReferenceSourceKind>('attachment');
  const [files, setFiles] = useState<File[]>([]);
  const [referenceUrl, setReferenceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [includePreview, setIncludePreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) return;
    setSourceKind('attachment');
    setFiles([]);
    setReferenceUrl('');
    setNotes('');
    setIncludePreview(false);
    setSubmitting(false);
  }, [open]);

  const dialogState = useMemo(
    () => buildExtractReferenceDialogState({ sourceKind, files, referenceUrl, submitting }),
    [files, referenceUrl, sourceKind, submitting],
  );

  const submit = () => {
    if (!dialogState.canSubmit) return;
    setSubmitting(true);
    onCreate(
      createHtmlDesignSystemReferenceDraftDetail({
        sourceKind,
        ...(sourceKind === 'pixso' ? { pixsoUrl: referenceUrl } : {}),
        ...(sourceKind === 'url' ? { referenceUrl } : {}),
        notes,
        includeDesignSystemPreview: includePreview,
        files: sourceKind === 'attachment' ? files : [],
        autoSend: true,
      }),
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(720px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Extract from reference
          </DialogTitle>
          <DialogDescription>
            Create a reviewable HTML-first design-system proposal from a visual reference.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-2">
            <SourceKindButton
              active={sourceKind === 'attachment'}
              icon={FileImage}
              label="File"
              onClick={() => setSourceKind('attachment')}
            />
            <SourceKindButton
              active={sourceKind === 'pixso'}
              icon={Link2}
              label="Pixso URL"
              onClick={() => {
                setSourceKind('pixso');
                setReferenceUrl('');
              }}
            />
            <SourceKindButton
              active={sourceKind === 'url'}
              icon={Globe2}
              label="Web URL"
              onClick={() => {
                setSourceKind('url');
                setReferenceUrl('');
              }}
            />
          </div>

          {sourceKind === 'attachment' ? (
            <div className="grid gap-2">
              <Label htmlFor="reference-files">Reference file</Label>
              <Input
                id="reference-files"
                type="file"
                multiple
                accept={ACCEPTED_ATTACHMENTS}
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              />
              {files.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {files.map((file) => file.name).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="reference-url">
                {sourceKind === 'pixso' ? 'Pixso URL' : 'Reference URL'}
              </Label>
              <Input
                id="reference-url"
                value={referenceUrl}
                placeholder={
                  sourceKind === 'pixso' ? 'https://pixso.com/...' : 'https://example.com/...'
                }
                onChange={(event) => setReferenceUrl(event.target.value)}
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="reference-notes">Notes</Label>
            <Textarea
              id="reference-notes"
              value={notes}
              rows={3}
              placeholder="Optional focus, constraints, or naming hints."
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includePreview}
              onChange={(event) => setIncludePreview(event.target.checked)}
              className="size-3.5"
            />
            <span>Also create a proposal preview</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!dialogState.canSubmit}>
            {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Create proposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourceKindButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof FileImage;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm transition-colors',
        active
          ? 'border-primary/50 bg-primary/10 text-foreground'
          : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
