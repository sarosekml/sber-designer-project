import type { AgentKitAgent } from '@sber-designer/shared-types';
import type { LoadedAgentKit } from './loader';

export type ResolveRequestedAgentResult =
  | { ok: true; agent: AgentKitAgent }
  | {
      ok: false;
      code: 'agent_not_found' | 'agent_not_invokable' | 'agent_hidden';
      detail: string;
    };

export function resolvePrimaryAgent(
  kit: Pick<LoadedAgentKit, 'defaultAgent' | 'agents'>,
  requestedAgentName: string | undefined,
): ResolveRequestedAgentResult {
  if (!requestedAgentName) return { ok: true, agent: kit.defaultAgent };

  const agent = kit.agents.find((candidate) => candidate.name === requestedAgentName);
  if (!agent) return agentNotFound(requestedAgentName);
  if (agent.hidden) return agentHidden(requestedAgentName);
  if (agent.mode !== 'primary' && agent.mode !== 'all') {
    return {
      ok: false,
      code: 'agent_not_invokable',
      detail: `Agent "${requestedAgentName}" is not a primary agent.`,
    };
  }
  return { ok: true, agent };
}

export function resolvePromptAgent(
  kit: Pick<LoadedAgentKit, 'defaultAgent' | 'agents'>,
  requestedAgentName: string | undefined,
): ResolveRequestedAgentResult {
  if (!requestedAgentName) return { ok: true, agent: kit.defaultAgent };

  const agent = kit.agents.find((candidate) => candidate.name === requestedAgentName);
  if (!agent) return agentNotFound(requestedAgentName);
  if (agent.hidden) return agentHidden(requestedAgentName);
  return { ok: true, agent };
}

export function resolveRequestedAgent(
  kit: Pick<LoadedAgentKit, 'defaultAgent' | 'agents'>,
  requestedAgentName: string | undefined,
): ResolveRequestedAgentResult {
  if (!requestedAgentName) return { ok: true, agent: kit.defaultAgent };

  const agent = kit.agents.find((candidate) => candidate.name === requestedAgentName);
  if (!agent) return agentNotFound(requestedAgentName);
  if (agent.hidden) return agentHidden(requestedAgentName);
  if (agent.mode !== 'subagent' && agent.mode !== 'all') {
    return {
      ok: false,
      code: 'agent_not_invokable',
      detail: `Agent "${requestedAgentName}" is not a subagent.`,
    };
  }
  return { ok: true, agent };
}

function agentNotFound(agentName: string): ResolveRequestedAgentResult {
  return {
    ok: false,
    code: 'agent_not_found',
    detail: `Agent "${agentName}" was not found.`,
  };
}

function agentHidden(agentName: string): ResolveRequestedAgentResult {
  return {
    ok: false,
    code: 'agent_hidden',
    detail: `Agent "${agentName}" is hidden.`,
  };
}
