import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { normalizeAssistantTokenUsage } from '@sber-designer/shared-types';
import type { ChatResponse, LlmGateway } from '@sber-designer/llm-gateway';
import { z } from 'zod';

import { openAiCompatibleChatStream } from '../packages/llm-gateway/src/providers/openai-compatible-stream';
import { addRuntimeUsage } from '../services/api/src/agent-runtimes/usage';
import { runAgent } from '../services/api/src/agent/loop';
import {
  completeAgentRun,
  createAgentRun,
  readRunManifest,
} from '../services/api/src/agent/run-recorder';
import type { ServerTool, ToolContext } from '../services/api/src/agent/types';
import { ProjectSchema } from '../services/api/src/project-store';

test('0114 API and CLI usage aggregation keeps Total equal to Input plus Output', () => {
  const aggregate = addRuntimeUsage(addRuntimeUsage({}, { inputTokens: 400, outputTokens: 50 }), {
    inputTokens: 600,
    outputTokens: 75,
  });

  expect(normalizeAssistantTokenUsage(aggregate)).toEqual({
    totalTokens: 1_125,
    inputTokens: 1_000,
    outputTokens: 125,
  });
});

test('0114 openai-compatible streaming requests and reads the terminal usage chunk', async () => {
  let requestBody: Record<string, unknown> | null = null;
  const fetchImpl: typeof fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      [
        'data: {"choices":[{"index":0,"delta":{"content":"Done"},"finish_reason":"stop"}],"usage":null}',
        '',
        'data: {"choices":[],"usage":{"prompt_tokens":41,"completion_tokens":7,"total_tokens":48}}',
        '',
        'data: [DONE]',
        '',
      ].join('\n'),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  };

  const events = [];
  for await (const event of openAiCompatibleChatStream(
    { messages: [{ role: 'user', content: 'Reply briefly.' }] },
    {
      type: 'openai-compatible',
      name: 'Compatible provider',
      options: { baseURL: 'https://provider.example/v1' },
    },
    { provider: 'compatible', model: 'model-a' },
    fetchImpl,
  )) {
    events.push(event);
  }

  expect(requestBody).toMatchObject({
    stream: true,
    stream_options: { include_usage: true },
  });
  expect(events.at(-1)).toMatchObject({
    type: 'done',
    final: {
      text: 'Done',
      usage: { inputTokens: 41, outputTokens: 7, totalTokens: 48 },
    },
  });
});

test('0114 openai-compatible streaming reads usage attached to a final choice chunk', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      [
        'data: {"choices":[{"index":0,"delta":{"content":"Done"},"finish_reason":"stop"}],"usage":{"prompt_tokens":52,"completion_tokens":8,"total_tokens":60}}',
        '',
        'data: [DONE]',
        '',
      ].join('\n'),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );

  const events = [];
  for await (const event of openAiCompatibleChatStream(
    { messages: [{ role: 'user', content: 'Reply briefly.' }] },
    {
      type: 'openai-compatible',
      name: 'Compatible provider',
      options: { baseURL: 'https://provider.example/v1' },
    },
    { provider: 'compatible', model: 'model-a' },
    fetchImpl,
  )) {
    events.push(event);
  }

  expect(events.at(-1)).toMatchObject({
    type: 'done',
    final: {
      text: 'Done',
      usage: { inputTokens: 52, outputTokens: 8, totalTokens: 60 },
    },
  });
});

test('0114 openai-compatible streaming retries without usage options when unsupported', async () => {
  const requestBodies: Record<string, unknown>[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    if (requestBodies.length === 1) {
      return new Response('{"error":"stream_options is not supported"}', { status: 400 });
    }
    return new Response(
      [
        'data: {"choices":[{"index":0,"delta":{"content":"Done"},"finish_reason":"stop"}]}',
        '',
        'data: [DONE]',
        '',
      ].join('\n'),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  };

  const events = [];
  for await (const event of openAiCompatibleChatStream(
    { messages: [{ role: 'user', content: 'Reply briefly.' }] },
    {
      type: 'openai-compatible',
      name: 'Legacy provider',
      options: { baseURL: 'https://provider.example/v1' },
    },
    { provider: 'legacy', model: 'model-a' },
    fetchImpl,
  )) {
    events.push(event);
  }

  expect(requestBodies).toHaveLength(2);
  expect(requestBodies[0]).toMatchObject({
    stream_options: { include_usage: true },
  });
  expect(requestBodies[1]?.stream_options).toBeUndefined();
  expect(events.at(-1)).toMatchObject({ type: 'done', final: { text: 'Done' } });
});

test('0114 non-streaming API aggregates usage across internal tool iterations', async () => {
  const responses: ChatResponse[] = [
    {
      text: '',
      toolCalls: [{ id: 'echo-1', name: 'echo', arguments: '{"value":"ok"}' }],
      finishReason: 'tool_calls',
      provider: 'mock',
      model: 'mock-model',
      usage: { inputTokens: 400, outputTokens: 50 },
    },
    {
      text: 'Done',
      finishReason: 'stop',
      provider: 'mock',
      model: 'mock-model',
      usage: { inputTokens: 600, outputTokens: 75 },
    },
  ];
  let responseIndex = 0;
  const gateway: LlmGateway = {
    active: { provider: 'mock', model: 'mock-model' },
    listVisibleModels: () => [],
    chat: async () => responses[responseIndex++] ?? responses.at(-1)!,
    chatStream: async function* () {
      yield { type: 'done', final: responses.at(-1)! };
    },
  };
  const tool: ServerTool<{ value: string }, { value: string }> = {
    name: 'echo',
    description: 'Echo a value.',
    inputSchema: z.object({ value: z.string() }),
    handler: async (input) => input,
  };
  const toolContext: ToolContext = {
    user: 'test-user',
    workspacePath: null,
    canvasUrl: null,
  };

  const result = await runAgent({
    gateway,
    messages: [{ role: 'user', content: 'Use echo.' }],
    tools: [tool],
    toolContext,
    permission: { '*': 'allow' },
    maxIterations: 2,
  });

  expect(result.finalResponse.usage).toEqual({
    totalTokens: 1_125,
    inputTokens: 1_000,
    outputTokens: 125,
  });
});

test('0114 run manifest persists the same three token counters', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0114-token-usage-'));
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    workspacePath: workspace,
  });

  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'complete',
    summary: 'Done.',
    metrics: { iterations: 2, inputTokens: 1_000, outputTokens: 125 },
  });

  expect((await readRunManifest(workspace, run.runId)).metrics).toMatchObject({
    iterations: 2,
    totalTokens: 1_125,
    inputTokens: 1_000,
    outputTokens: 125,
  });
});

test('0114 manifest and UI contract do not invent a total from a partial split', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0114-partial-token-usage-'));
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'external-cli',
    model: 'unknown',
    workspacePath: workspace,
  });

  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'complete',
    summary: 'Done.',
    metrics: { iterations: 1, inputTokens: 700 },
  });

  const metrics = (await readRunManifest(workspace, run.runId)).metrics;
  expect(metrics?.inputTokens).toBe(700);
  expect(metrics?.outputTokens).toBeUndefined();
  expect(metrics?.totalTokens).toBeUndefined();
});

test('0114 project schema accepts persisted token usage on each assistant message', () => {
  const project = ProjectSchema.parse({
    version: 1,
    name: 'Token project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
    assistant: {
      storageVersion: 1,
      sessions: [
        {
          id: 'session-1',
          title: 'Token task',
          primaryScreenId: '__storybook__',
          status: 'active',
          messages: [
            {
              id: 'assistant-1',
              role: 'assistant',
              content: 'Done',
              createdAt: '2026-07-18T00:00:00.000Z',
              tokenUsage: { totalTokens: 81, inputTokens: 70, outputTokens: 11 },
            },
          ],
          createdAt: '2026-07-18T00:00:00.000Z',
          updatedAt: '2026-07-18T00:00:01.000Z',
        },
      ],
    },
  });

  expect(project.assistant?.sessions[0]?.messages[0]?.tokenUsage).toEqual({
    totalTokens: 81,
    inputTokens: 70,
    outputTokens: 11,
  });
});
