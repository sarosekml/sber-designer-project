import { expect, test } from 'bun:test';

import { mapCodexRawEvent } from '../services/api/src/agent-runtimes/codex-events';

test('maps Codex task and agent message events into normalized events', () => {
  expect(mapCodexRawEvent({ type: 'task_started' })).toEqual([
    { type: 'status', label: 'running' },
  ]);
  expect(mapCodexRawEvent({ type: 'thread.started', thread_id: 'thread-1' })).toEqual([
    { type: 'status', label: 'running' },
  ]);
  expect(mapCodexRawEvent({ type: 'agent_message', message: 'Done' })).toEqual([
    { type: 'text_delta', delta: 'Done' },
  ]);
  expect(mapCodexRawEvent({ type: 'agent_message_delta', delta: ' streamed' })).toEqual([
    { type: 'text_delta', delta: ' streamed' },
  ]);
});

test('maps Codex exec JSONL item completion events into normalized events', () => {
  expect(
    mapCodexRawEvent({
      type: 'item.completed',
      item: { id: 'item_0', type: 'agent_message', text: 'pong' },
    }),
  ).toEqual([{ type: 'text_delta', delta: 'pong' }]);
  expect(
    mapCodexRawEvent({
      type: 'turn.completed',
      usage: {
        input_tokens: 10,
        output_tokens: 3,
      },
    }),
  ).toEqual([{ type: 'usage', inputTokens: 10, outputTokens: 3 }]);
});

test('maps Codex cached input as reuse instead of new prompt usage', () => {
  expect(
    mapCodexRawEvent({
      type: 'turn.completed',
      usage: {
        input_tokens: 150,
        cached_input_tokens: 120,
        output_tokens: 15,
      },
    }),
  ).toEqual([{ type: 'usage', inputTokens: 30, cachedInputTokens: 120, outputTokens: 15 }]);
});

test('maps Codex exec command events into normalized tool events', () => {
  const begin = mapCodexRawEvent({
    type: 'exec_command_begin',
    call_id: 'exec-1',
    command: 'bun test',
  });
  const end = mapCodexRawEvent({
    type: 'exec_command_end',
    call_id: 'exec-1',
    exit_code: 0,
    stdout: 'pass',
    stderr: '',
  });

  expect(begin).toEqual([
    { type: 'tool_use', id: 'exec-1', name: 'exec_command', input: { command: 'bun test' } },
  ]);
  expect(end).toEqual([
    { type: 'tool_result', toolUseId: 'exec-1', content: 'pass', isError: false },
  ]);
});

test('maps Codex exec JSONL command item events into normalized tool events', () => {
  const begin = mapCodexRawEvent({
    type: 'item.started',
    item: {
      id: 'item_0',
      type: 'command_execution',
      command: '/bin/zsh -lc pwd',
      status: 'in_progress',
    },
  });
  const end = mapCodexRawEvent({
    type: 'item.completed',
    item: {
      id: 'item_0',
      type: 'command_execution',
      command: '/bin/zsh -lc pwd',
      aggregated_output: '/work/demo-project\n',
      exit_code: 0,
      status: 'completed',
    },
  });

  expect(begin).toEqual([
    {
      type: 'tool_use',
      id: 'item_0',
      name: 'exec_command',
      input: { command: '/bin/zsh -lc pwd' },
    },
  ]);
  expect(end).toEqual([
    {
      type: 'tool_result',
      toolUseId: 'item_0',
      content: '/work/demo-project\n',
      isError: false,
    },
  ]);
});

test('maps Codex MCP tool events into normalized tool events', () => {
  const begin = mapCodexRawEvent({
    type: 'mcp_tool_call_begin',
    invocation: {
      callId: 'mcp-1',
      server: 'figma',
      tool: 'get_design_context',
      arguments: { fileKey: 'abc' },
    },
  });
  const end = mapCodexRawEvent({
    type: 'mcp_tool_call_end',
    invocation: {
      callId: 'mcp-1',
      result: { ok: true },
      isError: false,
    },
  });

  expect(begin).toEqual([
    {
      type: 'tool_use',
      id: 'mcp-1',
      name: 'figma.get_design_context',
      input: { fileKey: 'abc' },
    },
  ]);
  expect(end).toEqual([
    {
      type: 'tool_result',
      toolUseId: 'mcp-1',
      content: JSON.stringify({ ok: true }),
      isError: false,
    },
  ]);
});
