import { expect, test } from 'bun:test';

import { mapClaudeCodeRawEvent } from '../services/api/src/agent-runtimes/claude-events';

test('maps Claude Code assistant text into normalized deltas', () => {
  expect(
    mapClaudeCodeRawEvent({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Screen ' },
          { type: 'text', text: 'created' },
        ],
      },
    }),
  ).toEqual([{ type: 'text_delta', delta: 'Screen created' }]);
});

test('maps Claude Code tool use and tool result blocks', () => {
  expect(
    mapClaudeCodeRawEvent({
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'write_file',
            input: { path: 'src/screens/New.tsx' },
          },
        ],
      },
    }),
  ).toEqual([
    {
      type: 'tool_use',
      id: 'toolu_1',
      name: 'write_file',
      input: { path: 'src/screens/New.tsx' },
    },
  ]);

  expect(
    mapClaudeCodeRawEvent({
      type: 'user',
      message: {
        content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok' }],
      },
    }),
  ).toEqual([{ type: 'tool_result', toolUseId: 'toolu_1', content: 'ok', isError: false }]);
});

test('maps Claude Code errors', () => {
  expect(mapClaudeCodeRawEvent({ type: 'error', error: { message: 'auth required' } })).toEqual([
    { type: 'error', message: 'auth required' },
  ]);
});

test('maps Claude Code assistant API errors into visible runtime errors', () => {
  expect(
    mapClaudeCodeRawEvent({
      type: 'assistant',
      error: 'rate_limit',
      isApiErrorMessage: true,
      apiErrorStatus: 429,
      message: {
        content: [{ type: 'text', text: "You've hit your session limit" }],
      },
    }),
  ).toEqual([
    { type: 'text_delta', delta: "You've hit your session limit" },
    { type: 'error', message: "You've hit your session limit" },
  ]);
});
