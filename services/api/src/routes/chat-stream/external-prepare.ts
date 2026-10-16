/**
 * Preparing an external-runtime turn (0136 R12 — extracted from external.ts).
 *
 * Everything that happens *before* the runtime is started: assembling the
 * agent-kit context, building the handoff prompt, resolving the previous
 * stable context a resumed session can reuse, and creating the run record.
 * external.ts keeps the streaming half.
 */
import { readFile } from 'node:fs/promises';
import { resolveInside } from '@sber-designer/ast-bridge';
import {
  detectExternalDesignSourceIntent,
  isProjectStyleMemoryEnabled,
  normalizeAssistantSessionMode,
  type AssistantSessionMode,
  type PromptAttachmentEvidence,
} from '@sber-designer/shared-types';
import {
  createAgentRun,
  recordComponentPackSafely,
  recordDesignSourceEvidencePackSafely,
  recordExternalRuntimeContextBundleSafely,
  recordScreenStructurePlanSafely,
  type AgentRunTargetCapabilities,
  type AgentRunManifest,
} from '../../agent/run-recorder';
import { resolvePrimaryAgent, resolveRequestedAgent } from '../../agent-kit/active-agent';
import { loadAgentKit } from '../../agent-kit/loader';
import { allowedTargetsFromState, latestUserRequest } from '../../agent-runtimes/handoff-prompt';
import {
  buildAgentKitHandoff,
  type AgentKitRuntimeSessionContext,
  type AgentKitHandoffResult,
  type AgentKitPreviousStableContext,
  type ExternalRuntimeKind,
} from '../../agent-runtimes/agent-kit-handoff';
import { snapshotRuntimeTargetFiles } from '../../agent-runtimes/change-validation';
import { loadProjectStyleMemoryPrompt } from '../../project-preferences';
import { getProject } from '../../project-store';
import { sessionModePromptSection } from '../../session-mode';
import { type EditorState } from '../../state-store';
import type { GenerationOptions } from '../../generation-mode';
import {
  buildRunScreenStructurePlan,
  loadExternalRuntimeProjectIndexContext,
  loadRunComponentPack,
  resolveTaskRelevantComponentTaskKind,
} from './run-context';
import { captureRuntimeVisualSnapshot, unavailableRuntimeVisualSnapshot } from './render-health';
import {
  runtimeKindForProvider,
  type ExternalRuntimeAgentKitContext,
  type ExternalRuntimeRunContext,
} from './external';

export async function prepareExternalRuntimeAgentKitContext(input: {
  workspacePath: string | null;
  primaryAgent?: string | undefined;
  requestedAgent?: string | undefined;
}): Promise<
  | { ok: true; context: ExternalRuntimeAgentKitContext }
  | { ok: false; error: string; detail: string; status: 400 }
> {
  const kit = await loadAgentKit({ workspacePath: input.workspacePath });
  const primary = resolvePrimaryAgent(kit, input.primaryAgent);
  if (!primary.ok) {
    return { ok: false, error: primary.code, detail: primary.detail, status: 400 };
  }
  if (input.requestedAgent) {
    const requested = resolveRequestedAgent(kit, input.requestedAgent);
    if (!requested.ok) {
      return { ok: false, error: requested.code, detail: requested.detail, status: 400 };
    }
    return {
      ok: true,
      context: {
        kit,
        primaryAgentName: primary.agent.name,
        requestedAgentName: requested.agent.name,
      },
    };
  }
  return { ok: true, context: { kit, primaryAgentName: primary.agent.name } };
}

export async function prepareExternalRuntimePrompt(input: {
  runtime: ExternalRuntimeKind;
  runtimeLabel: string;
  model: string | null;
  messages: { role: string; content: unknown }[];
  state: EditorState;
  agentRun: AgentRunManifest | null;
  context: ExternalRuntimeAgentKitContext;
  sessionMetadata?: { lastRunManifestPath?: string | null } | null;
  runtimeSession?: AgentKitRuntimeSessionContext | null;
  maxPromptBytes?: number;
  promptAttachments?: PromptAttachmentEvidence[];
  runtimeWarnings?: string[];
  generation?: GenerationOptions | null;
  sessionMode?: AssistantSessionMode;
}): Promise<AgentKitHandoffResult> {
  const sessionMode = normalizeAssistantSessionMode(input.sessionMode);
  const projectIndex = await loadExternalRuntimeProjectIndexContext(input.state.workspacePath);
  const userRequest = latestUserRequest(input.messages);
  const taskKind = resolveTaskRelevantComponentTaskKind(
    input.state,
    input.promptAttachments ?? [],
    userRequest,
  );
  const screenStructurePlan =
    sessionMode === 'design'
      ? buildRunScreenStructurePlan({
          state: input.state,
          messages: input.messages,
          promptAttachments: input.promptAttachments ?? [],
          designBrief: input.generation?.designBrief ?? null,
          directionSelection: input.generation?.directionSelection ?? null,
          taskKind,
        })
      : null;
  if (screenStructurePlan) {
    await recordScreenStructurePlanSafely({
      workspacePath: input.state.workspacePath ?? null,
      runId: input.agentRun?.runId,
      plan: screenStructurePlan,
    });
  }
  const componentPack =
    sessionMode === 'design'
      ? await loadRunComponentPack({
          workspacePath: input.state.workspacePath,
          state: input.state,
          messages: input.messages,
          promptAttachments: input.promptAttachments ?? [],
          designBrief: input.generation?.designBrief ?? null,
          screenStructurePlan,
          taskKind: screenStructurePlan?.taskKind ?? taskKind,
        })
      : null;
  if (componentPack) {
    await recordComponentPackSafely({
      workspacePath: input.state.workspacePath ?? null,
      runId: input.agentRun?.runId,
      componentPack,
    });
  }
  const previousStableContext = await resolvePreviousStableContextForHandoff({
    workspacePath: input.state.workspacePath,
    sessionMetadata: input.sessionMetadata ?? null,
    messages: input.messages,
  });
  const resolvedTaskKind = componentPack?.taskKind ?? taskKind;
  const projectStyleMemory =
    sessionMode === 'ask'
      ? ''
      : await loadProjectStyleMemoryPrompt(input.state.workspacePath, resolvedTaskKind, {
          enabled: isProjectStyleMemoryEnabled(getProject(input.state.workspacePath)),
        });
  const rawHandoff = buildAgentKitHandoff({
    runtime: input.runtime,
    runtimeLabel: input.runtimeLabel,
    model: input.model,
    messages: input.messages,
    state: input.state,
    kit: input.context.kit,
    primaryAgentName: input.context.primaryAgentName,
    requestedAgentName: input.context.requestedAgentName,
    agentRunId: input.agentRun?.runId ?? null,
    projectIndex,
    componentPack,
    promptAttachments: input.promptAttachments ?? [],
    runtimeWarnings: input.runtimeWarnings ?? [],
    generation: input.generation ?? null,
    screenStructurePlan,
    previousStableContext,
    runtimeSession: input.runtimeSession ?? null,
    projectStyleMemory,
    ...(input.maxPromptBytes !== undefined ? { maxPromptBytes: input.maxPromptBytes } : {}),
  });
  const modeSection = sessionModePromptSection(sessionMode);
  const handoff: AgentKitHandoffResult = {
    ...rawHandoff,
    prompt: [modeSection, rawHandoff.prompt].filter(Boolean).join('\n\n'),
    ...(rawHandoff.resumeFallbackPrompt
      ? {
          resumeFallbackPrompt: [modeSection, rawHandoff.resumeFallbackPrompt]
            .filter(Boolean)
            .join('\n\n'),
        }
      : {}),
  };
  await recordExternalRuntimeContextBundleSafely({
    workspacePath: input.state.workspacePath ?? null,
    runId: input.agentRun?.runId,
    runtimeLabel: input.runtimeLabel,
    handoff,
  });
  return handoff;
}

export async function resolvePreviousStableContextForHandoff(input: {
  workspacePath: string | null | undefined;
  sessionMetadata?: { lastRunManifestPath?: string | null } | null;
  messages: { role: string; content: unknown }[];
}): Promise<AgentKitPreviousStableContext | null> {
  if (!input.workspacePath) return null;
  const metadataRunManifestPath = cleanRunManifestPath(input.sessionMetadata?.lastRunManifestPath);
  const allowLegacyMessageScan = !Object.hasOwn(input, 'sessionMetadata');
  const runManifestPath =
    metadataRunManifestPath ??
    (allowLegacyMessageScan ? latestPreviousRunManifestPath(input.messages) : null);
  if (!runManifestPath) return null;
  const source: AgentKitPreviousStableContext['source'] = metadataRunManifestPath
    ? 'metadata'
    : 'message_scan';
  const paths = stableContextPathsFromRunManifestPath(runManifestPath);
  if (!paths) return null;
  const raw = await readFile(resolveInside(input.workspacePath, paths.contextBudgetPath), 'utf8')
    .then((value) => value)
    .catch(() => null);
  if (!raw) return null;
  const parsed = parseJsonObject(raw);
  const digest = typeof parsed?.stableContextDigest === 'string' ? parsed.stableContextDigest : '';
  if (!digest.trim()) return null;
  return {
    digest,
    runManifestPath,
    source,
    contextBundlePath:
      typeof parsed?.previousStableContextBundlePath === 'string' &&
      parsed.previousStableContextBundlePath.trim()
        ? parsed.previousStableContextBundlePath
        : paths.contextBundlePath,
  };
}

function cleanRunManifestPath(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function latestPreviousRunManifestPath(
  messages: { role: string; content: unknown }[],
): string | null {
  const matches: string[] = [];
  for (const message of messages) {
    const text = messageContentText(message.content);
    if (!text) continue;
    for (const match of text.matchAll(
      /(?:^|\n)-?\s*runManifest:\s*(\.sber-designer\/runs\/[A-Za-z0-9._/-]+\/run-manifest\.json)(?=\s|$)/gu,
    )) {
      if (match[1]) matches.push(match[1]);
    }
  }
  return matches.at(-1) ?? null;
}

function stableContextPathsFromRunManifestPath(
  runManifestPath: string,
): { contextBudgetPath: string; contextBundlePath: string } | null {
  const normalized = runManifestPath.replace(/\\/gu, '/');
  if (normalized.split('/').includes('..')) return null;
  if (!normalized.startsWith('.sber-designer/runs/')) return null;
  if (!normalized.endsWith('/run-manifest.json')) return null;
  const runRoot = normalized.replace(/\/run-manifest\.json$/u, '');
  return {
    contextBudgetPath: `${runRoot}/external-runtime/context-budget.json`,
    contextBundlePath: `${runRoot}/external-runtime/prompt.md`,
  };
}

function messageContentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (
          part &&
          typeof part === 'object' &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          return (part as { text: string }).text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (
    content &&
    typeof content === 'object' &&
    typeof (content as { text?: unknown }).text === 'string'
  ) {
    return (content as { text: string }).text;
  }
  return '';
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function prepareExternalRuntimeRun(input: {
  state: EditorState;
  user: string;
  userGoal: string;
  provider: string;
  model: string | null;
  targetCapabilities?: AgentRunTargetCapabilities;
  existingAgentRun?: AgentRunManifest | null;
}): Promise<ExternalRuntimeRunContext> {
  const workspacePath = input.state.workspacePath ?? null;
  if (!workspacePath) {
    return {
      workspacePath: null,
      agentRun: null,
      snapshots: [],
      visualSnapshot: unavailableRuntimeVisualSnapshot('No workspace connected.'),
    };
  }

  const designSourceIntent = detectExternalDesignSourceIntent(input.userGoal);
  const targetPaths = allowedTargetsFromState(input.state, input.userGoal);
  const agentRunPromise =
    input.existingAgentRun !== undefined
      ? Promise.resolve(input.existingAgentRun)
      : createAgentRun({
          route: 'chat-stream',
          user: input.user,
          provider: input.provider,
          model: input.model,
          runtimeKind: runtimeKindForProvider(input.provider),
          targetCapabilities: input.targetCapabilities,
          projectName: input.state.projectName ?? null,
          userGoal: input.userGoal,
          workspacePath,
          activeScreen: input.state.activeScreen ?? null,
          assistantTaskIntent: input.state.assistantTaskIntent ?? null,
        }).catch(() => null);
  const [agentRun, snapshots] = await Promise.all([
    agentRunPromise,
    snapshotRuntimeTargetFiles(workspacePath, targetPaths).catch(() => []),
  ]);
  if (agentRun && designSourceIntent) {
    await recordDesignSourceEvidencePackSafely({
      workspacePath,
      runId: agentRun.runId,
      intent: designSourceIntent,
    });
  }
  const visualSnapshot = await captureRuntimeVisualSnapshot({
    workspacePath,
    agentRun,
    canvasUrl: input.state.canvasUrl ?? null,
    phase: 'before',
  });

  return { workspacePath, agentRun, snapshots, visualSnapshot };
}
