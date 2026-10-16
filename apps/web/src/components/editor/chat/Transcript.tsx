/** Chat transcript: user/assistant bubbles and tool call rendering. */
import {
  Image as ImageIcon,
  Download,
  FileText,
  RefreshCw,
  Loader2,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import {
  type AssistantActiveRun,
  type AssistantRunMetrics,
  type ComponentReuseRunSummary,
  type DesignDirectionOption,
} from '@sber-designer/shared-types';
import { Button } from '@/components/ui/button';
import {
  scopeFailureRecoveryActions,
  transcriptRunNotice,
  type ChatRunStatus,
} from '@/lib/agent-run-status';
import type { AgentRunRenderProof } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { type ChatMessage } from '@/stores/chat-store';
import { parseInterviewBlock } from '@/lib/interview-question';
import {
  isDirectionPickerResolved,
  parseDirectionPickerMessagePayload,
  type DirectionPickerMessagePayload,
} from '@/lib/design-direction-picker';
import { ChatMarkdown } from './Markdown';
import { AssistantWithTools } from '../ToolCallBubble';
import { InterviewQuestions } from './InterviewQuestions';
import { RunFeedbackCard } from './RunFeedbackCard';
import { findLatestPlanDocumentPath } from '@/lib/plan-document';
import {
  componentPackSummaryFromMetadata,
  qualitySummaryFromMetadata,
} from '@/lib/chat-transcript';
import { PlanDocumentCard } from './PlanDocumentCard';
import { ComponentPackStatusCard } from './ComponentPackStatusCard';
import { QualitySummaryCard } from './QualitySummaryCard';
import { RunReviewCard } from './RunReviewCard';
import {
  ExternalRuntimeContextRow,
  externalRuntimeContextFor,
  extractAgentRunId,
  formatRunMetrics,
  TokenUsageFooter,
} from './run-metadata';

export function Transcript({
  messages,
  pending,
  iterations,
  truncated,
  runStatus,
  runErrorCode,
  runSummary,
  blockingRun,
  componentReuse,
  runMetrics,
  debugLogPath,
  runManifestPath,
  onContinue,
  onViewBlockingRun,
  onReprobeRender,
  onExportEvidence,
  exportingEvidenceRunId,
  reprobingRenderRunId,
  renderProof,
  onQuickReply,
  onDirectionSelect,
  onGenerateFromPlan,
  onRefinePlan,
}: {
  messages: ChatMessage[];
  pending: boolean;
  iterations: number | null;
  truncated: boolean;
  runStatus: ChatRunStatus;
  runErrorCode: string | null;
  runSummary: string | null;
  blockingRun: AssistantActiveRun | null;
  componentReuse: ComponentReuseRunSummary | null;
  runMetrics: AssistantRunMetrics | null;
  debugLogPath: string | null;
  runManifestPath: string | null;
  onContinue: () => void;
  onViewBlockingRun: (run: AssistantActiveRun) => void;
  onReprobeRender: (runId: string) => void;
  onExportEvidence: (runId: string) => void;
  exportingEvidenceRunId: string | null;
  reprobingRenderRunId: string | null;
  renderProof: AgentRunRenderProof | null;
  /** Send a composed reply (used by the interview answer controls). */
  onQuickReply?: (text: string) => void;
  onDirectionSelect?: (
    payload: DirectionPickerMessagePayload,
    option: DesignDirectionOption,
  ) => void;
  onGenerateFromPlan?: (path: string) => void;
  onRefinePlan?: (path: string) => void;
}) {
  // Index tool results by toolCallId so AssistantWithTools can pair them.
  const resultsByCallId = new Map<string, ChatMessage>();
  for (const m of messages) {
    if (m.role === 'tool' && m.toolCallId) resultsByCallId.set(m.toolCallId, m);
  }

  // Hide tool messages — they're rendered inline beneath the assistant
  // message that asked for them.
  const visible = messages.filter((m) => m.role !== 'tool');
  const planDocumentPath = findLatestPlanDocumentPath(messages);
  const runNotice = pending
    ? null
    : transcriptRunNotice({
        runStatus,
        truncated,
        iterations,
        runSummary,
        componentReuse,
        renderProof,
        errorCode: runErrorCode,
        blockingRun,
      });
  const evidenceRunId = extractAgentRunId(runManifestPath);
  const canExportEvidence = Boolean(evidenceRunId) && runStatus === 'failed';
  const exportingEvidence = evidenceRunId === exportingEvidenceRunId;
  const canReprobeRender = Boolean(evidenceRunId) && runNotice?.action === 'reprobe';
  const reprobingRender = evidenceRunId === reprobingRenderRunId;
  const scopeRecoveryActions =
    runNotice?.action === 'scope-recovery' ? scopeFailureRecoveryActions() : [];
  const hasPersistedTurnUsage = visible.some(
    (message) => message.role === 'assistant' && Boolean(message.tokenUsage),
  );
  const runMetricsText = hasPersistedTurnUsage ? null : formatRunMetrics(runMetrics);
  const renderProofConfirmed = renderProof?.status === 'confirmed';
  const canRateRun =
    Boolean(evidenceRunId) &&
    (runStatus === 'complete' || runStatus === 'needs_review') &&
    !pending;

  return (
    <div className="min-w-0 space-y-3">
      {visible.map((m, index) => {
        const externalRuntimeContext = externalRuntimeContextFor(m);
        if (externalRuntimeContext) {
          return (
            <ExternalRuntimeContextRow
              key={m.id}
              event={externalRuntimeContext}
              content={m.content}
            />
          );
        }
        if (m.role === 'user') return <UserBubble key={m.id} message={m} />;
        const componentPack = componentPackSummaryFromMetadata(m.metadata);
        if (m.role === 'assistant' && componentPack) {
          return <ComponentPackStatusCard key={m.id} summary={componentPack} />;
        }
        const qualitySummary = qualitySummaryFromMetadata(m.metadata);
        if (m.role === 'assistant' && qualitySummary) {
          return <QualitySummaryCard key={m.id} summary={qualitySummary} />;
        }
        const directionPicker = parseDirectionPickerMessagePayload(m.metadata);
        if (m.role === 'assistant' && directionPicker) {
          const resolved = isDirectionPickerResolved(visible, index, directionPicker);
          return (
            <DirectionPickerBubble
              key={m.id}
              message={m}
              payload={directionPicker}
              disabled={pending || resolved || !onDirectionSelect}
              onSelect={(option) => onDirectionSelect?.(directionPicker, option)}
            />
          );
        }
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          return <AssistantWithTools key={m.id} message={m} results={resultsByCallId} />;
        }
        return <AssistantBubble key={m.id} message={m} onQuickReply={onQuickReply} />;
      })}
      {planDocumentPath && onGenerateFromPlan && onRefinePlan && (
        <PlanDocumentCard
          path={planDocumentPath}
          disabled={pending}
          onGenerate={onGenerateFromPlan}
          onRefine={onRefinePlan}
        />
      )}
      {renderProofConfirmed ? (
        <div className="rounded-md border border-success/35 bg-success/10 px-3 py-2 text-xs text-foreground">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="size-3.5" />
            Runtime proof confirmed
          </div>
          <p className="text-muted-foreground">{renderProof.reason}</p>
        </div>
      ) : runNotice ? (
        <div
          className={cn(
            'rounded-md border px-3 py-2 text-xs text-foreground',
            runNotice.tone === 'error'
              ? 'border-destructive/40 bg-destructive/10'
              : runNotice.tone === 'warning'
                ? 'border-warning/35 bg-warning/10'
                : runNotice.tone === 'info'
                  ? 'border-primary/25 bg-primary/5'
                  : 'border-border/60 bg-muted/30',
          )}
        >
          <div className="mb-1 font-medium">{runNotice.title}</div>
          <p className="text-muted-foreground">{runNotice.detail}</p>
          {renderProof && !renderProofConfirmed && (
            <p className="mt-2 rounded border border-border/60 bg-background/50 px-2 py-1.5 text-muted-foreground">
              Render proof {renderProof.status}: {renderProof.reason}
            </p>
          )}
          {(runNotice.action === 'continue' ||
            scopeRecoveryActions.length > 0 ||
            (runNotice.action === 'view-run' && blockingRun) ||
            canReprobeRender ||
            canExportEvidence) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {runNotice.action === 'continue' && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  onClick={onContinue}
                  disabled={pending}
                >
                  <RefreshCw className="size-3.5" />
                  Continue run
                </Button>
              )}
              {runNotice.action === 'view-run' && blockingRun && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  onClick={() => onViewBlockingRun(blockingRun)}
                  disabled={pending}
                >
                  <MessageCircle className="size-3.5" />
                  View run
                </Button>
              )}
              {scopeRecoveryActions.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  onClick={() => onQuickReply?.(action.prompt)}
                  disabled={pending || !onQuickReply}
                >
                  <RefreshCw className="size-3.5" />
                  {action.label}
                </Button>
              ))}
              {canReprobeRender && evidenceRunId && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  onClick={() => onReprobeRender(evidenceRunId)}
                  disabled={pending || reprobingRender}
                >
                  {reprobingRender ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  {reprobingRender ? 'Checking...' : 'Re-run render proof'}
                </Button>
              )}
              {canExportEvidence && evidenceRunId && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  onClick={() => onExportEvidence(evidenceRunId)}
                  disabled={exportingEvidence}
                >
                  <Download className="size-3.5" />
                  {exportingEvidence ? 'Exporting...' : 'Export evidence'}
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        (iterations !== null || runMetricsText) && (
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
            {[
              iterations !== null ? `${iterations} agent turn${iterations === 1 ? '' : 's'}` : null,
              runMetricsText,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        )
      )}
      {debugLogPath && (
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Agent log:</span>{' '}
          <span className="break-all font-mono">{debugLogPath}</span>
        </div>
      )}
      {runManifestPath && (
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Agent run:</span>{' '}
          <span className="break-all font-mono">{runManifestPath}</span>
        </div>
      )}
      {canRateRun && evidenceRunId && <RunFeedbackCard runId={evidenceRunId} />}
      {runStatus === 'needs_review' && evidenceRunId && !pending && (
        <RunReviewCard runId={evidenceRunId} />
      )}
      {pending && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Thinking…
        </div>
      )}
    </div>
  );
}

function DirectionPickerBubble({
  message,
  payload,
  disabled,
  onSelect,
}: {
  message: ChatMessage;
  payload: DirectionPickerMessagePayload;
  disabled: boolean;
  onSelect: (option: DesignDirectionOption) => void;
}) {
  const time = formatMessageTime(message.createdAt);
  return (
    <div className="min-w-0 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>Assistant · direction</span>
        {time && <span className="font-mono normal-case">{time}</span>}
      </div>
      <ChatMarkdown content={message.content} />
      <div className="mt-3 grid gap-2">
        {payload.options.map((option) => (
          <Button
            key={option.optionId}
            type="button"
            variant="outline"
            size="sm"
            className="group h-auto min-h-12 cursor-pointer justify-start whitespace-normal border-border bg-background px-3 py-2 text-left shadow-sm transition-colors hover:border-primary/60 hover:bg-primary/10 disabled:cursor-default"
            disabled={disabled}
            onClick={() => onSelect(option)}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary">
              {option.optionId}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{option.label}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {option.summary}
              </span>
            </span>
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-primary opacity-70 group-hover:opacity-100">
              Choose
            </span>
          </Button>
        ))}
      </div>
      {disabled && (
        <p className="mt-2 text-xs text-muted-foreground">
          {payload.options.length === 3 ? 'Direction selection is complete.' : 'Unavailable.'}
        </p>
      )}
    </div>
  );
}

function formatMessageTime(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function UserBubble({ message }: { message: ChatMessage }) {
  const time = formatMessageTime(message.createdAt);
  return (
    <div className="min-w-0 rounded-md bg-primary/10 px-3 py-2 text-sm">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>You</span>
        {time && <span className="font-mono normal-case">{time}</span>}
      </div>
      <div className="whitespace-pre-wrap break-words">{message.content}</div>
      {message.attachments && message.attachments.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {message.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex h-14 w-28 shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-primary/20 bg-background/70 px-1.5"
              title={attachment.name}
            >
              {attachment.kind === 'image' && attachment.dataUrl ? (
                <>
                  <img src={attachment.dataUrl} alt="" className="h-full w-14 object-cover" />
                  <ImageIcon className="size-3 shrink-0 text-muted-foreground" />
                </>
              ) : (
                <>
                  {attachment.kind === 'image' ? (
                    <ImageIcon className="size-3.5 shrink-0 text-primary" />
                  ) : (
                    <FileText className="size-3.5 shrink-0 text-primary" />
                  )}
                  <span className="min-w-0 truncate text-[11px]">
                    {attachment.sourceUrl ? `${attachment.name} · URL` : attachment.name}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssistantBubble({
  message,
  onQuickReply,
}: {
  message: ChatMessage;
  onQuickReply?: ((text: string) => void) | undefined;
}) {
  const isExternal = message.external === true;
  const time = formatMessageTime(message.createdAt);
  const interview = onQuickReply
    ? parseInterviewBlock(message.content)
    : { block: null, rest: message.content };
  return (
    <div
      className={cn(
        'min-w-0 rounded-md px-3 py-2 text-sm',
        isExternal
          ? 'border border-primary/30 bg-primary/5 text-foreground'
          : 'border border-border bg-card text-foreground',
      )}
    >
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{isExternal ? 'External' : 'Assistant'}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          {message.meta && (
            <>
              {message.meta.sessionMode && (
                <span className="rounded bg-muted px-1 font-mono uppercase">
                  {message.meta.sessionMode}
                </span>
              )}
              <span
                className="truncate font-mono normal-case"
                title={`${message.meta.provider ?? 'default'} / ${message.meta.model ?? 'default'}`}
              >
                {message.meta.model}
              </span>
            </>
          )}
          {time && <span className="font-mono normal-case">{time}</span>}
        </span>
      </div>
      {interview.rest.trim() && <ChatMarkdown content={interview.rest} />}
      {interview.block && onQuickReply && (
        <InterviewQuestions block={interview.block} onSubmit={onQuickReply} />
      )}
      <TokenUsageFooter usage={message.tokenUsage} />
    </div>
  );
}
