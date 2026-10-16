import { useEffect, useState } from 'react';
import {
  resolveScreenReadinessProfile,
  type ProjectCommentThread,
  type ProjectScreen,
} from '@sber-designer/shared-types';

import { apiEventsWsUrl, fetchProject, pushEditorState } from '@/lib/api-client';
import {
  createEventBusClient,
  type ConnectionStatus,
  type EditorEvent,
} from '@/lib/event-bus-client';
import { shouldAdoptFetchedProject } from '@/lib/project-adoption';
import { resolveCommentContext } from '@/lib/project-comments';
import { useCatalogStore } from '@/stores/catalog-store';
import { useChatStore } from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';

/**
 * The editor-side half of ADR-0010:
 *   - Subscribes to /api/events (WS) and routes incoming `editor.message`
 *     and `proj-mcp.tool-call` events into the chat transcript.
 *   - Pushes selection / mode / sandbox state into /api/state whenever
 *     they change locally, so proj-mcp.editor_get_selection has fresh data.
 *
 * Mounts once at the top of the EditorShell.
 */
export function useEditorBridge(): { wsStatus: ConnectionStatus } {
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('idle');

  // Consume bus events.
  useEffect(() => {
    const bus = createEventBusClient({
      url: apiEventsWsUrl,
      onEvent: handleIncomingEvent,
      onStatusChange: setWsStatus,
    });
    bus.start();
    return () => {
      bus.stop();
    };
  }, []);

  // Push selection on change.
  const selection = useEditorStore((s) => s.selected);
  useEffect(() => {
    void pushEditorState({ selection: selection });
  }, [selection]);

  // Push mode on change.
  const mode = useEditorStore((s) => s.mode);
  useEffect(() => {
    void pushEditorState({ mode });
  }, [mode]);

  const agentCraftPostCheckEnabled = useEditorStore((s) => s.agentCraftPostCheckEnabled);
  const screenReadiness = useEditorStore((s) => s.screenReadiness);
  useEffect(() => {
    void pushEditorState({ agentCraftPostCheckEnabled, screenReadiness });
  }, [agentCraftPostCheckEnabled, screenReadiness]);

  // Push active project/screen on change. The agent uses this as the
  // default file/story scope for targeted edits.
  const project = useProjectStore((s) => s.project);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const activeComponentId = useEditorStore((s) => s.activeComponentId);
  const canvasView = useEditorStore((s) => s.canvasView);
  const selectedCommentId = useEditorStore((s) => s.selectedCommentId);
  const commentContextMode = useEditorStore((s) => s.commentContextMode);
  const commentContextIds = useEditorStore((s) => s.commentContextIds);
  const assistantTaskIntent = useEditorStore((s) => s.assistantTaskIntent);
  const catalog = useCatalogStore((s) => s.catalog);
  useEffect(() => {
    const activeScreen = project?.screens.find((screen) => screen.id === activeScreenId) ?? null;
    const activeComponent =
      activeComponentId && canvasView !== 'screen'
        ? (catalog?.components.find((component) => component.id === activeComponentId) ?? null)
        : null;
    const selectedComment =
      project?.comments?.find((comment) => comment.id === selectedCommentId) ?? null;
    const commentContext =
      project && canvasView === 'screen'
        ? resolveCommentContext(project, activeScreenId, commentContextMode, commentContextIds)
        : [];
    void pushEditorState({
      canvasView,
      projectName: project?.name ?? null,
      projectInstructions: project?.projectInstructions ?? null,
      screenReadiness: resolveScreenReadinessProfile(screenReadiness, agentCraftPostCheckEnabled),
      activeScreen:
        canvasView === 'screen' && activeScreen ? toEditorStateScreen(activeScreen) : null,
      activeComponent,
      selectedComment:
        canvasView === 'screen' && selectedComment ? toEditorStateComment(selectedComment) : null,
      commentContext: commentContext.map(toEditorStateComment),
      assistantTaskIntent: canvasView === 'screen' ? assistantTaskIntent : null,
    });
  }, [
    activeScreenId,
    activeComponentId,
    agentCraftPostCheckEnabled,
    assistantTaskIntent,
    canvasView,
    catalog,
    commentContextIds,
    commentContextMode,
    project,
    screenReadiness,
    selectedCommentId,
  ]);

  // Push canvasUrl + workspacePath on sandbox change.
  const session = useSandboxStore((s) => s.session);
  useEffect(() => {
    void pushEditorState({
      canvasUrl: session?.previewUrl ?? null,
      workspacePath: session?.workspacePath ?? null,
    });
  }, [session?.previewUrl, session?.workspacePath]);

  return { wsStatus };
}

function toEditorStateScreen(screen: ProjectScreen) {
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

function toEditorStateComment(comment: ProjectCommentThread) {
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

function handleIncomingEvent(event: EditorEvent): void {
  // Tag bridge nudges so /api/chat round-trips don't echo them back as
  // synthetic assistant messages inside the agent transcript.
  if (event.type === 'editor.message') {
    const meta = event.meta?.provider
      ? { provider: event.meta.provider, model: event.meta.model ?? 'claude-code' }
      : event.source === 'agent'
        ? { provider: 'agent', model: 'event-bus' }
        : { provider: 'claude-code', model: 'mcp' };
    useChatStore.getState().appendExternalAssistant(event.text, meta);
    return;
  }
  if (event.type === 'proj-mcp.tool-call') {
    useChatStore
      .getState()
      .appendExternalAssistant(`[tool] ${event.tool} ${event.argsSummary}`.trim(), {
        provider: 'claude-code',
        model: 'mcp',
      });
    return;
  }
  if (event.type === 'project.changed') {
    // Server-side mutation (agent toolset / proj-mcp). Re-fetch, but
    // never adopt another workspace's project: a page left open on a
    // different project must not absorb the newly active one and
    // autosave it into its own project.sdproj (2026-06-12 corruption).
    void fetchProject()
      .then((p) => {
        const local = useProjectStore.getState();
        // A background refetch may update a clean view, never an unsaved
        // draft. Its older ETag must survive so a save reports a conflict.
        if (local.saving || (local.project && JSON.stringify(local.project) !== local.baseline))
          return;
        if (!shouldAdoptFetchedProject(useProjectStore.getState().project, p)) return;
        useProjectStore.getState().setBaseline(p);
        const merged = useProjectStore.getState().project;
        if (!useChatStore.getState().pending) {
          useChatStore.getState().hydrateFromProject(merged);
        }
      })
      .catch(() => undefined);
    return;
  }
  if (event.type === 'storybook.reload-pending') {
    useEditorStore.getState().setStorybookReloadPending(true);
    return;
  }
  if (event.type === 'storybook.reload-cleared') {
    useEditorStore.getState().setStorybookReloadPending(false);
  }
}
