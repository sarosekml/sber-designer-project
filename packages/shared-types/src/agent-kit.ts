/** Project-local agent kit (.agents) shapes. */

export type AgentKitSource = 'default' | 'personal' | 'workspace';
export type AgentKitDiagnosticLevel = 'info' | 'warning' | 'error';

export interface AgentKitDiagnostic {
  level: AgentKitDiagnosticLevel;
  code: string;
  message: string;
  path?: string;
}

export interface AgentPermissionSet {
  allow: string[];
  deny: string[];
}

export interface AgentPermissionPolicy {
  tools: AgentPermissionSet;
  skills: AgentPermissionSet;
}

export type AgentKitPermissionAction = 'allow' | 'ask' | 'deny';
export type AgentKitPermissionRule =
  | AgentKitPermissionAction
  | Record<string, AgentKitPermissionAction>;

export interface AgentKitPermission {
  read?: AgentKitPermissionRule | undefined;
  edit?: AgentKitPermissionRule | undefined;
  run_script?: AgentKitPermissionRule | undefined;
  load_skill?: AgentKitPermissionRule | undefined;
  send_pr?: AgentKitPermissionAction | undefined;
  set_mode?: AgentKitPermissionAction | undefined;
  '*'?: AgentKitPermissionAction | undefined;
}

export interface AgentKitAgent {
  name: string;
  description: string;
  mode: 'primary' | 'subagent' | 'all';
  hidden: boolean;
  path: string;
  source: AgentKitSource;
  body: string;
  permissionPolicy: AgentPermissionPolicy;
  permission: AgentKitPermission;
  temperature?: number;
  maxIterations?: number;
}

export interface AgentKitSkill {
  name: string;
  description: string;
  path: string;
  source: AgentKitSource;
  license?: string;
  compatibility?: string;
  profiles?: string[];
  craftRequires?: string[];
  critiquePolicy?: 'required' | 'opt-in' | 'opt-out';
  /**
   * SKILL.md body (frontmatter stripped). Carried for inlining into external
   * runtime handoffs where the .agents/ path is not readable (0083 section A).
   * Stripped from the lean `list_agent_skills` tool result.
   */
  body?: string;
}

export interface AgentKitKnowledgeResource {
  id: string;
  path: string;
  description: string;
  source: AgentKitSource;
  sizeBytes: number;
}

export interface AgentKitScript {
  name: string;
  description: string;
  command: string;
  args: string[];
  cwd: 'workspace' | 'agents';
  permission: 'allow' | 'ask' | 'deny';
  timeoutMs: number;
  source: AgentKitSource;
}
