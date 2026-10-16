import type { CompleteAgentRunInput } from '../../agent/run-recorder';
import type { TaskRelevantComponentPack } from '../../component-intelligence/component-pack';

export type RunFinalizationGateId =
  | 'component_replacement'
  | 'component_role_contract'
  | 'screen_craft'
  | 'screen_redesign_fidelity'
  | 'design_system_proposal'
  | 'selection_target'
  | 'story_implementation'
  | 'story_identity'
  | 'preview_freshness'
  | 'no_visible_write'
  | 'screen_root_marker'
  | 'target_diff'
  | 'render_acceptance';

export type RunFinalizationTaskKind =
  | 'screen_generation'
  | 'screen_redesign'
  | 'screen_edit'
  | 'unknown';

type FailureStatus = Extract<CompleteAgentRunInput['status'], 'failed' | 'needs_review'>;

export interface RunFinalizationGateContext {
  taskKind: RunFinalizationTaskKind;
  changedTargetCount: number;
}

export interface RunFinalizationGateDecisionInput {
  suggestedStatus?: FailureStatus;
  summary: string;
  notice: string;
  finishReason?: 'other';
  retryableNoTargetChanges?: boolean;
  retryableComponentGap?: boolean;
  componentGapRole?: string;
  componentGapReason?: string;
  retryableRenderFailure?: boolean;
  renderFailureReason?: string;
  renderFailureChangedFiles?: string[];
  retryableCraftFailure?: boolean;
  craftFailureSummary?: string;
  craftFailureFindings?: unknown[];
}

export interface RunFinalizationGateDecision extends RunFinalizationGateDecisionInput {
  gateId: RunFinalizationGateId;
  status: FailureStatus;
}

export interface RunFinalizationGate<TContext extends RunFinalizationGateContext> {
  id: RunFinalizationGateId;
  applies(ctx: TContext): boolean;
  run(
    ctx: TContext,
  ): RunFinalizationGateDecisionInput | null | Promise<RunFinalizationGateDecisionInput | null>;
}

const FINALIZATION_GATE_SEVERITY: Partial<
  Record<RunFinalizationGateId, Partial<Record<RunFinalizationTaskKind | 'default', FailureStatus>>>
> = {
  component_replacement: {
    default: 'failed',
  },
  component_role_contract: {
    screen_generation: 'needs_review',
    screen_redesign: 'needs_review',
    default: 'failed',
  },
  screen_craft: {
    screen_generation: 'needs_review',
    screen_redesign: 'needs_review',
    screen_edit: 'needs_review',
    default: 'failed',
  },
  screen_redesign_fidelity: {
    screen_redesign: 'needs_review',
    default: 'failed',
  },
  selection_target: {
    default: 'failed',
  },
  story_implementation: {
    default: 'failed',
  },
  story_identity: {
    default: 'failed',
  },
  preview_freshness: {
    default: 'needs_review',
  },
  no_visible_write: {
    default: 'failed',
  },
  screen_root_marker: {
    default: 'failed',
  },
  target_diff: {
    default: 'failed',
  },
  render_acceptance: {
    default: 'failed',
  },
};

export function finalizationFailureStatus(input: {
  gateId: RunFinalizationGateId;
  taskKind: RunFinalizationTaskKind;
  changedTargetCount: number;
  suggestedStatus?: FailureStatus | undefined;
}): FailureStatus {
  if (input.changedTargetCount <= 0) return 'failed';
  const severity = FINALIZATION_GATE_SEVERITY[input.gateId];
  return severity?.[input.taskKind] ?? severity?.default ?? input.suggestedStatus ?? 'failed';
}

export async function runFinalizationGates<TContext extends RunFinalizationGateContext>(
  ctx: TContext,
  gates: RunFinalizationGate<TContext>[],
): Promise<RunFinalizationGateDecision | null> {
  for (const gate of gates) {
    if (!gate.applies(ctx)) continue;
    const decision = await gate.run(ctx);
    if (!decision) continue;
    return {
      ...decision,
      gateId: gate.id,
      status: finalizationFailureStatus({
        gateId: gate.id,
        taskKind: ctx.taskKind,
        changedTargetCount: ctx.changedTargetCount,
        suggestedStatus: decision.suggestedStatus,
      }),
    };
  }
  return null;
}

export function finalizationTaskKindFromComponentPack(
  componentPack: TaskRelevantComponentPack | null | undefined,
): RunFinalizationTaskKind {
  if (!componentPack) return 'unknown';
  if (
    componentPack.taskKind === 'image-to-screen' ||
    componentPack.taskKind === 'screen-generation'
  ) {
    return 'screen_generation';
  }
  if (componentPack.taskKind === 'screen-edit') return 'screen_edit';
  if (componentPack.taskKind === 'screen-redesign') return 'screen_redesign';
  return 'unknown';
}

export function shouldRetryAutomaticCraftRepair(taskKind: RunFinalizationTaskKind): boolean {
  return taskKind === 'screen_generation' || taskKind === 'screen_redesign';
}
