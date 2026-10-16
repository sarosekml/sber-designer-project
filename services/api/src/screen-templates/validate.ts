import type { AgentKitDiagnostic, ScreenTemplate } from '@sber-designer/shared-types';

export interface ValidateScreenTemplateOptions {
  /** Indexed components for binding resolution; omit to skip index checks. */
  components?: { id: string; shortName: string }[] | null;
}

/**
 * Quality gate for `*.screen.md` templates (0080 1.5). Runs on top of the
 * parse-level diagnostics: parse rejects malformed files, this lint defines
 * the "ideal state" — structure consistency, role/binding resolution against
 * the index, and state coverage. Applies to built-ins and project templates;
 * generated templates must pass it before `draft → confirmed` promotion.
 */
export function validateScreenTemplate(
  template: ScreenTemplate,
  options: ValidateScreenTemplateOptions = {},
): AgentKitDiagnostic[] {
  const diagnostics: AgentKitDiagnostic[] = [];
  const path = template.filePath ?? `screen-template:${template.source}/${template.id}`;
  const body = template.content;

  const roles = (template.componentRoles ?? []).map((role) => role.role);
  if (roles.length === 0) {
    diagnostics.push({
      level: 'warning',
      code: 'screen_template_no_roles',
      message: `Template "${template.id}" declares no componentRoles; the agent gets no slot contract to resolve.`,
      path,
    });
  }

  const regionNames = extractRegionNames(body);
  if (hasSection(body, 'regions') && regionNames.length === 0) {
    diagnostics.push({
      level: 'warning',
      code: 'screen_template_missing_regions_list',
      message: `Template "${template.id}" has a "## Regions" section without "- **Region**" bullets.`,
      path,
    });
  }
  if (template.layoutSchema) {
    for (const region of regionNames) {
      if (!containsLoose(template.layoutSchema, region)) {
        diagnostics.push({
          level: 'warning',
          code: 'screen_template_region_not_in_layout',
          message: `Template "${template.id}": region "${region}" is listed under "## Regions" but does not appear in the ASCII layout schema.`,
          path,
        });
      }
    }
  }

  const bodyLower = body.toLowerCase();
  for (const role of roles) {
    if (!bodyLower.includes(role.toLowerCase())) {
      diagnostics.push({
        level: 'warning',
        code: 'screen_template_role_not_described',
        message: `Template "${template.id}": role "${role}" is declared in frontmatter but never mentioned in the body (Regions/guidance).`,
        path,
      });
    }
  }

  for (const binding of template.componentBindings ?? []) {
    if (roles.length > 0 && !roles.includes(binding.role)) {
      diagnostics.push({
        level: 'error',
        code: 'screen_template_binding_unknown_role',
        message: `Template "${template.id}": componentBindings entry targets role "${binding.role}" which is not declared in componentRoles.`,
        path,
      });
    }
    if (options.components) {
      for (const ref of binding.components) {
        if (!resolvesAgainstIndex(ref, options.components)) {
          diagnostics.push({
            level: 'warning',
            code: 'screen_template_binding_unresolved',
            message: `Template "${template.id}": binding for role "${binding.role}" references "${ref}", which no longer resolves against the project index. Re-index or fix the binding.`,
            path,
          });
        }
      }
    }
  }

  const states = template.states ?? [];
  if (states.length > 0) {
    if (!hasSection(body, 'states')) {
      diagnostics.push({
        level: 'warning',
        code: 'screen_template_state_uncovered',
        message: `Template "${template.id}" declares states [${states.join(', ')}] but has no "## States" section.`,
        path,
      });
    } else {
      const statesSection = sectionText(body, 'states').toLowerCase();
      for (const state of states) {
        if (!statesSection.includes(state.toLowerCase())) {
          diagnostics.push({
            level: 'warning',
            code: 'screen_template_state_uncovered',
            message: `Template "${template.id}": declared state "${state}" is not covered in the "## States" section.`,
            path,
          });
        }
      }
    }
  }

  return diagnostics;
}

/** `- **Name** — purpose` bullets under `## Regions`. */
function extractRegionNames(body: string): string[] {
  const section = sectionText(body, 'regions');
  const names: string[] = [];
  for (const match of section.matchAll(/^\s*-\s+\*\*([^*]+)\*\*/gm)) {
    const name = match[1]?.trim();
    if (name) names.push(name);
  }
  return names;
}

function sectionText(body: string, section: string): string {
  const heading = new RegExp(`(^|\\n)##\\s+${section}\\b[^\\n]*\\n`, 'i').exec(body);
  if (!heading) return '';
  const start = heading.index + heading[0].length;
  const rest = body.slice(start);
  const next = /\n##\s+/.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function hasSection(body: string, section: string): boolean {
  return new RegExp(`(^|\\n)##\\s+${section}\\b`, 'i').test(body);
}

/** Loose match: "Page header" should match "PageHeader: title · actions". */
function containsLoose(haystack: string, needle: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return normalize(haystack).includes(normalize(needle));
}

function resolvesAgainstIndex(
  ref: string,
  components: { id: string; shortName: string }[],
): boolean {
  const trimmed = ref.trim();
  if (!trimmed) return false;
  if (components.some((component) => component.id === trimmed)) return true;
  return components.filter((component) => component.shortName === trimmed).length === 1;
}
