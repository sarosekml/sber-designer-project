import { useCallback, useEffect, useState } from 'react';
import { Loader2, SquareStack } from 'lucide-react';
import {
  MODAL_WINDOW_MARKER,
  parseModalDimension,
  type ModalLongContent,
} from '@sber-designer/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { applyModalSize, fetchModalSizeBaseline } from '@/lib/api/design';
import {
  previewModalValues,
  readModalPreview,
  resetModalPreview,
  type ModalPreviewValues,
} from '@/lib/modal-preview';
import {
  modalSizeFieldErrors,
  modalSizePatchFromForm,
  type ModalSizeValues,
} from '@/lib/modal-size-form';
import { useDesignStore } from '@/stores/design-store';
import { useEditorStore } from '@/stores/editor-store';
import { usePatchStore } from '@/stores/patch-store';

type SectionStatus = 'loading' | 'ok' | 'unmanaged' | 'ambiguous' | 'no-preview';

const EMPTY: ModalSizeValues = { width: '', height: '', longContent: 'scroll' };

/**
 * Screen-level `Modal` size control (0132.3, §4.4). Reads the current contract
 * from the live DOM (never `.sdproj`), previews edits inline, and applies them
 * deterministically to the `data-sd-modal-window` — a managed target separate
 * from the element selection draft.
 */
export function ModalSurfaceSection({
  workspacePath,
  screenId,
  filePath,
}: {
  workspacePath?: string;
  screenId: string;
  filePath?: string;
}) {
  const previewWindow = useDesignStore((s) => s.previewWindow);
  const invalidateScreenPreview = useEditorStore((s) => s.invalidateScreenPreview);
  const [status, setStatus] = useState<SectionStatus>('loading');
  const [committed, setCommitted] = useState<ModalSizeValues>(EMPTY);
  const [draft, setDraft] = useState<ModalSizeValues>(EMPTY);
  const [baseline, setBaseline] = useState<{ hash: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readFromDom = useCallback(async () => {
    if (!previewWindow) {
      setStatus('no-preview');
      return;
    }
    setStatus('loading');
    try {
      const [snapshot, sourceBaseline] = await Promise.all([
        readModalPreview(previewWindow),
        filePath
          ? fetchModalSizeBaseline({
              ...(workspacePath ? { workspacePath } : {}),
              filePath,
            })
          : Promise.resolve(null),
      ]);
      if (snapshot.status !== 'ok' || !snapshot.values) {
        setStatus(snapshot.status);
        return;
      }
      setCommitted(snapshot.values);
      setDraft(snapshot.values);
      setBaseline(sourceBaseline ? { hash: sourceBaseline.hash } : null);
      setError(null);
      setStatus('ok');
    } catch {
      setStatus('no-preview');
    }
  }, [filePath, previewWindow, workspacePath]);

  useEffect(() => {
    void readFromDom();
    return () => {
      if (previewWindow) void resetModalPreview(previewWindow).catch(() => undefined);
    };
  }, [previewWindow, readFromDom, screenId]);

  const update = (partial: Partial<ModalSizeValues>) => {
    const next = { ...draft, ...partial };
    setDraft(next);
    if (!previewWindow) return;
    const preview = previewableModalValues(next, committed);
    void previewModalValues(previewWindow, preview).catch(() => undefined);
  };

  const resetDraft = () => {
    if (previewWindow) void resetModalPreview(previewWindow).catch(() => undefined);
    setDraft(committed);
    setError(null);
  };

  const errors = modalSizeFieldErrors(draft);
  const patch = status === 'ok' ? modalSizePatchFromForm(committed, draft) : null;
  const canApply = status === 'ok' && Boolean(patch) && !errors.width && !errors.height && !busy;

  const apply = async () => {
    if (!patch || !filePath) return;
    setBusy(true);
    setError(null);
    try {
      const result = await applyModalSize({
        ...(workspacePath ? { workspacePath } : {}),
        screenId,
        filePath,
        patch,
        ...(baseline ? { baseline } : {}),
      });
      usePatchStore.getState().recordDiffs([{ ...result.diff, source: 'visual' }]);
      setBaseline({ hash: result.baseline.hash });
      setCommitted(draft);
      if (previewWindow) await resetModalPreview(previewWindow).catch(() => undefined);
      // Reload the canvas; the DOM (and committed values) refresh from the file.
      invalidateScreenPreview(screenId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-md border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
        <SquareStack className="size-3.5 text-primary" />
        Modal
      </div>
      {status === 'loading' || status === 'no-preview' ? (
        <p className="text-xs text-muted-foreground">
          Open this modal in the canvas to read and edit its size.
        </p>
      ) : status === 'unmanaged' ? (
        <p className="text-xs text-muted-foreground">
          Unmanaged size — no <span className="font-mono">{MODAL_WINDOW_MARKER}</span> on this
          screen. Ask the assistant to restore the modal size contract.
        </p>
      ) : status === 'ambiguous' ? (
        <p className="text-xs text-warning">
          Ambiguous contract — more than one{' '}
          <span className="font-mono">{MODAL_WINDOW_MARKER}</span> found. Keep exactly one.
        </p>
      ) : (
        <div className="grid gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Width
              <Input
                value={draft.width}
                onChange={(event) => update({ width: event.target.value })}
                placeholder="640px"
                disabled={busy}
                aria-invalid={errors.width || undefined}
                className="h-8"
              />
            </label>
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Height
              <Input
                value={draft.longContent === 'grow' ? '' : draft.height}
                onChange={(event) => update({ height: event.target.value })}
                placeholder={draft.longContent === 'grow' ? 'auto' : 'auto'}
                disabled={busy || draft.longContent === 'grow'}
                aria-invalid={errors.height || undefined}
                className="h-8"
              />
            </label>
          </div>
          <label className="grid gap-1 text-[11px] text-muted-foreground">
            Long content
            <div className="[&_[data-slot=native-select-wrapper]]:w-full">
              <NativeSelect
                value={draft.longContent}
                onChange={(event) =>
                  update({ longContent: event.target.value as ModalLongContent })
                }
                className="h-8 w-full"
                disabled={busy}
              >
                <NativeSelectOption value="scroll">Scroll body</NativeSelectOption>
                <NativeSelectOption value="grow">Grow modal</NativeSelectOption>
              </NativeSelect>
            </div>
          </label>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={resetDraft}
              disabled={busy || !patch}
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void apply()}
              disabled={!canApply || !filePath}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function previewableModalValues(
  draft: ModalSizeValues,
  committed: ModalSizeValues,
): ModalPreviewValues {
  const width = parseModalDimension(draft.width, { allowAuto: false });
  const height = parseModalDimension(draft.height, { allowAuto: true });
  return {
    width: width.ok && width.value ? width.value : committed.width,
    height: height.ok && height.value ? height.value : committed.height,
    longContent: draft.longContent,
  };
}
