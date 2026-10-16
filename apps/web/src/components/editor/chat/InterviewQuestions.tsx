/**
 * 0083 UX-1 — interactive controls for the Description for AI interview.
 * Renders the agent's `sd:interview` block: per question, accept the suggested
 * answer / type your own / skip, then submit a composed reply via the chat.
 */
import { useState, type ComponentType } from 'react';
import { BookOpen, Check, FileText, Pencil, Send, SkipForward } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  composeInterviewReply,
  defaultAnswerMode,
  defaultInterviewWriteTarget,
  interviewWriteTargetOptions,
  type InterviewAnswer,
  type InterviewAnswerMode,
  type InterviewBlock,
  type InterviewWriteTarget,
} from '@/lib/interview-question';
import { useProjectStore } from '@/stores/project-store';

interface AnswerDraft {
  mode: InterviewAnswerMode;
  text: string;
}

export function InterviewQuestions({
  block,
  disabled,
  onSubmit,
}: {
  block: InterviewBlock;
  disabled?: boolean;
  onSubmit: (reply: string) => void;
}) {
  const projectKind = useProjectStore((s) => s.project?.projectKind);
  const writeTargetOptions = interviewWriteTargetOptions(projectKind);
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>(() =>
    Object.fromEntries(
      block.questions.map((question) => [
        question.id,
        { mode: defaultAnswerMode(question), text: '' },
      ]),
    ),
  );
  const [submitted, setSubmitted] = useState(false);
  // 0112: sidecar is always canonical; profile decides whether the default also
  // projects to Storybook or design-system/index.html.
  const [target, setTarget] = useState<InterviewWriteTarget>(() =>
    defaultInterviewWriteTarget(projectKind),
  );
  const locked = Boolean(disabled) || submitted;

  const update = (id: string, patch: Partial<AnswerDraft>) =>
    setAnswers((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { mode: 'skip', text: '' }), ...patch },
    }));

  const handleSubmit = () => {
    if (locked) return;
    const list: InterviewAnswer[] = block.questions.map((question) => {
      const draft = answers[question.id] ?? { mode: 'skip', text: '' };
      return {
        questionId: question.id,
        mode: draft.mode,
        ...(draft.mode === 'own' ? { text: draft.text } : {}),
      };
    });
    setSubmitted(true);
    onSubmit(composeInterviewReply(block, list, target));
  };

  return (
    <div className="mt-2 grid gap-2 rounded-md border border-primary/30 bg-background/60 p-2.5">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="truncate">Describe {block.componentName ?? block.componentId}</span>
        {block.progress && (
          <span className="shrink-0 font-mono normal-case">
            component {block.progress.index}/{block.progress.total}
          </span>
        )}
      </div>

      {block.questions.map((question, index) => {
        const draft = answers[question.id] ?? { mode: 'skip', text: '' };
        return (
          <div
            key={question.id}
            className="grid gap-1.5 rounded-md border border-border bg-card px-2.5 py-2"
          >
            <div className="text-xs font-medium">
              {index + 1}. {question.label}
            </div>
            {question.prompt && (
              <div className="text-[11px] text-muted-foreground">{question.prompt}</div>
            )}
            {question.suggestion && draft.mode === 'accept' && (
              <div className="rounded bg-muted/50 px-2 py-1 text-[11px] text-foreground">
                {question.suggestion}
              </div>
            )}
            {draft.mode === 'own' && (
              <Textarea
                value={draft.text}
                disabled={locked}
                rows={2}
                onChange={(event) => update(question.id, { text: event.target.value })}
                placeholder={
                  question.suggestion ? `Suggested: ${question.suggestion}` : 'Your answer…'
                }
                className="min-h-0 text-xs"
              />
            )}
            <div className="flex flex-wrap gap-1">
              {question.suggestion && (
                <ModeButton
                  active={draft.mode === 'accept'}
                  disabled={locked}
                  icon={Check}
                  label="Accept"
                  onClick={() => update(question.id, { mode: 'accept' })}
                />
              )}
              <ModeButton
                active={draft.mode === 'own'}
                disabled={locked}
                icon={Pencil}
                label="Own"
                onClick={() => update(question.id, { mode: 'own' })}
              />
              <ModeButton
                active={draft.mode === 'skip'}
                disabled={locked}
                icon={SkipForward}
                label="Skip"
                onClick={() => update(question.id, { mode: 'skip' })}
              />
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Save to</span>
        {writeTargetOptions.map((option) => (
          <ModeButton
            key={option.target}
            active={target === option.target}
            disabled={locked}
            icon={option.target === 'sidecar' ? FileText : BookOpen}
            label={option.label}
            title={option.title}
            onClick={() => setTarget(option.target)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          Tip: type “save and finish” anytime to stop.
        </span>
        <Button type="button" size="sm" className="h-7" onClick={handleSubmit} disabled={locked}>
          <Send className="size-3" />
          {submitted ? 'Submitted' : 'Submit answers'}
        </Button>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  icon: Icon,
  label,
  title,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors disabled:opacity-50',
        active
          ? 'border-primary/60 bg-primary/10 text-foreground'
          : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}
