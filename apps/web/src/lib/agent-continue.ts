export const CONTINUE_AGENT_RUN_MAX_ITERATIONS = 20;

export function buildContinueAgentRunPrompt(iterations: number | null): string {
  const turnText = iterations === null ? '' : ` after ${iterations} turns`;
  return [
    '[act-mode] Continue the previous agent run from the latest transcript state.',
    '',
    `The previous run hit the agent iteration limit${turnText}. Continue from the last visible tool result or assistant message, do not restart completed work, inspect current files only if needed, and finish with a concise summary.`,
  ].join('\n');
}
