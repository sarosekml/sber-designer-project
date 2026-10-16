/**
 * Run evidence: design-source packs, external runtime context bundles,
 * component packs, screenshots, and the evidence export manifest.
 */
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import type { ChatMessage } from '@sber-designer/llm-gateway';
import type { ExternalDesignSourceIntent } from '@sber-designer/shared-types';
import type { AgentKitHandoffResult } from '../../agent-runtimes/agent-kit-handoff';
import type {
  TaskRelevantComponentPack,
  TaskRelevantComponentSelectionChange,
} from '../../component-intelligence/component-pack';
import type {
  AgentRunEvidenceActiveTarget,
  AgentRunEvidenceArtifact,
  AgentRunEvidenceExportManifest,
  AgentRunEvidencePendingPermission,
  AgentRunEvidenceReceiptSummary,
  AgentRunExternalLog,
  AgentRunManifest,
  AgentToolReceipt,
  RecordComponentPackInput,
  RecordDesignSourceEvidencePackInput,
  RecordExternalRuntimeContextBundleInput,
  RecordScreenStructurePlanInput,
  TimelineEvent,
} from './types';
import {
  RUNS_ROOT,
  readRunManifest,
  requireRunId,
  requireWorkspacePath,
  runRoot,
  uniqueSorted,
  writeJson,
} from './store';
import { readRunReceipts, recordToolReceipt } from './receipts';
import { listPendingAgentPermissionRequests } from '../permission-requests';
import { RUN_SOURCE_PREFERENCE_SNAPSHOT_FILE } from './preference-signals';

export async function recordDesignSourceEvidencePackSafely(
  input: RecordDesignSourceEvidencePackInput,
): Promise<void> {
  if (!input.workspacePath || !input.runId) return;
  await recordDesignSourceEvidencePack(input).catch(() => undefined);
}

export async function recordExternalRuntimeContextBundleSafely(
  input: RecordExternalRuntimeContextBundleInput,
): Promise<void> {
  if (!input.workspacePath || !input.runId) return;
  await recordExternalRuntimeContextBundle(input).catch(() => undefined);
}

export async function recordComponentPackSafely(input: RecordComponentPackInput): Promise<void> {
  if (!input.workspacePath || !input.runId) return;
  await recordComponentPack(input).catch(() => undefined);
}

export async function recordComponentSelectionUpdateSafely(input: {
  workspacePath: string | null;
  runId: string | null | undefined;
  componentPack: TaskRelevantComponentPack;
  change: TaskRelevantComponentSelectionChange;
}): Promise<void> {
  if (!input.workspacePath || !input.runId) return;
  await recordComponentSelectionUpdate({
    workspacePath: input.workspacePath,
    runId: input.runId,
    componentPack: input.componentPack,
    change: input.change,
  }).catch(() => undefined);
}

export async function recordScreenStructurePlanSafely(
  input: RecordScreenStructurePlanInput,
): Promise<void> {
  if (!input.workspacePath || !input.runId) return;
  await recordScreenStructurePlan(input).catch(() => undefined);
}

export async function recordRunTranscriptSafely(input: {
  workspacePath: string | null;
  runId: string | null | undefined;
  transcript: ChatMessage[];
  source: 'chat' | 'chat-stream' | 'external-runtime';
}): Promise<void> {
  if (!input.workspacePath || !input.runId) return;
  await recordRunTranscript({
    workspacePath: input.workspacePath,
    runId: input.runId,
    transcript: input.transcript,
    source: input.source,
  }).catch(() => undefined);
}

export async function recordRunTranscript(input: {
  workspacePath: string;
  runId: string;
  transcript: ChatMessage[];
  source: 'chat' | 'chat-stream' | 'external-runtime';
}): Promise<void> {
  const workspacePath = requireWorkspacePath(input.workspacePath);
  const runId = requireRunId(input.runId);
  const relativePath = 'transcript.jsonl';
  const lines = input.transcript.map((message, index) =>
    JSON.stringify({
      version: 1,
      runId,
      source: input.source,
      index,
      role: message.role,
      content: message.content,
      ...(message.toolCalls ? { toolCalls: message.toolCalls } : {}),
      ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
    }),
  );
  await writeFile(
    resolveInside(runRoot(workspacePath, runId), relativePath),
    `${lines.join('\n')}${lines.length > 0 ? '\n' : ''}`,
    'utf8',
  );
  await recordToolReceipt({
    workspacePath,
    runId,
    tool: 'run_transcript',
    status: 'ok',
    changedFiles: [],
    summary: `Persisted ${input.transcript.length} transcript message(s) for run recovery.`,
    metadata: {
      transcriptPath: relativePath,
      messageCount: input.transcript.length,
      source: input.source,
    },
  });
}

export async function recordComponentPack(input: RecordComponentPackInput): Promise<void> {
  const workspacePath = requireWorkspacePath(input.workspacePath);
  const runId = requireRunId(input.runId);
  const relativePath = 'component-pack.json';
  const hydrationSummary = input.componentPack.hydrationManifest
    ? `${input.componentPack.hydrationManifest.hydratedComponentIds.length} component(s) in ${input.componentPack.hydrationManifest.batches.length} region batch(es), ${input.componentPack.hydrationManifest.totalBytes} UTF-8 bytes`
    : `${input.componentPack.candidates.length} candidate(s)`;
  await writeJson(resolveInside(runRoot(workspacePath, runId), relativePath), input.componentPack);
  await recordToolReceipt({
    workspacePath,
    runId,
    tool: 'task_relevant_component_pack',
    status: 'ok',
    changedFiles: [],
    summary: input.componentPack.selectionMap
      ? `Prepared complete component selection map with ${input.componentPack.selectionMap.counts.indexed} indexed component(s), then hydrated ${hydrationSummary}${input.componentPack.selectionPlan ? ` for ${input.componentPack.selectionPlan.plannedRoles.length} planned role(s), with ${input.componentPack.selectionPlan.gaps.length} design-system gap(s)` : ''}.`
      : `Prepared task-relevant component pack with ${hydrationSummary}.`,
    metadata: {
      path: relativePath,
      status: input.componentPack.status,
      stale: input.componentPack.stale,
      taskKind: input.componentPack.taskKind,
      candidateCount: input.componentPack.candidates.length,
      componentIds: input.componentPack.candidates.map((candidate) => candidate.componentId),
      ...(input.componentPack.hydrationManifest
        ? {
            hydrationStrategy: input.componentPack.hydrationManifest.strategy,
            hydrationBatchBudgetBytes: input.componentPack.hydrationManifest.batchBudgetBytes,
            hydratedCount: input.componentPack.hydrationManifest.hydratedComponentIds.length,
            hydratedComponentIds: input.componentPack.hydrationManifest.hydratedComponentIds,
            hydrationBatchCount: input.componentPack.hydrationManifest.batches.length,
            hydrationBytes: input.componentPack.hydrationManifest.totalBytes,
            hydrationBatches: input.componentPack.hydrationManifest.batches.map((batch) => ({
              id: batch.id,
              regionIds: batch.regionIds,
              componentIds: batch.componentIds,
              byteSize: batch.byteSize,
              oversized: batch.oversized,
            })),
          }
        : {}),
      ...(input.componentPack.selectionPlan
        ? {
            selectionSource: input.componentPack.selectionPlan.source,
            plannedRoleCount: input.componentPack.selectionPlan.plannedRoles.length,
            plannedRoles: input.componentPack.selectionPlan.plannedRoles,
            gapCount: input.componentPack.selectionPlan.gaps.length,
            gapRoles: input.componentPack.selectionPlan.gaps.map((gap) => gap.role),
            ...(input.componentPack.selectionPlan.resolutions
              ? {
                  componentResolutionCount: input.componentPack.selectionPlan.resolutions.length,
                  resolvedComponentCount: input.componentPack.selectionPlan.resolutions.filter(
                    (item) => item.status === 'resolved',
                  ).length,
                  partialResolutionCount: input.componentPack.selectionPlan.resolutions.filter(
                    (item) => item.status === 'partial',
                  ).length,
                  unverifiedResolutionCount: input.componentPack.selectionPlan.resolutions.filter(
                    (item) => item.status === 'unverified',
                  ).length,
                  componentResolutions: input.componentPack.selectionPlan.resolutions,
                }
              : {}),
          }
        : {}),
      ...(input.componentPack.selectionMap
        ? {
            selectionMapPath: '.sber-designer/design-index/component-selection-map.json',
            indexedCount: input.componentPack.selectionMap.counts.indexed,
            describedCount: input.componentPack.selectionMap.counts.described,
            divergedCount: input.componentPack.selectionMap.counts.diverged,
            selectionMapSource: input.componentPack.selectionMap.source,
          }
        : {}),
    },
  });
}

export async function readRecordedComponentPack(
  workspacePath: string,
  runId: string,
): Promise<TaskRelevantComponentPack | null> {
  try {
    return JSON.parse(
      await readFile(resolveInside(runRoot(workspacePath, runId), 'component-pack.json'), 'utf8'),
    ) as TaskRelevantComponentPack;
  } catch {
    return null;
  }
}

export async function recordComponentSelectionUpdate(input: {
  workspacePath: string;
  runId: string;
  componentPack: TaskRelevantComponentPack;
  change: TaskRelevantComponentSelectionChange;
}): Promise<void> {
  const workspacePath = requireWorkspacePath(input.workspacePath);
  const runId = requireRunId(input.runId);
  const relativePath = 'component-pack.json';
  await writeJson(resolveInside(runRoot(workspacePath, runId), relativePath), input.componentPack);
  await recordToolReceipt({
    workspacePath,
    runId,
    tool: 'update_component_selection',
    status: 'ok',
    changedFiles: [],
    summary:
      input.change.action === 'replace'
        ? `Replaced ${input.change.replacedComponentId} with ${input.change.componentId} for planned role ${input.change.role} and continued the same run.`
        : `Added ${input.change.componentId} for planned role ${input.change.role} and continued the same run.`,
    metadata: {
      path: relativePath,
      ...input.change,
      candidateCount: input.componentPack.candidates.length,
      lateChangeCount: input.componentPack.lateSelection?.changes.length ?? 0,
      lateChangeBudget: input.componentPack.lateSelection?.maxChanges ?? 0,
      hydratedComponentIds: input.componentPack.hydrationManifest?.hydratedComponentIds ?? [],
    },
  });
}

export async function recordScreenStructurePlan(
  input: RecordScreenStructurePlanInput,
): Promise<void> {
  const workspacePath = requireWorkspacePath(input.workspacePath);
  const runId = requireRunId(input.runId);
  const relativePath = 'screen-structure-plan.json';
  await writeJson(resolveInside(runRoot(workspacePath, runId), relativePath), input.plan);
  await recordToolReceipt({
    workspacePath,
    runId,
    tool: 'screen_structure_plan',
    status: 'ok',
    changedFiles: [],
    summary: `Prepared screen structure plan with ${input.plan.regions.length} region(s), ${input.plan.actions.length} action(s), and ${input.plan.states.length} state requirement(s).`,
    metadata: {
      path: relativePath,
      taskKind: input.plan.taskKind,
      source: input.plan.source,
      regionCount: input.plan.regions.length,
      uiRoles: uniqueSorted(input.plan.regions.flatMap((region) => region.uiRoles)),
      dataRequirementCount: input.plan.data.length,
      actionCount: input.plan.actions.length,
      stateCount: input.plan.states.length,
    },
  });
}

export async function recordExternalRuntimeContextBundle(
  input: RecordExternalRuntimeContextBundleInput,
): Promise<void> {
  const workspacePath = requireWorkspacePath(input.workspacePath);
  const runId = requireRunId(input.runId);
  const root = resolveInside(runRoot(workspacePath, runId), 'external-runtime');
  await mkdir(root, { recursive: true });

  await writeFile(resolveInside(root, 'prompt.md'), input.handoff.prompt, 'utf8');
  await writeFile(
    resolveInside(root, 'skill-inventory.md'),
    formatSkillInventory(input.handoff),
    'utf8',
  );
  await writeFile(
    resolveInside(root, 'knowledge-inventory.md'),
    formatKnowledgeInventory(input.handoff),
    'utf8',
  );
  await writeFile(
    resolveInside(root, 'agent-kit-summary.md'),
    formatExternalRuntimeAgentKitSummary(input),
    'utf8',
  );
  await writeJson(resolveInside(root, 'context-budget.json'), {
    estimatedBytes: input.handoff.estimatedBytes,
    stableContextDigest: input.handoff.stableContextDigest,
    stableContextBytes: input.handoff.stableContextBytes,
    kitStableDigest: input.handoff.kitStableDigest,
    kitStableBytes: input.handoff.kitStableBytes,
    taskBytes: input.handoff.taskBytes,
    stableContextReuse: input.handoff.stableContextReuse,
    resumeUsed: input.handoff.resumeUsed,
    ...(input.handoff.deltaBytes !== undefined ? { deltaBytes: input.handoff.deltaBytes } : {}),
    ...(input.handoff.runtimeSessionId ? { runtimeSessionId: input.handoff.runtimeSessionId } : {}),
    ...(input.handoff.previousStableContextDigest
      ? { previousStableContextDigest: input.handoff.previousStableContextDigest }
      : {}),
    ...(input.handoff.previousStableContextBundlePath
      ? { previousStableContextBundlePath: input.handoff.previousStableContextBundlePath }
      : {}),
    ...(input.handoff.previousStableContextSource
      ? { stableContextSource: input.handoff.previousStableContextSource }
      : {}),
    omittedSections: input.handoff.omittedSections,
    includedTaskHistorySummary: input.handoff.includedTaskHistorySummary,
  });

  await recordToolReceipt({
    workspacePath,
    runId,
    tool: 'external_runtime_context_bundle',
    status: 'ok',
    changedFiles: [],
    summary: `Prepared ${input.runtimeLabel} agent-kit-aware handoff for ${input.handoff.agentName}.`,
    metadata: {
      promptPath: 'external-runtime/prompt.md',
      skillInventoryPath: 'external-runtime/skill-inventory.md',
      knowledgeInventoryPath: 'external-runtime/knowledge-inventory.md',
      agentKitSummaryPath: 'external-runtime/agent-kit-summary.md',
      contextBudgetPath: 'external-runtime/context-budget.json',
      skillInventoryCount: input.handoff.skillInventory.length,
      knowledgeInventoryCount: input.handoff.knowledgeInventory.length,
      stableContextDigest: input.handoff.stableContextDigest,
      stableContextBytes: input.handoff.stableContextBytes,
      kitStableDigest: input.handoff.kitStableDigest,
      kitStableBytes: input.handoff.kitStableBytes,
      taskBytes: input.handoff.taskBytes,
      stableContextReuse: input.handoff.stableContextReuse,
      resumeUsed: input.handoff.resumeUsed,
      ...(input.handoff.deltaBytes !== undefined ? { deltaBytes: input.handoff.deltaBytes } : {}),
      ...(input.handoff.runtimeSessionId
        ? { runtimeSessionId: input.handoff.runtimeSessionId }
        : {}),
      ...(input.handoff.previousStableContextDigest
        ? { previousStableContextDigest: input.handoff.previousStableContextDigest }
        : {}),
      ...(input.handoff.previousStableContextBundlePath
        ? { previousStableContextBundlePath: input.handoff.previousStableContextBundlePath }
        : {}),
      ...(input.handoff.previousStableContextSource
        ? { stableContextSource: input.handoff.previousStableContextSource }
        : {}),
      omittedSections: input.handoff.omittedSections,
    },
  });
}

export async function recordDesignSourceEvidencePack(
  input: RecordDesignSourceEvidencePackInput,
): Promise<void> {
  const workspacePath = requireWorkspacePath(input.workspacePath);
  const runId = requireRunId(input.runId);
  const root = runRoot(workspacePath, runId);
  const referenceRoot = resolveInside(root, join('reference', 'design-source'));
  await mkdir(referenceRoot, { recursive: true });

  const sourceSummaryPath = resolveInside(referenceRoot, 'source-summary.md');
  const mappingReportPath = resolveInside(referenceRoot, 'mapping-report.md');
  const manifestPath = resolveInside(referenceRoot, 'manifest.json');
  await writeFile(sourceSummaryPath, formatDesignSourceSummary(input.intent), 'utf8');
  await writeFile(mappingReportPath, formatDesignSourceMappingReport(input.intent), 'utf8');
  await writeJson(manifestPath, {
    version: 1,
    runId,
    source: input.intent.source,
    target: input.intent.target,
    policies: input.intent.policies,
    files: {
      sourceSummary: 'reference/design-source/source-summary.md',
      mappingReport: 'reference/design-source/mapping-report.md',
    },
    createdAt: Date.now(),
  });

  await recordToolReceipt({
    workspacePath,
    runId,
    tool: 'reference_evidence_pack',
    status: 'ok',
    changedFiles: [],
    summary: `Initialized design-source evidence pack for ${input.intent.source.kind}.`,
    metadata: {
      source: input.intent.source,
      target: input.intent.target,
      policies: input.intent.policies,
      sourceSummaryPath: 'reference/design-source/source-summary.md',
      mappingReportPath: 'reference/design-source/mapping-report.md',
      manifestPath: 'reference/design-source/manifest.json',
      completeness: 'initialized',
    },
  });
}

function formatDesignSourceSummary(intent: ExternalDesignSourceIntent): string {
  return [
    '# Design Source Summary',
    '',
    `- Source: ${intent.source.kind}`,
    `- Input: ${intent.source.input}`,
    intent.source.url ? `- URL: ${intent.source.url}` : null,
    intent.source.nodeId ? `- Node ID: ${intent.source.nodeId}` : null,
    `- Target mode: ${intent.target.mode}`,
    intent.target.name ? `- Target name: ${intent.target.name}` : null,
    intent.target.storyFilePath ? `- Story file: ${intent.target.storyFilePath}` : null,
    intent.target.implementationFilePath
      ? `- Implementation file: ${intent.target.implementationFilePath}`
      : null,
    `- Token policy: ${intent.policies.tokens}`,
    `- Component policy: ${intent.policies.components}`,
    '',
    '## MCP Evidence',
    '',
    '- Code: _not captured yet_',
    '- Images: _not captured yet_',
    '- Layout/style notes: _not captured yet_',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatDesignSourceMappingReport(intent: ExternalDesignSourceIntent): string {
  return [
    '# Design Source Mapping Report',
    '',
    `Source: ${intent.source.kind}`,
    `Target mode: ${intent.target.mode}`,
    '',
    '## Project Components Used',
    '',
    '- _pending_',
    '',
    '## Project Tokens Used',
    '',
    '- _pending_',
    '',
    '## Direct Source Values Kept',
    '',
    '- _pending_',
    '',
    '## Conflicts',
    '',
    '- _pending_',
    '',
    '## Assumptions',
    '',
    '- _pending_',
    '',
  ].join('\n');
}

export async function buildRunEvidenceExportManifest(
  workspacePath: string,
  runId: string,
): Promise<AgentRunEvidenceExportManifest> {
  const safeRunId = requireRunId(runId);
  const manifest = await readRunManifest(workspacePath, safeRunId);
  if (!manifest) throw new Error(`Agent run "${safeRunId}" was not found.`);
  const root = runRoot(workspacePath, safeRunId);
  const artifacts: AgentRunEvidenceArtifact[] = [];
  const addArtifact = async (
    kind: string,
    path: string,
    options: { required?: boolean; source?: string } = {},
  ): Promise<void> => {
    artifacts.push({
      kind,
      path,
      required: options.required ?? false,
      exists: await existsUnder(root, path),
      ...(options.source ? { source: options.source } : {}),
    });
  };

  await addArtifact('manifest', 'run-manifest.json', { required: true });
  await addArtifact('timeline', 'timeline.jsonl', { required: true });
  await addArtifact('handoff', 'handoff.md');
  await addArtifact('receipts', 'receipts', { required: true });
  await addArtifact('continuation-context', 'continuation-context.json');
  await addArtifact('screen-structure-plan', 'screen-structure-plan.json');
  await addArtifact('component-pack', 'component-pack.json');
  await addArtifact('transcript', 'transcript.jsonl');
  await addArtifact('source-preference-snapshot', RUN_SOURCE_PREFERENCE_SNAPSHOT_FILE);

  for (const attachment of manifest.promptAttachments ?? []) {
    const runRelativePath = runRelativeArtifactPath(safeRunId, attachment.runPath);
    if (runRelativePath) {
      await addArtifact('prompt-attachment', runRelativePath, { source: attachment.name });
    }
  }
  await addArtifact('prompt-attachments-manifest', 'attachments/attachments.json');

  for (const artifact of await listArtifactsIn(root, 'screenshots', 'screenshot')) {
    artifacts.push(artifact);
  }
  for (const artifact of await listArtifactsIn(root, 'reference/design-source', 'design-source')) {
    artifacts.push(artifact);
  }
  for (const artifact of await listArtifactsIn(root, 'external-runtime', 'external-runtime')) {
    artifacts.push(artifact);
  }

  const receipts = await readRunReceipts(workspacePath, safeRunId);
  for (const receipt of receipts) {
    for (const artifact of receiptMetadataArtifacts(receipt)) {
      await addArtifact(artifact.kind, artifact.path, { source: receipt.tool });
    }
  }
  const now = Date.now();

  return {
    version: 1,
    runId: safeRunId,
    status: manifest.status,
    provider: manifest.provider,
    model: manifest.model,
    runtimeKind: manifest.runtimeKind,
    summary: manifest.summary ?? null,
    rootPath: join(RUNS_ROOT, safeRunId),
    workspacePath,
    generatedAt: Date.now(),
    activeScreen: manifest.activeScreen,
    activeTarget: activeTargetFromManifest(manifest),
    diagnostics: manifest.diagnostics ?? null,
    metrics: manifest.metrics ?? null,
    componentReuse: manifest.componentReuse ?? null,
    receiptSummary: summarizeEvidenceReceipts(receipts),
    pendingPermissions: pendingPermissionsForRun(manifest, safeRunId, now),
    lastTimelineEvent: await readLastTimelineEvent(root),
    artifacts: uniqueArtifacts(artifacts),
    externalLogs: externalLogArtifacts(manifest),
  };
}

async function existsUnder(root: string, relativePath: string): Promise<boolean> {
  try {
    await stat(resolveInside(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function listArtifactsIn(
  root: string,
  relativeDir: string,
  kind: string,
): Promise<AgentRunEvidenceArtifact[]> {
  const abs = resolveInside(root, relativeDir);
  let entries: string[] = [];
  try {
    entries = await readdir(abs);
  } catch {
    return [];
  }
  const artifacts: AgentRunEvidenceArtifact[] = [];
  for (const entry of entries.sort((a, b) => a.localeCompare(b))) {
    const path = join(relativeDir, entry).split('\\').join('/');
    artifacts.push({
      kind,
      path,
      required: false,
      exists: await existsUnder(root, path),
    });
  }
  return artifacts;
}

function receiptMetadataArtifacts(receipt: AgentToolReceipt): { kind: string; path: string }[] {
  const artifacts: { kind: string; path: string }[] = [];
  for (const [key, value] of Object.entries(receipt.metadata ?? {})) {
    if (!key.toLowerCase().endsWith('path')) continue;
    if (typeof value !== 'string' || !value.trim()) continue;
    if (value.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(value)) continue;
    artifacts.push({ kind: receiptMetadataArtifactKind(key), path: value });
  }
  return artifacts;
}

function receiptMetadataArtifactKind(key: string): string {
  const normalized = key
    .replace(/Path$/u, '')
    .replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)
    .replace(/^-+/u, '');
  return normalized || 'receipt-metadata';
}

function runRelativeArtifactPath(runId: string, runPath: string): string | null {
  const prefix = `${RUNS_ROOT}/${runId}/`;
  const normalized = runPath.split('\\').join('/');
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : null;
}

function externalLogArtifacts(manifest: AgentRunManifest): AgentRunExternalLog[] {
  const logs: AgentRunExternalLog[] = [];
  if (manifest.diagnostics?.attemptLogPath) {
    logs.push({ kind: 'attempt-log', path: manifest.diagnostics.attemptLogPath });
  }
  if (manifest.diagnostics?.debugLogPath) {
    logs.push({ kind: 'debug-log', path: manifest.diagnostics.debugLogPath });
  }
  if (manifest.diagnostics?.runManifestPath) {
    logs.push({ kind: 'run-manifest-link', path: manifest.diagnostics.runManifestPath });
  }
  return logs;
}

function activeTargetFromManifest(manifest: AgentRunManifest): AgentRunEvidenceActiveTarget | null {
  if (!manifest.activeScreen) return null;
  const files = uniqueSorted(
    [manifest.activeScreen.implementationFilePath, manifest.activeScreen.filePath].filter(
      (value): value is string => Boolean(value),
    ),
  );
  return {
    screenId: manifest.activeScreen.id,
    screenName: manifest.activeScreen.name,
    files,
  };
}

function summarizeEvidenceReceipts(receipts: AgentToolReceipt[]): AgentRunEvidenceReceiptSummary {
  const byStatus: Record<string, number> = {};
  for (const receipt of receipts) {
    byStatus[receipt.status] = (byStatus[receipt.status] ?? 0) + 1;
  }
  const latest = [...receipts].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  return {
    total: receipts.length,
    byStatus,
    tools: uniqueSorted(receipts.map((receipt) => receipt.tool)),
    latest: latest
      ? {
          tool: latest.tool,
          status: latest.status,
          summary: latest.summary,
          changedFiles: latest.changedFiles,
          createdAt: latest.createdAt,
        }
      : null,
  };
}

function pendingPermissionsForRun(
  manifest: AgentRunManifest,
  runId: string,
  now: number,
): AgentRunEvidencePendingPermission[] {
  return listPendingAgentPermissionRequests({ user: manifest.user })
    .filter((request) => request.runId === runId)
    .map((request) => ({
      id: request.id,
      toolCallId: request.toolCallId,
      toolName: request.toolName,
      category: request.category,
      resource: request.resource,
      pattern: request.pattern,
      ...(request.runId ? { runId: request.runId } : {}),
      createdAt: request.createdAt,
      ...(request.expiresAt ? { expiresAt: request.expiresAt } : {}),
      elapsedMs: Math.max(0, now - request.createdAt),
    }));
}

async function readLastTimelineEvent(root: string): Promise<TimelineEvent | null> {
  try {
    const raw = await readFile(resolveInside(root, 'timeline.jsonl'), 'utf8');
    const line = raw
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .at(-1);
    return line ? (JSON.parse(line) as TimelineEvent) : null;
  } catch {
    return null;
  }
}

function uniqueArtifacts(artifacts: AgentRunEvidenceArtifact[]): AgentRunEvidenceArtifact[] {
  const seen = new Set<string>();
  const unique: AgentRunEvidenceArtifact[] = [];
  for (const artifact of artifacts) {
    const key = `${artifact.kind}:${artifact.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(artifact);
  }
  return unique.sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind));
}

export async function readScreenshotEvidence(
  workspacePath: string,
  runId: string,
): Promise<string[]> {
  const screenshotsRoot = resolveInside(runRoot(workspacePath, runId), 'screenshots');
  try {
    const files = await readdir(screenshotsRoot);
    return files
      .filter((file) => /\.(png|jpe?g|webp)$/iu.test(file))
      .sort()
      .map((file) => `screenshots/${file}`);
  } catch {
    return [];
  }
}

function formatSkillInventory(handoff: AgentKitHandoffResult): string {
  return [
    '# Skill Inventory',
    '',
    ...handoff.skillInventory.map(
      (skill) =>
        `- \`${skill.name}\` (${skill.source}) - ${skill.description}\n  - whenToUse: ${skill.whenToUse}\n  - path: ${skill.path}`,
    ),
    '',
  ].join('\n');
}

function formatKnowledgeInventory(handoff: AgentKitHandoffResult): string {
  return [
    '# Knowledge Inventory',
    '',
    ...handoff.knowledgeInventory.map(
      (item) => `- \`${item.id}\` (${item.source}) - ${item.description}\n  - path: ${item.path}`,
    ),
    '',
  ].join('\n');
}

function formatExternalRuntimeAgentKitSummary(
  input: RecordExternalRuntimeContextBundleInput,
): string {
  return [
    '# External Runtime Agent Kit Summary',
    '',
    `- runtime: ${input.runtimeLabel}`,
    `- agent: ${input.handoff.agentName}`,
    `- skills: ${input.handoff.skillInventory.length}`,
    `- knowledge: ${input.handoff.knowledgeInventory.length}`,
    `- taskHistorySummary: ${input.handoff.includedTaskHistorySummary ? 'included' : 'omitted'}`,
    `- estimatedBytes: ${input.handoff.estimatedBytes}`,
    `- stableContextDigest: ${input.handoff.stableContextDigest}`,
    `- stableContextBytes: ${input.handoff.stableContextBytes}`,
    `- kitStableDigest: ${input.handoff.kitStableDigest}`,
    `- kitStableBytes: ${input.handoff.kitStableBytes}`,
    `- taskBytes: ${input.handoff.taskBytes}`,
    `- stableContextReuse: ${input.handoff.stableContextReuse}`,
    ...(input.handoff.previousStableContextBundlePath
      ? [`- previousStableContextBundle: ${input.handoff.previousStableContextBundlePath}`]
      : []),
    '',
  ].join('\n');
}
