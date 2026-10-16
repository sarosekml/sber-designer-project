export interface ComponentGapRepairRequest {
  role: string;
  reason: string;
}

const DESIGN_SYSTEM_GAP_RULE = 'craft.component-reuse.design-system-gap';

export function componentGapRepairFromToolResult(
  toolName: string,
  resultContent: string,
): ComponentGapRepairRequest | null {
  if (!['apply_patch', 'validate_screen_craft', 'write_file'].includes(toolName)) return null;
  const result = parseObject(resultContent);
  if (!result) return null;
  const craft = toolName === 'validate_screen_craft' ? result : objectValue(result.craft);
  if (!craft || !Array.isArray(craft.findings)) return null;
  for (const finding of craft.findings) {
    const record = objectValue(finding);
    if (!record || record.ruleId !== DESIGN_SYSTEM_GAP_RULE) continue;
    const reason =
      typeof record.message === 'string'
        ? record.message
        : 'A required design-system role has no selected component.';
    const role =
      typeof record.componentRole === 'string'
        ? record.componentRole
        : /Required role\s+([^\s.,;]+)/iu.exec(reason)?.[1];
    if (role) return { role, reason };
  }
  return null;
}

export function componentGapRepairNudge(request: ComponentGapRepairRequest): string {
  return `[sber-designer · auto] One bounded design-system readiness repair is required for role ${request.role}. Call search_project_index with types=["component"] for that role, call get_usage_card for the selected component, call update_component_selection with action="add" and role="${request.role}", then patch the active screen and validate once. Do not repeat this retrieve → hydrate → repair loop.`;
}

function parseObject(value: string): Record<string, unknown> | null {
  try {
    return objectValue(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
