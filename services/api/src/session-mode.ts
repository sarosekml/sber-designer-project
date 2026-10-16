import {
  normalizeAssistantSessionMode,
  type AssistantSessionMode,
} from '@sber-designer/shared-types';

import type { ServerTool } from './agent/types';

export const PLAN_DOCS_DIR = '.sber-designer/plans';

export const ASK_MODE_OVERRIDE = `# Ask session mode — read-only conversation

This block overrides any conflicting instruction below for this turn.

- Answer questions, review the current project, compare approaches, and explain design decisions.
- Use the available read-only tools when project evidence is needed.
- Do not create, edit, rename, or delete files and do not change editor state.
- If the user asks for a substantial implementation, answer briefly and suggest switching to Design, or to Plan when they want a reviewable brief first.
- Keep the answer concise and do not start a discovery interview unless the user asks for one.`;

export const PLAN_MODE_OVERRIDE = `# Plan session mode — editable plan document first

This block overrides any conflicting instruction below for this turn.

- Do not create or edit screens, components, stories, styles, flows, or project source files.
- The only writable artifact is one Markdown plan under \`.sber-designer/plans/\`.
- Build the screen or flow structure from the brief first: regions, data, actions, navigation, states, constraints, and acceptance checks.
- Use project-index search and component evidence to propose component roles and exact project component ids when confidence is sufficient. Do not hydrate or assume final variants here; Design revalidates the component map, selects exact contracts, and resolves variants before implementation.
- Mark design-system gaps and unresolved choices as open questions instead of inventing components or APIs.
- Create a new \`NNNN-<slug>.plan.md\` only when no relevant plan exists; otherwise update the existing plan in place.
- End by naming the plan path and invite the user to review it. Do not implement the final artifact in this turn.`;

const DESIGN_MODE_MARKER = `# Design session mode

Create or change the requested project artifact using the full generation pipeline. Chat session mode is \`design\`; this is separate from the canvas Interact / Design / Code mode.`;

const READ_ONLY_TOOL_NAMES = new Set([
  'read_file',
  'get_project_index_status',
  'get_project_structure_report',
  'search_project_index',
  'get_indexed_component',
  'get_usage_card',
  'list_undescribed_components',
  'get_component_description_source',
  'list_patterns',
  'get_pattern',
  'get_indexed_token',
  'get_indexed_asset',
  'get_indexed_icon',
  'list_indexed_screens',
  'list_design_context',
  'list_components',
  'list_screen_templates',
  'read_screen_template',
  'list_project_templates',
  'get_selection',
  'validate_design_screen',
  'validate_screen_craft',
  'list_product_mcp_tools',
  'list_agent_skills',
  'list_agent_knowledge',
  'read_agent_knowledge',
  'list_agent_scripts',
  'load_agent_skill',
]);

// `apply_patch` is an AST/source tool and does not support Markdown safely.
// Plan updates reread the document and replace it through `write_file`.
const PLAN_WRITE_TOOL_NAMES = new Set(['write_file']);

export function sessionModePromptSection(mode: AssistantSessionMode | null | undefined): string {
  const resolved = normalizeAssistantSessionMode(mode);
  if (resolved === 'ask') return ASK_MODE_OVERRIDE;
  if (resolved === 'plan') return PLAN_MODE_OVERRIDE;
  return DESIGN_MODE_MARKER;
}

export function filterToolsForSessionMode(
  tools: readonly ServerTool[],
  mode: AssistantSessionMode | null | undefined,
): ServerTool[] {
  const resolved = normalizeAssistantSessionMode(mode);
  if (resolved === 'design') return [...tools];
  return tools.filter(
    (tool) =>
      READ_ONLY_TOOL_NAMES.has(tool.name) ||
      (resolved === 'plan' && PLAN_WRITE_TOOL_NAMES.has(tool.name)),
  );
}

export function isPlanDocumentPath(path: string): boolean {
  const normalized = path.replace(/\\/gu, '/').replace(/^\.\//u, '');
  if (normalized.split('/').includes('..')) return false;
  return normalized.startsWith(`${PLAN_DOCS_DIR}/`) && /\.md$/iu.test(normalized);
}

export function sessionModeEnforcementForRuntime(input: {
  sessionMode: AssistantSessionMode;
  targetKind: 'api' | 'cli';
}): 'native' | 'promptOnly' {
  return input.targetKind === 'api' ? 'native' : 'promptOnly';
}
