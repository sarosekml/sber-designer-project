import type { AssistantActiveRun, ComponentReuseRunSummary } from '@sber-designer/shared-types';

export type ChatRunStatus =
  | 'running'
  | 'complete'
  | 'failed'
  | 'needs_review'
  | 'cancelled'
  | 'preflight_rejected'
  | null;

export interface TranscriptRunNoticeInput {
  runStatus: ChatRunStatus;
  truncated: boolean;
  iterations: number | null;
  runSummary?: string | null;
  componentReuse?: ComponentReuseRunSummary | null;
  renderProof?: { canReprobe?: boolean | null } | null;
  errorCode?: string | null;
  blockingRun?: AssistantActiveRun | null;
}

export interface TranscriptRunNotice {
  tone: 'neutral' | 'info' | 'warning' | 'error';
  title: string;
  detail: string;
  action: 'continue' | 'reprobe' | 'scope-recovery' | 'view-run' | null;
}

export interface ScopeFailureRecoveryAction {
  id: 'create-new-screen' | 'project-design-system-scope' | 'retry-current-screen';
  label: string;
  prompt: string;
}

export function transcriptRunNotice(input: TranscriptRunNoticeInput): TranscriptRunNotice | null {
  if (input.runStatus === 'preflight_rejected') {
    if (
      input.blockingRun &&
      (input.errorCode === 'same_screen_active' || input.errorCode === 'same_file_active')
    ) {
      const title = input.blockingRun?.title?.trim() || 'The active run';
      const status = input.blockingRun?.status ?? 'running';
      const displayName = input.blockingRun.displayName?.trim() || 'another user';
      return {
        tone: 'error',
        title: 'Agent is busy',
        detail: `Run started by ${displayName}. ${title} is still ${status}.`,
        action: 'view-run',
      };
    }
    return {
      tone: 'error',
      title: 'Request rejected before agent start',
      detail: 'No agent turns ran. Adjust the request or selected model/runtime and send again.',
      action: null,
    };
  }
  if (input.runStatus === 'needs_review' && input.truncated) {
    return {
      tone: 'warning',
      title: 'Source saved, review needed',
      detail: `${formatAgentTurns(input.iterations)}Validation or preview did not finish, but the changed files were preserved.`,
      action: 'continue',
    };
  }
  if (input.runStatus === 'needs_review' && isRuntimeProofPendingSummary(input.runSummary)) {
    const canReprobe = input.renderProof?.canReprobe === true;
    return {
      tone: 'info',
      title: 'Screen saved — browser verification pending',
      detail: `${formatAgentTurns(input.iterations)}Source saved, screen renders from available evidence, and browser proof can run when JS-capable preview evidence is available.`,
      action: canReprobe ? 'reprobe' : null,
    };
  }
  if (input.runStatus === 'failed' && isCurrentScreenScopeFailure(input.runSummary)) {
    return {
      tone: 'error',
      title: 'Task hit the current-screen write scope',
      detail: `${formatAgentTurns(input.iterations)}The requested change tried to write outside the selected screen. Continue with the preserved chat context using the right target.`,
      action: 'scope-recovery',
    };
  }
  if (input.runStatus === 'failed' && input.runSummary?.trim()) {
    return {
      tone: 'error',
      title: 'Agent run failed',
      detail: `${formatAgentTurns(input.iterations)}${compactRunSummary(input.runSummary)}`,
      action: null,
    };
  }
  if (input.runStatus === 'cancelled') {
    return {
      tone: 'neutral',
      title: 'Agent run cancelled',
      detail: `${formatAgentTurns(input.iterations)}${
        input.runSummary?.trim() ? compactRunSummary(input.runSummary) : 'Cancelled by user.'
      }`,
      action: null,
    };
  }
  if (input.truncated) {
    return {
      tone: 'warning',
      title: 'Agent paused at the iteration limit',
      detail: `${formatAgentTurns(input.iterations)}Progress and tool results are preserved.`,
      action: 'continue',
    };
  }
  if (input.runStatus === 'failed') {
    return {
      tone: 'error',
      title: 'Agent run failed',
      detail: `${formatAgentTurns(input.iterations)}Check the transcript and run log before retrying.`,
      action: null,
    };
  }
  if (input.runStatus === 'needs_review') {
    return null;
  }
  if (input.componentReuse && input.componentReuse.missing.length > 0) {
    return {
      tone: 'warning',
      title: 'Project components were missed',
      detail: componentReuseDetail(input.componentReuse),
      action: null,
    };
  }
  return null;
}

export function scopeFailureRecoveryActions(): ScopeFailureRecoveryAction[] {
  return [
    {
      id: 'create-new-screen',
      label: 'Create new screen and continue',
      prompt:
        'Create a new screen and continue this task with the preserved context. Use a dedicated page or screen for the result; do not edit Index unless I explicitly ask for Index.',
    },
    {
      id: 'project-design-system-scope',
      label: 'Switch to project/design-system task',
      prompt:
        'Continue this as a project/design-system task with the preserved context. For html-first projects use design-system/Design.md, design-system/tokens.css, design-system/components.css, and design-system/refs/** when they fit the request.',
    },
    {
      id: 'retry-current-screen',
      label: 'Retry on current screen',
      prompt:
        'Retry on the current screen only with the preserved context. Keep every write inside the active screen target and do not create another screen.',
    },
  ];
}

function isRuntimeProofPendingSummary(summary: string | null | undefined): boolean {
  if (!summary) return false;
  return /runtime proof pending|browser verification pending|runtime screen root was not proven|runtime screen root marker mismatch/iu.test(
    summary,
  );
}

function isCurrentScreenScopeFailure(summary: string | null | undefined): boolean {
  if (!summary) return false;
  return /outside (?:the )?current screen scope|current screen scope (?:blocked|guard)|blocked by (?:the )?current screen scope|screen_create is not allowed while editing the current screen/iu.test(
    summary,
  );
}

function formatAgentTurns(iterations: number | null): string {
  if (iterations === null) return '';
  return `${iterations} agent turn${iterations === 1 ? '' : 's'} completed. `;
}

function compactRunSummary(summary: string): string {
  const compact = summary.replace(/\s+/gu, ' ').trim();
  return compact.length <= 220 ? compact : `${compact.slice(0, 217).trimEnd()}...`;
}

function componentReuseDetail(summary: ComponentReuseRunSummary): string {
  const missing = summary.missing.length > 0 ? summary.missing.join(', ') : 'none';
  const used = summary.used.length > 0 ? summary.used.join(', ') : 'none';
  const score = summary.score ? [`Reuse score: ${summary.score.label}.`] : [];
  const substitutions = formatComponentReuseSubstitutions(summary);
  return [
    ...score,
    `Missing: ${missing}.`,
    ...(substitutions ? [`Substituted: ${substitutions}.`] : []),
    `Used: ${used}.`,
    'Re-run with the component pack, re-index the project, or add component guidance.',
    'You can accept the draft anyway.',
  ].join(' ');
}

function formatComponentReuseSubstitutions(summary: ComponentReuseRunSummary): string {
  const substitutions = summary.substituted ?? [];
  if (substitutions.length === 0) return '';
  return substitutions
    .slice(0, 3)
    .map((item) => `${item.expected} -> ${item.used.join(', ') || 'unknown substitute'}`)
    .join('; ');
}
