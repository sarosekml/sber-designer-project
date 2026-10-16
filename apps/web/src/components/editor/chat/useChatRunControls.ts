import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { AssistantActiveRun } from '@sber-designer/shared-types';

import {
  fetchAgentRunEvidence,
  reprobeAgentRunRender,
  resolveChatPermission,
  type AgentRunRenderProof,
} from '@/lib/api-client';
import { buildAutoTaskPrompt } from '@/lib/auto-agent';
import { autoPrPathsAfterRun } from '@/lib/git-auto-pr';
import { sendPr, type GitChange } from '@/lib/api/git';
import { useChat } from '@/hooks/useChat';
import { useChatStore } from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';
import { useGitStore } from '@/stores/git-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useTasksStore } from '@/stores/tasks-store';
import { STORYBOOK_ASSISTANT_SCREEN_ID } from '@/stores/chat-store';
import { stopAssistantRun } from './BackgroundRunsStrip';
import { downloadJson, waitForIdle } from './chat-panel-utils';

export function useChatRunControls({
  autoRunningRef,
  cancel,
  canvasUrl,
  pendingPermission,
  permissionRemember,
  permissionResolving,
  project,
  selectedRun,
  send,
  session,
  setAutoRunning,
  setError,
  setExportingEvidenceRunId,
  setPermissionResolving,
  setRenderProofByRunId,
  setReprobingRenderRunId,
  setStopAfterCurrent,
  stopAfterCurrentRef,
}: {
  autoRunningRef: MutableRefObject<boolean>;
  cancel: ReturnType<typeof useChatStore.getState>['cancel'];
  canvasUrl: string | null;
  pendingPermission: ReturnType<typeof useChatStore.getState>['pendingPermission'];
  permissionRemember: boolean;
  permissionResolving: 'allow' | 'deny' | null;
  project: ReturnType<typeof useProjectStore.getState>['project'];
  selectedRun: AssistantActiveRun | null;
  send: ReturnType<typeof useChat>['send'];
  session: ReturnType<typeof useSandboxStore.getState>['session'];
  setAutoRunning: Dispatch<SetStateAction<boolean>>;
  setError: (error: string | null) => void;
  setExportingEvidenceRunId: Dispatch<SetStateAction<string | null>>;
  setPermissionResolving: Dispatch<SetStateAction<'allow' | 'deny' | null>>;
  setRenderProofByRunId: Dispatch<SetStateAction<Record<string, AgentRunRenderProof>>>;
  setReprobingRenderRunId: Dispatch<SetStateAction<string | null>>;
  setStopAfterCurrent: Dispatch<SetStateAction<boolean>>;
  stopAfterCurrentRef: MutableRefObject<boolean>;
}) {
  const handleExportEvidence = async (runId: string) => {
    setExportingEvidenceRunId(runId);
    try {
      const manifest = await fetchAgentRunEvidence(runId);
      downloadJson(`${runId}-evidence.json`, manifest);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to export run evidence.');
    } finally {
      setExportingEvidenceRunId(null);
    }
  };

  const handleReprobeRender = async (runId: string) => {
    setReprobingRenderRunId(runId);
    try {
      const result = await reprobeAgentRunRender(runId, canvasUrl);
      setRenderProofByRunId((current) => ({ ...current, [runId]: result.renderProof }));
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to re-run render verification.');
    } finally {
      setReprobingRenderRunId(null);
    }
  };

  const handleStartAuto = async (selectedTaskIds: string[]) => {
    const taskStore = useTasksStore.getState();
    let tasks = taskStore.tasks.filter((task) => selectedTaskIds.includes(task.id));
    if (tasks.length === 0) {
      await taskStore.sync();
      tasks = useTasksStore.getState().tasks.filter((task) => selectedTaskIds.includes(task.id));
    }
    if (tasks.length === 0) return;

    autoRunningRef.current = true;
    stopAfterCurrentRef.current = false;
    setAutoRunning(true);
    setStopAfterCurrent(false);
    setError(null);

    try {
      for (const task of tasks) {
        if (!autoRunningRef.current) break;
        const autoPrEnabled = Boolean(
          session && (project?.gitSession?.autoPush || project?.agentAutoPr),
        );
        let beforeAutoPrChanges: GitChange[] = [];
        if (autoPrEnabled) {
          const gitStore = useGitStore.getState();
          await gitStore.refresh();
          beforeAutoPrChanges = gitStore.status?.changes ?? [];
        }
        await send(buildAutoTaskPrompt(task), [], {
          displayContent: `[auto] ${task.title}`,
          sessionMode: 'design',
        });
        await waitForIdle();
        if (!autoRunningRef.current) break;
        if (autoPrEnabled) {
          const gitStore = useGitStore.getState();
          await gitStore.refresh();
          const changed = gitStore.status?.changes ?? [];
          const paths = autoPrPathsAfterRun(beforeAutoPrChanges, changed);
          if (paths.length > 0) {
            const result = await sendPr({
              paths,
              title: task.title,
              ...(task.url
                ? { body: `Task: ${task.url}` }
                : task.description
                  ? { body: task.description }
                  : {}),
            });
            if (result.status) gitStore.setStatus(result.status);
          } else if (changed.length > 0 && beforeAutoPrChanges.length > 0) {
            setError(
              'Auto PR skipped because the workspace already had uncommitted changes. Open Source Control to review and send them.',
            );
          }
        }
        if (stopAfterCurrentRef.current) break;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      autoRunningRef.current = false;
      stopAfterCurrentRef.current = false;
      setAutoRunning(false);
      setStopAfterCurrent(false);
    }
  };

  const stopAutoNow = () => {
    autoRunningRef.current = false;
    stopAfterCurrentRef.current = false;
    setStopAfterCurrent(false);
    cancel?.();
  };
  const handleStopSelectedRun = () => {
    if (!selectedRun) cancel?.();
    else stopAssistantRun(selectedRun);
  };
  const handleOpenBackgroundRun = (run: AssistantActiveRun) => {
    if (run.screenId === STORYBOOK_ASSISTANT_SCREEN_ID) {
      useEditorStore.getState().setCanvasView('storybook');
      return;
    }
    const screenId = project?.screens.some((screen) => screen.id === run.screenId)
      ? run.screenId
      : null;
    if (screenId) useEditorStore.getState().openScreenTab(screenId);
    useEditorStore.getState().setActiveScreenId(screenId, { source: 'user' });
  };
  const handleStopBackgroundRun = (run: AssistantActiveRun) => stopAssistantRun(run);
  const stopAutoAfterCurrent = () => {
    stopAfterCurrentRef.current = true;
    setStopAfterCurrent(true);
  };
  const handleResolvePermission = async (decision: 'allow' | 'deny') => {
    if (!pendingPermission || permissionResolving) return;
    setPermissionResolving(decision);
    try {
      await resolveChatPermission(pendingPermission.id, decision, {
        remember: decision === 'allow' && permissionRemember,
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Unable to resolve the permission request.',
      );
    } finally {
      setPermissionResolving(null);
    }
  };

  return {
    handleExportEvidence,
    handleOpenBackgroundRun,
    handleReprobeRender,
    handleResolvePermission,
    handleStartAuto,
    handleStopBackgroundRun,
    handleStopSelectedRun,
    stopAutoAfterCurrent,
    stopAutoNow,
  };
}
