/**
 * Streaming mock — emits text deltas word-by-word so the agent loop
 * and the editor have something to render in tests when no live
 * provider is reachable. The `<call:tool>{json}</call>` directive
 * still works: the mock will skip text deltas and emit a single
 * tool-call event, mirroring real providers.
 */
import { mockChat } from './mock';
import type { ChatRequest } from '../chat';
import type { ChatStreamEvent } from '../stream';

export async function* mockChatStream(
  req: ChatRequest,
  active: { provider: string; model: string },
): AsyncGenerator<ChatStreamEvent> {
  const final = await mockChat(req, active);

  if (final.toolCalls && final.toolCalls.length > 0) {
    for (const call of final.toolCalls) {
      yield { type: 'tool-call', call };
    }
    yield { type: 'done', final };
    return;
  }

  // Tokenise on whitespace, preserving spaces. Yield each word with a
  // trailing space so the rendered output reads naturally.
  const tokens = final.text.split(/(\s+)/);
  for (const tok of tokens) {
    if (!tok) continue;
    yield { type: 'text-delta', delta: tok };
    // Cooperative yield so async tests don't block on the synchronous loop.
    await Promise.resolve();
  }

  yield { type: 'done', final };
}
