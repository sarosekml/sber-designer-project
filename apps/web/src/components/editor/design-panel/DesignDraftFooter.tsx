/** Draft footer: pending visual changes list with apply/discard actions. */
import { CheckCircle2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDesignStore } from '@/stores/design-store';

import { changeLabelKey } from './shared';

export function DesignDraftFooter({
  workspacePath,
  onReload,
}: {
  workspacePath?: string;
  onReload: () => Promise<void>;
}) {
  const changes = useDesignStore((s) => s.draftChanges);
  const resetDraft = useDesignStore((s) => s.resetDraft);
  const applyDraft = useDesignStore((s) => s.applyDraft);
  const applyStatus = useDesignStore((s) => s.applyStatus);
  const applyError = useDesignStore((s) => s.applyError);
  const dirty = changes.length > 0;
  return (
    <div className="shrink-0 border-t border-border px-3 py-3">
      {applyError && (
        <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive-foreground">
          {applyError}
        </div>
      )}
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className={dirty ? 'font-medium text-foreground' : 'text-muted-foreground'}>
          {dirty
            ? `${changes.length} visual change${changes.length === 1 ? '' : 's'}`
            : 'No visual changes'}
        </span>
        {applyStatus === 'success' && (
          <span className="inline-flex items-center gap-1 text-[11px] text-success">
            <CheckCircle2 className="size-3" />
            Applied
          </span>
        )}
      </div>
      {dirty && (
        <div className="mb-2 max-h-20 overflow-y-auto rounded-md border border-border bg-card px-2 py-1">
          {changes.map((change) => (
            <div
              key={changeLabelKey(change)}
              className="truncate text-[10px] text-muted-foreground"
              title={change.label}
            >
              {change.label}
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!dirty || applyStatus === 'applying'}
          onClick={resetDraft}
        >
          Reset
        </Button>
        <Button
          size="sm"
          disabled={!dirty || applyStatus === 'applying'}
          onClick={async () => {
            await applyDraft(workspacePath);
            if (useDesignStore.getState().applyStatus === 'success') {
              await onReload();
            }
          }}
        >
          {applyStatus === 'applying' ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Apply visual changes
        </Button>
      </div>
    </div>
  );
}
