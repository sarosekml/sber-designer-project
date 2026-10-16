/**
 * OpenAI Chat Completions wire format adapter.
 *
 * Hits `<baseURL>/chat/completions` with the standard OpenAI body. Works
 * unchanged for: GigaChat (with corp `baseURL`), vLLM/llama.cpp/LM Studio,
 * Together AI, DeepSeek, OpenAI proper, anything that speaks the
 * Chat Completions API. Tool-calling matches the OpenAI spec —
 * `tools` + `tool_choice` in request, `tool_calls` in the assistant
 * message of the response. ADR-0014.
 *
 * No SDK dependency — we use `fetch` directly. This keeps the bundle small,
 * works in both Node and browser, and avoids version-pinning a vendor SDK.
 */
import type { ChatContent, ChatRequest, ChatResponse, FinishReason, ToolCall } from '../chat';
import {
  ProviderError,
  analyzeProviderHttpFailure,
  providerHttpErrorMessage,
  providerSecretsOf,
  providerTransportError,
} from '../provider-error';
import type { ProviderEntryT } from '../schema';
import { pairToolMessages } from './tool-pairing';

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAiResponseMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAiToolCall[];
}

interface OpenAiChoice {
  index: number;
  message: OpenAiResponseMessage;
  finish_reason: string | null;
}

interface OpenAiResponse {
  id: string;
  model: string;
  choices: OpenAiChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export async function openAiCompatibleChat(
  req: ChatRequest,
  provider: ProviderEntryT,
  active: { provider: string; model: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ChatResponse> {
  const baseURL = provider.options?.baseURL;
  if (!baseURL) {
    throw new Error(`Provider "${active.provider}" is openai-compatible but has no baseURL set.`);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...provider.options?.headers,
  };
  if (provider.options?.apiKey) {
    headers['Authorization'] ??= `Bearer ${provider.options.apiKey}`;
  }

  const body = {
    model: active.model,
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
  const fetchInit: RequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    ...(req.signal ? { signal: req.signal } : {}),
  };
  let res: Response;
  try {
    res = await fetchImpl(url, fetchInit);
  } catch (err) {
    // Transport-level failure (connection refused, DNS, timeout): classify as
    // network, never as an auth/billing verdict (review R2).
    throw providerTransportError(err);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const secrets = providerSecretsOf(provider);
    throw new ProviderError(
      providerHttpErrorMessage(
        active.provider,
        res.status,
        res.statusText,
        text,
        secrets,
        'returned',
      ),
      analyzeProviderHttpFailure(res.status, text, secrets),
    );
  }

  let data: OpenAiResponse;
  try {
    data = (await res.json()) as OpenAiResponse;
  } catch (err) {
    throw new Error(
      `Provider "${active.provider}" returned a malformed success response: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const choice = data.choices[0];
  if (!choice) {
    throw new Error(`Provider "${active.provider}" returned no choices.`);
  }

  const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));

  const finishReason = normalizeFinishReason(choice.finish_reason);
  const usage = compactUsage(data.usage?.prompt_tokens, data.usage?.completion_tokens);

  return {
    text: choice.message.content ?? '',
    ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
    ...(finishReason ? { finishReason } : {}),
    provider: active.provider,
    model: active.model,
    ...(data.model ? { responseModel: data.model } : {}),
    ...(usage ? { usage } : {}),
  };
}

function compactUsage(inputTokens?: number, outputTokens?: number): ChatResponse['usage'] {
  const usage = {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
  };
  return Object.keys(usage).length > 0 ? usage : undefined;
}

function toOpenAiMessage(m: ChatRequest['messages'][number]) {
  if (m.role === 'tool') {
    return {
      role: 'tool' as const,
      content: contentToText(m.content),
      tool_call_id: m.toolCallId,
    };
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
