import type {
  AgentKitPermission,
  AgentKitPermissionRule,
  AgentKitSkill,
  AgentPermissionPolicy,
  AgentPermissionSet,
} from '@sber-designer/shared-types';
import { HTML_DESIGN_SYSTEM_PATHS } from '@sber-designer/shared-types';
import type { ServerTool } from '../agent/types';

export const DEFAULT_AGENT_KIT_PERMISSION: AgentKitPermission = {
  '*': 'ask',
  read: 'allow',
  edit: 'ask',
  run_script: 'ask',
  load_skill: 'allow',
  send_pr: 'ask',
  set_mode: 'allow',
};

export const DEFAULT_AGENT_PERMISSION_POLICY: AgentPermissionPolicy = {
  tools: { allow: ['*'], deny: [] },
  skills: { allow: ['*'], deny: [] },
};

export interface AgentToolPermissionInput {
  toolName: string;
  input: unknown;
  permission?: AgentKitPermission;
}

export interface AgentToolPermissionDecision {
  action: 'allow' | 'ask' | 'deny';
  toolName: string;
  category: keyof AgentKitPermission | '*';
  resource: string;
  pattern: string;
  reasonCode?: 'active_screen_scope_auto_allow' | 'permission_denied' | 'permission_timeout';
}

export function resolveAgentKitPermission(
  ...layers: Array<Partial<AgentKitPermission> | undefined>
): AgentKitPermission {
  let resolved: AgentKitPermission = { ...DEFAULT_AGENT_KIT_PERMISSION };
  for (const layer of layers) {
    if (!layer) continue;
    resolved = mergeAgentKitPermissionLayer(resolved, layer);
  }
  return resolved;
}

export function resolveAgentToolPermission(
  input: AgentToolPermissionInput,
): AgentToolPermissionDecision {
  const permission = resolveAgentKitPermission(input.permission);
  const category = permissionCategoryForTool(input.toolName, input.input);
  const resources = resourcePatternsForTool(input.toolName, input.input);
  const rule = category === '*' ? undefined : permission[category];
  const fallback = permission['*'] ?? 'ask';
  const targets = resources.length > 0 ? resources : ['*'];
  const decisions = targets.map((resource) =>
    resolveRuleForResource({
      toolName: input.toolName,
      category,
      resource,
      rule,
      fallback,
    }),
  );
  return (
    decisions.find((decision) => decision.action === 'deny') ??
    decisions.find((decision) => decision.action === 'ask') ??
    decisions[0] ?? {
      action: fallback,
      toolName: input.toolName,
      category,
      resource: '*',
      pattern: '*',
    }
  );
}

export function resolveAgentPermissionPolicy(
  input: Partial<AgentPermissionPolicy>,
  defaults: Partial<AgentPermissionPolicy> = DEFAULT_AGENT_PERMISSION_POLICY,
): AgentPermissionPolicy {
  return {
    tools: mergePermissionSet(input.tools, defaults.tools),
    skills: mergePermissionSet(input.skills, defaults.skills),
  };
}

export function filterAgentTools(
  tools: ServerTool[],
  options: { policy: AgentPermissionPolicy },
): ServerTool[] {
  return tools.filter((tool) => isAllowedByPermissionSet(tool.name, options.policy.tools));
}

export function filterAgentSkills(
  skills: AgentKitSkill[],
  options: { policy: AgentPermissionPolicy },
): AgentKitSkill[] {
  return skills.filter((skill) => isAgentSkillAllowed(skill.name, options));
}

export function isAgentSkillAllowed(
  name: string,
  options: { policy: AgentPermissionPolicy },
): boolean {
  return isAllowedByPermissionSet(name, options.policy.skills);
}

function mergePermissionSet(
  input: AgentPermissionSet | undefined,
  defaults: AgentPermissionSet | undefined,
): AgentPermissionSet {
  return {
    allow: input?.allow ?? defaults?.allow ?? ['*'],
    deny: input?.deny ?? defaults?.deny ?? [],
  };
}

function isAllowedByPermissionSet(name: string, policy: AgentPermissionSet): boolean {
  const allowed = policy.allow.includes('*') || policy.allow.includes(name);
  if (!allowed) return false;
  return !policy.deny.includes(name);
}

function mergeAgentKitPermissionLayer(
  base: AgentKitPermission,
  layer: Partial<AgentKitPermission>,
): AgentKitPermission {
  const out: AgentKitPermission = { ...base };
  for (const [key, value] of Object.entries(layer) as Array<
    [keyof AgentKitPermission, AgentKitPermissionRule | undefined]
  >) {
    if (value === undefined) continue;
    const previous = out[key];
    if (isRuleObject(previous) && isRuleObject(value)) {
      out[key] = { ...previous, ...value } as never;
      continue;
    }
    out[key] = value as never;
  }
  return out;
}

function isRuleObject(value: unknown): value is Record<string, 'allow' | 'ask' | 'deny'> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function permissionCategoryForTool(
  toolName: string,
  input?: unknown,
): keyof AgentKitPermission | '*' {
  if (toolName === 'send_pr') return 'send_pr';
  if (toolName === 'set_mode') return 'set_mode';
  if (toolName === 'run_agent_script') return 'run_script';
  if (toolName === 'load_agent_skill') return 'load_skill';
  // 0083 UX-5: a project reindex only regenerates derived
  // .sber-designer/design-index artifacts (no source/screen edits). It is safe
  // and idempotent, so treat it as auto-allowed — no approval prompt mid-interview.
  if (toolName === 'request_project_reindex') return 'read';
  // 0112/0303: this only rewrites the managed design-system/index.html preview
  // from canonical html-first sources, then restores description projections
  // from sidecars. It should not interrupt description/component workflows.
  if (toolName === 'rebuild_design_system_preview') return 'read';
  // 0083 D2: the read-only interview tools are scoped to .sber-designer/components
  // (ranked queue, source read-back) — auto-allowed so the agent does not re-prompt.
  if (
    toolName === 'list_undescribed_components' ||
    toolName === 'get_component_description_source'
  ) {
    return 'read';
  }
  // 0083 R1 / 0112 P-1a: write_component_description is read-safe for the
  // canonical sidecar. Storybook/auto can mutate arbitrary CSF source, so they
  // stay edit-gated. The explicit design-system target is a managed preview
  // projection with marker-based merge, round-trip verification and revert,
  // matching rebuild_design_system_preview's trust class.
  if (toolName === 'write_component_description') {
    const target = asRecord(input)?.target;
    return target === 'storybook' || target === 'auto' ? 'edit' : 'read';
  }
  if (
    toolName === 'apply_patch' ||
    toolName === 'write_file' ||
    toolName === 'import_asset_pack' ||
    toolName === 'materialize_indexed_icon' ||
    toolName === 'apply_project_restructure' ||
    toolName === 'screen_create' ||
    toolName === 'screen_update' ||
    toolName === 'screen_remove' ||
    toolName === 'flow_add_edge' ||
    toolName === 'flow_remove_edge'
  ) {
    return 'edit';
  }
  if (
    toolName === 'read_file' ||
    toolName === 'list_components' ||
    toolName === 'list_screen_templates' ||
    toolName === 'read_screen_template' ||
    toolName === 'list_project_templates' ||
    toolName === 'list_design_context' ||
    toolName === 'get_project_index_status' ||
    toolName === 'get_project_structure_report' ||
    toolName === 'search_project_index' ||
    toolName === 'get_usage_card' ||
    toolName === 'update_component_selection' ||
    toolName === 'get_indexed_component' ||
    toolName === 'get_indexed_token' ||
    toolName === 'get_indexed_asset' ||
    toolName === 'get_indexed_icon' ||
    toolName === 'list_indexed_screens' ||
    toolName === 'validate_design_screen' ||
    toolName === 'validate_screen_craft' ||
    toolName === 'post_message' ||
    toolName === 'get_selection' ||
    toolName === 'list_product_mcp_tools' ||
    toolName === 'list_agent_skills' ||
    toolName === 'list_agent_knowledge' ||
    toolName === 'read_agent_knowledge' ||
    toolName === 'list_agent_scripts'
  ) {
    return 'read';
  }
  return '*';
}

function resourcePatternsForTool(toolName: string, input: unknown): string[] {
  const data = asRecord(input);
  if (!data) return ['*'];
  switch (toolName) {
    case 'apply_patch':
      return Array.from(
        new Set(
          Array.isArray(data.ops)
            ? data.ops
                .map((op) => asRecord(op)?.file)
                .filter((value): value is string => typeof value === 'string' && value.length > 0)
            : [],
        ),
      );
    case 'write_file':
    case 'read_file':
      return typeof data.path === 'string' ? [data.path] : ['*'];
    case 'load_agent_skill':
    case 'run_agent_script':
      return typeof data.name === 'string' ? [data.name] : ['*'];
    case 'read_screen_template':
      return typeof data.id === 'string' ? [data.id] : ['*'];
    case 'read_agent_knowledge':
      return typeof data.id === 'string' ? [data.id] : ['*'];
    case 'send_pr':
      return typeof data.branch === 'string' ? [data.branch] : ['send_pr'];
    case 'import_asset_pack':
      return typeof data.sourcePath === 'string' ? [`asset-pack:${data.sourcePath}`] : ['*'];
    case 'materialize_indexed_icon':
      return typeof data.iconId === 'string' ? [`indexed-icon:${data.iconId}`] : ['*'];
    case 'apply_project_restructure':
      return [`project-restructure:${String(data.planDigest ?? '*')}`];
    case 'set_mode':
      return typeof data.mode === 'string' ? [data.mode] : ['set_mode'];
    case 'screen_create':
      return typeof data.implementationFilePath === 'string'
        ? [data.implementationFilePath]
        : typeof data.filePath === 'string'
          ? [data.filePath]
          : ['.sber-designer/project.sdproj'];
    case 'screen_update':
      return ['.sber-designer/project.sdproj'];
    case 'screen_remove':
    case 'flow_add_edge':
    case 'flow_remove_edge':
      return ['.sber-designer/project.sdproj'];
    case 'write_component_description': {
      // 0083 R1: scope the resource so edit rules can target Storybook-source
      // and design-system projection writes specifically; sidecar stays read-safe.
      const id = typeof data.componentId === 'string' ? data.componentId : '*';
      if (data.target === 'storybook' || data.target === 'auto') return [`storybook-source:${id}`];
      if (data.target === 'design-system') return [HTML_DESIGN_SYSTEM_PATHS.previewHtml];
      return [`.sber-designer/components/${id}.md`];
    }
    case 'rebuild_design_system_preview':
      return [HTML_DESIGN_SYSTEM_PATHS.previewHtml];
    default:
      return ['*'];
  }
}

function resolveRuleForResource(input: {
  toolName: string;
  category: keyof AgentKitPermission | '*';
  resource: string;
  rule: AgentKitPermissionRule | undefined;
  fallback: 'allow' | 'ask' | 'deny';
}): AgentToolPermissionDecision {
  if (!input.rule) {
    return {
      action: input.fallback,
      toolName: input.toolName,
      category: input.category,
      resource: input.resource,
      pattern: '*',
    };
  }
  if (!isRuleObject(input.rule)) {
    return {
      action: input.rule,
      toolName: input.toolName,
      category: input.category,
      resource: input.resource,
      pattern: '*',
    };
  }
  const matched = bestMatchingRule(input.rule, input.resource);
  return {
    action: matched?.action ?? input.fallback,
    toolName: input.toolName,
    category: input.category,
    resource: input.resource,
    pattern: matched?.pattern ?? '*',
  };
}

function bestMatchingRule(
  rules: Record<string, 'allow' | 'ask' | 'deny'>,
  resource: string,
): { pattern: string; action: 'allow' | 'ask' | 'deny' } | null {
  let best: { pattern: string; action: 'allow' | 'ask' | 'deny' } | null = null;
  for (const [pattern, action] of Object.entries(rules)) {
    if (!matchesPermissionPattern(pattern, resource)) continue;
    if (!best || pattern.length > best.pattern.length) {
      best = { pattern, action };
    }
  }
  return best;
}

function matchesPermissionPattern(pattern: string, resource: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return resource === prefix || resource.startsWith(`${prefix}/`);
  }
  if (pattern.includes('*')) {
    const regexp = new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`);
    return regexp.test(resource);
  }
  return pattern === resource;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
