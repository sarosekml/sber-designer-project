import { DESIGN_INDEX_PATHS } from './types';
import type {
  CompositionPatternRecord,
  DesignIndexDiagnostic,
  IndexedComponentRecord,
  ScreenTemplatePatternInput,
} from './types';

export interface CompiledPatterns {
  patterns: CompositionPatternRecord[];
  diagnostics: DesignIndexDiagnostic[];
}

/**
 * Compile `screen`-kind composition patterns from project screen templates
 * (0080 1.5). Templates are the human-authored source of truth; this compiled
 * form is what the component pack retrieves. Built-in templates stay role-only
 * and are served by the pack's universal fallback, so they do not compile.
 */
export function compileScreenTemplatePatterns(
  templates: ScreenTemplatePatternInput[],
  components: IndexedComponentRecord[],
): CompiledPatterns {
  const diagnostics: DesignIndexDiagnostic[] = [];
  const byId = new Map(components.map((component) => [component.id, component] as const));
  const byShortName = new Map<string, IndexedComponentRecord[]>();
  for (const component of components) {
    const list = byShortName.get(component.shortName) ?? [];
    list.push(component);
    byShortName.set(component.shortName, list);
  }

  const patterns: CompositionPatternRecord[] = [];
  for (const template of templates) {
    if (template.source !== 'project') continue;

    const bindingsByRole = new Map(
      (template.componentBindings ?? []).map((binding) => [binding.role, binding] as const),
    );
    const roles = new Map<string, { intent?: string }>();
    for (const role of template.componentRoles ?? []) {
      roles.set(role.role, role.intent ? { intent: role.intent } : {});
    }
    for (const binding of template.componentBindings ?? []) {
      if (!roles.has(binding.role)) roles.set(binding.role, {});
    }
    if (roles.size === 0) {
      diagnostics.push({
        level: 'warning',
        filePath: template.filePath ?? DESIGN_INDEX_PATHS.patterns,
        message: `Project template "${template.id}" declares no componentRoles/componentBindings; no pattern compiled.`,
      });
      continue;
    }

    const slots: CompositionPatternRecord['slots'] = [];
    for (const [role, meta] of roles) {
      const binding = bindingsByRole.get(role);
      const componentIds: string[] = [];
      for (const ref of binding?.components ?? []) {
        const resolved = resolveComponentRef(ref, byId, byShortName);
        if (resolved) {
          if (!componentIds.includes(resolved.id)) componentIds.push(resolved.id);
        } else {
          diagnostics.push({
            level: 'warning',
            filePath: template.filePath ?? DESIGN_INDEX_PATHS.patterns,
            message: `Template "${template.id}" binds role "${role}" to unknown component "${ref}". Re-index or fix the binding.`,
          });
        }
      }
      slots.push({
        role,
        required: true,
        componentIds,
        ...(binding?.preset ? { preset: binding.preset } : {}),
        ...(meta.intent ? { notes: [meta.intent] } : {}),
      });
    }

    patterns.push({
      id: `template-${template.id}`,
      kind: 'screen',
      name: template.name,
      description: template.description,
      slots,
      evidence: [
        { source: 'screen-template', ref: template.filePath ?? template.id },
        ...(template.evidence ?? []).map((ref) => ({
          source: 'reference-screen' as const,
          ref,
        })),
      ],
      status: 'confirmed',
    });
  }

  return {
    patterns: patterns.sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics,
  };
}

function resolveComponentRef(
  ref: string,
  byId: Map<string, IndexedComponentRecord>,
  byShortName: Map<string, IndexedComponentRecord[]>,
): IndexedComponentRecord | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  const direct = byId.get(trimmed);
  if (direct) return direct;
  const named = byShortName.get(trimmed);
  if (named && named.length === 1) return named[0] ?? null;
  return null;
}
