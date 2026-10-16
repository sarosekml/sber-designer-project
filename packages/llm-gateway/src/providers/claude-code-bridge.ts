import type { ChatRequest, ChatResponse } from '../chat';

/**
 * Pseudo-provider that does NOT call any LLM. It exists so the editor
 * Settings UI can present "Claude Code (external)" as a model choice.
 *
 * When this provider is active, the chat panel must NOT call
 * `gateway.chat()` — instead it shows a "Connect your Claude Code" panel
 * with a snippet of `claude mcp add ...`. The actual conversation happens
 * inside the user's Claude Code; sber-designer sees only the side effects
 * (tool calls into proj-mcp) and the chat transcript pushed back via
 * `editor_post_message`.
 *
 * If something does call into here it's a bug — we throw a clear error.
 *
 * See ADR-0006.
 */
export async function claudeCodeBridgeChat(
  _req: ChatRequest,
  active: { provider: string; model: string },
): Promise<ChatResponse> {
  throw new Error(
    `Provider "${active.provider}" is a Claude Code bridge — chat() must not be called for it. ` +
      `The UI should route conversation through the user's external Claude Code via proj-mcp instead.`,
  );
}
