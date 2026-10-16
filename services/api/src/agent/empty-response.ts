import type { ChatMessage, ChatResponse } from '@sber-designer/llm-gateway';

export const EMPTY_ASSISTANT_RETRY_LIMIT = 2;

export function isEmptyAssistantResponse(input: {
  text: string | null | undefined;
  toolCallCount: number;
}): boolean {
  return input.toolCallCount === 0 && !input.text?.trim();
}

export function canRetryEmptyAssistantResponse(input: {
  retries: number;
  iteration: number;
  maxIterations: number;
}): boolean {
  return input.retries < EMPTY_ASSISTANT_RETRY_LIMIT && input.iteration < input.maxIterations;
}

export function emptyAssistantRetryMessage(): ChatMessage {
  return {
    role: 'system',
    content: [
      'Runtime guard: the previous assistant turn was empty.',
      'Continue the same user request now. If work remains, call the appropriate tool instead of stopping.',
      'If the work is complete, respond with a concise non-empty summary. Do not restart from scratch.',
    ].join(' '),
  };
}

export function emptyAssistantFallbackResponse(
  response: ChatResponse | null | undefined,
): ChatResponse {
  return {
    text: [
      'The model returned an empty response before completing the task.',
      'Please retry the request or switch to another model.',
    ].join(' '),
    provider: response?.provider ?? '',
    model: response?.model ?? '',
    finishReason: response?.finishReason ?? 'other',
    ...(response?.usage ? { usage: response.usage } : {}),
  };
}
