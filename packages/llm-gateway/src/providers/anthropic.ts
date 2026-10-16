/**
 * Anthropic /v1/messages adapter (Phase 2.4).
 *
 * Maps the gateway's OpenAI-flavoured ChatRequest/Response onto
 * Anthropic's content-block shape:
 *
 *   request                        Anthropic
 *   ----------------------------   ------------------------------------
 *   role:'system' messages       → top-level `system` field (joined)
 *   role:'user'                  → role:'user', content as-is
 *   role:'assistant' (no tools)  → role:'assistant', content: text
 *   role:'assistant' + toolCalls → role:'assistant', content: text +
 *                                    tool_use blocks (id/name/input)
 *   role:'tool'                  → role:'user', content: [tool_result
 *                                    block referencing tool_use_id]
 *   tools[]                      → tools[] with input_schema=parameters
 *
 *   response                       gateway
 *   ----------------------------   ------------------------------------
 *   content: text blocks         → text (joined)
 *   content: tool_use blocks     → toolCalls (id + name + JSON-stringified input)
 *   stop_reason: 'tool_use'      → finishReason 'tool_calls'
 *   stop_reason: 'max_tokens'    → 'length'
 *   stop_reason: 'end_turn'      → 'stop'
 *
 * Headers: `x-api-key` from provider.options.apiKey, `anthropic-version: 2023-06-01`.
 *
 * Reference: https://platform.claude.com/docs/en/api/messages
 */
import type { PromptRasterImageMimeType } from '@sber-designer/shared-types';
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

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}
interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
type AnthropicResponseBlock = AnthropicTextBlock | AnthropicToolUseBlock;

interface AnthropicResponse {
  id: string;
  role: 'assistant';
  content: AnthropicResponseBlock[];
  model: string;
  stop_reason?: 'end_turn' | 'stop_sequence' | 'max_tokens' | 'tool_use';
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

interface AnthropicImageBlock {
  type: 'image';
  source:
    | {
        type: 'base64';
        media_type: PromptRasterImageMimeType;
        data: string;
      }
    | { type: 'url'; url: string };
}

type AnthropicRequestBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock
  | AnthropicImageBlock;

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicRequestBlock[];
}

export async function anthropicChat(
  req: ChatRequest,
  provider: ProviderEntryT,
  active: { provider: string; model: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ChatResponse> {
  const apiKey = provider.options?.apiKey;
  if (!apiKey) {
    throw new Error(`Provider "${active.provider}" needs apiKey set in sber-designer.json.`);
  }
  const baseURL = (provider.options?.baseURL ?? 'https://api.anthropic.com').replace(/\/+$/, '');

  const { systemPrompt, messages } = mapMessages(req.messages);

  const body: Record<string, unknown> = {
    model: active.model,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages,
  };
  if (systemPrompt) body.system = systemPrompt;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.tools && req.tools.length > 0) {
    body.tools = req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: ensureObjectSchema(t.parameters),
    }));
    if (req.toolChoice && req.toolChoice !== 'auto') {
      body.tool_choice = mapToolChoice(req.toolChoice);
    }
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    ...provider.options?.headers,
  };

  const url = baseURL + '/v1/messages';
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

  const data = (await res.json()) as AnthropicResponse;

  const text = data.content
    .filter((b): b is AnthropicTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const toolCalls: ToolCall[] = data.content
    .filter((b): b is AnthropicToolUseBlock => b.type === 'tool_use')
    .map((b) => ({
      id: b.id,
      name: b.name,
      arguments: JSON.stringify(b.input ?? {}),
    }));

  const finishReason = mapStopReason(data.stop_reason);
  const usage = compactUsage(data.usage?.input_tokens, data.usage?.output_tokens);

  return {
    text,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    ...(finishReason ? { finishReason } : {}),
    provider: active.provider,
    model: active.model,
    ...(usage ? { usage } : {}),
  };
}

function mapMessages(input: ChatRequest['messages']): {
  systemPrompt: string | null;
  messages: AnthropicMessage[];
} {
  const systemParts: string[] = [];
  const out: AnthropicMessage[] = [];

  // Anthropic rejects a tool_use block with no matching tool_result (and vice
  // versa) just like the OpenAI-compatible wire format; drop dangling pairs
  // from a resumed/interrupted history before mapping. See ./tool-pairing.
  for (const m of pairToolMessages(input)) {
    if (m.role === 'system') {
      if (m.content) systemParts.push(contentToText(m.content));
      continue;
    }
    if (m.role === 'user') {
      out.push(coalesceUser(m.content, out));
      continue;
    }
    if (m.role === 'assistant') {
      out.push(mapAssistant(m));
      continue;
    }
    if (m.role === 'tool') {
      // role:'tool' messages collapse into a single user message with
      // tool_result blocks. If the previous emitted message is already a
      // user message (i.e. we're aggregating multiple tool results in one
      // turn), append the block to it; otherwise start a fresh user msg.
      const block: AnthropicToolResultBlock = {
        type: 'tool_result',
        tool_use_id: m.toolCallId ?? '',
        content: contentToText(m.content),
      };
      const last = out[out.length - 1];
      if (last && last.role === 'user' && Array.isArray(last.content)) {
        last.content.push(block);
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

function compactUsage(inputTokens?: number, outputTokens?: number): ChatResponse['usage'] {
  const usage = {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
  };
  return Object.keys(usage).length > 0 ? usage : undefined;
}

function coalesceUser(content: ChatContent, out: AnthropicMessage[]): AnthropicMessage {
  void out;
  return { role: 'user', content: contentToAnthropicUserContent(content) };
}

function mapAssistant(m: { content: ChatContent; toolCalls?: ToolCall[] }): AnthropicMessage {
  if (!m.toolCalls || m.toolCalls.length === 0) {
    return { role: 'assistant', content: contentToText(m.content) };
  }
  const blocks: AnthropicRequestBlock[] = [];
  const text = contentToText(m.content);
  if (text) blocks.push({ type: 'text', text });
  for (const tc of m.toolCalls) {
    let input: Record<string, unknown> = {};
    if (tc.arguments) {
      try {
        const parsed = JSON.parse(tc.arguments);
        if (parsed && typeof parsed === 'object') input = parsed as Record<string, unknown>;
      } catch {
        // Anthropic requires a JSON object — fall back to wrapping.
        input = { __raw: tc.arguments };
      }
    }
    blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input });
  }
  return { role: 'assistant', content: blocks };
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

function contentToAnthropicUserContent(content: ChatContent): string | AnthropicRequestBlock[] {
  if (typeof content === 'string') return content;
  const blocks: AnthropicRequestBlock[] = [];
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

function mapToolChoice(tc: NonNullable<ChatRequest['toolChoice']>): unknown {
  if (tc === 'required') return { type: 'any' };
  if (tc === 'none') return { type: 'none' };
  if (typeof tc === 'object' && 'name' in tc) return { type: 'tool', name: tc.name };
  return { type: 'auto' };
}

function mapStopReason(s: AnthropicResponse['stop_reason']): FinishReason | undefined {
  if (!s) return undefined;
  if (s === 'tool_use') return 'tool_calls';
  if (s === 'max_tokens') return 'length';
  // 'end_turn' and 'stop_sequence' both map to 'stop'.
  return 'stop';
}

function ensureObjectSchema(p: Record<string, unknown>): Record<string, unknown> {
  // Anthropic requires input_schema to be a JSON Schema object.
  // zod-to-json-schema gives us exactly that — pass through. Some models
  // dislike `$schema` / `additionalProperties:false`; we leave them alone
  // for now and revisit if we hit a 400.
  return p;
}
