/**
 * Streaming chat events. Mirrors what every modern provider emits
 * (OpenAI Chat Completions SSE, Anthropic Messages SSE), normalised
 * to one shape so the agent loop and the editor don't care which
 * provider produced them.
 *
 * `chatStream(req)` returns an AsyncIterable<ChatStreamEvent>. The
 * generator finishes after a `done` event; on transport errors it
 * emits `error` and finishes too — never throws after the iterator
 * has started.
 */

import type { ChatRequest, ChatResponse, ToolCall } from './chat';
import type { ProviderErrorCategory } from './provider-error';

export type ChatStreamEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'tool-call'; call: ToolCall }
  | { type: 'done'; final: ChatResponse }
  | {
      type: 'error';
      message: string;
      /**
       * Optional structured metadata for HTTP/network failures (0139).
       * `message` stays the only required field — existing consumers keep
       * working; new ones can branch on category/providerCode instead of
       * parsing the message.
       */
      status?: number;
      providerCode?: string;
      providerMessage?: string;
      category?: ProviderErrorCategory;
      retryable?: boolean;
    };

export interface ChatStreamer {
  chatStream(req: ChatRequest): AsyncIterable<ChatStreamEvent>;
}
