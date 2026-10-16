/**
 * Regression for the DeepSeek HTTP 400 hit during the component-description
 * interview: "An assistant message with 'tool_calls' must be followed by tool
 * messages responding to each 'tool_call_id'." A resumed ("Continue run")
 * history could carry an assistant tool_call whose result was never recorded,
 * and the very first request of the resumed run was rejected.
 */
import { expect, test } from 'bun:test';

import type { ChatMessage } from '../packages/llm-gateway/src/chat';
import { pairToolMessages } from '../packages/llm-gateway/src/providers/tool-pairing';

const call = (id: string) => ({ id, name: 'write_component_description', arguments: '{}' });

test('drops a dangling assistant tool_calls that has no following tool result', () => {
  const messages: ChatMessage[] = [
    { role: 'user', content: 'describe Paper' },
    { role: 'assistant', content: '', toolCalls: [call('c1')] },
  ];
  const out = pairToolMessages(messages);
  expect(out).toHaveLength(1);
  expect(out[0]).toEqual({ role: 'user', content: 'describe Paper' });
});

test('keeps assistant prose but strips the unmatched tool_call', () => {
  const messages: ChatMessage[] = [
    { role: 'assistant', content: 'Saving…', toolCalls: [call('c1')] },
  ];
  const out = pairToolMessages(messages);
  expect(out).toHaveLength(1);
  expect(out[0].toolCalls).toBeUndefined();
  expect(out[0].content).toBe('Saving…');
});

test('drops an orphan tool result no assistant call declared', () => {
  const messages: ChatMessage[] = [
    { role: 'user', content: 'hi' },
    { role: 'tool', content: 'ok', toolCallId: 'ghost' },
  ];
  const out = pairToolMessages(messages);
  expect(out).toHaveLength(1);
  expect(out[0].role).toBe('user');
});

test('leaves a well-formed tool_calls/tool pair untouched (same reference)', () => {
  const messages: ChatMessage[] = [
    { role: 'assistant', content: '', toolCalls: [call('c1')] },
    { role: 'tool', content: 'saved', toolCallId: 'c1' },
  ];
  const out = pairToolMessages(messages);
  expect(out).toBe(messages);
});

test('keeps only the satisfied call when an assistant declares several', () => {
  const messages: ChatMessage[] = [
    { role: 'assistant', content: '', toolCalls: [call('c1'), call('c2')] },
    { role: 'tool', content: 'saved', toolCallId: 'c1' },
  ];
  const out = pairToolMessages(messages);
  expect(out).toHaveLength(2);
  expect(out[0].toolCalls).toHaveLength(1);
  expect(out[0].toolCalls?.[0].id).toBe('c1');
  expect(out[1].toolCallId).toBe('c1');
});
