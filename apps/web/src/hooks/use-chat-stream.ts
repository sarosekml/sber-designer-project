/**
 * Chat send/stream machinery: one-shot and SSE runs, progressive
 * transcript commits, editor-state mapping and run bookkeeping for the
 * useChat hook.
 */
import type {
  ChatMessage as GatewayChatMessage,
  ChatContentPart,
} from '@sber-designer/llm-gateway';
import type {
  AssistantSessionMode,
  ProjectCommentThread,
  ProjectScreen,
  ProjectTask,
  PromptAttachmentUpload,
} from '@sber-designer/shared-types';
import { normalizeAssistantTokenUsage } from '@sber-designer/shared-types';
import {
  ApiError,
  fetchProject,
  postChat,
  saveProjectToApi,
  streamChat,
  summarizeChatTask,
  type AgentStreamEvent,
  type ChatEditorContext,
  type ChatGenerationOptions,
} from '@/lib/api-client';
import { useAssistantRunStore } from '@/stores/assistant-run-store';
import { useChatStore, type ChatAttachment, type ChatMessage } from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';
import { useGitStore } from '@/stores/git-store';
import { usePatchStore } from '@/stores/patch-store';
import { useProjectStore } from '@/stores/project-store';
import { type MentionableAgent } from '@/lib/agent-mentions';
import {
  captureCoverAfterRun,
  clearCoverScreenPinForDeletedScreen,
} from '@/lib/project-cover-capture';
import { shouldAdoptFetchedProject } from '@/lib/project-adoption';
import {
  activeScreenChangedByToolResult,
  attachRunTokenUsage,
  contentToDisplayText,
  doneEventRunInfo,
  failedSendRunInfo,
  formatComponentPackStatus,
  latestComponentPackSummary,
  mergeDoneTranscriptMessages,
  screenChangedByToolResult,
  toolTimingMessageMetadata,
  upsertComponentPackStatusMessage,
  upsertQualitySummaryMessage,
} from '@/lib/chat-transcript';
import { settleCancelledToolCalls } from '@/lib/cancelled-transcript';

export interface SendChatOptions {
  sessionMode?: AssistantSessionMode;
  maxIterations?: number;
  displayContent?: string;
  agentName?: string;
  primaryAgentName?: string;
  knownAgents?: readonly MentionableAgent[];
  generation?: ChatGenerationOptions;
}

export interface ChatRunBinding {
  clientRunId: string;
  sessionId: string;
  screenId: string;
}

/**
 * Send a message through services/api.
 *
 * Two execution modes (selected by `useStreaming` in chat-store):
 *   - non-streaming → POST /api/chat → replaceTurn with the final transcript.
 *   - streaming     → POST /api/chat/stream (SSE) → progressive updates
 *     (text deltas, tool calls, tool results) rendered as they arrive.
 *
 * Both modes preserve external (bridge) messages across the turn.
 */

export function toEditorStateScreen(screen: ProjectScreen) {
  return {
    id: screen.id,
    name: screen.name,
    kind: screen.kind,
    ...(screen.surface === 'modal' ? { surface: screen.surface } : {}),
    ...(screen.storyId ? { storyId: screen.storyId } : {}),
    ...(screen.filePath ? { filePath: screen.filePath } : {}),
    ...(screen.implementationFilePath
      ? { implementationFilePath: screen.implementationFilePath }
      : {}),
    ...(screen.folder ? { folder: screen.folder } : {}),
    ...(screen.description ? { description: screen.description } : {}),
  };
}

export function toEditorStateComment(comment: ProjectCommentThread) {
  return {
    id: comment.id,
    screenId: comment.screenId,
    body: comment.messages[0]?.body ?? '',
    anchor: comment.anchor,
    status: comment.status,
    ...(comment.selector ? { selector: comment.selector } : {}),
    ...(comment.elementText ? { elementText: comment.elementText } : {}),
  };
}

export function resolveListTaskContext(
  tasks: ProjectTask[],
  mode: 'all' | 'none' | 'custom',
  ids: string[],
) {
  if (mode === 'none') return [];
  if (mode === 'all') return tasks;
  const idSet = new Set(ids);
  return tasks.filter((task) => idSet.has(task.id));
}

export function toEditorStateTask(task: ProjectTask) {
  return {
    id: task.id,
    title: task.title,
    ...(task.description ? { description: task.description } : {}),
    ...(task.url ? { url: task.url } : {}),
    source: task.source,
    screenIds: task.screenIds,
    ...(task.commentId ? { commentId: task.commentId } : {}),
    ...(task.status ? { status: task.status } : {}),
    ...(task.priority ? { priority: task.priority } : {}),
  };
}

export async function runOnce(
  wire: GatewayChatMessage[],
  active: { provider: string; model: string } | null,
  binding: ChatRunBinding,
  signal?: AbortSignal,
  options: SendChatOptions = {},
  attachments: ChatAttachment[] = [],
): Promise<void> {
  const res = await postChat(
    {
      messages: wire,
      attachments: toPromptAttachmentUploads(attachments),
      ...(active?.provider ? { provider: active.provider } : {}),
      ...(active?.model ? { model: active.model } : {}),
      ...(options.primaryAgentName ? { primaryAgent: options.primaryAgentName } : {}),
      ...(options.agentName ? { agent: options.agentName } : {}),
      ...(options.maxIterations !== undefined ? { maxIterations: options.maxIterations } : {}),
      ...(options.generation ? { generation: options.generation } : {}),
      ...(options.sessionMode ? { sessionMode: options.sessionMode } : {}),
    },
    signal,
  );
  const meta = {
    provider: res.provider,
    model: res.model,
    sessionMode: options.sessionMode ?? 'design',
  };
  const next: ChatMessage[] = res.transcript
    .filter((m) => m.role !== 'system')
    .map((m, i) => ({
      id: `t-${Date.now()}-${i}`,
      role: m.role,
      content: contentToDisplayText(m.content),
      ...(m.toolCalls ? { toolCalls: m.toolCalls } : {}),
      ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
      ...(m.role === 'assistant' || m.role === 'tool' ? { meta } : {}),
    }));
  const displayContent = options.displayContent?.trim();
  if (displayContent) {
    for (let i = next.length - 1; i >= 0; i -= 1) {
      const current = next[i];
      if (current?.role === 'user') {
        next[i] = { ...current, content: displayContent };
        break;
      }
    }
  }
  const tokenUsage = normalizeAssistantTokenUsage(res.usage);
  const nextWithTokenUsage = attachRunTokenUsage(next, tokenUsage ?? {});
  // Scan tool messages for apply_patch diffs and push them into the
  // patch-store so the Code-mode DiffEditor can surface them.
  for (const m of nextWithTokenUsage) {
    if (m.role === 'tool') recordDiffsIfPatch(m.content);
  }
  useChatStore.getState().replaceTurnForSession(binding.sessionId, nextWithTokenUsage, {
    iterations: res.iterations,
    truncated: res.truncated,
    ...(res.debugLogPath ? { debugLogPath: res.debugLogPath } : {}),
    ...(res.runManifestPath ? { runManifestPath: res.runManifestPath } : {}),
    ...(res.componentReuse ? { componentReuse: res.componentReuse } : {}),
    ...(tokenUsage ? { runMetrics: { iterations: res.iterations, ...tokenUsage } } : {}),
  });
  // Streaming is the default, but the supported one-shot path must keep the
  // same cover lifecycle when a successful run changes the target screen.
  if (!res.truncated) captureCoverAfterRun(binding.screenId);
  queueTaskSummaryForSession(binding.sessionId);
}

export async function refreshProjectAfterAgentRun(
  finalStatus:
    | 'running'
    | 'complete'
    | 'failed'
    | 'needs_review'
    | 'cancelled'
    | 'preflight_rejected'
    | null,
): Promise<void> {
  if (!shouldRefreshProjectAfterAgentRun(finalStatus)) return;
  try {
    const project = await fetchProject();
    if (!shouldAdoptFetchedProject(useProjectStore.getState().project, project)) return;
    useProjectStore.getState().setBaseline(project);
    const coverScreenId = useEditorStore.getState().coverScreenId;
    if (coverScreenId && !project.screens.some((screen) => screen.id === coverScreenId)) {
      void clearCoverScreenPinForDeletedScreen(coverScreenId);
    }
  } catch {
    // Run completion should not be hidden by a best-effort sidebar health refresh.
  }
}

export function shouldRefreshProjectAfterAgentRun(
  finalStatus:
    | 'running'
    | 'complete'
    | 'failed'
    | 'needs_review'
    | 'cancelled'
    | 'preflight_rejected'
    | null,
): boolean {
  return finalStatus === 'complete' || finalStatus === 'needs_review' || finalStatus === 'failed';
}

export async function persistCurrentProjectSnapshotForChat(
  options: { force?: boolean } = {},
): Promise<void> {
  const store = useProjectStore.getState();
  const project = store.project;
  if (!project || (store.saving && !options.force)) return;
  const saveIndicatorOwnedByChat = !store.saving;
  if (saveIndicatorOwnedByChat) {
    store.setSaving(true);
    store.setSaveError(null);
  }
  try {
    const saved = await saveProjectToApi(project);
    useProjectStore.getState().setBaseline(saved);
  } catch (err) {
    useProjectStore.getState().setSaveError(err instanceof Error ? err.message : String(err));
  } finally {
    if (saveIndicatorOwnedByChat) {
      useProjectStore.getState().setSaving(false);
    }
  }
}

export async function runStream(
  wire: GatewayChatMessage[],
  active: { provider: string; model: string } | null,
  binding: ChatRunBinding,
  editorContext: ChatEditorContext,
  signal?: AbortSignal,
  options: SendChatOptions = {},
  attachments: ChatAttachment[] = [],
): Promise<void> {
  const meta = {
    ...(active ? { provider: active.provider, model: active.model } : {}),
    sessionMode: options.sessionMode ?? 'design',
  };
  const turnMessages: ChatMessage[] = [];
  // Snapshot the transcript right after the user message was appended.
  // Progressive renders place turnMessages right after this slice so
  // earlier turns stay visible.
  const snapshot = useChatStore.getState().messages.map((message) => ({ ...message }));
  // Map iteration → in-flight assistant message id (so text deltas keep
  // appending to the same bubble).
  const assistantByIteration = new Map<number, string>();

  for await (const ev of streamChat(
    {
      messages: wire,
      attachments: toPromptAttachmentUploads(attachments),
      ...(active?.provider ? { provider: active.provider } : {}),
      ...(active?.model ? { model: active.model } : {}),
      ...(options.primaryAgentName ? { primaryAgent: options.primaryAgentName } : {}),
      ...(options.agentName ? { agent: options.agentName } : {}),
      clientRunId: binding.clientRunId,
      sessionId: binding.sessionId,
      screenId: binding.screenId,
      editorContext,
      maxIterations: options.maxIterations ?? (editorContext.assistantTaskIntent ? 20 : 10),
      ...(options.generation ? { generation: options.generation } : {}),
      ...(options.sessionMode ? { sessionMode: options.sessionMode } : {}),
    },
    signal,
  )) {
    handleStreamEvent(
      ev.type === 'done' && options.displayContent?.trim()
        ? {
            ...ev,
            transcript: withLastUserDisplayContent(ev.transcript, options.displayContent.trim()),
          }
        : ev,
      binding,
      turnMessages,
      assistantByIteration,
      meta,
      snapshot,
    );
  }
}

export function withLastUserDisplayContent(
  transcript: GatewayChatMessage[],
  displayContent: string,
): GatewayChatMessage[] {
  const next = transcript.map((message) => ({ ...message }));
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const message = next[index];
    if (message?.role !== 'user') continue;
    next[index] = { ...message, content: displayContent };
    break;
  }
  return next;
}

export function handleStreamEvent(
  ev: AgentStreamEvent,
  binding: ChatRunBinding,
  turnMessages: ChatMessage[],
  assistantByIteration: Map<number, string>,
  meta: ChatMessage['meta'],
  snapshot: ChatMessage[],
): void {
  const store = useChatStore.getState();

  switch (ev.type) {
    case 'heartbeat':
      break;

    case 'run-started':
      useAssistantRunStore.getState().updateRun(binding.clientRunId, {
        status: 'running',
        provider: ev.provider,
        model: ev.model,
        ...(ev.runId ? { runId: ev.runId } : {}),
        ...(ev.runManifestPath ? { runManifestPath: ev.runManifestPath } : {}),
      });
      store.markRunStartedForSession(
        binding.sessionId,
        ev.runManifestPath ? { runManifestPath: ev.runManifestPath } : {},
        { persistProject: false },
      );
      store.setError(null);
      if (ev.componentPack) {
        turnMessages.push({
          id: `component-pack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          content: formatComponentPackStatus(ev.componentPack),
          createdAt: new Date().toISOString(),
          contextEligible: false,
          metadata: { componentPack: ev.componentPack },
        });
        commitProgressive(binding.sessionId, turnMessages, snapshot, { persistProject: true });
      }
      break;

    case 'run-rejected':
      useAssistantRunStore.getState().updateRun(binding.clientRunId, {
        status: 'rejected',
        reason: ev.reason,
      });
      turnMessages.push({
        id: `run-rejected-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: ev.reason,
        createdAt: new Date().toISOString(),
        contextEligible: false,
        ...(meta ? { meta } : {}),
        metadata: { runRejected: ev },
      });
      store.replaceTurnForSession(
        binding.sessionId,
        [...snapshot.filter((m) => !m.external), ...turnMessages.map((m) => ({ ...m }))],
        {
          iterations: 0,
          truncated: true,
          runStatus: 'preflight_rejected',
          runSummary: ev.reason,
        },
        { persistProject: true },
      );
      useAssistantRunStore.getState().finishRun(binding.clientRunId);
      queueTaskSummaryForSession(binding.sessionId);
      break;

    case 'iteration-start':
      commitProgressive(binding.sessionId, turnMessages, snapshot);
      break;

    case 'text-delta': {
      let id = assistantByIteration.get(ev.iteration);
      if (!id) {
        id = `stream-${Date.now()}-${ev.iteration}-${Math.random().toString(36).slice(2, 6)}`;
        assistantByIteration.set(ev.iteration, id);
        turnMessages.push({
          id,
          role: 'assistant',
          content: ev.delta,
          createdAt: new Date().toISOString(),
          ...(meta ? { meta } : {}),
        });
      } else {
        const m = turnMessages.find((mm) => mm.id === id);
        if (m) m.content += ev.delta;
      }
      commitProgressive(binding.sessionId, turnMessages, snapshot);
      break;
    }

    case 'tool-call': {
      let id = assistantByIteration.get(ev.iteration);
      if (!id) {
        id = `stream-${Date.now()}-${ev.iteration}-c`;
        assistantByIteration.set(ev.iteration, id);
        turnMessages.push({
          id,
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
          toolCalls: [ev.call],
          ...(meta ? { meta } : {}),
        });
      } else {
        const m = turnMessages.find((mm) => mm.id === id);
        if (m) m.toolCalls = [...(m.toolCalls ?? []), ev.call];
      }
      commitProgressive(binding.sessionId, turnMessages, snapshot, { persistProject: true });
      break;
    }

    case 'tool-result':
      turnMessages.push({
        id: `stream-result-${Date.now()}-${ev.toolCallId}`,
        role: 'tool',
        toolCallId: ev.toolCallId,
        content: ev.content,
        createdAt: new Date().toISOString(),
        ...(meta ? { meta } : {}),
        ...toolTimingMessageMetadata(ev),
      });
      if (ev.componentPack) {
        const nextTurnMessages = upsertComponentPackStatusMessage(turnMessages, ev.componentPack);
        turnMessages.splice(0, turnMessages.length, ...nextTurnMessages);
      }
      store.clearPendingPermissionForTool(ev.toolCallId, binding.clientRunId);
      recordDiffsIfPatch(ev.content);
      if (!ev.isError && ev.status !== 'error') {
        const targetChanged = screenChangedByToolResult(binding.screenId, ev.changedFiles);
        if (targetChanged) {
          const editor = useEditorStore.getState();
          editor.invalidateScreenPreview(binding.screenId);
          if (editor.activeScreenId === binding.screenId) editor.bumpCanvasReloadKey();
        } else if (activeScreenChangedByToolResult(ev.changedFiles)) {
          // Preserve the legacy active-target fallback for runs without matching screen metadata.
          useEditorStore.getState().bumpCanvasReloadKey();
        }
      }
      commitProgressive(binding.sessionId, turnMessages, snapshot, { persistProject: true });
      break;

    case 'permission-request':
      store.setPendingPermissionForRun(binding.clientRunId, ev.request);
      commitProgressive(binding.sessionId, turnMessages, snapshot, { persistProject: true });
      break;

    case 'iteration-end':
      // No-op; the iteration badge is updated on `done`.
      break;

    case 'usage':
      break;

    case 'external-runtime-context':
      turnMessages.push({
        id: `external-runtime-context-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: `Preparing ${ev.agent} handoff for ${ev.runtime}`,
        createdAt: new Date().toISOString(),
        contextEligible: false,
        metadata: { externalRuntimeContext: ev },
      });
      commitProgressive(binding.sessionId, turnMessages, snapshot, { persistProject: true });
      break;

    case 'external-runtime-diagnostic':
      break;

    case 'done':
      store.clearPendingPermissionsForRun(binding.clientRunId);
      const runInfo = doneEventRunInfo(ev);
      const runFailed = runInfo.runStatus === 'failed';
      // replaceTurn drops everything except externals and substitutes
      // the agent's full view. Build that from snapshot (without the
      // current pending user, which is in turnMessages from the server)
      // + the streamed turn.
      const mergedTranscript = mergeDoneTranscriptMessages({
        snapshot,
        turnMessages,
        transcript: ev.transcript,
        meta,
      });
      const finalComponentPack = ev.componentPack ?? latestComponentPackSummary(turnMessages);
      const componentMessages = finalComponentPack
        ? upsertComponentPackStatusMessage(mergedTranscript, finalComponentPack)
        : mergedTranscript;
      const qualityMessages = ev.qualitySummary
        ? upsertQualitySummaryMessage(componentMessages, ev.qualitySummary)
        : componentMessages;
      const footerUsage =
        runInfo.runMetrics ??
        (runInfo.runStatus === 'complete' || runInfo.runStatus === 'needs_review' ? {} : null);
      const mergedMessages = attachRunTokenUsage(qualityMessages, footerUsage);
      store.replaceTurnForSession(
        binding.sessionId,
        runInfo.runStatus === 'cancelled'
          ? settleCancelledToolCalls(mergedMessages, {
              afterMessageId: snapshot.at(-1)?.id,
            })
          : mergedMessages,
        {
          ...runInfo,
        },
        { persistProject: true },
      );
      if (runFailed) store.setError(null);
      useAssistantRunStore.getState().finishRun(binding.clientRunId);
      // Keep the Home cover on the freshest generated screen (0135).
      if (!runFailed && runInfo.runStatus !== 'cancelled') {
        captureCoverAfterRun(binding.screenId);
      }
      queueTaskSummaryForSession(binding.sessionId);
      // The agent likely changed files; refresh the git change count now so the
      // footer/panel don't lag behind the 15s poll (task 0110 C1).
      void useGitStore.getState().refresh({ silent: true });
      break;

    case 'error': {
      store.clearPendingPermissionsForRun(binding.clientRunId);
      store.replaceTurnForSession(
        binding.sessionId,
        [
          ...snapshot.filter((m) => !m.external),
          ...turnMessages.map((m) => ({ ...m })),
          {
            id: `stream-error-${Date.now()}`,
            role: 'assistant',
            content: ev.message,
            createdAt: new Date().toISOString(),
            contextEligible: false,
            ...(meta ? { meta } : {}),
          },
        ],
        {
          iterations: 0,
          truncated: true,
          runStatus: 'failed',
          runSummary: ev.message,
          ...(ev.attemptId ? { attemptId: ev.attemptId } : {}),
          ...(ev.debugLogPath ? { debugLogPath: ev.debugLogPath } : {}),
          ...(ev.runManifestPath ? { runManifestPath: ev.runManifestPath } : {}),
        },
        { persistProject: true },
      );
      useAssistantRunStore.getState().finishRun(binding.clientRunId);
      queueTaskSummaryForSession(binding.sessionId);
      break;
    }
  }
}

function commitProgressive(
  sessionId: string,
  turnMessages: ChatMessage[],
  snapshot: ChatMessage[],
  options: { persistProject?: boolean } = {},
): void {
  // Place the streamed turn right after the snapshot (which already
  // contains the user message we just appended).
  useChatStore
    .getState()
    .setVisibleMessagesForSession(
      sessionId,
      [...snapshot.filter((m) => !m.external), ...turnMessages.map((m) => ({ ...m }))],
      {
        persistProject: options.persistProject ?? false,
      },
    );
}

export function persistFailedSend(sessionId: string, message: string, err: ApiError): void {
  const store = useChatStore.getState();
  const sessionMessages = store.contextMessagesForSession(sessionId);
  store.replaceTurnForSession(
    sessionId,
    [
      ...sessionMessages.filter((m) => m.id !== 'seed-welcome'),
      {
        id: `send-error-${Date.now()}`,
        role: 'assistant',
        content: message,
        createdAt: new Date().toISOString(),
        contextEligible: false,
      },
    ],
    failedSendRunInfo(message, err),
    { persistProject: true },
  );
}

export function toWireMessage(
  m: ChatMessage,
  attachments: ChatAttachment[] = [],
): GatewayChatMessage {
  const content =
    m.role === 'user' && attachments.length > 0
      ? toMultimodalContent(m.content, attachments)
      : m.content;
  const base: GatewayChatMessage = { role: m.role, content };
  if (m.toolCalls) base.toolCalls = m.toolCalls;
  if (m.toolCallId) base.toolCallId = m.toolCallId;
  return base;
}

function toMultimodalContent(text: string, attachments: ChatAttachment[]): ChatContentPart[] {
  const images = attachments.filter(
    (attachment): attachment is ChatAttachment & { dataUrl: string } =>
      attachment.kind === 'image' && Boolean(attachment.dataUrl),
  );
  return [
    { type: 'text', text: text || 'Use the attached image as context.' },
    ...images.map((attachment) => ({
      type: 'image_url' as const,
      image_url: { url: attachment.dataUrl, detail: 'auto' as const },
    })),
  ];
}

function toPromptAttachmentUploads(attachments: ChatAttachment[]): PromptAttachmentUpload[] {
  return attachments.map((attachment) => ({
    id: attachment.id,
    kind: attachment.kind,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    ...(attachment.dataUrl ? { dataUrl: attachment.dataUrl } : {}),
    ...(attachment.sourceUrl
      ? { source: { type: 'remote-url' as const, url: attachment.sourceUrl } }
      : {}),
    ...(attachment.text ? { text: attachment.text } : {}),
  }));
}

/**
 * Tool-result content is a JSON string. apply_patch returns
 * { diffs: [{ path, before, after }, ...] } in addition to the usual
 * shape — when we see that, push it into the patch-store so the
 * Code-mode DiffEditor surfaces the change.
 *
 * We don't know the tool name on the result event; instead we look
 * for the structural shape — duck-typing is fine since `diffs` is a
 * field unique to apply_patch's payload.
 */

function recordDiffsIfPatch(content: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== 'object') return;
  const diffs = (parsed as { diffs?: unknown }).diffs;
  if (!Array.isArray(diffs)) return;
  const entries: { path: string; before: string; after: string }[] = [];
  for (const d of diffs) {
    if (
      d &&
      typeof d === 'object' &&
      typeof (d as { path?: unknown }).path === 'string' &&
      typeof (d as { before?: unknown }).before === 'string' &&
      typeof (d as { after?: unknown }).after === 'string'
    ) {
      const e = d as { path: string; before: string; after: string };
      entries.push({ path: e.path, before: e.before, after: e.after });
    }
  }
  if (entries.length > 0) {
    usePatchStore.getState().recordDiffs(entries);
  }
}

function queueTaskSummaryForSession(sessionId: string): void {
  const store = useChatStore.getState();
  const session = store.assistant.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) return;
  const eligible = session.messages.filter(
    (message) =>
      (message.role === 'user' || message.role === 'assistant') &&
      !message.external &&
      message.content.trim(),
  );
  const last = eligible[eligible.length - 1];
  if (!last || session.lastSummarizedMessageId === last.id) return;
  const sample =
    eligible.length > 8 ? [...eligible.slice(0, 4), ...eligible.slice(-4)] : eligible.slice();
  void summarizeChatTask({
    messages: sample.map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    })),
  })
    .then((summary) => {
      useChatStore.getState().updateTaskSummary(session.id, {
        title: summary.title,
        summary: summary.summary,
        lastSummarizedMessageId: last.id,
      });
    })
    .catch(() => {
      // Task titles are helpful but never required for the main assistant turn.
    });
}
