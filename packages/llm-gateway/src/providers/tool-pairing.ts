/**
 * OpenAI-compatible providers (DeepSeek, GigaChat, vLLM, llama.cpp, …) reject a
 * request when an assistant message carrying `tool_calls` is not immediately
 * followed by one `tool` message per `tool_call_id`:
 *
 *   HTTP 400 "An assistant message with 'tool_calls' must be followed by tool
 *   messages responding to each 'tool_call_id'."
 *
 * A persisted or continued conversation can arrive with such dangling calls —
 * e.g. an agent run paused at the iteration cap right after the model asked for
 * a tool but before the result was recorded, then resumed ("Continue run") with
 * the unresolved call still in history. The model never gets a chance to make
 * progress because the very first request of the resumed run is rejected.
 *
 * `pairToolMessages` makes any message array safe to send:
 *  - an assistant `tool_calls` entry with no matching following `tool` result is
 *    stripped from that message (the message survives as plain assistant text,
 *    or is dropped entirely if it then carries no content);
 *  - a `tool` message whose `tool_call_id` matches no assistant call is dropped
 *    as an orphan result.
 *
 * Well-formed histories pass through unchanged (same references).
 */
import type { ChatMessage } from '../chat';

export function pairToolMessages(messages: ChatMessage[]): ChatMessage[] {
  // tool_call ids that actually have a result message in this history.
  const satisfied = new Set<string>();
  // tool_call ids that some assistant message actually declared.
  const declared = new Set<string>();
  for (const m of messages) {
    if (m.role === 'tool' && m.toolCallId) satisfied.add(m.toolCallId);
    if (m.role === 'assistant' && m.toolCalls) {
      for (const call of m.toolCalls) declared.add(call.id);
    }
  }

  let changed = false;
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      if (m.toolCallId && declared.has(m.toolCallId)) {
        out.push(m);
      } else {
        changed = true; // drop orphan result
      }
      continue;
    }

    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      const kept = m.toolCalls.filter((call) => satisfied.has(call.id));
      if (kept.length === m.toolCalls.length) {
        out.push(m);
      } else if (kept.length > 0) {
        changed = true;
        out.push({ ...m, toolCalls: kept });
      } else {
        // No result for any call — keep only the assistant prose, if any.
        changed = true;
        const { toolCalls: _dropped, ...rest } = m;
        if (hasContent(rest.content)) out.push(rest);
      }
      continue;
    }

    out.push(m);
  }

  return changed ? out : messages;
}

function hasContent(content: ChatMessage['content']): boolean {
  if (typeof content === 'string') return content.trim().length > 0;
  return content.length > 0;
}
