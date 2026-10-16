import { expect, test } from 'bun:test';
import { DESIGN_SYSTEM_ASSISTANT_SCREEN_ID } from '@/stores/chat-store';

import {
  PROJECT_RESTRUCTURE_AGENT_NAME,
  buildProjectRestructurePrompt,
  planProjectRestructureLaunch,
} from './use-start-project-restructure';

test('project restructure launches a plan-first role in a write-capable Design session', () => {
  expect(planProjectRestructureLaunch()).toEqual({
    canvasView: 'design-system',
    sessionMode: 'design',
    taskScreenId: DESIGN_SYSTEM_ASSISTANT_SCREEN_ID,
    agentName: PROJECT_RESTRUCTURE_AGENT_NAME,
  });
  const prompt = buildProjectRestructurePrompt();
  expect(prompt).toContain('Do not change files until I explicitly confirm');
  expect(prompt).toContain('planDigest');
  expect(prompt).toContain('apply_project_restructure');
});
