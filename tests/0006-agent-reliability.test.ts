import { expect, test } from 'bun:test';
import { z } from 'zod';

import {
  CONTINUE_AGENT_RUN_MAX_ITERATIONS,
  buildContinueAgentRunPrompt,
} from '../apps/web/src/lib/agent-continue';
import { openAiCompatibleChat } from '../packages/llm-gateway/src/providers/openai-compatible';
import { openAiCompatibleChatStream } from '../packages/llm-gateway/src/providers/openai-compatible-stream';
import { anthropicChat } from '../packages/llm-gateway/src/providers/anthropic';
import { anthropicChatStream } from '../packages/llm-gateway/src/providers/anthropic-stream';
import type { ChatRequest, ChatResponse, LlmGateway, ToolCall } from '../packages/llm-gateway/src';
import { runAgent } from '../services/api/src/agent/loop';
import { runAgentStream } from '../services/api/src/agent/stream';
import type { ServerTool, ToolContext } from '../services/api/src/agent/types';
import type { ProviderEntryT } from '../packages/llm-gateway/src/schema';

test('builds a continuation prompt that resumes a truncated agent run', () => {
  const prompt = buildContinueAgentRunPrompt(10);

  expect(CONTINUE_AGENT_RUN_MAX_ITERATIONS).toBe(20);
  expect(prompt).toContain('iteration limit');
  expect(prompt).toContain('10 turns');
  expect(prompt).toContain('Continue');
  expect(prompt).toContain('do not restart');
  expect(prompt).toContain('finish with a concise summary');
});

test('forwards image_url parts through the OpenAI-compatible provider body', async () => {
  let capturedBody: unknown = null;
  const fetchImpl: typeof fetch = async (_url, init) => {
    capturedBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        id: 'chatcmpl-test',
        model: 'openai-compatible-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'ok' },
            finish_reason: 'stop',
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const provider: ProviderEntryT = {
    type: 'openai-compatible',
    name: 'OpenAI-compatible',
    options: { baseURL: 'https://example.test/v1', apiKey: 'test-key' },
  };

  const response = await openAiCompatibleChat(
    {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Use the screenshot as context.' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,AA==', detail: 'auto' },
            },
          ],
        },
      ],
    },
    provider,
    { provider: 'openai', model: 'openai-compatible-model' },
    fetchImpl,
  );

  expect(response.text).toBe('ok');
  expect(capturedBody).toMatchObject({
    model: 'openai-compatible-model',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Use the screenshot as context.' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AA==', detail: 'auto' },
          },
        ],
      },
    ],
  });
});

test('converts image_url parts to Anthropic image blocks', async () => {
  let capturedBody: unknown = null;
  const fetchImpl: typeof fetch = async (_url, init) => {
    capturedBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        id: 'msg-test',
        role: 'assistant',
        model: 'anthropic-vision-model',
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const provider: ProviderEntryT = {
    type: 'anthropic',
    name: 'Anthropic',
    options: { baseURL: 'https://example.test', apiKey: 'test-key' },
  };

  const response = await anthropicChat(
    {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Use the screenshot as context.' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,AA==', detail: 'auto' },
            },
          ],
        },
      ],
    },
    provider,
    { provider: 'anthropic', model: 'anthropic-vision-model' },
    fetchImpl,
  );

  expect(response.text).toBe('ok');
  expect(capturedBody).toMatchObject({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Use the screenshot as context.' },
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: 'AA==' },
          },
        ],
      },
    ],
  });
});

test('converts streaming Anthropic image_url parts to image blocks', async () => {
  let capturedBody: unknown = null;
  const fetchImpl: typeof fetch = async (_url, init) => {
    capturedBody = JSON.parse(String(init?.body));
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"message_stop"}\n\n'));
          controller.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  };

  const provider: ProviderEntryT = {
    type: 'anthropic',
    name: 'Anthropic',
    options: { baseURL: 'https://example.test', apiKey: 'test-key' },
  };

  for await (const _event of anthropicChatStream(
    {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Use the screenshot as context.' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,AA==', detail: 'auto' },
            },
          ],
        },
      ],
    },
    provider,
    { provider: 'anthropic', model: 'anthropic-vision-model' },
    fetchImpl,
  )) {
    // Exhaust the stream.
  }

  expect(capturedBody).toMatchObject({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Use the screenshot as context.' },
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: 'AA==' },
          },
        ],
      },
    ],
  });
});

test('forwards abort signals through OpenAI-compatible provider requests', async () => {
  const controller = new AbortController();
  const capturedSignals: Array<AbortSignal | undefined> = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    capturedSignals.push(init?.signal);
    return new Response(
      JSON.stringify({
        id: 'chatcmpl-test',
        model: 'openai-compatible-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'ok' },
            finish_reason: 'stop',
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const provider: ProviderEntryT = {
    type: 'openai-compatible',
    name: 'OpenAI-compatible',
    options: { baseURL: 'https://example.test/v1', apiKey: 'test-key' },
  };

  await openAiCompatibleChat(
    {
      messages: [{ role: 'user', content: 'Hello' }],
      signal: controller.signal,
    },
    provider,
    { provider: 'openai', model: 'openai-compatible-model' },
    fetchImpl,
  );

  const events = [];
  const streamFetchImpl: typeof fetch = async (_url, init) => {
    capturedSignals.push(init?.signal);
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream<Uint8Array>({
        start(streamController) {
          streamController.enqueue(
            encoder.encode(
              'data: {"choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n',
            ),
          );
          streamController.enqueue(encoder.encode('data: [DONE]\n\n'));
          streamController.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  };

  for await (const event of openAiCompatibleChatStream(
    {
      messages: [{ role: 'user', content: 'Hello' }],
      signal: controller.signal,
    },
    provider,
    { provider: 'openai', model: 'openai-compatible-model' },
    streamFetchImpl,
  )) {
    events.push(event);
  }

  expect(capturedSignals).toEqual([controller.signal, controller.signal]);
  expect(events.at(-1)).toMatchObject({ type: 'done', final: { text: 'ok' } });
});

test('streaming agent loop forwards abort signals to the gateway', async () => {
  const controller = new AbortController();
  let capturedSignal: AbortSignal | undefined;

  const gateway: LlmGateway = {
    active: { provider: 'test', model: 'test-model' },
    listVisibleModels: () => [],
    chat: async () => ({ text: 'Done', provider: 'test', model: 'test-model' }),
    chatStream: async function* (req) {
      capturedSignal = req.signal;
      yield {
        type: 'done',
        final: { text: 'Done', provider: 'test', model: 'test-model' },
      };
    },
  };

  for await (const _event of runAgentStream({
    gateway,
    messages: [{ role: 'user', content: 'Finish.' }],
    tools: [],
    toolContext,
    signal: controller.signal,
  })) {
    // Exhaust the stream.
  }

  expect(capturedSignal).toBe(controller.signal);
});

test('executes final tool calls before marking a non-streaming run truncated', async () => {
  const result = await runAgent({
    gateway: toolCallingGateway(),
    messages: [{ role: 'user', content: 'Use the tool.' }],
    tools: [echoTool],
    toolContext,
    permission: { '*': 'allow' },
    maxIterations: 1,
  });

  expect(result.truncated).toBe(true);
  expect(result.transcript).toContainEqual({
    role: 'tool',
    toolCallId: 'call-1',
    content: JSON.stringify({ echoed: 'done' }),
  });
});

test('streams final tool results before marking a run truncated', async () => {
  const events = [];
  for await (const event of runAgentStream({
    gateway: toolCallingGateway(),
    messages: [{ role: 'user', content: 'Use the tool.' }],
    tools: [echoTool],
    toolContext,
    permission: { '*': 'allow' },
    maxIterations: 1,
  })) {
    events.push(event);
  }

  expect(events).toContainEqual(
    expect.objectContaining({
      type: 'tool-result',
      iteration: 1,
      toolCallId: 'call-1',
      content: JSON.stringify({ echoed: 'done' }),
      isError: false,
      toolName: 'echo',
      status: 'ok',
    }),
  );
  expect(events.at(-1)).toMatchObject({ type: 'done', truncated: true });
});

test('streaming tool result changed files are emitted only for mutation tools', async () => {
  const readTool: ServerTool = {
    name: 'read_file',
    description: 'Read source.',
    inputSchema: z.object({ path: z.string() }).strict(),
    handler: async (input) => ({ path: input.path }),
  };
  const writeTool: ServerTool = {
    name: 'write_file',
    description: 'Write source.',
    inputSchema: z.object({ path: z.string() }).strict(),
    handler: async (input) => ({ path: input.path }),
  };

  const events = [];
  for await (const event of runAgentStream({
    gateway: scriptedGateway([
      {
        text: '',
        toolCalls: [
          {
            id: 'call-read',
            name: 'read_file',
            arguments: JSON.stringify({ path: 'src/screens/Demo.tsx' }),
          },
          {
            id: 'call-write',
            name: 'write_file',
            arguments: JSON.stringify({ path: 'src/screens/Demo.tsx' }),
          },
        ],
        finishReason: 'tool_calls',
        provider: 'test',
        model: 'test-model',
      },
      { text: 'Done', provider: 'test', model: 'test-model' },
    ]),
    messages: [{ role: 'user', content: 'Read then write.' }],
    tools: [readTool, writeTool],
    toolContext,
    permission: { read: 'allow', edit: 'allow' },
    maxIterations: 2,
  })) {
    events.push(event);
  }

  const readResult = events.find(
    (event) => event.type === 'tool-result' && event.toolName === 'read_file',
  );
  const writeResult = events.find(
    (event) => event.type === 'tool-result' && event.toolName === 'write_file',
  );
  expect(readResult).toMatchObject({ type: 'tool-result' });
  expect(readResult?.changedFiles).toBeUndefined();
  expect(writeResult).toMatchObject({
    type: 'tool-result',
    changedFiles: ['src/screens/Demo.tsx'],
  });
});

test('streaming screen generation retries once when the model returns source in chat before writing', async () => {
  const requests: ChatRequest[] = [];
  const responses: ChatResponse[] = [
    {
      text: '```html\n<main>Preview only</main>\n```',
      finishReason: 'stop',
      provider: 'test',
      model: 'test-model',
    },
    {
      text: '',
      toolCalls: [
        {
          id: 'call-write-after-nudge',
          name: 'write_file',
          arguments: JSON.stringify({
            path: 'pages/dashboard.html',
            contentsLines: ['<main data-sd-screen-root>Dashboard</main>'],
          }),
        },
      ],
      finishReason: 'tool_calls',
      provider: 'test',
      model: 'test-model',
    },
    { text: 'Saved the active screen.', provider: 'test', model: 'test-model' },
  ];
  let responseIndex = 0;
  const gateway: LlmGateway = {
    active: { provider: 'test', model: 'test-model' },
    listVisibleModels: () => [],
    chat: async () => responses[responseIndex++] ?? responses.at(-1)!,
    chatStream: async function* (request) {
      requests.push(request);
      const response = responses[responseIndex++] ?? responses.at(-1)!;
      for (const call of response.toolCalls ?? []) yield { type: 'tool-call', call };
      yield { type: 'done', final: response };
    },
  };
  const writeTool: ServerTool<{ path: string; contentsLines: string[] }, { path: string }> = {
    name: 'write_file',
    description: 'Write the active HTML page.',
    inputSchema: z.object({ path: z.string(), contentsLines: z.array(z.string()) }),
    handler: async (input) => ({ path: input.path }),
  };
  const events = [];

  for await (const event of runAgentStream({
    gateway,
    messages: [{ role: 'user', content: 'Recreate this dashboard in the active screen.' }],
    tools: [writeTool],
    toolContext: {
      ...toolContext,
      activeScreen: {
        id: 'screen-dashboard',
        name: 'Dashboard',
        kind: 'page',
        filePath: 'pages/dashboard.html',
        implementationFilePath: 'pages/dashboard.html',
      },
      componentPack: {
        status: 'weak',
        source: 'design-index',
        stale: false,
        taskKind: 'image-to-screen',
        candidates: [],
        diagnostics: [],
      },
    },
    permission: { '*': 'allow' },
    maxIterations: 3,
  })) {
    events.push(event);
  }

  expect(requests).toHaveLength(3);
  expect(requests[1]?.messages.at(-1)?.content).toContain(
    'previous response did not change the active screen',
  );
  expect(requests[1]?.messages.at(-1)?.content).toContain('pages/dashboard.html');
  expect(events).toContainEqual(
    expect.objectContaining({
      type: 'tool-result',
      toolName: 'write_file',
      changedFiles: ['pages/dashboard.html'],
    }),
  );
  expect(events.at(-1)).toMatchObject({
    type: 'done',
    iterations: 3,
    finalResponse: { text: 'Saved the active screen.' },
  });
});

test('streaming agent loop stops after an explicit permission denial', async () => {
  let gatewayCalls = 0;
  let toolCalls = 0;
  const tool: ServerTool = {
    name: 'write_file',
    description: 'Write source.',
    inputSchema: z.object({ path: z.string(), contents: z.string() }).strict(),
    handler: async () => {
      toolCalls += 1;
      return { ok: true };
    },
  };

  const gateway = scriptedGateway([
    {
      text: '',
      toolCalls: [
        {
          id: 'call-denied',
          name: 'write_file',
          arguments: JSON.stringify({ path: 'src/screens/Demo.tsx', contents: '' }),
        },
      ],
      finishReason: 'tool_calls',
      provider: 'test',
      model: 'test-model',
    },
    { text: 'Should not continue', provider: 'test', model: 'test-model' },
  ]);
  const countingGateway: LlmGateway = {
    ...gateway,
    chatStream: async function* (req) {
      gatewayCalls += 1;
      yield* gateway.chatStream(req);
    },
  };

  const events = [];
  for await (const event of runAgentStream({
    gateway: countingGateway,
    messages: [{ role: 'user', content: 'Write it.' }],
    tools: [tool],
    toolContext,
    permission: { edit: 'ask' },
    requestPermission: async () => ({ decision: 'deny' }),
    maxIterations: 4,
  })) {
    events.push(event);
  }

  expect(gatewayCalls).toBe(1);
  expect(toolCalls).toBe(0);
  expect(events).toContainEqual(
    expect.objectContaining({
      type: 'tool-result',
      isError: true,
      content: expect.stringContaining('permission_denied'),
    }),
  );
  expect(events.at(-1)).toMatchObject({ type: 'done', hadErrors: true });
});

test('non-streaming agent loop retries an empty assistant turn after tool use', async () => {
  const values: string[] = [];

  const result = await runAgent({
    gateway: scriptedGateway([
      toolResponse('call-1', 'first'),
      { text: '', provider: 'test', model: 'test-model' },
      toolResponse('call-2', 'second'),
      { text: 'Done', provider: 'test', model: 'test-model' },
    ]),
    messages: [{ role: 'user', content: 'Use tools, then finish.' }],
    tools: [recordingEchoTool(values)],
    toolContext,
    permission: { '*': 'allow' },
    maxIterations: 4,
  });

  expect(values).toEqual(['first', 'second']);
  expect(result.finalResponse.text).toBe('Done');
  expect(
    result.transcript.some(
      (message) =>
        message.role === 'system' &&
        typeof message.content === 'string' &&
        message.content.includes('previous assistant turn was empty'),
    ),
  ).toBe(true);
});

test('streaming agent loop retries an empty assistant turn after tool use', async () => {
  const values: string[] = [];
  const events = [];

  for await (const event of runAgentStream({
    gateway: scriptedGateway([
      toolResponse('call-1', 'first'),
      { text: '', provider: 'test', model: 'test-model' },
      toolResponse('call-2', 'second'),
      { text: 'Done', provider: 'test', model: 'test-model' },
    ]),
    messages: [{ role: 'user', content: 'Use tools, then finish.' }],
    tools: [recordingEchoTool(values)],
    toolContext,
    permission: { '*': 'allow' },
    maxIterations: 4,
  })) {
    events.push(event);
  }

  expect(values).toEqual(['first', 'second']);
  expect(events.filter((event) => event.type === 'tool-result')).toHaveLength(2);
  expect(events.at(-1)).toMatchObject({
    type: 'done',
    finalResponse: { text: 'Done' },
  });
});

test('agent loop unwraps nested tool arguments from OpenAI-compatible providers', async () => {
  const values: string[] = [];

  const result = await runAgent({
    gateway: scriptedGateway([
      {
        text: '',
        toolCalls: [
          {
            id: 'call-nested',
            name: 'echo',
            arguments: JSON.stringify({
              arguments: JSON.stringify({ value: 'nested' }),
            }),
          },
        ],
        finishReason: 'tool_calls',
        provider: 'test',
        model: 'test-model',
      },
      { text: 'Done', provider: 'test', model: 'test-model' },
    ]),
    messages: [{ role: 'user', content: 'Use the tool.' }],
    tools: [recordingEchoTool(values)],
    toolContext,
    permission: { '*': 'allow' },
    maxIterations: 2,
  });

  expect(values).toEqual(['nested']);
  expect(result.finalResponse.text).toBe('Done');
});

test('agent loop returns actionable errors for malformed tool JSON', async () => {
  const result = await runAgent({
    gateway: scriptedGateway([
      {
        text: '',
        toolCalls: [
          {
            id: 'call-bad',
            name: 'echo',
            arguments: '{"value": "unterminated',
          },
        ],
        finishReason: 'tool_calls',
        provider: 'test',
        model: 'test-model',
      },
      { text: 'Blocked', provider: 'test', model: 'test-model' },
    ]),
    messages: [{ role: 'user', content: 'Use the tool.' }],
    tools: [echoTool],
    toolContext,
    permission: { '*': 'allow' },
    maxIterations: 2,
  });

  const toolResult = result.transcript.find((message) => message.role === 'tool');
  expect(toolResult?.content).toContain('invalid_tool_json');
  expect(toolResult?.content).toContain('write_file');
});

test('agent loop escalates recovery guidance after repeated malformed write_file JSON', async () => {
  const result = await runAgent({
    gateway: scriptedGateway([
      {
        text: '',
        toolCalls: [
          {
            id: 'call-bad-1',
            name: 'write_file',
            arguments: '{"path":"src/screens/NewScreen.tsx","contents":"unterminated',
          },
        ],
        finishReason: 'tool_calls',
        provider: 'test',
        model: 'test-model',
      },
      {
        text: '',
        toolCalls: [
          {
            id: 'call-bad-2',
            name: 'write_file',
            arguments: '{"path":"src/screens/NewScreen.tsx","contents":"still unterminated',
          },
        ],
        finishReason: 'tool_calls',
        provider: 'test',
        model: 'test-model',
      },
      { text: 'Blocked', provider: 'test', model: 'test-model' },
    ]),
    messages: [{ role: 'user', content: 'Create the screen.' }],
    tools: [writeFileTool],
    toolContext,
    permission: { '*': 'allow' },
    maxIterations: 3,
  });

  const toolResults = result.transcript.filter((message) => message.role === 'tool');
  expect(toolResults).toHaveLength(2);
  expect(toolResults[1]?.content).toContain('compact_write_required');
  expect(toolResults[1]?.content).toContain('contentsLines');
  expect(toolResults[1]?.content).toContain('under 120 lines');
});

const toolCall: ToolCall = {
  id: 'call-1',
  name: 'echo',
  arguments: JSON.stringify({ value: 'done' }),
};

const toolContext: ToolContext = {
  user: 'test-user',
  workspacePath: null,
  canvasUrl: null,
};

const echoTool: ServerTool<{ value: string }, { echoed: string }> = {
  name: 'echo',
  description: 'Echo a value.',
  inputSchema: z.object({ value: z.string() }),
  handler: async (input) => ({ echoed: input.value }),
};

const writeFileTool: ServerTool<
  { path: string; contents?: string; contentsLines?: string[] },
  { ok: true }
> = {
  name: 'write_file',
  description: 'Write a file.',
  inputSchema: z.object({
    path: z.string(),
    contents: z.string().optional(),
    contentsLines: z.array(z.string()).optional(),
  }),
  handler: async () => ({ ok: true }),
};

function recordingEchoTool(values: string[]): ServerTool<{ value: string }, { echoed: string }> {
  return {
    name: 'echo',
    description: 'Echo a value.',
    inputSchema: z.object({ value: z.string() }),
    handler: async (input) => {
      values.push(input.value);
      return { echoed: input.value };
    },
  };
}

function toolResponse(id: string, value: string): ChatResponse {
  return {
    text: '',
    toolCalls: [
      {
        id,
        name: 'echo',
        arguments: JSON.stringify({ value }),
      },
    ],
    finishReason: 'tool_calls',
    provider: 'test',
    model: 'test-model',
  };
}

function scriptedGateway(responses: ChatResponse[]): LlmGateway {
  let index = 0;
  return {
    active: { provider: 'test', model: 'test-model' },
    listVisibleModels: () => [],
    chat: async () => responses[index++] ?? responses.at(-1)!,
    chatStream: async function* () {
      const response = responses[index++] ?? responses.at(-1)!;
      for (const call of response.toolCalls ?? []) {
        yield { type: 'tool-call', call };
      }
      yield { type: 'done', final: response };
    },
  };
}

function toolCallingGateway(): LlmGateway {
  return {
    active: { provider: 'test', model: 'test-model' },
    listVisibleModels: () => [],
    chat: async () => ({
      text: '',
      toolCalls: [toolCall],
      finishReason: 'tool_calls',
      provider: 'test',
      model: 'test-model',
    }),
    chatStream: async function* () {
      yield { type: 'tool-call', call: toolCall };
      yield {
        type: 'done',
        final: {
          text: '',
          toolCalls: [toolCall],
          finishReason: 'tool_calls',
          provider: 'test',
          model: 'test-model',
        },
      };
    },
  };
}
