/** Built-in (API provider) run completion and finalization. */
import {
  readAgentRunReceipts,
  recordToolReceiptSafely,
  type AgentRunManifest,
  type AgentToolReceipt,
  type CompleteAgentRunInput,
} from '../../agent/run-recorder';
import { type AgentStreamEvent } from '../../agent/stream';
import { checkRuntimeStoryImplementationInvariant } from '../../agent-runtimes/change-validation';
import { repairRuntimeScreenRootMarker } from '../../agent-runtimes/screen-root-marker-repair';
import { appendNoticeToDoneEvent } from './sse';
import {
  changedActiveScreenTargets,
  formatPartialActiveScreenWriteNotice,
  formatRunStatusBanner,
  formatRuntimeRenderHealthFailedNotice,
  formatRuntimeRenderHealthNeedsReviewNotice,
  recordRuntimeRenderHealthSafely,
  renderProofDiagnosticsFromHealth,
} from './render-health';
import { reconcileProjectIndexForDescriptionSidecarChanges } from './description-reindex-reconcile';
import { ensureFinalScreenQualityEvidence } from './quality-evidence';
import type { TaskRelevantComponentPack } from '../../component-intelligence/component-pack';
import type { ScreenReadinessProfileInput } from '@sber-designer/shared-types';
import type { ScreenCraftProfile } from '../../generation-mode';
import { recordScreenRedesignFidelity } from '../../screen-redesign-fidelity';
import {
  finalizationTaskKindFromComponentPack,
  shouldRetryAutomaticCraftRepair,
} from './finalization-gates';

export function resolveBuiltInRunCompletion(ev: {
  iterations: number;
  truncated: boolean;
  hadErrors?: boolean;
  stoppedAfterPermissionDeny?: boolean;
  finalResponse: { finishReason?: string };
}): {
  status: 'complete' | 'failed';
  summary: string;
  diagnostics: NonNullable<CompleteAgentRunInput['diagnostics']>;
} {
  const diagnostics: NonNullable<CompleteAgentRunInput['diagnostics']> = {
    iterations: ev.iterations,
    truncated: ev.truncated,
    hadErrors: Boolean(ev.hadErrors),
    stoppedAfterPermissionDeny: Boolean(ev.stoppedAfterPermissionDeny),
    ...(ev.finalResponse.finishReason ? { finishReason: ev.finalResponse.finishReason } : {}),
  };
  if (ev.stoppedAfterPermissionDeny) {
    return {
      status: 'failed',
      summary: `Stopped after a permission request was denied at agent turn ${ev.iterations}.`,
      diagnostics,
    };
  }
  if (ev.truncated || ev.hadErrors || ev.finalResponse.finishReason === 'tool_calls') {
    const reasons = [
      ev.truncated ? 'truncated' : null,
      ev.hadErrors ? 'tool errors' : null,
      ev.finalResponse.finishReason === 'tool_calls' ? 'unfinished tool calls' : null,
    ].filter(Boolean);
    return {
      status: 'failed',
      summary: `Agent run failed after ${ev.iterations} turn${ev.iterations === 1 ? '' : 's'} (${reasons.join(', ')}).`,
      diagnostics,
    };
  }
  return {
    status: 'complete',
    summary: `Completed ${ev.iterations} agent turn${ev.iterations === 1 ? '' : 's'}.`,
    diagnostics,
  };
}

export async function finalizeBuiltInRunDone(input: {
  event: Extract<AgentStreamEvent, { type: 'done' }>;
  workspacePath: string | null;
  agentRun: AgentRunManifest | null;
  canvasUrl: string | null;
  runAborted?: boolean;
  fetchImpl?: typeof fetch;
  readinessDelaysMs?: readonly number[];
  componentPack?: TaskRelevantComponentPack | null;
  screenReadiness?: ScreenReadinessProfileInput | null;
  screenCraftProfile?: ScreenCraftProfile;
  forceQualityEvidence?: boolean;
}): Promise<{
  event: Extract<AgentStreamEvent, { type: 'done' }>;
  preEvents?: AgentStreamEvent[];
  status: CompleteAgentRunInput['status'];
  summary: string;
  diagnostics: NonNullable<CompleteAgentRunInput['diagnostics']>;
  retryableCraftFailure?: boolean;
  craftFailureSummary?: string;
  craftFailureFindings?: unknown[];
}> {
  if (input.runAborted) {
    const diagnostics: NonNullable<CompleteAgentRunInput['diagnostics']> = {
      iterations: input.event.iterations,
      truncated: input.event.truncated,
      hadErrors: Boolean(input.event.hadErrors),
      stoppedAfterPermissionDeny: Boolean(input.event.stoppedAfterPermissionDeny),
      finishReason: 'cancelled',
    };
    return {
      event: {
        ...input.event,
        finalResponse: {
          ...input.event.finalResponse,
          text: 'Cancelled by user.',
          finishReason: 'stop',
        },
      },
      status: 'cancelled',
      summary: 'Cancelled by user.',
      diagnostics,
    };
  }

  const completion = resolveBuiltInRunCompletion(input.event);
  if (!input.workspacePath || !input.agentRun) {
    if (completion.status === 'failed') {
      const notice =
        formatRunStatusBanner('failed') + formatBuiltInCompletionFailedNotice(completion.summary);
      return {
        preEvents: [{ type: 'text-delta', iteration: input.event.iterations, delta: notice }],
        event: appendNoticeToDoneEvent(input.event, notice, 'other', 'failed'),
        status: 'failed',
        summary: completion.summary,
        diagnostics: completion.diagnostics,
      };
    }
    return {
      event: input.event,
      status: completion.status,
      summary: completion.summary,
      diagnostics: completion.diagnostics,
    };
  }

  const receiptsBeforeQuality = await readAgentRunReceipts(
    input.workspacePath,
    input.agentRun.runId,
  ).catch(() => []);
  const changedFilesBeforeQuality = changedFilesFromReceipts(receiptsBeforeQuality);
  if (
    requiresActiveScreenWrite(input.componentPack) &&
    !changedActiveScreenTargets(changedFilesBeforeQuality, input.agentRun).length
  ) {
    const summary = 'The agent finished without writing the active screen source.';
    const notice = formatRunStatusBanner('failed') + formatActiveScreenNotWrittenNotice(summary);
    return {
      preEvents: [{ type: 'text-delta', iteration: input.event.iterations, delta: notice }],
      event: appendNoticeToDoneEvent(input.event, notice, 'other', 'failed'),
      status: 'failed',
      summary,
      diagnostics: {
        ...completion.diagnostics,
        finishReason: 'other',
      },
    };
  }

  await ensureFinalScreenQualityEvidence({
    workspacePath: input.workspacePath,
    agentRun: input.agentRun,
    ...(input.componentPack !== undefined ? { componentPack: input.componentPack } : {}),
    ...(input.screenReadiness !== undefined ? { screenReadiness: input.screenReadiness } : {}),
    ...(input.screenCraftProfile ? { screenCraftProfile: input.screenCraftProfile } : {}),
    ...(input.forceQualityEvidence ? { forceCraft: true, forceDesignMode: true } : {}),
  });
  const redesignFidelity = await recordScreenRedesignFidelity({
    workspacePath: input.workspacePath,
    agentRun: input.agentRun,
    taskKind: input.componentPack?.taskKind,
  });
  const receipts = await readAgentRunReceipts(input.workspacePath, input.agentRun.runId).catch(
    () => [],
  );
  const craftReview = latestCraftValidationNeedsReview(receipts);
  const changedFiles = changedFilesFromReceipts(receipts);
  await reconcileProjectIndexForDescriptionSidecarChanges({
    workspacePath: input.workspacePath,
    agentRun: input.agentRun,
    changedFiles: allChangedFilesFromReceipts(receipts),
  });
  if (!changedActiveScreenTargets(changedFiles, input.agentRun).length) {
    if (craftReview) {
      const notice =
        formatRunStatusBanner('failed') + formatCraftValidationFailedNotice(craftReview.summary);
      return {
        preEvents: [
          {
            type: 'text-delta',
            iteration: input.event.iterations,
            delta: notice,
          },
        ],
        event: appendNoticeToDoneEvent(input.event, notice, 'other', 'failed'),
        status: 'failed',
        summary: craftReview.summary,
        diagnostics: {
          ...completion.diagnostics,
          finishReason: 'other',
        },
      };
    }
    if (completion.status === 'failed') {
      const notice =
        formatRunStatusBanner('failed') + formatBuiltInCompletionFailedNotice(completion.summary);
      return {
        preEvents: [{ type: 'text-delta', iteration: input.event.iterations, delta: notice }],
        event: appendNoticeToDoneEvent(input.event, notice, 'other', 'failed'),
        status: 'failed',
        summary: completion.summary,
        diagnostics: completion.diagnostics,
      };
    }
    return {
      event: input.event,
      status: completion.status,
      summary: completion.summary,
      diagnostics: completion.diagnostics,
    };
  }

  if (craftReview) {
    const retryable = shouldRetryAutomaticCraftRepair(
      finalizationTaskKindFromComponentPack(input.componentPack),
    );
    const notice =
      formatRunStatusBanner('needs_review') +
      formatCraftValidationNeedsReviewNotice(craftReview.summary, retryable);
    return {
      preEvents: [
        {
          type: 'text-delta',
          iteration: input.event.iterations,
          delta: notice,
        },
      ],
      event: appendNoticeToDoneEvent(input.event, notice, undefined, 'needs_review'),
      status: 'needs_review',
      summary: craftReview.summary,
      diagnostics: completion.diagnostics,
      ...(retryable
        ? {
            retryableCraftFailure: true,
            craftFailureSummary: craftReview.summary,
            craftFailureFindings: craftReview.findings,
          }
        : {}),
    };
  }

  if (redesignFidelity?.status === 'failed') {
    const summary = 'Screen redesign did not preserve its full content and composition contract.';
    const notice = formatRunStatusBanner('needs_review') + formatRedesignFidelityNotice();
    return {
      preEvents: [{ type: 'text-delta', iteration: input.event.iterations, delta: notice }],
      event: appendNoticeToDoneEvent(input.event, notice, undefined, 'needs_review'),
      status: 'needs_review',
      summary,
      diagnostics: completion.diagnostics,
    };
  }

  const storyImplementationInvariant = await checkRuntimeStoryImplementationInvariant(
    input.workspacePath,
    input.agentRun.activeScreen,
  );
  if (storyImplementationInvariant.status === 'broken') {
    const notice =
      formatRunStatusBanner('failed') +
      formatStoryImplementationInvariantFailedNotice(storyImplementationInvariant.reason);
    return {
      preEvents: [
        {
          type: 'text-delta',
          iteration: input.event.iterations,
          delta: notice,
        },
      ],
      event: appendNoticeToDoneEvent(input.event, notice, 'other', 'failed'),
      status: 'failed',
      summary: storyImplementationInvariant.reason,
      diagnostics: {
        ...completion.diagnostics,
        finishReason: 'other',
      },
    };
  }

  const rootMarkerRepair = await repairRuntimeScreenRootMarker({
    workspacePath: input.workspacePath,
    changedFiles,
    activeScreen: input.agentRun.activeScreen,
  });
  if (rootMarkerRepair.status !== 'not_needed') {
    await recordToolReceiptSafely({
      workspacePath: input.workspacePath,
      runId: input.agentRun.runId,
      tool: 'screen_root_marker_repair',
      status:
        rootMarkerRepair.status === 'repaired'
          ? 'ok'
          : rootMarkerRepair.status === 'missing_unrepaired'
            ? 'error'
            : 'skipped',
      changedFiles: rootMarkerRepair.filePath ? [rootMarkerRepair.filePath] : changedFiles,
      summary: rootMarkerRepair.reason,
      metadata: { rootMarkerRepair },
    });
  }
  if (rootMarkerRepair.status === 'missing_unrepaired') {
    const notice =
      formatRunStatusBanner('failed') +
      formatScreenRootMarkerRepairFailedNotice(rootMarkerRepair.reason);
    return {
      preEvents: [
        {
          type: 'text-delta',
          iteration: input.event.iterations,
          delta: notice,
        },
      ],
      event: appendNoticeToDoneEvent(input.event, notice, 'other', 'failed'),
      status: 'failed',
      summary: rootMarkerRepair.reason,
      diagnostics: {
        ...completion.diagnostics,
        finishReason: 'other',
      },
    };
  }

  const renderHealth = await recordRuntimeRenderHealthSafely({
    workspacePath: input.workspacePath,
    agentRun: input.agentRun,
    canvasUrl: input.canvasUrl,
    changedFiles,
    ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
    ...(input.readinessDelaysMs ? { readinessDelaysMs: input.readinessDelaysMs } : {}),
  });

  if (renderHealth.status === 'failed') {
    const notice =
      formatRunStatusBanner('failed') + formatRuntimeRenderHealthFailedNotice(renderHealth);
    const renderProof = renderProofDiagnosticsFromHealth(renderHealth, input.canvasUrl, 1);
    return {
      preEvents: [
        {
          type: 'text-delta',
          iteration: input.event.iterations,
          delta: notice,
        },
      ],
      event: appendNoticeToDoneEvent(input.event, notice, 'other', 'failed'),
      status: 'failed',
      summary: renderHealth.reason,
      diagnostics: {
        ...completion.diagnostics,
        finishReason: 'other',
        renderProof,
      },
    };
  }

  if (renderHealth.status !== 'ok') {
    const notice = [
      formatRunStatusBanner('needs_review'),
      formatRuntimeRenderHealthNeedsReviewNotice(renderHealth),
    ].join('');
    return {
      preEvents: [
        {
          type: 'text-delta',
          iteration: input.event.iterations,
          delta: notice,
        },
      ],
      event: appendNoticeToDoneEvent(input.event, notice, undefined, 'needs_review'),
      status: 'needs_review',
      summary: renderHealth.reason,
      diagnostics: {
        ...completion.diagnostics,
        renderProof: renderProofDiagnosticsFromHealth(renderHealth, input.canvasUrl, 1),
      },
    };
  }

  if (completion.status !== 'complete') {
    if (recoveredToolErrorsPassedMechanicalChecks(input.event)) {
      return {
        event: input.event,
        status: 'complete',
        summary:
          'Screen source was saved and all deterministic checks passed after recovered tool errors.',
        diagnostics: completion.diagnostics,
      };
    }
    const notice =
      formatRunStatusBanner('needs_review') +
      formatPartialActiveScreenWriteNotice(completion.summary);
    return {
      preEvents: [
        {
          type: 'text-delta',
          iteration: input.event.iterations,
          delta: notice,
        },
      ],
      event: appendNoticeToDoneEvent(input.event, notice, undefined, 'needs_review'),
      status: 'needs_review',
      summary: 'Source was written and rendered, but final agent validation did not finish.',
      diagnostics: completion.diagnostics,
    };
  }

  return {
    event: input.event,
    status: completion.status,
    summary: completion.summary,
    diagnostics: completion.diagnostics,
  };
}

function recoveredToolErrorsPassedMechanicalChecks(
  event: Extract<AgentStreamEvent, { type: 'done' }>,
): boolean {
  return Boolean(
    event.hadErrors &&
    !event.truncated &&
    !event.stoppedAfterPermissionDeny &&
    event.finalResponse.finishReason === 'stop',
  );
}

function formatBuiltInCompletionFailedNotice(summary: string): string {
  return ['', '', 'sber-designer: Agent run did not finish cleanly.', `Reason: ${summary}`].join(
    '\n',
  );
}

function latestCraftValidationNeedsReview(
  receipts: AgentToolReceipt[],
): { summary: string; findings: unknown[] } | null {
  const latest = receipts
    .filter((receipt) => receipt.tool === 'validate_screen_craft')
    .sort((a, b) => a.createdAt - b.createdAt)
    .at(-1);
  if (!latest) return null;
  const status = latestCraftStatus(latest);
  if (latest.status !== 'error' && status !== 'blocked') return null;
  return {
    summary:
      latest.summary ??
      (status === 'blocked'
        ? 'validate_screen_craft reported blocking findings.'
        : 'validate_screen_craft did not complete successfully.'),
    findings: Array.isArray(latest.metadata.findings) ? latest.metadata.findings : [],
  };
}

function latestCraftStatus(receipt: AgentToolReceipt): string | null {
  const metadataStatus = receipt.metadata.status;
  if (typeof metadataStatus === 'string') return metadataStatus;
  const result = receipt.metadata.result;
  if (result && typeof result === 'object' && 'status' in result) {
    const status = (result as { status?: unknown }).status;
    return typeof status === 'string' ? status : null;
  }
  return null;
}

function changedFilesFromReceipts(receipts: AgentToolReceipt[]): string[] {
  return Array.from(
    new Set(
      receipts
        .filter(
          (receipt) => receipt.status === 'ok' && SOURCE_MUTATION_RECEIPT_TOOLS.has(receipt.tool),
        )
        .flatMap((receipt) => receipt.changedFiles),
    ),
  );
}

function allChangedFilesFromReceipts(receipts: AgentToolReceipt[]): string[] {
  return Array.from(
    new Set(
      receipts
        .filter((receipt) => receipt.status === 'ok')
        .flatMap((receipt) => receipt.changedFiles),
    ),
  );
}

const SOURCE_MUTATION_RECEIPT_TOOLS = new Set([
  'write_file',
  'apply_patch',
  'screen_root_marker_repair',
]);

function requiresActiveScreenWrite(componentPack: TaskRelevantComponentPack | null | undefined) {
  return (
    componentPack?.taskKind === 'image-to-screen' ||
    componentPack?.taskKind === 'screen-generation' ||
    componentPack?.taskKind === 'screen-redesign' ||
    componentPack?.taskKind === 'screen-edit'
  );
}

function formatActiveScreenNotWrittenNotice(summary: string): string {
  return [
    '',
    '',
    'sber-designer: Active screen was not written.',
    `Reason: ${summary}`,
    'Craft repair was not started because validation evidence cannot substitute for a source mutation.',
  ].join('\n');
}

function formatCraftValidationFailedNotice(summary: string): string {
  return [
    '',
    '',
    'sber-designer: Craft validation failed.',
    `Reason: ${summary}`,
    'Generated source was preserved for repair, but unresolved blocking craft findings cannot be accepted.',
  ].join('\n');
}

function formatCraftValidationNeedsReviewNotice(summary: string, retryable: boolean): string {
  return [
    '',
    '',
    'sber-designer: Screen saved — craft findings need repair.',
    `Reason: ${summary}`,
    retryable
      ? 'The generated source and preview were preserved. Resolve the blocking findings before accepting the screen.'
      : 'The requested screen edit was preserved without widening its scope. Review pre-existing craft findings separately.',
  ].join('\n');
}

function formatStoryImplementationInvariantFailedNotice(summary: string): string {
  return [
    '',
    '',
    'sber-designer: Storybook wrapper verification failed.',
    `Reason: ${summary}`,
    'The active story and implementation export must be repaired before this screen can be accepted.',
  ].join('\n');
}

function formatScreenRootMarkerRepairFailedNotice(summary: string): string {
  return [
    '',
    '',
    'sber-designer: Screen root marker verification failed.',
    `Reason: ${summary}`,
    'The active screen source must expose data-sd-screen-root so canvas render verification and Design mode can inspect the DOM.',
  ].join('\n');
}

function formatRedesignFidelityNotice(): string {
  return [
    '',
    '',
    'sber-designer: Screen redesign fidelity needs review.',
    'The composition must change while every original section, business fact, action, state, and route remains present.',
  ].join('\n');
}
