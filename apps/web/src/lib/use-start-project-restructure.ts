import { useCallback } from 'react';

import { useChat } from '@/hooks/useChat';
import { DESIGN_SYSTEM_ASSISTANT_SCREEN_ID, useChatStore } from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';

export const PROJECT_RESTRUCTURE_AGENT_NAME = 'ai-project-restructurer';

export function buildProjectRestructurePrompt(): string {
  return `@${PROJECT_RESTRUCTURE_AGENT_NAME} Inspect this static HTML project with get_project_structure_report. Show the complete proposed mapping, link rewrites, collisions, manual follow-ups, and planDigest. Do not change files until I explicitly confirm the plan. After confirmation, use apply_project_restructure with that exact digest and report its receipt.`;
}

export function planProjectRestructureLaunch() {
  return {
    canvasView: 'design-system' as const,
    sessionMode: 'design' as const,
    taskScreenId: DESIGN_SYSTEM_ASSISTANT_SCREEN_ID,
    agentName: PROJECT_RESTRUCTURE_AGENT_NAME,
  };
}

export function useStartProjectRestructure(): () => Promise<void> {
  const { send } = useChat();
  return useCallback(async () => {
    const launch = planProjectRestructureLaunch();
    useEditorStore.getState().setCanvasView(launch.canvasView);
    const chat = useChatStore.getState();
    // The dedicated role remains plan-first through its prompt and tool
    // contract. Design mode keeps the confirmed apply tool available in the
    // same task; plan mode intentionally denies project writes.
    chat.setSessionMode(launch.sessionMode);
    chat.startNewTask(launch.taskScreenId);
    chat.setSessionAgentName(launch.agentName);
    await send(buildProjectRestructurePrompt());
  }, [send]);
}
