/** Project agent kit (.agents) inventory, reload and bootstrap. */
import type {
  AgentKitAgent,
  AgentKitDiagnostic,
  AgentKitKnowledgeResource,
  AgentKitScript,
  AgentKitSkill,
  AgentKitSource,
} from '@sber-designer/shared-types';

import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';

export interface AgentKitInventory {
  defaultAgent: Omit<AgentKitAgent, 'body'>;
  agents: Array<Omit<AgentKitAgent, 'body'>>;
  instructions: { path: string; source: AgentKitSource; sizeBytes: number }[];
  skills: AgentKitSkill[];
  knowledge: AgentKitKnowledgeResource[];
  scripts: AgentKitScript[];
  diagnostics: AgentKitDiagnostic[];
  defaultRoot: string;
  workspaceRoot: string | null;
  workspaceKitExists: boolean;
}

export interface AgentKitBootstrapResult {
  ok: true;
  workspaceRoot: string;
  createdPaths: string[];
  gitIgnored: boolean;
  warning?: string;
}

export async function fetchAgentKit(signal?: AbortSignal): Promise<AgentKitInventory> {
  const res = await fetch(
    `${API_URL}/api/agent-kit`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as AgentKitInventory;
}

export async function reloadAgentKit(signal?: AbortSignal): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/agent-kit/reload`,
    withSignal({ method: 'POST', headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
}

export async function bootstrapAgentKit(signal?: AbortSignal): Promise<AgentKitBootstrapResult> {
  const res = await fetch(
    `${API_URL}/api/agent-kit/bootstrap`,
    withSignal({ method: 'POST', headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as AgentKitBootstrapResult;
}

// ---------- /api/tasks (task 001 autonomous mode) ----------
