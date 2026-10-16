import {
  recordToolReceiptSafely,
  type AgentRunManifest,
  type CompleteAgentRunInput,
} from '../../agent/run-recorder';
import type { AgentStreamEvent } from '../../agent/stream';
import {
  checkRuntimeStoryIdentity,
  checkRuntimeStoryImplementationInvariant,
  classifyRuntimeVisibleAcceptance,
  compareRuntimeScreenshotBytes,
  formatRuntimeCompletionNotice,
  formatRuntimeChangeSummary,
  formatRuntimeNoTargetChangeNotice,
  formatRuntimeStoryIdentityNotice,
  inspectExistingRuntimeTargetState,
  summarizeRuntimeTargetChanges,
  type RuntimeExistingTargetState,
  type RuntimeStoryIdentityCheck,
  type RuntimeStoryImplementationInvariant,
  type RuntimeTargetChangeSummary,
  type RuntimeTargetSnapshot,
  type RuntimeVisibleAcceptance,
} from '../../agent-runtimes/change-validation';
import {
  repairRuntimeScreenRootMarker,
  type RuntimeScreenRootMarkerRepair,
} from '../../agent-runtimes/screen-root-marker-repair';
import {
  componentRoleContractReviewNotice,
  componentRoleContractNotice,
  componentReplacementNotice,
  validateRuntimeComponentRoleContracts,
  validateRuntimeComponentReplacement,
  type ComponentReplacementValidation,
  type ComponentRoleContractValidation,
} from '../../component-intelligence/component-intent';
import type { TaskRelevantComponentPack } from '../../component-intelligence/component-pack';
import {
  validateSelectionTargetContract,
  type SelectionTargetContractValidation,
} from '../../agent-runtimes/selection-target-contract';
import { markStorybookReloadPendingForPath } from '../../storybook-reload';
import type { EditorState } from '../../state-store';
import { selectRunCanvasUrl } from './request-schema';
import { appendNoticeToDoneEvent, withExternalRunMetadata } from './sse';
import {
  EXTERNAL_RUNTIME_VISUAL_DIFF_THRESHOLD,
  captureRuntimeVisualSnapshot,
  formatRunStatusBanner,
  recordRuntimeRenderHealthSafely,
  renderProofDiagnosticsFromHealth,
  type ExternalRuntimeVisualSnapshot,
  visualEvidenceMode,
} from './render-health';
import {
  finalizationFailureStatus,
  finalizationTaskKindFromComponentPack,
  runFinalizationGates,
  shouldRetryAutomaticCraftRepair,
  type RunFinalizationGate,
  type RunFinalizationGateContext,
  type RunFinalizationGateDecision,
  type RunFinalizationTaskKind,
} from './finalization-gates';
import { reconcileProjectIndexForDescriptionSidecarChanges } from './description-reindex-reconcile';
import type { ScreenReadinessProfileInput } from '@sber-designer/shared-types';
import type { ScreenCraftProfile } from '../../generation-mode';
import { ensureFinalScreenQualityEvidence } from './quality-evidence';
import { recordScreenRedesignFidelity } from '../../screen-redesign-fidelity';
import type { ScreenCraftResult } from '../../screen-craft';
import type { ExternalDesignSystemProposalValidation } from './external-design-system-proposal';
import { validateExternalDesignSystemProposalBundle } from './external-design-system-proposal';
import {
  formatExternalCraftValidationNotice,
  formatExternalDesignSystemProposalNotice,
  formatExternalRedesignFidelityNotice,
  formatNoVisibleWriteSummary,
  formatRuntimeNoVisibleWriteNotice,
  formatRuntimeScreenRootMarkerNotice,
  formatRuntimeStoryImplementationInvariantNotice,
  formatSelectionTargetMissedNotice,
} from './external-finalization-notices';
import { shouldClassifyNoVisibleWrite } from './external-finalization-intent';

export interface ExternalRuntimeDoneFinalizationInput {
  event: Extract<AgentStreamEvent, { type: 'done' }>;
  runtimeLabel: string;
  workspacePath: string | null;
  agentRun: AgentRunManifest | null;
  snapshots: RuntimeTargetSnapshot[];
  canvasUrl: string | null;
  visualSnapshot: ExternalRuntimeVisualSnapshot;
  componentPack?: TaskRelevantComponentPack | null;
  screenReadiness?: ScreenReadinessProfileInput | null;
  screenCraftProfile?: ScreenCraftProfile;
  selection?: EditorState['selection'] | null;
  sawError: boolean;
}

export interface ExternalRuntimeDoneFinalizationResult {
  event: unknown;
  preEvents?: AgentStreamEvent[];
  status: CompleteAgentRunInput['status'];
  summary: string;
  diagnostics?: CompleteAgentRunInput['diagnostics'];
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

interface ExternalRuntimeFinalizationGateContext extends RunFinalizationGateContext {
  input: ExternalRuntimeDoneFinalizationInput;
  eventWithRun: Extract<AgentStreamEvent, { type: 'done' }>;
  summary: RuntimeTargetChangeSummary;
  summaryText: string;
  taskKind: RunFinalizationTaskKind;
  componentReplacement: ComponentReplacementValidation | null;
  componentRoleContract: ComponentRoleContractValidation | null;
  selectionTarget: SelectionTargetContractValidation;
  designSystemProposal: ExternalDesignSystemProposalValidation;
  storyImplementation: RuntimeStoryImplementationInvariant;
  storyIdentity: RuntimeStoryIdentityCheck;
  rootMarkerRepair: RuntimeScreenRootMarkerRepair;
  acceptance: RuntimeVisibleAcceptance;
  existingTargetState: RuntimeExistingTargetState;
  renderHealth: Awaited<ReturnType<typeof recordRuntimeRenderHealthSafely>>;
  renderProof: NonNullable<NonNullable<CompleteAgentRunInput['diagnostics']>['renderProof']>;
  craft: ScreenCraftResult | null;
  redesignFidelity: Awaited<ReturnType<typeof recordScreenRedesignFidelity>>;
}

export async function finalizeExternalRuntimeDone(
  input: ExternalRuntimeDoneFinalizationInput,
): Promise<ExternalRuntimeDoneFinalizationResult> {
  const eventWithRun = withExternalRunMetadata(input.event, input.agentRun) as Extract<
    AgentStreamEvent,
    { type: 'done' }
  >;
  if (!input.workspacePath || input.snapshots.length === 0) {
    return finalizeWithoutTargetValidation(input, eventWithRun);
  }

  const summary = await summarizeRuntimeTargetChanges(input.workspacePath, input.snapshots);
  await reconcileProjectIndexForDescriptionSidecarChanges({
    workspacePath: input.workspacePath,
    agentRun: input.agentRun,
    changedFiles: summary.changedFiles,
  });
  const summaryText = formatRuntimeChangeSummary(summary);
  const taskKind = finalizationTaskKindFromComponentPack(input.componentPack);
  const qualityEvidence =
    summary.changedTargets.length > 0
      ? await ensureFinalScreenQualityEvidence({
          workspacePath: input.workspacePath,
          agentRun: input.agentRun,
          ...(input.componentPack !== undefined ? { componentPack: input.componentPack } : {}),
          ...(input.screenReadiness !== undefined
            ? { screenReadiness: input.screenReadiness }
            : {}),
          ...(input.screenCraftProfile ? { screenCraftProfile: input.screenCraftProfile } : {}),
          forceCraft: true,
          forceDesignMode: true,
        })
      : { craft: null, designMode: null };
  const redesignFidelity =
    summary.changedTargets.length > 0
      ? await recordScreenRedesignFidelity({
          workspacePath: input.workspacePath,
          agentRun: input.agentRun,
          taskKind: input.componentPack?.taskKind,
        })
      : null;

  for (const change of summary.changedTargets) {
    markStorybookReloadPendingForPath(change.path, change.kind === 'created');
  }

  const componentReplacement = await validateRuntimeComponentReplacement({
    workspacePath: input.workspacePath,
    userRequest: input.agentRun?.userGoal,
    changedFiles: summary.changedFiles,
  });
  if (componentReplacement) {
    await recordToolReceiptSafely({
      workspacePath: input.workspacePath,
      runId: input.agentRun?.runId,
      tool: 'semantic_component_replacement',
      status: componentReplacement.status === 'passed' ? 'ok' : 'error',
      changedFiles: summary.changedFiles,
      summary: componentReplacement.reason,
      metadata: { componentReplacement },
    });
  }

  const componentRoleContract = await validateRuntimeComponentRoleContracts({
    workspacePath: input.workspacePath,
    componentPack: input.componentPack,
    changedFiles: summary.changedFiles,
    userRequest: input.agentRun?.userGoal ?? null,
    activeScreenName: input.agentRun?.activeScreen?.name ?? null,
    activeScreenDescription: input.agentRun?.activeScreen?.description ?? null,
  });
  if (componentRoleContract) {
    await recordToolReceiptSafely({
      workspacePath: input.workspacePath,
      runId: input.agentRun?.runId,
      tool:
        componentRoleContract.status === 'advisory'
          ? 'role_contract_advisory'
          : 'semantic_component_role_contract',
      status: componentRoleContract.status === 'failed' ? 'error' : 'ok',
      changedFiles: summary.changedFiles,
      summary: componentRoleContract.reason,
      metadata: { componentRoleContract },
    });
  }

  const selectionTarget = await validateSelectionTargetContract({
    workspacePath: input.workspacePath,
    selection: input.selection ?? null,
    userRequest: input.agentRun?.userGoal ?? null,
    summary,
    snapshots: input.snapshots,
    taskKind: input.componentPack?.taskKind ?? taskKind,
  });
  if (selectionTarget.status !== 'skipped') {
    await recordToolReceiptSafely({
      workspacePath: input.workspacePath,
      runId: input.agentRun?.runId,
      tool: 'selection_target_contract',
      status: selectionTarget.status === 'failed' ? 'error' : 'ok',
      changedFiles: summary.changedFiles,
      summary: selectionTarget.reason,
      metadata: { selectionTarget },
    });
  }

  const designSystemProposal = await validateExternalDesignSystemProposalBundle({
    workspacePath: input.workspacePath,
    userRequest: input.agentRun?.userGoal ?? null,
    runId: input.agentRun?.runId ?? null,
    summary,
  });
  if (designSystemProposal.status !== 'skipped') {
    await recordToolReceiptSafely({
      workspacePath: input.workspacePath,
      runId: input.agentRun?.runId,
      tool: 'design_system_proposal_bundle',
      status: designSystemProposal.status === 'complete' ? 'ok' : 'error',
      changedFiles: summary.changedFiles,
      summary: designSystemProposal.reason,
      metadata: { designSystemProposal },
    });
  }

  const rootMarkerRepair = await repairRuntimeScreenRootMarker({
    workspacePath: input.workspacePath,
    changedFiles: summary.changedFiles,
    activeScreen: input.agentRun?.activeScreen ?? null,
  });
  if (rootMarkerRepair.status !== 'not_needed') {
    await recordToolReceiptSafely({
      workspacePath: input.workspacePath,
      runId: input.agentRun?.runId,
      tool: 'screen_root_marker_repair',
      status:
        rootMarkerRepair.status === 'repaired'
          ? 'ok'
          : rootMarkerRepair.status === 'missing_unrepaired'
            ? 'error'
            : 'skipped',
      changedFiles: rootMarkerRepair.filePath ? [rootMarkerRepair.filePath] : summary.changedFiles,
      summary: rootMarkerRepair.reason,
      metadata: { rootMarkerRepair },
    });
  }

  const afterVisualSnapshot = await captureRuntimeVisualSnapshot({
    workspacePath: input.workspacePath,
    agentRun: input.agentRun,
    canvasUrl: selectRunCanvasUrl(input.canvasUrl),
    phase: 'after',
  });
  const visualDiff = compareRuntimeScreenshotBytes(
    input.visualSnapshot.bytes,
    afterVisualSnapshot.bytes,
    EXTERNAL_RUNTIME_VISUAL_DIFF_THRESHOLD,
  );
  const renderHealth = await recordRuntimeRenderHealthSafely({
    workspacePath: input.workspacePath,
    agentRun: input.agentRun,
    canvasUrl: selectRunCanvasUrl(input.canvasUrl),
    changedFiles: summary.changedFiles,
  });
  const renderProof = renderProofDiagnosticsFromHealth(
    renderHealth,
    selectRunCanvasUrl(input.canvasUrl),
    1,
  );
  const acceptance = classifyRuntimeVisibleAcceptance(summary, {
    visualDiff,
    requireVisualEvidence: visualEvidenceMode() === 'required',
    renderHealth,
  });
  const existingTargetState = inspectExistingRuntimeTargetState(input.snapshots);
  const storyIdentity = await checkRuntimeStoryIdentity(
    input.workspacePath,
    input.agentRun?.activeScreen ?? null,
  );
  const storyImplementation = await checkRuntimeStoryImplementationInvariant(
    input.workspacePath,
    input.agentRun?.activeScreen ?? null,
  );

  if (storyImplementation.status !== 'unavailable') {
    await recordToolReceiptSafely({
      workspacePath: input.workspacePath,
      runId: input.agentRun?.runId,
      tool: 'runtime_story_implementation_invariant',
      status: storyImplementation.status === 'ok' ? 'ok' : 'error',
      changedFiles: summary.changedFiles,
      summary: storyImplementation.reason,
      metadata: { storyImplementation },
    });
  }

  const structuralFailureReason =
    storyIdentity.status === 'changed'
      ? storyIdentity.reason
      : storyImplementation.status === 'broken'
        ? storyImplementation.reason
        : null;
  const effectiveAcceptance = structuralFailureReason
    ? {
        ...acceptance,
        status: 'failed' as const,
        reason: structuralFailureReason,
      }
    : acceptance;

  await recordToolReceiptSafely({
    workspacePath: input.workspacePath,
    runId: input.agentRun?.runId,
    tool: 'external_runtime_target_diff',
    status:
      structuralFailureReason !== null
        ? 'error'
        : summary.changedTargets.length === 0
          ? 'skipped'
          : 'ok',
    changedFiles: summary.changedFiles,
    summary: structuralFailureReason ? `${summaryText} ${structuralFailureReason}` : summaryText,
    metadata: {
      runtime: input.runtimeLabel,
      targetFiles: summary.targetFiles,
      unchangedFiles: summary.unchangedFiles,
      missingFiles: summary.missingFiles,
      changedTargets: summary.changedTargets,
      acceptance: effectiveAcceptance,
      storyIdentity,
      storyImplementation,
      rootMarkerRepair,
      visualDiff,
      visualEvidenceMode: visualEvidenceMode(),
      renderHealth,
      existingTargetState,
      screenshots: {
        before: input.visualSnapshot.path,
        after: afterVisualSnapshot.path,
        beforeStatus: input.visualSnapshot.status,
        afterStatus: afterVisualSnapshot.status,
        beforeMessage: input.visualSnapshot.message,
        afterMessage: afterVisualSnapshot.message,
      },
    },
  });

  if (summary.targetFiles.length > 0 && summary.changedTargets.length === 0) {
    await recordToolReceiptSafely({
      workspacePath: input.workspacePath,
      runId: input.agentRun?.runId,
      tool: 'existing_target_state',
      status: existingTargetState.status === 'non_empty' ? 'ok' : 'skipped',
      changedFiles: existingTargetState.files,
      summary: existingTargetState.reason,
      metadata: {
        existingTargetState,
        renderHealth,
      },
    });
  }

  const context: ExternalRuntimeFinalizationGateContext = {
    input,
    eventWithRun,
    summary,
    summaryText,
    taskKind,
    changedTargetCount: summary.changedTargets.length,
    componentReplacement,
    componentRoleContract,
    selectionTarget,
    designSystemProposal,
    storyImplementation,
    storyIdentity,
    rootMarkerRepair,
    acceptance,
    existingTargetState,
    renderHealth,
    renderProof,
    craft: qualityEvidence.craft,
    redesignFidelity,
  };

  const gateDecision = await runFinalizationGates(context, externalRuntimeFinalizationGates);
  if (gateDecision) {
    return finalizeGateDecision(context, gateDecision);
  }

  if (
    !input.sawError &&
    summary.targetFiles.length > 0 &&
    summary.changedTargets.length === 0 &&
    existingTargetState.status === 'non_empty' &&
    renderHealth.status !== 'failed'
  ) {
    const notice = [
      '',
      '',
      `sber-designer: ${input.runtimeLabel} run summary`,
      'Verification: complete - Existing generated screen is already applied.',
      `Existing files: ${existingTargetState.files.join(', ') || 'unknown'}.`,
    ].join('\n');
    return {
      preEvents: [{ type: 'text-delta', iteration: input.event.iterations, delta: notice }],
      event: appendNoticeToDoneEvent(eventWithRun, notice),
      status: 'complete',
      summary: `${summaryText} Existing generated screen is already applied.`,
      diagnostics: { renderProof },
    };
  }

  if (!input.sawError && summary.changedTargets.length > 0) {
    const notice = formatRuntimeCompletionNotice({
      runtimeLabel: input.runtimeLabel,
      summary,
      acceptance,
      storyIdentity,
    });
    return {
      preEvents: [{ type: 'text-delta', iteration: input.event.iterations, delta: notice }],
      event: appendNoticeToDoneEvent(eventWithRun, notice),
      status: 'complete',
      summary: summaryText,
      diagnostics: { renderProof },
    };
  }

  return finalizeDefaultCompletion(context);
}

const externalRuntimeFinalizationGates: RunFinalizationGate<ExternalRuntimeFinalizationGateContext>[] =
  [
    {
      id: 'component_replacement',
      applies: (ctx) => !ctx.input.sawError && ctx.componentReplacement?.status === 'failed',
      run: (ctx) => {
        if (!ctx.componentReplacement) return null;
        return {
          notice: componentReplacementNotice(ctx.componentReplacement),
          summary: `${ctx.summaryText} ${ctx.componentReplacement.reason}`,
        };
      },
    },
    {
      id: 'component_role_contract',
      applies: (ctx) => !ctx.input.sawError && ctx.componentRoleContract?.status === 'failed',
      run: (ctx) => {
        if (!ctx.componentRoleContract) return null;
        const severityForNotice = finalizationFailureStatus({
          gateId: 'component_role_contract',
          taskKind: ctx.taskKind,
          changedTargetCount: ctx.changedTargetCount,
        });
        const notice =
          severityForNotice === 'needs_review'
            ? componentRoleContractReviewNotice(ctx.componentRoleContract)
            : componentRoleContractNotice(ctx.componentRoleContract);
        return {
          notice,
          summary: `${ctx.summaryText} ${ctx.componentRoleContract.reason}`,
          ...(ctx.componentRoleContract.reasonCode === 'design_system_gap'
            ? {
                retryableComponentGap: true,
                componentGapRole: ctx.componentRoleContract.role,
                componentGapReason: ctx.componentRoleContract.reason,
              }
            : {}),
        };
      },
    },
    {
      id: 'screen_craft',
      applies: (ctx) =>
        !ctx.input.sawError &&
        ctx.summary.changedTargets.length > 0 &&
        (ctx.craft?.status === 'blocked' || ctx.craft?.status === 'missing'),
      run: (ctx) => {
        const findings = ctx.craft?.findings ?? [];
        const retryable = shouldRetryAutomaticCraftRepair(ctx.taskKind);
        const craftSummary = ctx.craft
          ? `Craft post-check found ${ctx.craft.summary.findings.blocking} blocking, ${ctx.craft.summary.findings.shouldFix} should-fix, and ${ctx.craft.summary.findings.advisory} advisory findings.`
          : 'Screen craft validation was unavailable.';
        return {
          suggestedStatus: 'needs_review',
          notice: formatExternalCraftValidationNotice(craftSummary, retryable),
          summary: `${ctx.summaryText} ${craftSummary}`,
          ...(retryable
            ? {
                retryableCraftFailure: true,
                craftFailureSummary: craftSummary,
                craftFailureFindings: findings,
              }
            : {}),
        };
      },
    },
    {
      id: 'screen_redesign_fidelity',
      applies: (ctx) => !ctx.input.sawError && ctx.redesignFidelity?.status === 'failed',
      run: (ctx) => ({
        suggestedStatus: 'needs_review',
        notice: formatExternalRedesignFidelityNotice(),
        summary: `${ctx.summaryText} Redesign did not preserve the full screen contract.`,
      }),
    },
    {
      id: 'selection_target',
      applies: (ctx) => !ctx.input.sawError && ctx.selectionTarget.status === 'failed',
      run: (ctx) => ({
        notice: formatSelectionTargetMissedNotice(ctx.selectionTarget),
        summary: `${ctx.summaryText} ${ctx.selectionTarget.reason}`,
      }),
    },
    {
      id: 'design_system_proposal',
      applies: (ctx) =>
        !ctx.input.sawError &&
        ctx.summary.changedTargets.length > 0 &&
        ctx.designSystemProposal.status === 'incomplete',
      run: (ctx) => ({
        suggestedStatus: 'needs_review',
        notice: formatExternalDesignSystemProposalNotice(ctx.designSystemProposal),
        summary: `${ctx.summaryText} ${ctx.designSystemProposal.reason}`,
      }),
    },
    {
      id: 'story_implementation',
      applies: (ctx) => !ctx.input.sawError && ctx.storyImplementation.status === 'broken',
      run: (ctx) => ({
        notice: formatRuntimeStoryImplementationInvariantNotice(ctx.storyImplementation),
        summary: `${ctx.summaryText} ${ctx.storyImplementation.reason}`,
      }),
    },
    {
      id: 'story_identity',
      applies: (ctx) => !ctx.input.sawError && ctx.storyIdentity.status === 'changed',
      run: (ctx) => ({
        notice: formatRuntimeStoryIdentityNotice(ctx.storyIdentity),
        summary: `${ctx.summaryText} ${ctx.storyIdentity.reason}`,
      }),
    },
    {
      id: 'screen_root_marker',
      applies: (ctx) => !ctx.input.sawError && ctx.rootMarkerRepair.status === 'missing_unrepaired',
      run: (ctx) => ({
        notice: formatRuntimeScreenRootMarkerNotice(ctx.rootMarkerRepair),
        summary: `${ctx.summaryText} ${ctx.rootMarkerRepair.reason}`,
      }),
    },
    {
      id: 'preview_freshness',
      applies: (ctx) =>
        !ctx.input.sawError &&
        Boolean(ctx.input.agentRun) &&
        Boolean(ctx.input.canvasUrl) &&
        ctx.summary.changedTargets.length > 0 &&
        ctx.renderHealth.status === 'unavailable',
      run: (ctx) => {
        const reason = `preview_stale_or_unverified: ${ctx.renderHealth.reason}`;
        const acceptanceForNotice: RuntimeVisibleAcceptance = {
          ...ctx.acceptance,
          status: 'failed',
          reason,
        };
        return {
          finishReason: 'other',
          notice: formatRuntimeCompletionNotice({
            runtimeLabel: ctx.input.runtimeLabel,
            summary: ctx.summary,
            acceptance: acceptanceForNotice,
            storyIdentity: ctx.storyIdentity,
          }),
          summary: `${ctx.summaryText} ${reason}`,
        };
      },
    },
    {
      id: 'no_visible_write',
      applies: (ctx) =>
        !ctx.input.sawError &&
        ctx.summary.targetFiles.length > 0 &&
        ctx.summary.changedTargets.length === 0 &&
        shouldClassifyNoVisibleWrite({
          componentPack: ctx.input.componentPack,
          existingTargetState: ctx.existingTargetState,
        }),
      run: (ctx) => {
        const noVisibleWriteSummary = formatNoVisibleWriteSummary(ctx.summaryText);
        return {
          notice: formatRuntimeNoVisibleWriteNotice({
            runtimeLabel: ctx.input.runtimeLabel,
            summaryText: noVisibleWriteSummary,
            existingTargetState: ctx.existingTargetState,
          }),
          summary: noVisibleWriteSummary,
          retryableNoTargetChanges: true,
        };
      },
    },
    {
      id: 'target_diff',
      applies: (ctx) =>
        !ctx.input.sawError &&
        ctx.summary.targetFiles.length > 0 &&
        ctx.summary.changedTargets.length === 0 &&
        !(ctx.existingTargetState.status === 'non_empty' && ctx.renderHealth.status !== 'failed'),
      run: (ctx) => ({
        notice: formatRuntimeNoTargetChangeNotice(ctx.summary),
        summary: ctx.summaryText,
        retryableNoTargetChanges: true,
      }),
    },
    {
      id: 'render_acceptance',
      applies: (ctx) =>
        !ctx.input.sawError &&
        ctx.summary.changedTargets.length > 0 &&
        ctx.acceptance.status === 'failed',
      run: (ctx) => ({
        notice: formatRuntimeCompletionNotice({
          runtimeLabel: ctx.input.runtimeLabel,
          summary: ctx.summary,
          acceptance: ctx.acceptance,
          storyIdentity: ctx.storyIdentity,
        }),
        summary: `${ctx.summaryText} ${ctx.acceptance.reason}`,
        retryableRenderFailure: ctx.renderHealth.status === 'failed',
        ...(ctx.renderHealth.status === 'failed'
          ? {
              renderFailureReason: ctx.renderHealth.reason,
              renderFailureChangedFiles: ctx.summary.changedFiles,
            }
          : {}),
      }),
    },
  ];

function finalizeWithoutTargetValidation(
  input: ExternalRuntimeDoneFinalizationInput,
  eventWithRun: Extract<AgentStreamEvent, { type: 'done' }>,
): ExternalRuntimeDoneFinalizationResult {
  const status =
    input.sawError || input.event.finalResponse.finishReason === 'other' ? 'failed' : 'complete';
  const notice = [
    '',
    '',
    `sber-designer: ${input.runtimeLabel} run summary`,
    'Changed files: not validated.',
    'Verification: unavailable - no target-file diff validation was configured for this run.',
  ].join('\n');
  const terminalNotice = status === 'failed' ? formatRunStatusBanner('failed') + notice : notice;
  return {
    preEvents: [{ type: 'text-delta', iteration: input.event.iterations, delta: terminalNotice }],
    event: appendNoticeToDoneEvent(
      eventWithRun,
      terminalNotice,
      status === 'failed' ? 'other' : undefined,
      status === 'failed' ? 'failed' : undefined,
    ),
    status,
    summary: `${input.runtimeLabel} completed without target-file diff validation.`,
  };
}

function finalizeGateDecision(
  ctx: ExternalRuntimeFinalizationGateContext,
  decision: RunFinalizationGateDecision,
): ExternalRuntimeDoneFinalizationResult {
  const notice = formatRunStatusBanner(decision.status) + decision.notice;
  return {
    preEvents: [
      {
        type: 'text-delta',
        iteration: ctx.input.event.iterations,
        delta: notice,
      },
    ],
    event: appendNoticeToDoneEvent(
      ctx.eventWithRun,
      notice,
      decision.finishReason ?? (decision.status === 'failed' ? 'other' : undefined),
      decision.status,
    ),
    status: decision.status,
    summary: decision.summary,
    diagnostics: { renderProof: ctx.renderProof },
    ...(decision.retryableNoTargetChanges
      ? { retryableNoTargetChanges: decision.retryableNoTargetChanges }
      : {}),
    ...(decision.retryableComponentGap
      ? { retryableComponentGap: decision.retryableComponentGap }
      : {}),
    ...(decision.componentGapRole ? { componentGapRole: decision.componentGapRole } : {}),
    ...(decision.componentGapReason ? { componentGapReason: decision.componentGapReason } : {}),
    ...(decision.retryableRenderFailure
      ? { retryableRenderFailure: decision.retryableRenderFailure }
      : {}),
    ...(decision.renderFailureReason ? { renderFailureReason: decision.renderFailureReason } : {}),
    ...(decision.renderFailureChangedFiles
      ? { renderFailureChangedFiles: decision.renderFailureChangedFiles }
      : {}),
    ...(decision.retryableCraftFailure
      ? { retryableCraftFailure: decision.retryableCraftFailure }
      : {}),
    ...(decision.craftFailureSummary ? { craftFailureSummary: decision.craftFailureSummary } : {}),
    ...(decision.craftFailureFindings
      ? { craftFailureFindings: decision.craftFailureFindings }
      : {}),
  };
}

function finalizeDefaultCompletion(
  ctx: ExternalRuntimeFinalizationGateContext,
): ExternalRuntimeDoneFinalizationResult {
  const finalStatus =
    ctx.input.sawError || ctx.input.event.finalResponse.finishReason === 'other'
      ? 'failed'
      : 'complete';
  const finalAcceptance =
    finalStatus === 'failed'
      ? {
          ...ctx.acceptance,
          status: 'failed' as const,
          reason: ctx.input.sawError
            ? `${ctx.input.runtimeLabel} reported an error before completion.`
            : ctx.acceptance.reason,
        }
      : ctx.acceptance;
  const notice = formatRuntimeCompletionNotice({
    runtimeLabel: ctx.input.runtimeLabel,
    summary: ctx.summary,
    acceptance: finalAcceptance,
    storyIdentity: ctx.storyIdentity,
  });
  const terminalNotice =
    finalStatus === 'failed' ? formatRunStatusBanner('failed') + notice : notice;
  return {
    preEvents: [
      { type: 'text-delta', iteration: ctx.input.event.iterations, delta: terminalNotice },
    ],
    event: appendNoticeToDoneEvent(
      ctx.eventWithRun,
      terminalNotice,
      finalStatus === 'failed' ? 'other' : undefined,
      finalStatus === 'failed' ? 'failed' : undefined,
    ),
    status: finalStatus,
    summary: ctx.summaryText,
    diagnostics: { renderProof: ctx.renderProof },
  };
}
