/**
 * useChat hook: session-bound assistant chat send/stream entry points.
 * Pure transcript helpers live in @/lib/chat-transcript and the stream
 * machinery in ./use-chat-stream (task 0078, KT3b); both are re-exported
 * here so existing imports (including useChat.test.ts) keep working.
 */
import { useCallback } from 'react';
import type { ChatMessage as GatewayChatMessage } from '@sber-designer/llm-gateway';
import {
  normalizeAssistantSessionMode,
  resolveScreenReadinessProfile,
} from '@sber-designer/shared-types';
import { ApiError, pushEditorState, type ChatEditorContext } from '@/lib/api-client';
import { useAssistantRunStore } from '@/stores/assistant-run-store';
import { useAuthStore } from '@/stores/auth-store';
import {
  DESIGN_SYSTEM_ASSISTANT_SCREEN_ID,
  STORYBOOK_ASSISTANT_SCREEN_ID,
  useChatStore,
  type ChatAttachment,
} from '@/stores/chat-store';
import { useCatalogStore } from '@/stores/catalog-store';
import { useDesignStore } from '@/stores/design-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { resolveTaskContext, useTasksStore } from '@/stores/tasks-store';
import { parseLeadingAgentMention } from '@/lib/agent-mentions';
import { resolveAssistantTarget } from '@/lib/assistant-target';
import { buildTextAttachmentContext } from '@/lib/chat-attachments';
import {
  formatDirectionPickerMessage,
  type DirectionPickerPresentationPayload,
} from '@/lib/design-direction-picker';
import { resolveCommentContext } from '@/lib/project-comments';
import { tasksForComponentCatalog } from '@/lib/storybook-component-tasks';
import { useActiveScreenUrl } from './useActiveScreenUrl';
import { useStorybookReadiness } from './useStorybookReadiness';
import { formatChatSendError, selectChatCanvasUrl } from '@/lib/chat-transcript';
import {
  type ChatRunBinding,
  type SendChatOptions,
  persistCurrentProjectSnapshotForChat,
  persistFailedSend,
  refreshProjectAfterAgentRun,
  resolveListTaskContext,
  runOnce,
  runStream,
  shouldRefreshProjectAfterAgentRun,
  toEditorStateComment,
  toEditorStateScreen,
  toEditorStateTask,
  toWireMessage,
} from './use-chat-stream';

export {
  activeScreenChangedByToolResult,
  doneEventRunInfo,
  failedSendRunInfo,
  formatChatSendError,
  formatComponentPackStatus,
  mergeDoneTranscriptMessages,
  selectChatCanvasUrl,
} from '@/lib/chat-transcript';
export { type SendChatOptions } from './use-chat-stream';

export function resolveChatGenerationRequest(
  explicit: SendChatOptions['generation'],
  pending: SendChatOptions['generation'] | null,
) {
  return explicit ?? pending ?? undefined;
}

export function useChat() {
  const active = useEditorStore((s) => s.active);
  const activeScreenUrl = useActiveScreenUrl();
  const ensureStoryReady = useStorybookReadiness();

  const send = useCallback(
    async (content: string, attachments: ChatAttachment[] = [], options: SendChatOptions = {}) => {
      const trimmed = content.trim();
      if (!trimmed && attachments.length === 0) return;
      const store = useChatStore.getState();
      store.setError(null);
      const parsedAgentMention = parseLeadingAgentMention(trimmed);
      const mentionedAgent = parsedAgentMention
        ? options.knownAgents?.find((agent) => agent.name === parsedAgentMention.agent)
        : undefined;
      const primaryMention = mentionedAgent?.mode === 'primary';
      const agentName =
        options.agentName ??
        (parsedAgentMention && !primaryMention ? parsedAgentMention.agent : undefined);
      const primaryAgentName =
        options.primaryAgentName ??
        (parsedAgentMention && primaryMention ? parsedAgentMention.agent : undefined);
      const promptText = parsedAgentMention ? parsedAgentMention.content : trimmed;
      const textContext = buildTextAttachmentContext(
        attachments
          .filter((attachment) => attachment.kind === 'text' && attachment.text)
          .map((attachment) => ({
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
            text: attachment.text ?? '',
          })),
      );
      const fallback =
        attachments.length === 0 && agentName
          ? `Run as @${agentName}.`
          : attachments.some((attachment) => attachment.kind === 'image')
            ? 'Please use the attached image as context.'
            : 'Please use the attached text file as context.';
      const wireContent = [promptText || fallback, textContext].filter(Boolean).join('\n\n');
      const displayContent = options.displayContent?.trim() || trimmed || fallback;
      const editorAtSend = useEditorStore.getState();
      const requestGeneration = resolveChatGenerationRequest(
        options.generation,
        editorAtSend.pendingGenerationRequest,
      );
      if (editorAtSend.pendingGenerationRequest) {
        useEditorStore.getState().setPendingGenerationRequest(null);
      }
      const targetScreenId =
        editorAtSend.canvasView === 'storybook'
          ? STORYBOOK_ASSISTANT_SCREEN_ID
          : editorAtSend.canvasView === 'design-system'
            ? DESIGN_SYSTEM_ASSISTANT_SCREEN_ID
            : editorAtSend.activeScreenId;
      const target = store.ensureSessionForScreen(targetScreenId);
      const sessionMode = normalizeAssistantSessionMode(
        options.sessionMode ??
          store.assistant.sessions.find((session) => session.id === target.sessionId)?.sessionMode,
      );
      const userId = store.appendUserToSession(target.sessionId, displayContent, attachments, {
        persistProject: true,
        ...(options.generation?.directionSelection
          ? { metadata: { directionSelection: options.generation.directionSelection } }
          : {}),
      });
      store.markRunStartedForSession(target.sessionId);
      store.setPending(true);

      const contextMessages = useChatStore
        .getState()
        .contextMessagesForSession(target.sessionId, userId);
      const wirePayload: GatewayChatMessage[] = contextMessages.map((m) =>
        m.id === userId
          ? toWireMessage({ ...m, content: wireContent }, attachments)
          : toWireMessage(m),
      );

      const ac = new AbortController();
      const clientRunId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();
      const currentUser = useAuthStore.getState().user;
      useAssistantRunStore.getState().upsertRun({
        clientRunId,
        sessionId: target.sessionId,
        screenId: target.screenId,
        provider: active?.provider ?? 'default',
        model: active?.model ?? 'default',
        ...(currentUser ? { displayName: currentUser.displayName } : {}),
        status: 'queued',
        startedAt: now,
        updatedAt: now,
        title: displayContent.slice(0, 96),
      });
      useAssistantRunStore.getState().setLocalCancel(clientRunId, () => {
        useAssistantRunStore.getState().updateRun(clientRunId, { status: 'stopping' });
        ac.abort();
      });
      useChatStore.getState().setCancel(() => ac.abort());
      void persistCurrentProjectSnapshotForChat();

      try {
        const editor = editorAtSend;
        const sandboxSession = useSandboxStore.getState().session;
        const design = useDesignStore.getState();
        const project = useProjectStore.getState().project;
        const catalog = useCatalogStore.getState().catalog;
        const activeScreen =
          project?.screens.find((screen) => screen.id === editor.activeScreenId) ?? null;
        const activeComponent =
          editor.canvasView !== 'screen' && editor.activeComponentId
            ? (catalog?.components.find((component) => component.id === editor.activeComponentId) ??
              null)
            : null;
        const selectedComment =
          project?.comments?.find((comment) => comment.id === editor.selectedCommentId) ?? null;
        const commentContext =
          project && editor.canvasView === 'screen'
            ? resolveCommentContext(
                project,
                editor.activeScreenId,
                editor.commentContextMode,
                editor.commentContextIds,
              )
            : [];
        const taskStore = useTasksStore.getState();
        const taskContext =
          editor.canvasView !== 'screen'
            ? resolveListTaskContext(
                tasksForComponentCatalog(taskStore.tasks, {
                  components: catalog?.components ?? [],
                  screenNames: project?.screens.map((screen) => screen.name) ?? [],
                }),
                taskStore.taskContextMode,
                taskStore.taskContextIds,
              )
            : resolveTaskContext(
                taskStore.tasks,
                editor.activeScreenId,
                taskStore.taskContextMode,
                taskStore.taskContextIds,
              );
        const resolvedAssistantTarget =
          editor.canvasView === 'screen'
            ? resolveAssistantTarget({
                message: promptText || displayContent,
                activeScreen,
                preference: editor.assistantTargetPreference,
                existingIntent: editor.assistantTaskIntent,
                projectKind: project?.projectKind ?? null,
              })
            : {
                intent: null,
                target: 'auto' as const,
                reason: 'none' as const,
              };
        const assistantTaskIntent = resolvedAssistantTarget.intent;
        const visualDesign =
          editor.canvasView === 'screen' && editor.mode === 'design'
            ? {
                draftChanges: design.draftChanges.map((change) => ({
                  kind: change.kind,
                  label: change.label,
                  filePath: change.filePath,
                  loc: change.loc,
                })),
              }
            : null;
        const editorContext: ChatEditorContext = {
          mode: editor.mode,
          canvasView: editor.canvasView,
          selection: editor.canvasView === 'screen' ? editor.selected : null,
          projectName: project?.name ?? null,
          projectInstructions: project?.projectInstructions ?? null,
          activeScreen:
            editor.canvasView === 'screen' && activeScreen
              ? toEditorStateScreen(activeScreen)
              : null,
          activeComponent,
          selectedComment:
            editor.canvasView === 'screen' && selectedComment
              ? toEditorStateComment(selectedComment)
              : null,
          commentContext: commentContext.map(toEditorStateComment),
          taskContext: taskContext.map(toEditorStateTask),
          assistantTaskIntent,
          ...(visualDesign ? { visualDesign } : {}),
          agentCraftPostCheckEnabled: editor.agentCraftPostCheckEnabled,
          screenReadiness: resolveScreenReadinessProfile(
            editor.screenReadiness,
            editor.agentCraftPostCheckEnabled,
          ),
          canvasUrl: selectChatCanvasUrl(
            activeScreenUrl,
            editor.canvasUrl,
            sandboxSession?.previewUrl ?? null,
          ),
          workspacePath: project?.workspacePath ?? null,
        };
        await pushEditorState({
          ...editorContext,
        });
        const optionsWithGeneration = requestGeneration
          ? { ...options, generation: requestGeneration }
          : options;
        const requestOptions =
          agentName || primaryAgentName
            ? {
                ...optionsWithGeneration,
                ...(agentName ? { agentName } : {}),
                ...(primaryAgentName ? { primaryAgentName } : {}),
              }
            : optionsWithGeneration;
        const modeAwareRequestOptions = { ...requestOptions, sessionMode };
        const effectiveRequestOptions =
          assistantTaskIntent && modeAwareRequestOptions.maxIterations === undefined
            ? { ...modeAwareRequestOptions, maxIterations: 20 }
            : modeAwareRequestOptions;
        const binding: ChatRunBinding = {
          clientRunId,
          sessionId: target.sessionId,
          screenId: target.screenId,
        };
        if (store.useStreaming) {
          await runStream(
            wirePayload,
            active,
            binding,
            editorContext,
            ac.signal,
            effectiveRequestOptions,
            attachments,
          );
        } else {
          await runOnce(
            wirePayload,
            active,
            binding,
            ac.signal,
            effectiveRequestOptions,
            attachments,
          );
        }
        const finalStatus = useChatStore.getState().lastRunStatus;
        if (shouldRefreshProjectAfterAgentRun(finalStatus) && editorContext.activeScreen?.storyId) {
          await ensureStoryReady(editorContext.activeScreen.storyId).catch(() => undefined);
        }
        await persistCurrentProjectSnapshotForChat({ force: true });
        await refreshProjectAfterAgentRun(finalStatus);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          const cancelledStore = useChatStore.getState();
          cancelledStore.clearPendingPermissionsForRun(clientRunId);
          cancelledStore.settleCancelledRunForSession(target.sessionId, {
            afterMessageId: userId,
            summary: 'Cancelled by user.',
          });
          cancelledStore.setError(null);
        } else {
          const message = formatChatSendError(err);
          if (err instanceof ApiError) {
            persistFailedSend(target.sessionId, message, err);
          }
          useChatStore.getState().setError(message);
        }
        // 0083 D4: persist the transcript even when the run fails or is cancelled.
        // The success path force-saves at the end; without this, a failed run (e.g.
        // a tool error) left the streamed history only in memory, so a page reload
        // dropped everything after the last successful save.
        await persistCurrentProjectSnapshotForChat({ force: true }).catch(() => undefined);
      } finally {
        useChatStore.getState().setPendingPermission(null);
        useChatStore.getState().setPending(false);
        useChatStore.getState().setCancel(null);
        useAssistantRunStore.getState().finishRun(clientRunId);
      }
    },
    [active, activeScreenUrl, ensureStoryReady],
  );

  const presentDirectionPicker = useCallback(
    async (displayContent: string, payload: DirectionPickerPresentationPayload) => {
      const trimmed = displayContent.trim();
      if (!trimmed) return;
      const editor = useEditorStore.getState();
      const store = useChatStore.getState();
      const targetScreenId =
        editor.canvasView === 'storybook'
          ? STORYBOOK_ASSISTANT_SCREEN_ID
          : editor.canvasView === 'design-system'
            ? DESIGN_SYSTEM_ASSISTANT_SCREEN_ID
            : editor.activeScreenId;
      const target = store.ensureSessionForScreen(targetScreenId);
      const requestMessageId = store.appendUserToSession(target.sessionId, trimmed, [], {
        persistProject: false,
        contextEligible: false,
        metadata: { directionPickerRequest: true },
      });
      store.appendAssistantToSession(
        target.sessionId,
        formatDirectionPickerMessage(payload.options),
        {
          contextEligible: false,
          metadata: { directionPicker: { ...payload, requestMessageId } },
          persistProject: true,
        },
      );
      await persistCurrentProjectSnapshotForChat({ force: true });
    },
    [],
  );

  return { send, presentDirectionPicker };
}
