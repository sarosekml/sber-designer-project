/**
 * Streaming variant of openai-compatible. Sends `stream: true` and
 * yields normalised ChatStreamEvent values. Tool-call args arrive in
 * deltas; we accumulate them per index and emit a single `tool-call`
 * event once the call finishes (matches what the agent loop wants).
 */
import type { ChatContent, ChatRequest, ChatResponse, FinishReason, ToolCall } from '../chat';
import {
  analyzeProviderHttpFailure,
  networkFailureInfo,
  providerHttpErrorMessage,
  providerSecretsOf,
} from '../provider-error';
import type { ProviderEntryT } from '../schema';
import { readSse } from '../sse';
import type { ChatStreamEvent } from '../stream';
import { pairToolMessages } from './tool-pairing';

interface DeltaToolCall {
  index: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenAiStreamChunk {
  id?: string;
  model?: string;
  choices?: {
    index: number;
    delta?: {
      role?: string;
      content?: string | null;
      tool_calls?: DeltaToolCall[];
    };
    finish_reason?: string | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
}

export async function* openAiCompatibleChatStream(
  req: ChatRequest,
  provider: ProviderEntryT,
  active: { provider: string; model: string },
  fetchImpl: typeof fetch = fetch,
): AsyncGenerator<ChatStreamEvent> {
  const baseURL = provider.options?.baseURL;
  if (!baseURL) {
    yield {
      type: 'error',
      message: `Provider "${active.provider}" is openai-compatible but has no baseURL set.`,
    };
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...provider.options?.headers,
  };
  if (provider.options?.apiKey) {
    headers['Authorization'] ??= `Bearer ${provider.options.apiKey}`;
  }

  const body = {
    model: active.model,
    stream: true,
    stream_options: { include_usage: true },
    messages: pairToolMessages(req.messages).map(toOpenAiMessage),
    temperature: req.temperature,
    max_tokens: req.maxTokens,
    ...(req.tools && req.tools.length > 0
      ? {
          tools: req.tools.map((t) => ({
            type: 'function' as const,
            function: { name: t.name, description: t.description, parameters: t.parameters },
          })),
          tool_choice: toOpenAiToolChoice(req.toolChoice),
        }
      : {}),
  };

  const url = baseURL.replace(/\/+$/, '') + '/chat/completions';

  let res: Response;
  try {
    res = await postChatCompletion(fetchImpl, url, headers, body, req.signal);
  } catch (err) {
    yield {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
      ...networkFailureInfo(err),
    };
    return;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (rejectsStreamUsageOption(res.status, text)) {
      try {
        const { stream_options: _streamOptions, ...fallbackBody } = body;
        res = await postChatCompletion(fetchImpl, url, headers, fallbackBody, req.signal);
      } catch (err) {
        yield {
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
          ...networkFailureInfo(err),
        };
        return;
      }
    } else {
      yield httpErrorEvent(active.provider, res.status, text, providerSecretsOf(provider));
      return;
    }
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    yield httpErrorEvent(active.provider, res.status, text, providerSecretsOf(provider));
    return;
  }

  const calls = new Map<number, { id: string; name: string; argsText: string }>();
  let textBuffer = '';
  let finishReason: FinishReason | undefined;
  let usage: ChatResponse['usage'] | undefined;
  let responseModel: string | undefined;

  try {
    for await (const chunk of readSse(res.body)) {
      let parsed: OpenAiStreamChunk;
      try {
        parsed = JSON.parse(chunk.data) as OpenAiStreamChunk;
      } catch {
        continue;
      }
      if (parsed.usage) {
        usage = compactUsage(
          parsed.usage.prompt_tokens,
          parsed.usage.completion_tokens,
          parsed.usage.total_tokens,
        );
      }
      if (parsed.model) {
        responseModel = parsed.model;
      }
      const choice = parsed.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta;
      if (delta?.content) {
        textBuffer += delta.content;
        yield { type: 'text-delta', delta: delta.content };
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const cur = calls.get(tc.index) ?? { id: '', name: '', argsText: '' };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name = tc.function.name;
          if (tc.function?.arguments) cur.argsText += tc.function.arguments;
          calls.set(tc.index, cur);
        }
      }
      if (choice.finish_reason) {
        finishReason = normalizeFinishReason(choice.finish_reason);
      }
    }
  } catch (err) {
    yield {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
      ...networkFailureInfo(err),
    };
    return;
  }

  // Emit accumulated tool calls in index order.
  const orderedCalls: ToolCall[] = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, c]) => ({ id: c.id, name: c.name, arguments: c.argsText || '{}' }));
  for (const call of orderedCalls) {
    yield { type: 'tool-call', call };
  }

  yield {
    type: 'done',
    final: {
      text: textBuffer,
      ...(orderedCalls.length > 0 ? { toolCalls: orderedCalls } : {}),
      ...(finishReason ? { finishReason } : {}),
      provider: active.provider,
      model: active.model,
      ...(responseModel ? { responseModel } : {}),
      ...(usage ? { usage } : {}),
    },
  };
}

function httpErrorEvent(
  providerKey: string,
  status: number,
  bodyText: string,
  secrets: ReturnType<typeof providerSecretsOf>,
): Extract<ChatStreamEvent, { type: 'error' }> {
  return {
    type: 'error',
    message: providerHttpErrorMessage(providerKey, status, '', bodyText, secrets, 'plain'),
    ...analyzeProviderHttpFailure(status, bodyText, secrets),
  };
}

function compactUsage(
  inputTokens?: number,
  outputTokens?: number,
  totalTokens?: number,
): ChatResponse['usage'] {
  const usage = {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
  };
  return Object.keys(usage).length > 0 ? usage : undefined;
}

async function postChatCompletion(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  return fetchImpl(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
}

function rejectsStreamUsageOption(status: number, body: string): boolean {
  return (
    (status === 400 || status === 422) && /stream[_ -]?options|include[_ -]?usage/iu.test(body)
  );
}

function toOpenAiMessage(m: ChatRequest['messages'][number]) {
  if (m.role === 'tool') {
    return { role: 'tool' as const, content: contentToText(m.content), tool_call_id: m.toolCallId };
  }
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
    return {
      role: 'assistant' as const,
      content: contentToText(m.content) || null,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };
  }
  return { role: m.role, content: m.content };
}

function contentToText(content: ChatContent): string {
  if (typeof content === 'string') return content;
  return content
    .map((part) => {
      if (part.type === 'text') return part.text;
      return `[Attached image: ${part.image_url.url.slice(0, 80)}]`;
    })
    .join('\n');
}

function toOpenAiToolChoice(tc: ChatRequest['toolChoice']) {
  if (!tc || tc === 'auto') return 'auto';
  if (tc === 'required') return 'required';
  if (tc === 'none') return 'none';
  return { type: 'function' as const, function: { name: tc.name } };
}

function normalizeFinishReason(s: string | null): FinishReason | undefined {
  if (!s) return undefined;
  if (s === 'stop' || s === 'length' || s === 'content_filter') return s;
  if (s === 'tool_calls' || s === 'function_call') return 'tool_calls';
  return 'other';
}
