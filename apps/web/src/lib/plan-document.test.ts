import { expect, test } from 'bun:test';

import type { ChatMessage } from '@/stores/chat-store';
import {
  findLatestPlanDocumentPath,
  generateFromPlanPrompt,
  isSafePlanDocumentPath,
} from './plan-document';

test('findLatestPlanDocumentPath reads both assistant text and tool arguments', () => {
  const messages: ChatMessage[] = [
    {
      id: 'a',
      role: 'assistant',
      content: 'Draft: `.sber-designer/plans/0001-first.plan.md`',
    },
    {
      id: 'b',
      role: 'assistant',
      content: 'Writing the revised plan.',
      toolCalls: [
        {
          id: 'tool-1',
          name: 'write_file',
          arguments: JSON.stringify({ path: '.sber-designer/plans/0002-revised.plan.md' }),
        },
      ],
    },
  ];
  expect(findLatestPlanDocumentPath(messages)).toBe('.sber-designer/plans/0002-revised.plan.md');
});

test('plan document paths and Design handoff stay scoped', () => {
  expect(isSafePlanDocumentPath('.sber-designer/plans/payment.md')).toBe(true);
  expect(isSafePlanDocumentPath('.sber-designer/plans/../project.sdproj')).toBe(false);
  expect(generateFromPlanPrompt('.sber-designer/plans/payment.md')).toContain(
    'resolve exact component contracts and variants',
  );
});
