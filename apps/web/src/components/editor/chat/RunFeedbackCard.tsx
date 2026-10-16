import { useEffect, useState } from 'react';
import { Check, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchAgentRunFeedback,
  saveAgentRunFeedback,
  type AgentRunFeedback,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';

export function RunFeedbackCard({ runId }: { runId: string }) {
  const [feedback, setFeedback] = useState<AgentRunFeedback | null>(null);
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFeedback(null);
    setRating(null);
    setReason('');
    setError(null);
    void fetchAgentRunFeedback(runId, controller.signal)
      .then((saved) => {
        setFeedback(saved);
        setRating(saved?.rating ?? null);
        setReason(saved?.reason ?? '');
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load run feedback.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [runId]);

  const normalizedReason = reason.trim() || null;
  const dirty =
    rating !== null &&
    (feedback?.rating !== rating || (feedback?.reason ?? null) !== normalizedReason);
  const handleSave = async () => {
    if (!rating || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveAgentRunFeedback(runId, { rating, reason: normalizedReason });
      setFeedback(saved);
      setRating(saved.rating);
      setReason(saved.reason ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save run feedback.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground"
      data-testid="agent-run-feedback"
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">Rate this run</span>
        {loading && <Loader2 className="size-3 animate-spin" aria-label="Loading run feedback" />}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className={cn('h-6 w-6', rating === 'up' && 'bg-success/15 text-success')}
          aria-label="Helpful run"
          aria-pressed={rating === 'up'}
          onClick={() => setRating('up')}
          disabled={loading || saving}
        >
          <ThumbsUp className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className={cn('h-6 w-6', rating === 'down' && 'bg-destructive/10 text-destructive')}
          aria-label="Unhelpful run"
          aria-pressed={rating === 'down'}
          onClick={() => setRating('down')}
          disabled={loading || saving}
        >
          <ThumbsDown className="size-3.5" />
        </Button>
        {feedback && !dirty && !saving && (
          <span className="ml-auto flex items-center gap-1 text-success">
            <Check className="size-3" /> Saved
          </span>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={240}
          placeholder="Short reason (optional)"
          aria-label="Run feedback reason"
          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
          disabled={loading || saving}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7"
          onClick={() => void handleSave()}
          disabled={loading || saving || !dirty}
        >
          {saving && <Loader2 className="size-3 animate-spin" />}
          Save
        </Button>
      </div>
      {error && (
        <p className="mt-1.5 text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
