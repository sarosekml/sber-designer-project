/** Run manifest lifecycle: create and complete (metrics, handoff write). */
import { DESIGN_INDEX_PATHS, type ProjectProfileFile } from '@sber-designer/design-indexer';
import {
  normalizeAssistantTokenUsage,
  type AssistantTokenUsage,
  type ProjectProfileContract,
} from '@sber-designer/shared-types';
import { updateRunContinuationContextSnapshotOnComplete } from '../continuation-context';
import type {
  AgentRunDiagnostics,
  AgentRunManifest,
  AgentRunMetrics,
  CompleteAgentRunInput,
  CreateAgentRunInput,
} from './types';
import {
  appendTimeline,
  compactActiveScreen,
  createRunId,
  readRunManifest,
  requireRunId,
  writeRunManifest,
} from './store';
import {
  readRunReceipts,
  recordToolReceiptSafely,
  summarizeComponentReuseFromReceipts,
} from './receipts';
import { writeHandoff } from './handoff';
import { readWorkspaceFile } from '../../safe-fs';
import { appendAgentRunDatasetRowOnce, buildAgentRunDatasetRow } from './dataset';
import { recordAutomaticProjectPreferenceSignal } from './preference-signals';
import { resolveRunScreenAttribution } from './screen-attribution';
import { touchScreens } from '../../project-store';

export async function createAgentRun(input: CreateAgentRunInput): Promise<AgentRunManifest> {
  const now = Date.now();
  const runId = createRunId();
  const projectProfile = await readProjectProfileSnapshot(input.workspacePath);
  const manifest: AgentRunManifest = {
    version: 1,
    runId,
    route: input.route,
    user: input.user,
    provider: input.provider ?? null,
    model: input.model ?? null,
    runtimeKind: input.runtimeKind ?? null,
    ...(input.sessionMode ? { sessionMode: input.sessionMode } : {}),
    ...(input.modeEnforcement ? { modeEnforcement: input.modeEnforcement } : {}),
    projectName: input.projectName ?? null,
    userGoal: input.userGoal?.trim() ? input.userGoal.trim() : null,
    workspacePath: input.workspacePath,
    createdAt: now,
    updatedAt: now,
    status: 'running',
    activeScreen: compactActiveScreen(input.activeScreen ?? null),
    assistantTaskIntent: input.assistantTaskIntent ?? null,
    ...(input.generationMode ? { generationMode: input.generationMode } : {}),
    ...(input.designJuryRequested !== undefined
      ? { designJuryRequested: input.designJuryRequested }
      : {}),
    ...(input.designBrief ? { designBrief: input.designBrief } : {}),
    ...(input.directionSelection ? { directionSelection: input.directionSelection } : {}),
    ...(projectProfile ? { projectProfile } : {}),
    ...(input.targetCapabilities ? { targetCapabilities: input.targetCapabilities } : {}),
  };
  await writeRunManifest(input.workspacePath, manifest);
  await appendTimeline(input.workspacePath, runId, {
    type: 'run_started',
    runId,
    route: input.route,
    createdAt: now,
  });
  if (input.designBrief) {
    await recordToolReceiptSafely({
      workspacePath: input.workspacePath,
      runId,
      tool: 'design_brief',
      status: 'ok',
      summary: `Captured structured design brief from ${input.designBrief.source}.`,
      metadata: { designBrief: input.designBrief },
    });
  }
  if (input.directionSelection) {
    await recordToolReceiptSafely({
      workspacePath: input.workspacePath,
      runId,
      tool: 'direction_selection',
      status: 'ok',
      summary: `Selected direction ${input.directionSelection.optionId}: ${input.directionSelection.label}.`,
      metadata: {
        directionSelection: input.directionSelection,
        ...(input.designBrief ? { designBrief: input.designBrief } : {}),
      },
    });
  }
  return manifest;
}

async function readProjectProfileSnapshot(
  workspacePath: string,
): Promise<ProjectProfileContract | null> {
  try {
    const parsed = JSON.parse(
      await readWorkspaceFile(workspacePath, DESIGN_INDEX_PATHS.projectProfile),
    ) as Partial<ProjectProfileFile>;
    if (!isProjectProfileContract(parsed)) return null;
    return {
      kind: parsed.kind,
      screenUnit: parsed.screenUnit,
      componentModel: parsed.componentModel,
      renderProbe: parsed.renderProbe,
      ...(Array.isArray(parsed.allowedUiPackages) && parsed.allowedUiPackages.length > 0
        ? { allowedUiPackages: parsed.allowedUiPackages.filter((item) => typeof item === 'string') }
        : {}),
    };
  } catch {
    return null;
  }
}

function isProjectProfileContract(value: Partial<ProjectProfileFile>): value is ProjectProfileFile {
  return (
    (value.kind === 'react-storybook' ||
      value.kind === 'react' ||
      value.kind === 'html-css' ||
      value.kind === 'empty') &&
    Boolean(value.screenUnit) &&
    typeof value.screenUnit?.sourceGlob === 'string' &&
    typeof value.screenUnit.storyRequired === 'boolean' &&
    typeof value.screenUnit.rootMarker === 'string' &&
    (value.componentModel === 'react-index' || value.componentModel === 'css-catalog') &&
    (value.renderProbe === 'storybook' || value.renderProbe === 'static-html')
  );
}

export async function completeAgentRun(
  input: CompleteAgentRunInput,
): Promise<AgentRunManifest | null> {
  if (!input.workspacePath || !input.runId) return null;
  const workspacePath = input.workspacePath;
  const runId = requireRunId(input.runId);
  const now = Date.now();
  const manifest = await readRunManifest(workspacePath, runId);
  if (!manifest) return null;
  const receipts = await readRunReceipts(workspacePath, runId);
  const componentReuse = summarizeComponentReuseFromReceipts(receipts);
  const attribution = await resolveRunScreenAttribution(workspacePath, manifest, receipts).catch(
    () => ({
      screenIds: manifest.activeScreen ? [manifest.activeScreen.id] : [],
      sources: manifest.activeScreen
        ? ({ [manifest.activeScreen.id]: 'active-screen' } as const)
        : {},
    }),
  );
  const next: AgentRunManifest = {
    ...manifest,
    ...(input.diagnostics?.runtimeModel?.model.trim()
      ? { model: input.diagnostics.runtimeModel.model.trim() }
      : {}),
    status: input.status,
    affectedScreenIds: attribution.screenIds,
    affectedScreenAttribution: attribution.sources,
    updatedAt: now,
    completedAt: now,
    metrics: completeRunMetrics({
      manifest,
      completedAt: now,
      ...(input.diagnostics !== undefined ? { diagnostics: input.diagnostics } : {}),
      ...(input.metrics !== undefined ? { metrics: input.metrics } : {}),
    }),
    ...(input.summary ? { summary: input.summary } : {}),
    ...(input.diagnostics ? { diagnostics: input.diagnostics } : {}),
    ...(componentReuse ? { componentReuse } : {}),
  };
  await writeRunManifest(workspacePath, next);
  await touchScreens(workspacePath, attribution.screenIds, { at: now }).catch(() => undefined);
  await appendTimeline(workspacePath, runId, {
    type: input.status === 'failed' ? 'run_failed' : 'run_completed',
    runId,
    status: input.status,
    ...(input.summary ? { summary: input.summary } : {}),
    createdAt: now,
  });
  await updateRunContinuationContextSnapshotOnComplete({
    workspacePath,
    runId,
    status: input.status,
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
    receipts,
  });
  await writeHandoff(workspacePath, next);
  await appendAgentRunDatasetRowOnce(workspacePath, buildAgentRunDatasetRow(next, receipts)).catch(
    () => false,
  );
  await recordAutomaticProjectPreferenceSignal({ workspacePath, manifest: next, receipts }).catch(
    () => undefined,
  );
  return next;
}

function completeRunMetrics(input: {
  manifest: AgentRunManifest;
  completedAt: number;
  diagnostics?: AgentRunDiagnostics;
  metrics?: Partial<AgentRunMetrics>;
}): AgentRunMetrics {
  const startedAt = input.metrics?.startedAt ?? input.manifest.createdAt;
  const completedAt = input.metrics?.completedAt ?? input.completedAt;
  const primaryUsage = normalizeAssistantTokenUsage(input.metrics);
  const runtimeFallback = normalizeAssistantTokenUsage(
    input.diagnostics?.runtimeSession?.cumulativeUsage,
  );
  const mergedUsage: AssistantTokenUsage = {};
  const inputTokens = primaryUsage?.inputTokens ?? runtimeFallback?.inputTokens;
  const outputTokens = primaryUsage?.outputTokens ?? runtimeFallback?.outputTokens;
  const totalTokens = primaryUsage?.totalTokens ?? runtimeFallback?.totalTokens;
  if (inputTokens !== undefined) mergedUsage.inputTokens = inputTokens;
  if (outputTokens !== undefined) mergedUsage.outputTokens = outputTokens;
  if (totalTokens !== undefined) mergedUsage.totalTokens = totalTokens;
  const tokenUsage = normalizeAssistantTokenUsage(mergedUsage);
  const costUsd =
    input.metrics?.costUsd ?? input.diagnostics?.runtimeSession?.cumulativeUsage?.costUsd;
  return {
    startedAt,
    completedAt,
    durationMs: Math.max(0, completedAt - startedAt),
    ...(input.metrics?.iterations !== undefined
      ? { iterations: input.metrics.iterations }
      : input.diagnostics?.iterations !== undefined
        ? { iterations: input.diagnostics.iterations }
        : {}),
    ...tokenUsage,
    ...(costUsd !== undefined ? { costUsd } : {}),
  };
}
