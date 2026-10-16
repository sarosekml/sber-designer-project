import { expect, test } from 'bun:test';
import { openAiCompatibleChat } from '../packages/llm-gateway/src/providers/openai-compatible';
import { openAiCompatibleChatStream } from '../packages/llm-gateway/src/providers/openai-compatible-stream';

test('openai-compatible chat preserves user image_url parts', async () => {
  let captured: unknown;
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    captured = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        id: 'chatcmpl-test',
        model: 'deepseek-v4-pro',
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

  await openAiCompatibleChat(
    {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Can you read this?' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,abc', detail: 'auto' } },
          ],
        },
      ],
    },
    {
      type: 'openai-compatible',
      name: 'DeepSeek',
      options: { baseURL: 'https://api.deepseek.com' },
    },
    { provider: 'deepseek', model: 'deepseek-v4-pro' },
    fetchImpl as typeof fetch,
  );

  expect(captured).toMatchObject({
    model: 'deepseek-v4-pro',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Can you read this?' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc', detail: 'auto' } },
        ],
      },
    ],
  });
});

test('openai-compatible stream preserves user image_url parts', async () => {
  let captured: unknown;
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    captured = JSON.parse(String(init?.body));
    return new Response(
      [
        'data: {"choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":null}]}',
        '',
        'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        '',
        'data: [DONE]',
        '',
      ].join('\n'),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  };

  for await (const _event of openAiCompatibleChatStream(
    {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Can you read this?' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,abc', detail: 'auto' } },
          ],
        },
      ],
    },
    {
      type: 'openai-compatible',
      name: 'DeepSeek',
      options: { baseURL: 'https://api.deepseek.com' },
    },
    { provider: 'deepseek', model: 'deepseek-v4-pro' },
    fetchImpl as typeof fetch,
  )) {
    // Drain the stream so the request body is captured and parser completes.
  }

  expect(captured).toMatchObject({
    model: 'deepseek-v4-pro',
    stream: true,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Can you read this?' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc', detail: 'auto' } },
        ],
      },
    ],
  });
});
