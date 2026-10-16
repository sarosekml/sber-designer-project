/**
 * Common chat interface every provider adapter implements.
 *
 * Phase 2.2: tool-calling shape mirrors OpenAI Chat Completions
 * (https://platform.openai.com/docs/guides/function-calling). GigaChat,
 * vLLM, DeepSeek, Together AI, llama.cpp, LM Studio — all OpenAI-compatible
 * providers — accept the same `tools` field. Anthropic gets its native
 * adapter in Phase 2.4. See ADR-0014.
 */

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for inputs. */
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  /** Stable id correlating call → result. */
  id: string;
  name: string;
  /** JSON-serialised arguments object — the model produced this string. */
  arguments: string;
}

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

export type ChatContent = string | ChatContentPart[];

export interface ChatMessage {
  role: ChatRole;
  content: ChatContent;
  /** Present on assistant messages where the model asked for tools. */
  toolCalls?: ToolCall[];
  /** Present on role:'tool' messages — links the result to the originating call. */
  toolCallId?: string;
}

export type ToolChoice = 'auto' | 'required' | 'none' | { name: string };

export interface ChatRequest {
  messages: ChatMessage[];
  /** Provider-side tools the model may invoke. Omit for plain chat. */
  tools?: ToolSpec[];
  /** Steers tool usage. Defaults to "auto" when tools are present. */
  toolChoice?: ToolChoice;
  /** Optional override; falls back to the active default in the gateway. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Abort the provider request when the caller cancels an agent run. */
  signal?: AbortSignal;
}

export type FinishReason = 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'other';

export interface ChatResponse {
  /** Final assistant text. May be empty when the response is purely tool_calls. */
  text: string;
  /** Populated when the model wants tools to run. */
  toolCalls?: ToolCall[];
  finishReason?: FinishReason;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  /** Echoed back so callers can audit which (provider, model) actually answered. */
  provider: string;
  /** The requested model id, as resolved by the gateway. */
  model: string;
  /**
   * Provider-reported model id from the response body, when present. `model`
   * is what we asked for; `responseModel` is what the provider says answered
   * (may differ through server-side aliases). Absence is not verification of
   * anything — callers must keep the two ids separate (0139).
   */
  responseModel?: string;
}

export interface LlmGateway {
  /**
   * Run a chat completion. Throws on provider error — callers handle
   * retry / fallback.
   */
  chat(req: ChatRequest): Promise<ChatResponse>;
  /**
   * Stream a chat completion. Yields ChatStreamEvent values until the
   * provider closes the stream. Errors land as `{ type: 'error' }`
   * events; the iterator never throws after it has started yielding.
   * See ./stream.ts.
   */
  chatStream(req: ChatRequest): AsyncIterable<import('./stream').ChatStreamEvent>;
  /** Active default — usable as a label in UI. */
  active: { provider: string; model: string };
  /** All visible (provider, model) pairs after admin-restrict. */
  listVisibleModels(): { provider: string; model: string; label: string }[];
}
