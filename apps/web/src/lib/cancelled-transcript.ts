import type { ChatMessage } from '@/stores/chat-store';

export function settleCancelledToolCalls(
  messages: ChatMessage[],
  options: { afterMessageId?: string | undefined; now?: string | undefined } = {},
): ChatMessage[] {
  const startIndex = options.afterMessageId
    ? Math.max(0, messages.findIndex((message) => message.id === options.afterMessageId) + 1)
    : 0;
  const settledCallIds = new Set(
    messages
      .filter((message) => message.role === 'tool' && message.toolCallId)
      .map((message) => message.toolCallId!),
  );
  const cancelledResults: ChatMessage[] = [];
  const now = options.now ?? new Date().toISOString();

  for (const message of messages.slice(startIndex)) {
    if (message.role !== 'assistant') continue;
    for (const call of message.toolCalls ?? []) {
      if (settledCallIds.has(call.id)) continue;
      settledCallIds.add(call.id);
      cancelledResults.push({
        id: `${message.id}-cancelled-${call.id}`,
        role: 'tool',
        toolCallId: call.id,
        content: JSON.stringify({
          status: 'cancelled',
          detail: 'Cancelled before this tool completed.',
        }),
        createdAt: now,
        contextEligible: false,
        metadata: { toolTerminalStatus: 'cancelled' },
      });
    }
  }

  return cancelledResults.length > 0 ? [...messages, ...cancelledResults] : messages;
}
