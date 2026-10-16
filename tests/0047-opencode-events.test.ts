import { expect, test } from 'bun:test';

import { mapOpenCodeRawEvent } from '../services/api/src/agent-runtimes/opencode-events';

test('maps OpenCode text and usage events into normalized run events', () => {
  expect(mapOpenCodeRawEvent({ type: 'step_start', sessionID: 's1' })).toEqual([
    { type: 'status', label: 'running' },
  ]);
  expect(mapOpenCodeRawEvent({ type: 'text', sessionID: 's1', part: { text: 'Hello' } })).toEqual([
    { type: 'text_delta', delta: 'Hello' },
  ]);
  expect(
    mapOpenCodeRawEvent({
      type: 'step_finish',
      sessionID: 's1',
      part: { tokens: { input: 10, output: 3 }, cost: 0.02 },
    }),
  ).toEqual([{ type: 'usage', inputTokens: 10, outputTokens: 3, costUsd: 0.02 }]);
});

test('deduplicates OpenCode tool_use events by session and call id', () => {
  const seen = new Set<string>();
  const first = mapOpenCodeRawEvent(
    {
      type: 'tool_use',
      sessionID: 's1',
      callID: 'call-1',
      part: { tool: 'get_code', callID: 'call-1', input: { source: 'pixso' } },
    },
    seen,
  );
  const duplicate = mapOpenCodeRawEvent(
    {
      type: 'tool_use',
      sessionID: 's1',
      callID: 'call-1',
      part: { tool: 'get_code', callID: 'call-1', input: { source: 'pixso' } },
    },
    seen,
  );
  const completed = mapOpenCodeRawEvent(
    {
      type: 'tool_use',
      sessionID: 's1',
      callID: 'call-1',
      part: { tool: 'get_code', callID: 'call-1' },
      state: { status: 'completed', output: '<div>Pixso frame</div>' },
    },
    seen,
  );

  expect(first).toEqual([
    { type: 'tool_use', id: 'call-1', name: 'get_code', input: { source: 'pixso' } },
  ]);
  expect(duplicate).toEqual([]);
  expect(completed).toEqual([
    {
      type: 'tool_result',
      toolUseId: 'call-1',
      content: '<div>Pixso frame</div>',
      isError: false,
    },
  ]);
});

test('maps OpenCode part.state tool events used by the CLI stream', () => {
  const seen = new Set<string>();
  const started = mapOpenCodeRawEvent(
    {
      type: 'tool_use',
      sessionID: 's1',
      part: {
        tool: 'pixso.get_code',
        callID: 'call-7',
        state: {
          status: 'running',
          input: '{"url":"https://pixso.example/file"}',
        },
      },
    },
    seen,
  );

  expect(started).toEqual([
    {
      type: 'tool_use',
      id: 'call-7',
      name: 'pixso.get_code',
      input: { url: 'https://pixso.example/file' },
    },
  ]);

  const completed = mapOpenCodeRawEvent(
    {
      type: 'tool_use',
      sessionID: 's1',
      part: {
        tool: 'pixso.get_code',
        callID: 'call-7',
        state: {
          status: 'completed',
          output: '<div>Screen</div>',
        },
      },
    },
    seen,
  );

  expect(completed).toEqual([
    {
      type: 'tool_result',
      toolUseId: 'call-7',
      content: '<div>Screen</div>',
      isError: false,
    },
  ]);
});
