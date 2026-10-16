import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { AgentRunReviewAnnotation } from '@sber-designer/shared-types';

import { Button } from '@/components/ui/button';
import { fetchAgentRunReview, markAgentRunReviewed } from '@/lib/api/agent-runs';
import { fetchProject } from '@/lib/api/project';
import { shouldAdoptFetchedProject } from '@/lib/project-adoption';
import { useProjectStore } from '@/stores/project-store';

export function RunReviewCard({ runId }: { runId: string }) {
  const [review, setReview] = useState<AgentRunReviewAnnotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchAgentRunReview(runId, controller.signal)
      .then(setReview)
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Unable to load review status.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [runId]);

  const markReviewed = async () => {
    if (saving || review) return;
    setSaving(true);
    setError(null);
    try {
      const savedReview = await markAgentRunReviewed(runId);
      setReview(savedReview);
      try {
        const project = await fetchProject();
        if (shouldAdoptFetchedProject(useProjectStore.getState().project, project)) {
          useProjectStore.getState().setBaseline(project);
        }
      } catch {
        setError('Review saved, but the screen status could not refresh. Reload the project.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to mark the run reviewed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-[11px] text-muted-foreground"
      data-testid="agent-run-review"
    >
      {review ? (
        <div className="flex items-center gap-1.5 text-foreground">
          <Check className="size-3.5 text-success" />
          Reviewed by {review.reviewer} · {new Date(review.reviewedAt).toLocaleString()}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span>
            Confirm the remaining findings were reviewed without changing the run outcome.
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 shrink-0"
            onClick={() => void markReviewed()}
            disabled={loading || saving}
          >
            {(loading || saving) && <Loader2 className="size-3 animate-spin" />}
            Mark reviewed
          </Button>
        </div>
      )}
      {error && (
        <p className="mt-1.5 text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
