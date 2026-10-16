import { expect, test } from 'bun:test';

import { normalizeAgentStreamEvent } from '../services/api/src/agent-runtimes/agent-events';

test('normalizes stream events and synthesizes file_write events from changed files', () => {
  expect(
    normalizeAgentStreamEvent({
      type: 'tool-result',
      iteration: 1,
      toolCallId: 'call-1',
      content: 'updated',
      isError: false,
      toolName: 'write_file',
      changedFiles: ['src/screens/Admin.tsx'],
    }),
  ).toEqual([
    {
      type: 'tool_result',
      iteration: 1,
      toolCallId: 'call-1',
      isError: false,
      content: 'updated',
    },
    {
      type: 'file_write',
      path: 'src/screens/Admin.tsx',
      source: 'tool-result',
      iteration: 1,
    },
  ]);
});
