import { z } from 'zod';
import type {
  AgentKitDiagnostic,
  ModalDefaults,
  ModalLongContent,
  ProjectScreenSurface,
  ScreenTemplate,
  ScreenTemplateComponentBinding,
  ScreenTemplateComponentRole,
  ScreenTemplateKind,
  ScreenTemplateSource,
  ScreenTemplateStatus,
} from '@sber-designer/shared-types';
import { normalizeModalDefaults } from '@sber-designer/shared-types';

import { parseMarkdownFrontmatter } from '../agent-kit/schema';

const KNOWN_KINDS: readonly ScreenTemplateKind[] = [
  'dashboard',
  'list-table',
  'detail',
  'form',
  'settings',
  'custom',
];

const KNOWN_STATUSES: readonly ScreenTemplateStatus[] = ['draft', 'stable', 'deprecated'];

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Lenient frontmatter schema. Required: name + description. Unknown extra keys
 * are tolerated; advisory fields are coerced after parsing so a slightly-off
 * file still lists with a warning instead of failing.
 */
const ScreenTemplateFrontmatterSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    id: z.string().optional(),
    kind: z.string().optional(),
    surface: z.string().optional(),
    modalDefaults: z.record(z.unknown()).optional(),
    tags: z.array(z.union([z.string(), z.number()])).optional(),
    status: z.string().optional(),
    version: z.number().int().nonnegative().optional(),
    states: z.array(z.union([z.string(), z.number()])).optional(),
    componentRoles: z.array(z.unknown()).optional(),
    componentBindings: z.array(z.unknown()).optional(),
    evidence: z.array(z.union([z.string(), z.number()])).optional(),
    viewport: z.number().int().positive().optional(),
  })
  .passthrough();

export interface ParseScreenTemplateInput {
  source: ScreenTemplateSource;
  /** File name including extension, e.g. "deal.screen.md". */
  fileName: string;
  /** Raw file contents. */
  raw: string;
  /** Workspace-relative path for project templates; omitted for built-ins. */
  filePath?: string;
  /** Public path used in diagnostics. Defaults to filePath ?? fileName. */
  diagnosticPath?: string;
}

export interface ParseScreenTemplateResult {
  template?: ScreenTemplate;
  diagnostics: AgentKitDiagnostic[];
}

/**
 * Parse one `*.screen.md` file into a {@link ScreenTemplate}. Hard errors
 * (missing required field, bad id) skip the file and return no template;
 * soft issues (missing body sections, universality smells) return the template
 * plus warning diagnostics.
 */
export function parseScreenTemplateFile(
  input: ParseScreenTemplateInput,
): ParseScreenTemplateResult {
  const diagnostics: AgentKitDiagnostic[] = [];
  const path = input.diagnosticPath ?? input.filePath ?? input.fileName;
  const baseName = stripScreenSuffix(input.fileName);

  const { frontmatter, body } = parseMarkdownFrontmatter(input.raw);
  const parsed = ScreenTemplateFrontmatterSchema.safeParse(frontmatter);
  if (!parsed.success) {
    diagnostics.push({
      level: 'error',
      code: 'invalid_screen_template',
      message: `Invalid frontmatter: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`)
        .join('; ')}`,
      path,
    });
    return { diagnostics };
  }

  const fm = parsed.data;
  const id = (fm.id ?? slugify(baseName)).trim();
  if (!ID_PATTERN.test(id)) {
    diagnostics.push({
      level: 'error',
      code: 'invalid_screen_template_id',
      message: `Template id "${id}" must match ${ID_PATTERN}. Derived from ${fm.id ? 'frontmatter id' : 'file name'}.`,
      path,
    });
    return { diagnostics };
  }

  const trimmedBody = body.trim();
  const layoutSchema = extractLayoutSchema(trimmedBody);
  for (const section of ['intent', 'layout', 'regions'] as const) {
    if (!hasSection(trimmedBody, section)) {
      diagnostics.push({
        level: 'warning',
        code: 'screen_template_missing_section',
        message: `Template "${id}" is missing the "## ${capitalize(section)}" section.`,
        path,
      });
    }
  }
  if (hasSection(trimmedBody, 'layout') && !layoutSchema) {
    diagnostics.push({
      level: 'warning',
      code: 'screen_template_missing_layout_schema',
      message: `Template "${id}" has a "## Layout" section but no fenced ASCII schema block.`,
      path,
    });
  }

  const componentRoles = coerceComponentRoles(fm.componentRoles);
  const componentBindings = coerceComponentBindings(fm.componentBindings);

  // Surface (0132) is orthogonal to kind: a `modal-form` keeps `kind: form` and
  // adds `surface: modal`. Modal templates must ship a size/overflow contract;
  // missing or invalid values fall back to the product default with a warning.
  const surface = coerceSurface(fm.surface);
  if (fm.surface !== undefined && surface !== normalizeSurfaceInput(fm.surface)) {
    diagnostics.push({
      level: 'warning',
      code: 'screen_template_surface',
      message: `Template "${id}" has unknown surface "${String(fm.surface)}"; treating it as "page".`,
      path,
    });
  }
  let modalDefaults: ModalDefaults | undefined;
  if (surface === 'modal') {
    if (fm.modalDefaults === undefined) {
      diagnostics.push({
        level: 'warning',
        code: 'screen_template_modal_defaults',
        message: `Modal template "${id}" has no modalDefaults; using the product fallback 640px × auto, scroll.`,
        path,
      });
    }
    const normalized = normalizeModalDefaults(coerceModalDefaultsInput(fm.modalDefaults));
    modalDefaults = normalized.value;
    for (const issue of normalized.issues) {
      diagnostics.push({
        level: 'warning',
        code: 'screen_template_modal_defaults',
        message: `Modal template "${id}": ${issue}`,
        path,
      });
    }
  } else if (fm.modalDefaults !== undefined) {
    diagnostics.push({
      level: 'warning',
      code: 'screen_template_modal_defaults',
      message: `Template "${id}" declares modalDefaults but is not a modal surface; the size contract is ignored.`,
      path,
    });
  }

  const template: ScreenTemplate = {
    id,
    name: fm.name.trim(),
    description: fm.description.trim(),
    source: input.source,
    content: trimmedBody,
    kind: coerceKind(fm.kind),
    ...(surface === 'modal' ? { surface } : {}),
    ...(modalDefaults ? { modalDefaults } : {}),
    ...(fm.tags ? { tags: coerceStringList(fm.tags) } : {}),
    status: coerceStatus(fm.status),
    ...(fm.version !== undefined ? { version: fm.version } : {}),
    ...(fm.states ? { states: coerceStringList(fm.states) } : {}),
    ...(componentRoles ? { componentRoles } : {}),
    ...(componentBindings ? { componentBindings } : {}),
    ...(fm.evidence ? { evidence: coerceStringList(fm.evidence) } : {}),
    ...(fm.viewport !== undefined ? { viewport: fm.viewport } : {}),
    ...(input.filePath ? { filePath: input.filePath } : {}),
    ...(layoutSchema ? { layoutSchema } : {}),
  };

  if (input.source === 'built-in' && componentBindings) {
    diagnostics.push({
      level: 'warning',
      code: 'screen_template_universality',
      message: `Built-in template "${id}" declares componentBindings. Bindings name concrete project components and are only valid in project templates.`,
      path,
    });
  }

  if (input.source === 'built-in') {
    const smell = universalitySmell(template);
    if (smell) {
      diagnostics.push({
        level: 'warning',
        code: 'screen_template_universality',
        message: `Built-in template "${id}" looks project-specific (${smell}). Built-in templates must use component roles, not concrete component names or imports.`,
        path,
      });
    }
  }

  return { template, diagnostics };
}

function stripScreenSuffix(fileName: string): string {
  return fileName.replace(/\.screen\.md$/i, '').replace(/\.md$/i, '');
}

function slugify(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function coerceKind(value: string | undefined): ScreenTemplateKind {
  const normalized = value?.trim().toLowerCase();
  return (KNOWN_KINDS as readonly string[]).includes(normalized ?? '')
    ? (normalized as ScreenTemplateKind)
    : 'custom';
}

function normalizeSurfaceInput(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? 'page';
}

function coerceSurface(value: string | undefined): ProjectScreenSurface {
  return normalizeSurfaceInput(value) === 'modal' ? 'modal' : 'page';
}

function coerceModalDefaultsInput(value: unknown): Partial<ModalDefaults> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const out: Partial<ModalDefaults> = {};
  if (typeof record.width === 'string') out.width = record.width;
  if (typeof record.height === 'string') out.height = record.height;
  // Pass any string through so normalizeModalDefaults reports invalid values.
  if (typeof record.longContent === 'string')
    out.longContent = record.longContent as ModalLongContent;
  return out;
}

function coerceStatus(value: string | undefined): ScreenTemplateStatus {
  const normalized = value?.trim().toLowerCase();
  return (KNOWN_STATUSES as readonly string[]).includes(normalized ?? '')
    ? (normalized as ScreenTemplateStatus)
    : 'stable';
}

function coerceStringList(value: Array<string | number>): string[] {
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function coerceComponentRoles(value: unknown): ScreenTemplateComponentRole[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const roles: ScreenTemplateComponentRole[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const role = item.trim();
      if (role) roles.push({ role });
      continue;
    }
    if (item && typeof item === 'object' && 'role' in item) {
      const record = item as Record<string, unknown>;
      const role = String(record.role ?? '').trim();
      if (!role) continue;
      const intentRaw = record.intent;
      const intent =
        typeof intentRaw === 'string' && intentRaw.trim() ? intentRaw.trim() : undefined;
      roles.push(intent ? { role, intent } : { role });
    }
  }
  return roles.length > 0 ? roles : undefined;
}

function coerceComponentBindings(value: unknown): ScreenTemplateComponentBinding[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const bindings: ScreenTemplateComponentBinding[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || !('role' in item)) continue;
    const record = item as Record<string, unknown>;
    const role = String(record.role ?? '').trim();
    if (!role) continue;
    const componentsRaw = record.components;
    const components = Array.isArray(componentsRaw)
      ? componentsRaw.map((entry) => String(entry).trim()).filter(Boolean)
      : [];
    if (components.length === 0) continue;
    const presetRaw = record.preset;
    const preset = typeof presetRaw === 'string' && presetRaw.trim() ? presetRaw.trim() : undefined;
    bindings.push({ role, components, ...(preset ? { preset } : {}) });
  }
  return bindings.length > 0 ? bindings : undefined;
}

function hasSection(body: string, section: string): boolean {
  return new RegExp(`(^|\\n)##\\s+${section}\\b`, 'i').test(body);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Extract the first fenced block under `## Layout`, before the next heading. */
function extractLayoutSchema(body: string): string | undefined {
  const heading = /(^|\n)##\s+layout\s*\n/i.exec(body);
  if (!heading) return undefined;
  const start = heading.index + heading[0].length;
  const rest = body.slice(start);
  const nextHeading = /\n##\s+/.exec(rest);
  const scope = nextHeading ? rest.slice(0, nextHeading.index) : rest;
  const fenced = /```[^\n]*\n([\s\S]*?)```/.exec(scope);
  const inner = fenced?.[1]?.replace(/\s+$/, '');
  return inner && inner.trim() ? inner : undefined;
}

/** Cheap heuristic: built-in templates should not name concrete imports. */
function universalitySmell(template: ScreenTemplate): string | undefined {
  const haystack = [
    template.content,
    ...(template.componentRoles?.map((role) => `${role.role} ${role.intent ?? ''}`) ?? []),
  ].join('\n');
  if (/\bimport\s+[\w{]/.test(haystack)) return 'import statement';
  if (/\bfrom\s+['"][^'"]+['"]/.test(haystack)) return 'module path';
  if (/@\/components\//.test(haystack)) return 'project import alias';
  if (/\b[\w-]+-ui-kit\b/i.test(haystack)) return 'customer kit name';
  return undefined;
}
