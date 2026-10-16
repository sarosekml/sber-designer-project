export interface MentionableAgent {
  name: string;
  mode?: string;
  hidden?: boolean;
}

export interface ParsedAgentMention {
  agent: string;
  content: string;
}

const LEADING_MENTION_RE = /^@([a-z0-9]+(?:-[a-z0-9]+)*)(?:\s+([\s\S]*))?$/;
const ACTIVE_QUERY_RE = /(^|\s)@([a-z0-9-]*)$/;

export function parseLeadingAgentMention(content: string): ParsedAgentMention | null {
  const match = LEADING_MENTION_RE.exec(content.trim());
  if (!match) return null;
  return {
    agent: match[1]!,
    content: (match[2] ?? '').trimStart(),
  };
}

export function suggestAgentMentions<TAgent extends MentionableAgent>(
  draft: string,
  agents: readonly TAgent[],
): TAgent[] {
  const query = activeMentionQuery(draft);
  if (query === null) return [];
  return agents
    .filter(isVisibleAgent)
    .filter((agent) => agent.name.startsWith(query))
    .slice(0, 8);
}

export function applyAgentMentionSuggestion(draft: string, agentName: string): string {
  return draft.replace(ACTIVE_QUERY_RE, (_match, prefix: string) => `${prefix}@${agentName} `);
}

export function clearActiveAgentMentionQuery(draft: string): string {
  return draft.replace(ACTIVE_QUERY_RE, '$1').trimEnd();
}

export function cyclePrimaryAgent<TAgent extends MentionableAgent>(
  agents: readonly TAgent[],
  currentAgentName: string | null | undefined,
  direction: 1 | -1 = 1,
): TAgent | null {
  const primaryAgents = agents.filter(
    (agent) => isVisibleAgent(agent) && (agent.mode === 'primary' || agent.mode === 'all'),
  );
  if (primaryAgents.length === 0) return null;
  const currentIndex = primaryAgents.findIndex((agent) => agent.name === currentAgentName);
  const nextIndex =
    currentIndex === -1
      ? 0
      : (currentIndex + direction + primaryAgents.length) % primaryAgents.length;
  return primaryAgents[nextIndex] ?? null;
}

export function activeMentionQuery(draft: string): string | null {
  const match = ACTIVE_QUERY_RE.exec(draft);
  return match ? match[2]! : null;
}

function isVisibleAgent(agent: MentionableAgent): boolean {
  return !agent.hidden;
}
