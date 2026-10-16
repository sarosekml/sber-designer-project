/**
 * Streaming variant of the Anthropic adapter. Reads `/v1/messages` SSE
 * events (content_block_delta, content_block_start, message_delta,
 * message_stop) and normalises them to ChatStreamEvent.
 *
 * Reference: https://platform.claude.com/docs/en/api/messages-streaming
 */
import type { PromptRasterImageMimeType } from '@sber-designer/shared-types';
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

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;

interface AnthropicSseEvent {
  type: string;
  index?: number;
  content_block?: { type: 'text' | 'tool_use'; id?: string; name?: string };
  delta?: {
    type?: 'text_delta' | 'input_json_delta';
    text?: string;
    partial_json?: string;
    stop_reason?: 'end_turn' | 'stop_sequence' | 'max_tokens' | 'tool_use';
  };
  message?: {
    stop_reason?: 'end_turn' | 'stop_sequence' | 'max_tokens' | 'tool_use';
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface BlockState {
  kind: 'text' | 'tool_use';
  toolId?: string;
  toolName?: string;
  textBuffer?: string;
  argsBuffer?: string;
}

interface AnthropicImageBlock {
  type: 'image';
  source:
    | { type: 'base64'; media_type: PromptRasterImageMimeType; data: string }
    | { type: 'url'; url: string };
}

export async function* anthropicChatStream(
  req: ChatRequest,
  provider: ProviderEntryT,
  active: { provider: string; model: string },
  fetchImpl: typeof fetch = fetch,
): AsyncGenerator<ChatStreamEvent> {
  const apiKey = provider.options?.apiKey;
  if (!apiKey) {
    yield { type: 'error', message: `Provider "${active.provider}" needs apiKey set.` };
    return;
  }
  const baseURL = (provider.options?.baseURL ?? 'https://api.anthropic.com').replace(/\/+$/, '');

  const { systemPrompt, messages } = mapMessages(req.messages);

  const body: Record<string, unknown> = {
    model: active.model,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages,
    stream: true,
  };
  if (systemPrompt) body.system = systemPrompt;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.tools && req.tools.length > 0) {
    body.tools = req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'text/event-stream',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    ...provider.options?.headers,
  };

  let res: Response;
  try {
    const fetchInit: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      ...(req.signal ? { signal: req.signal } : {}),
    };
    res = await fetchImpl(baseURL + '/v1/messages', fetchInit);
  } catch (err) {
    yield {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
      ...networkFailureInfo(err),
    };
    return;
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    const secrets = providerSecretsOf(provider);
    yield {
      type: 'error',
      message: providerHttpErrorMessage(active.provider, res.status, '', text, secrets, 'plain'),
      ...analyzeProviderHttpFailure(res.status, text, secrets),
    };
    return;
  }

  const blocks = new Map<number, BlockState>();
  const toolCalls: ToolCall[] = [];
  let fullText = '';
  let finishReason: FinishReason | undefined;
  let usage: ChatResponse['usage'] | undefined;

  try {
    for await (const chunk of readSse(res.body)) {
      let evt: AnthropicSseEvent;
      try {
        evt = JSON.parse(chunk.data) as AnthropicSseEvent;
      } catch {
        continue;
      }
      switch (evt.type) {
        case 'content_block_start': {
          if (typeof evt.index !== 'number' || !evt.content_block) break;
          if (evt.content_block.type === 'text') {
            blocks.set(evt.index, { kind: 'text', textBuffer: '' });
          } else if (evt.content_block.type === 'tool_use') {
            blocks.set(evt.index, {
              kind: 'tool_use',
              ...(evt.content_block.id ? { toolId: evt.content_block.id } : {}),
              ...(evt.content_block.name ? { toolName: evt.content_block.name } : {}),
              argsBuffer: '',
            });
          }
          break;
        }
        case 'content_block_delta': {
          if (typeof evt.index !== 'number') break;
          const state = blocks.get(evt.index);
          if (!state) break;
          if (state.kind === 'text' && evt.delta?.type === 'text_delta' && evt.delta.text) {
            state.textBuffer = (state.textBuffer ?? '') + evt.delta.text;
            fullText += evt.delta.text;
            yield { type: 'text-delta', delta: evt.delta.text };
          } else if (
            state.kind === 'tool_use' &&
            evt.delta?.type === 'input_json_delta' &&
            evt.delta.partial_json !== undefined
          ) {
            state.argsBuffer = (state.argsBuffer ?? '') + evt.delta.partial_json;
          }
          break;
        }
        case 'content_block_stop': {
          if (typeof evt.index !== 'number') break;
          const state = blocks.get(evt.index);
          if (state?.kind === 'tool_use' && state.toolId && state.toolName) {
            const args = state.argsBuffer || '{}';
            const call: ToolCall = { id: state.toolId, name: state.toolName, arguments: args };
            toolCalls.push(call);
            yield { type: 'tool-call', call };
          }
          break;
        }
        case 'message_delta': {
          if (evt.delta?.stop_reason) finishReason = mapStopReason(evt.delta.stop_reason);
          if (evt.usage) {
            usage = compactUsage(evt.usage.input_tokens, evt.usage.output_tokens);
          }
          break;
        }
        case 'message_stop': {
          // Final event — no payload of interest.
          break;
        }
        default:
          break;
      }
    }
  } catch (err) {
    yield { type: 'error', message: err instanceof Error ? err.message : String(err) };
    return;
  }

  yield {
    type: 'done',
    final: {
      text: fullText,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
      ...(finishReason ? { finishReason } : {}),
      provider: active.provider,
      model: active.model,
      ...(usage ? { usage } : {}),
    },
  };
}

function compactUsage(inputTokens?: number, outputTokens?: number): ChatResponse['usage'] {
  const usage = {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
  };
  return Object.keys(usage).length > 0 ? usage : undefined;
}

function mapMessages(input: ChatRequest['messages']): {
  systemPrompt: string | null;
  messages: { role: 'user' | 'assistant'; content: unknown }[];
} {
  // Reuse same shape as the non-streaming adapter (kept inline to avoid
  // a circular import). Logic mirrors providers/anthropic.ts.
  const systemParts: string[] = [];
  const out: { role: 'user' | 'assistant'; content: unknown }[] = [];
  // Same tool_use/tool_result pairing requirement as the non-streaming adapter.
  for (const m of pairToolMessages(input)) {
    if (m.role === 'system') {
      if (m.content) systemParts.push(contentToText(m.content));
      continue;
    }
    if (m.role === 'user') {
      out.push({ role: 'user', content: contentToAnthropicUserContent(m.content) });
      continue;
    }
    if (m.role === 'assistant') {
      if (!m.toolCalls || m.toolCalls.length === 0) {
        out.push({ role: 'assistant', content: contentToText(m.content) });
      } else {
        const blocks: unknown[] = [];
        const text = contentToText(m.content);
        if (text) blocks.push({ type: 'text', text });
        for (const tc of m.toolCalls) {
          let input: Record<string, unknown> = {};
          try {
            const parsed = JSON.parse(tc.arguments);
            if (parsed && typeof parsed === 'object') input = parsed as Record<string, unknown>;
          } catch {
            input = { __raw: tc.arguments };
          }
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input });
        }
        out.push({ role: 'assistant', content: blocks });
      }
      continue;
    }
    if (m.role === 'tool') {
      const last = out[out.length - 1];
      const block = {
        type: 'tool_result',
        tool_use_id: m.toolCallId ?? '',
        content: contentToText(m.content),
      };
      if (last && last.role === 'user' && Array.isArray(last.content)) {
        (last.content as unknown[]).push(block);
      } else {
        out.push({ role: 'user', content: [block] });
      }
    }
  }
  return {
    systemPrompt: systemParts.length > 0 ? systemParts.join('\n\n') : null,
    messages: out,
  };
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

function contentToAnthropicUserContent(content: ChatContent): string | unknown[] {
  if (typeof content === 'string') return content;
  const blocks: unknown[] = [];
  for (const part of content) {
    if (part.type === 'text') {
      if (part.text) blocks.push({ type: 'text', text: part.text });
      continue;
    }
    const imageBlock = imageUrlToAnthropicBlock(part.image_url.url);
    blocks.push(
      imageBlock ?? {
        type: 'text',
        text: `[Attached image: ${part.image_url.url.slice(0, 80)}]`,
      },
    );
  }
  return blocks.length > 0 ? blocks : '';
}

function imageUrlToAnthropicBlock(url: string): AnthropicImageBlock | null {
  const dataUrl = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/u.exec(url);
  if (dataUrl?.[1] && dataUrl[2] !== undefined) {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: dataUrl[1] as PromptRasterImageMimeType,
        data: dataUrl[2],
      },
    };
  }
  if (/^https?:\/\//iu.test(url)) return { type: 'image', source: { type: 'url', url } };
  return null;
}

function mapStopReason(
  s: NonNullable<AnthropicSseEvent['message']>['stop_reason'],
): FinishReason | undefined {
  if (!s) return undefined;
  if (s === 'tool_use') return 'tool_calls';
  if (s === 'max_tokens') return 'length';
  return 'stop';
}
