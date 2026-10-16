import { expect, test } from 'bun:test';

import {
  DESCRIPTION_AGENT_NAME,
  buildDescriptionInterviewPrompt,
  planDescriptionInterviewLaunch,
} from './use-start-description-interview';
import {
  DESIGN_SYSTEM_ASSISTANT_SCREEN_ID,
  STORYBOOK_ASSISTANT_SCREEN_ID,
} from '@/stores/chat-store';

test('global prompt mentions the role and the most-used-first queue', () => {
  const prompt = buildDescriptionInterviewPrompt();
  expect(prompt.startsWith(`@${DESCRIPTION_AGENT_NAME} `)).toBe(true);
  expect(prompt).toContain('most-used');
  expect(prompt).not.toContain('id:');
});

test('per-component prompt targets one component by id and name', () => {
  const prompt = buildDescriptionInterviewPrompt({
    componentId: 'atoms-badge',
    componentName: 'Badge',
  });
  expect(prompt).toContain(`@${DESCRIPTION_AGENT_NAME} `);
  expect(prompt).toContain('Describe only the Badge component');
  expect(prompt).toContain('id: atoms-badge');
});

test('launch plan sends html-first interviews to the Design system chat', () => {
  const plan = planDescriptionInterviewLaunch({
    projectKind: 'html-first',
    activeScreenId: 'screen-home',
  });

  expect(plan.switchTo).toBe('design-system');
  expect(plan.taskScreenId).toBe(DESIGN_SYSTEM_ASSISTANT_SCREEN_ID);
});

test('launch plan keeps component projects in the Storybook chat', () => {
  const plan = planDescriptionInterviewLaunch({
    projectKind: 'react-vite',
    activeScreenId: 'screen-home',
  });

  expect(plan.switchTo).toBe('storybook');
  expect(plan.taskScreenId).toBe(STORYBOOK_ASSISTANT_SCREEN_ID);
});
