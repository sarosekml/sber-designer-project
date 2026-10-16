import type { ChatContent, ChatMessage, ChatRequest, LlmGateway } from '@sber-designer/llm-gateway';

import type { AgentStreamEvent } from '../../agent/stream';

export function createExternalDesignJuryGateway(input: {
  provider: string;
  model: string;
  run: (prompt: string) => AsyncIterable<AgentStreamEvent>;
}): LlmGateway {
  return {
    active: { provider: input.provider, model: input.model },
    listVisibleModels: () => [],
    chat: async (request) => {
      const done = await collectExternalDesignJuryDone(input.run(renderChatRequest(request)));
      return done.finalResponse;
    },
    chatStream: async function* () {
      yield {
        type: 'error',
        message: 'External Design Jury uses non-streaming review turns.',
      };
    },
  };
}

export async function collectExternalDesignJuryDone(
  events: AsyncIterable<AgentStreamEvent>,
  onEvent?: (event: AgentStreamEvent) => Promise<void> | void,
): Promise<Extract<AgentStreamEvent, { type: 'done' }>> {
  let done: Extract<AgentStreamEvent, { type: 'done' }> | null = null;
  for await (const event of events) {
    if (event.type === 'error') throw new Error(event.message);
    if (event.type === 'done') {
      done = event;
      continue;
    }
    await onEvent?.(event);
  }
  if (!done) throw new Error('External Design Jury turn ended before a done event.');
  return done;
}

export function renderChatMessages(messages: readonly ChatMessage[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}:\n${renderChatContent(message.content)}`)
    .join('\n\n');
}

function renderChatRequest(request: ChatRequest): string {
  return [
    'This is an internal Design Jury review turn in the current sber-designer run.',
    'Do not edit files, call tools, or continue the implementation. Return only the requested JSON.',
    '',
    renderChatMessages(request.messages),
  ].join('\n');
}

function renderChatContent(content: ChatContent): string {
  if (typeof content === 'string') return content;
  return content
    .map((part) => (part.type === 'text' ? part.text : `[image: ${part.image_url.url}]`))
    .join('\n');
}
