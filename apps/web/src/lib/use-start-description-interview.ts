/**
 * Launch the component description interview (task 0083 Phase 2).
 *
 * Single entry point used by the component row menu ("Describe component", one
 * component) and the Project settings block ("Describe components", whole queue).
 * It switches to Storybook mode, starts a fresh chat (kept alongside the other
 * Storybook-mode chats), and seeds a message that routes the run to the
 * `ai-description-layer` role via a leading @mention.
 */
import { useCallback } from 'react';
import type { SberDesignerProjectKind } from '@sber-designer/shared-types';

import { useChat } from '@/hooks/useChat';
import {
  DESIGN_SYSTEM_ASSISTANT_SCREEN_ID,
  STORYBOOK_ASSISTANT_SCREEN_ID,
  useChatStore,
} from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';

export const DESCRIPTION_AGENT_NAME = 'ai-description-layer';

export interface StartDescriptionInterviewOptions {
  /** When set, the interview targets only this component. */
  componentId?: string;
  componentName?: string;
}

/** Seed message that routes the chat to the description interview role. */
export function buildDescriptionInterviewPrompt(
  opts: StartDescriptionInterviewOptions = {},
): string {
  if (opts.componentId) {
    const label = opts.componentName ?? opts.componentId;
    return `@${DESCRIPTION_AGENT_NAME} Describe only the ${label} component (id: ${opts.componentId}). Show the mined draft and the fixed questions, then wait for my confirmation before writing.`;
  }
  return `@${DESCRIPTION_AGENT_NAME} Describe my components — start with the most-used, undescribed ones (about 8 this pass). For each, show the mined draft and the fixed questions, then wait for my confirmation.`;
}

export interface DescriptionInterviewLaunchPlan {
  switchTo: 'storybook' | 'design-system';
  taskScreenId: string;
}

export function planDescriptionInterviewLaunch(input: {
  projectKind?: SberDesignerProjectKind | null | undefined;
  activeScreenId?: string | null;
}): DescriptionInterviewLaunchPlan {
  if (input.projectKind === 'html-first') {
    return {
      switchTo: 'design-system',
      taskScreenId: DESIGN_SYSTEM_ASSISTANT_SCREEN_ID,
    };
  }
  return {
    switchTo: 'storybook',
    taskScreenId: STORYBOOK_ASSISTANT_SCREEN_ID,
  };
}

export function useStartDescriptionInterview(): (
  opts?: StartDescriptionInterviewOptions,
) => Promise<void> {
  const { send } = useChat();
  return useCallback(
    async (opts: StartDescriptionInterviewOptions = {}) => {
      const editor = useEditorStore.getState();
      const project = useProjectStore.getState().project;
      const plan = planDescriptionInterviewLaunch({
        projectKind: project?.projectKind,
        activeScreenId: editor.activeScreenId,
      });
      editor.setCanvasView(plan.switchTo);
      if (opts.componentId) editor.setActiveComponentId(opts.componentId);
      useChatStore.getState().setSessionMode('design');
      // New chat per launch in the profile-specific component surface.
      useChatStore.getState().startNewTask(plan.taskScreenId);
      // 0083 D6/D7: pin this session to the description agent so typed follow-ups
      // (and control answers) stay on `ai-description-layer` instead of reverting
      // to the primary agent mid-interview.
      useChatStore.getState().setSessionAgentName(DESCRIPTION_AGENT_NAME);
      await send(buildDescriptionInterviewPrompt(opts));
    },
    [send],
  );
}
