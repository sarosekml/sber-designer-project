import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Loader2, Pencil, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { fetchFile, writeFile } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { ChatMarkdown } from './Markdown';

export function PlanDocumentCard({
  path,
  disabled,
  onGenerate,
  onRefine,
}: {
  path: string;
  disabled?: boolean;
  onGenerate: (path: string) => void;
  onRefine: (path: string) => void;
}) {
  const [contents, setContents] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setContents(null);
    setError(null);
    void fetchFile(path, controller.signal)
      .then((file) => setContents(file.contents))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Plan document is unavailable.');
        }
      });
    return () => controller.abort();
  }, [path]);

  const openEditor = () => {
    setDraft(contents ?? '');
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await writeFile(path, draft);
      setContents(draft);
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium">
            <FileText className="size-4 text-primary" />
            Editable plan
          </div>
          <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{path}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7"
            disabled={contents === null}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7"
            disabled={disabled || contents === null}
            onClick={openEditor}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>
      </div>
      <div
        className={cn(
          'mt-3 overflow-auto rounded border border-border/60 bg-background/70 p-3',
          expanded ? 'max-h-72' : 'max-h-28',
        )}
      >
        {contents === null && !error ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading plan…
          </span>
        ) : error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : (
          <ChatMarkdown content={contents ?? ''} />
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled || !contents}
          onClick={() => onGenerate(path)}
        >
          <Sparkles className="size-3.5" /> Generate from plan
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => onRefine(path)}
        >
          Refine plan
        </Button>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit plan</DialogTitle>
            <DialogDescription>{path}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-[55vh] resize-y font-mono text-xs"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving || !draft.trim()}>
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
