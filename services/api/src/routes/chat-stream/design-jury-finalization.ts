import type { ChatMessage, LlmGateway } from '@sber-designer/llm-gateway';
import type {
  AgentKitSkill,
  AssistantTokenUsage,
  DesignJuryPolicy,
  DesignJuryResult,
  DesignJuryRound,
} from '@sber-designer/shared-types';

import {
  readAgentRunReceipts,
  recordToolReceiptSafely,
  type AgentRunManifest,
  type CompleteAgentRunInput,
} from '../../agent/run-recorder';
import type { AgentStreamEvent } from '../../agent/stream';
import { addRuntimeUsage, hasRuntimeUsage } from '../../agent-runtimes/usage';
import type { TaskRelevantComponentPack } from '../../component-intelligence/component-pack';
import {
  DESIGN_JURY_THRESHOLD,
  formatDesignJuryNotice,
  recordDesignJuryRoundSafely,
  resolveDesignJuryEnabled,
  runDesignJury,
  type DesignJuryContext,
} from '../../design-jury';
import type { GenerationOptions } from '../../generation-mode';
import { readWorkspaceFile } from '../../safe-fs';
import type { finalizeBuiltInRunDone } from './built-in';
import { finalizationTaskKindFromComponentPack } from './finalization-gates';
import { changedActiveScreenTargets, formatRunStatusBanner } from './render-health';
import { appendNoticeToDoneEvent } from './sse';

export type BuiltInRunFinalization = Awaited<ReturnType<typeof finalizeBuiltInRunDone>>;
export const DESIGN_JURY_REVIEW_MAX_TOKENS = 4_096;

export interface DesignJuryRunPlan {
  enabled: boolean;
  taskKind: 'screen_generation' | 'screen_redesign' | null;
  skillName: 'product-screen-generation' | 'screen-redesign' | null;
  policy: DesignJuryPolicy;
}

export interface DesignJuryRevisionOutcome {
  context: DesignJuryContext;
  mechanical: BuiltInRunFinalization;
}

export function resolveDesignJuryRunPlan(input: {
  componentPack: TaskRelevantComponentPack | null | undefined;
  skills: readonly AgentKitSkill[];
  generation: GenerationOptions | null | undefined;
}): DesignJuryRunPlan {
  const taskKind = finalizationTaskKindFromComponentPack(input.componentPack);
  const eligibleTaskKind =
    taskKind === 'screen_generation' || taskKind === 'screen_redesign' ? taskKind : null;
  const skillName =
    eligibleTaskKind === 'screen_generation'
      ? 'product-screen-generation'
      : eligibleTaskKind === 'screen_redesign'
        ? 'screen-redesign'
        : null;
  const policy =
    (skillName
      ? input.skills.find((skill) => skill.name === skillName)?.critiquePolicy
      : undefined) ?? 'opt-in';
  return {
    enabled:
      eligibleTaskKind !== null && resolveDesignJuryEnabled(policy, input.generation?.critique),
    taskKind: eligibleTaskKind,
    skillName,
    policy,
  };
}

export async function loadDesignJuryContextForRun(input: {
  workspacePath: string;
  agentRun: AgentRunManifest;
  taskKind: 'screen_generation' | 'screen_redesign';
  componentPack?: TaskRelevantComponentPack | null;
}): Promise<{ context: DesignJuryContext; changedFiles: string[] }> {
  const receipts = await readAgentRunReceipts(input.workspacePath, input.agentRun.runId).catch(
    () => [],
  );
  const allChangedFiles = uniqueStrings(receipts.flatMap((receipt) => receipt.changedFiles));
  const changedFiles = changedActiveScreenTargets(allChangedFiles, input.agentRun);
  const targetPaths = uniqueStrings([
    ...changedFiles,
    input.agentRun.activeScreen?.implementationFilePath ?? '',
    input.agentRun.activeScreen?.filePath ?? '',
  ]);
  const targetFiles = (
    await Promise.all(
      targetPaths.slice(0, 4).map(async (path) => ({
        path,
        contents: await readWorkspaceFile(input.workspacePath, path).catch(() => ''),
      })),
    )
  ).filter((file) => file.contents.trim().length > 0);
  if (targetFiles.length === 0) {
    throw new Error('Design Jury could not read the active screen target source.');
  }
  const candidates = input.componentPack?.candidates ?? [];
  const evidence = [
    input.agentRun.activeScreen?.name ? `Active screen: ${input.agentRun.activeScreen.name}` : null,
    input.componentPack
      ? `Component pack: ${input.componentPack.status}, source ${input.componentPack.source}, ${candidates.length} candidate(s).`
      : null,
    ...candidates
      .slice(0, 8)
      .map((candidate) =>
        [candidate.role, candidate.componentId, candidate.guidance?.[0]]
          .filter(Boolean)
          .join(' — '),
      ),
  ].filter((item): item is string => Boolean(item));
  return {
    context: {
      userGoal: input.agentRun.userGoal?.trim() || 'Review the generated active screen.',
      taskKind: input.taskKind,
      targetFiles,
      ...(input.agentRun.designBrief ? { designBrief: input.agentRun.designBrief } : {}),
      ...(input.agentRun.directionSelection
        ? { directionSelection: input.agentRun.directionSelection }
        : {}),
      ...(evidence.length > 0 ? { evidence } : {}),
    },
    changedFiles,
  };
}

export async function finalizeBuiltInRunWithDesignJury(input: {
  mechanical: BuiltInRunFinalization;
  plan: DesignJuryRunPlan;
  gateway: LlmGateway;
  workspacePath: string | null;
  agentRun: AgentRunManifest | null;
  componentPack?: TaskRelevantComponentPack | null;
  modelOverride?: string;
  signal?: AbortSignal;
  revise?: (prompt: string) => Promise<DesignJuryRevisionOutcome>;
}): Promise<BuiltInRunFinalization> {
  if (
    input.mechanical.status !== 'complete' ||
    !input.plan.enabled ||
    !input.plan.taskKind ||
    !input.workspacePath ||
    !input.agentRun
  ) {
    return input.mechanical;
  }

  let currentMechanical = input.mechanical;
  const completedRounds: DesignJuryRound[] = [];
  let changedFiles: string[] = [];
  try {
    const loaded = await loadDesignJuryContextForRun({
      workspacePath: input.workspacePath,
      agentRun: input.agentRun,
      taskKind: input.plan.taskKind,
      ...(input.componentPack !== undefined ? { componentPack: input.componentPack } : {}),
    });
    changedFiles = loaded.changedFiles;
    const result = await runDesignJury({
      context: loaded.context,
      review: async ({ prompt }) => {
        const response = await input.gateway.chat({
          messages: [
            {
              role: 'system',
              content:
                'You are a read-only product design reviewer. Follow the requested jury role and return only the exact JSON object. Do not provide chain-of-thought; emit the JSON object immediately. Never call tools or propose unrelated redesign work.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          // Reasoning-capable OpenAI-compatible models may spend the first
          // several hundred completion tokens before emitting their compact
          // JSON answer. Keep the turn bounded while leaving enough room for
          // the required response instead of treating an empty, length-capped
          // content field as a Jury outage.
          maxTokens: DESIGN_JURY_REVIEW_MAX_TOKENS,
          ...(input.modelOverride ? { model: input.modelOverride } : {}),
          ...(input.signal ? { signal: input.signal } : {}),
        });
        return {
          text: response.text,
          ...(response.usage ? { usage: response.usage } : {}),
        };
      },
      ...(input.revise
        ? {
            revise: async ({ prompt }) => {
              const revision = await input.revise!(prompt);
              currentMechanical = revision.mechanical;
              if (revision.mechanical.status !== 'complete') {
                throw new DesignJuryRevisionMechanicalError(revision.mechanical);
              }
              return revision.context;
            },
          }
        : {}),
      onRound: async (round) => {
        completedRounds.push(round);
        await recordDesignJuryRoundSafely({
          workspacePath: input.workspacePath,
          runId: input.agentRun?.runId,
          changedFiles,
          round,
        });
      },
    });
    return applyDesignJuryResult(currentMechanical, result);
  } catch (error) {
    if (error instanceof DesignJuryRevisionMechanicalError) {
      return appendRevisionMechanicalNotice(error.mechanical, completedRounds);
    }
    if (input.signal?.aborted) {
      return applyCancelledDuringDesignJury(input.mechanical);
    }
    const detail = error instanceof Error ? error.message : String(error);
    await recordToolReceiptSafely({
      workspacePath: input.workspacePath,
      runId: input.agentRun.runId,
      tool: 'screen_jury',
      status: 'skipped',
      changedFiles,
      summary: `Design Jury was unavailable: ${detail}`,
      metadata: {
        designJury: {
          status: 'unavailable',
          threshold: DESIGN_JURY_THRESHOLD,
          completedRounds: completedRounds.length,
        },
      },
    });
    return applyUnavailableDesignJury(input.mechanical, detail, completedRounds);
  }
}

export function buildDesignJuryRevisionMessages(
  context: DesignJuryContext,
  prompt: string,
): ChatMessage[] {
  const targets = context.targetFiles.map((file) => file.path);
  const source = context.targetFiles
    .slice(0, 4)
    .map((file) => `--- ${file.path} ---\n${file.contents.slice(0, 16_000)}`)
    .join('\n\n');
  return [
    {
      role: 'system',
      content: [
        'Perform one bounded Design Jury revision of the existing active screen.',
        `Allowed targets: ${targets.join(', ')}.`,
        'Use the available screen tools and project components. Preserve screen identity, routes, working behavior, business facts, and language.',
        'Do not create a replacement screen. Address only the supplied must-fix findings, validate the changed target, then stop.',
        `Original user goal: ${context.userGoal}`,
        '',
        'Current target source:',
        source,
      ].join('\n'),
    },
    { role: 'user', content: prompt },
  ];
}

export function mergeAgentDoneEvents(
  first: Extract<AgentStreamEvent, { type: 'done' }>,
  second: Extract<AgentStreamEvent, { type: 'done' }>,
): Extract<AgentStreamEvent, { type: 'done' }> {
  const usage = addRuntimeUsage(
    first.usage ?? first.finalResponse.usage ?? {},
    second.usage ?? second.finalResponse.usage,
  );
  const responseUsage = hasRuntimeUsage(usage)
    ? {
        ...(usage.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
        ...(usage.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
        ...(usage.totalTokens !== undefined ? { totalTokens: usage.totalTokens } : {}),
      }
    : undefined;
  return {
    ...first,
    ...second,
    transcript: [
      ...first.transcript,
      ...second.transcript.filter((message) => message.role !== 'system'),
    ],
    iterations: first.iterations + second.iterations,
    truncated: first.truncated || second.truncated,
    hadErrors: Boolean(first.hadErrors || second.hadErrors),
    stoppedAfterPermissionDeny: Boolean(
      first.stoppedAfterPermissionDeny || second.stoppedAfterPermissionDeny,
    ),
    finalResponse: {
      ...second.finalResponse,
      ...(responseUsage ? { usage: responseUsage } : {}),
    },
    ...(hasRuntimeUsage(usage) ? { usage } : {}),
  };
}

function applyDesignJuryResult(
  mechanical: BuiltInRunFinalization,
  result: DesignJuryResult,
): BuiltInRunFinalization {
  const event = addUsageToDoneEvent(mechanical.event, result.usage);
  const juryNotice = formatDesignJuryNotice(result);
  const needsReview = result.status === 'needs_review';
  const notice = needsReview ? `${formatRunStatusBanner('needs_review')}${juryNotice}` : juryNotice;
  const summary = needsReview
    ? `Design Jury scored the screen ${result.juryComposite.toFixed(1)}/10 after ${result.rounds.length} round(s).`
    : `${mechanical.summary} Design Jury: ${result.juryComposite.toFixed(1)}/10.`;
  return {
    ...mechanical,
    preEvents: [
      ...(mechanical.preEvents ?? []),
      { type: 'text-delta', iteration: event.iterations, delta: notice },
    ],
    event: appendNoticeToDoneEvent(
      event,
      notice,
      needsReview ? undefined : event.finalResponse.finishReason,
      needsReview ? 'needs_review' : undefined,
    ),
    status: needsReview ? 'needs_review' : 'complete',
    summary,
    diagnostics: {
      ...mechanical.diagnostics,
      designJury: designJuryDiagnostics(result),
    },
  };
}

function applyUnavailableDesignJury(
  mechanical: BuiltInRunFinalization,
  detail: string,
  rounds: DesignJuryRound[],
): BuiltInRunFinalization {
  const notice = [
    formatRunStatusBanner('needs_review'),
    '',
    '',
    'Design Jury could not complete. The mechanically valid screen was preserved and marked for review.',
    `Reason: ${detail}`,
  ].join('\n');
  const event = addUsageToDoneEvent(mechanical.event, tokenUsageFromRounds(rounds));
  return {
    ...mechanical,
    preEvents: [
      ...(mechanical.preEvents ?? []),
      { type: 'text-delta', iteration: event.iterations, delta: notice },
    ],
    event: appendNoticeToDoneEvent(event, notice, undefined, 'needs_review'),
    status: 'needs_review',
    summary: `Design Jury was unavailable: ${detail}`,
    diagnostics: {
      ...mechanical.diagnostics,
      designJury: {
        status: 'unavailable',
        threshold: DESIGN_JURY_THRESHOLD,
        rounds: rounds.length,
        revisionAttempted: false,
        ...tokenUsageFromRounds(rounds),
        detail,
      },
    },
  };
}

function applyCancelledDuringDesignJury(
  mechanical: BuiltInRunFinalization,
): BuiltInRunFinalization {
  return {
    ...mechanical,
    event: {
      ...mechanical.event,
      finalResponse: {
        ...mechanical.event.finalResponse,
        text: 'Cancelled by user.',
        finishReason: 'stop',
      },
      runStatus: 'cancelled',
      runSummary: 'Cancelled by user.',
    },
    status: 'cancelled',
    summary: 'Cancelled by user.',
    diagnostics: {
      ...mechanical.diagnostics,
      finishReason: 'cancelled',
    },
  };
}

function appendRevisionMechanicalNotice(
  mechanical: BuiltInRunFinalization,
  rounds: DesignJuryRound[],
): BuiltInRunFinalization {
  const latest = rounds.at(-1);
  const notice = [
    '',
    '',
    'Design Jury stopped after its single revision because the revised target did not pass mechanical finalization.',
    ...(latest ? [`Initial jury score: ${latest.composite.toFixed(1)}/10.`] : []),
  ].join('\n');
  const event = addUsageToDoneEvent(mechanical.event, tokenUsageFromRounds(rounds));
  return {
    ...mechanical,
    preEvents: [
      ...(mechanical.preEvents ?? []),
      { type: 'text-delta', iteration: event.iterations, delta: notice },
    ],
    event: appendNoticeToDoneEvent(event, notice),
    diagnostics: {
      ...mechanical.diagnostics,
      designJury: {
        status: 'needs_review',
        threshold: DESIGN_JURY_THRESHOLD,
        rounds: rounds.length,
        revisionAttempted: true,
        ...(latest ? { juryComposite: latest.composite } : {}),
        ...tokenUsageFromRounds(rounds),
        detail: 'The bounded revision did not pass mechanical finalization.',
      },
    },
  };
}

function addUsageToDoneEvent(
  event: Extract<AgentStreamEvent, { type: 'done' }>,
  extra: AssistantTokenUsage | null | undefined,
): Extract<AgentStreamEvent, { type: 'done' }> {
  if (!extra) return event;
  const usage = addRuntimeUsage(event.usage ?? event.finalResponse.usage ?? {}, extra);
  return {
    ...event,
    finalResponse: {
      ...event.finalResponse,
      usage: {
        ...(usage.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
        ...(usage.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
        ...(usage.totalTokens !== undefined ? { totalTokens: usage.totalTokens } : {}),
      },
    },
    usage,
  };
}

function designJuryDiagnostics(
  result: DesignJuryResult,
): NonNullable<NonNullable<CompleteAgentRunInput['diagnostics']>['designJury']> {
  return {
    status: result.status,
    threshold: result.rounds.at(-1)?.threshold ?? DESIGN_JURY_THRESHOLD,
    rounds: result.rounds.length,
    revisionAttempted: result.revisionAttempted,
    juryComposite: result.juryComposite,
    ...result.usage,
  };
}

function tokenUsageFromRounds(rounds: readonly DesignJuryRound[]): AssistantTokenUsage {
  const usage = rounds.reduce(
    (current, round) => addRuntimeUsage(current, round.usage),
    {} as AssistantTokenUsage,
  );
  return {
    ...(usage.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
    ...(usage.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
    ...(usage.totalTokens !== undefined ? { totalTokens: usage.totalTokens } : {}),
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

class DesignJuryRevisionMechanicalError extends Error {
  constructor(readonly mechanical: BuiltInRunFinalization) {
    super('The bounded Design Jury revision did not pass mechanical finalization.');
  }
}
