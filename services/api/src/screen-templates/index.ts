import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { resolveDefaultKitRoot } from '@sber-designer/agent-kit';
import type {
  AgentKitDiagnostic,
  ProjectTemplate,
  ScreenTemplate,
  ScreenTemplateRef,
  ScreenTemplateSource,
} from '@sber-designer/shared-types';
import { screenSurface } from '@sber-designer/shared-types';

import { parseScreenTemplateFile } from './parse';

export { parseScreenTemplateFile } from './parse';
export type { ParseScreenTemplateResult } from './parse';
export { validateScreenTemplate } from './validate';
export type { ValidateScreenTemplateOptions } from './validate';

const DEFAULT_BUILT_IN_DIR = resolve(join(resolveDefaultKitRoot(), 'screen-templates'));
/** Display path for built-in templates (0140: the kit lives in the package). */
const BUILT_IN_DISPLAY_REL = 'packages/agent-kit/kit/screen-templates';
const PROJECT_TEMPLATE_REL = '.sber-designer/screen-templates';
const SCREEN_FILE_SUFFIX = '.screen.md';
/** Authoring skeleton that ships beside the built-ins; never a real template. */
const SKELETON_FILE = 'template.screen.md';

/** Stable, product-meaningful order for the built-in set (page then modal). */
const BUILT_IN_ORDER = [
  'dashboard',
  'list-table',
  'detail',
  'form',
  'settings',
  'modal-form',
  'modal-confirm',
];

export interface ResolveScreenTemplatesResult {
  templates: ScreenTemplate[];
  diagnostics: AgentKitDiagnostic[];
}

export interface ResolveScreenTemplatesOptions {
  /** Override the built-in directory (tests). */
  builtInDir?: string;
}

interface DirLoad {
  templates: ScreenTemplate[];
  diagnostics: AgentKitDiagnostic[];
}

const dirCache = new Map<string, { fingerprint: string; value: DirLoad }>();

export function resetScreenTemplatesCache(): void {
  dirCache.clear();
}

/**
 * Resolve built-in (`packages/agent-kit/kit/screen-templates`) and project-local
 * (`<workspace>/.sber-designer/screen-templates`) templates into one list.
 * Both sources are kept even when ids collide; the `{ id, source }` pair
 * disambiguates them downstream.
 */
export async function resolveScreenTemplates(
  workspacePath?: string | null,
  options: ResolveScreenTemplatesOptions = {},
): Promise<ResolveScreenTemplatesResult> {
  const builtInDir = options.builtInDir ?? DEFAULT_BUILT_IN_DIR;
  const builtIn = await loadDirCached(builtInDir, 'built-in');
  builtIn.templates.sort(byBuiltInOrder);

  let project: DirLoad = { templates: [], diagnostics: [] };
  if (workspacePath) {
    const projectDir = resolve(workspacePath, PROJECT_TEMPLATE_REL);
    project = await loadDirCached(projectDir, 'project', PROJECT_TEMPLATE_REL);
    project.templates.sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    templates: [...builtIn.templates, ...project.templates],
    diagnostics: [...builtIn.diagnostics, ...project.diagnostics],
  };
}

/** Find one template by `{ id, source }`. */
export function findScreenTemplate(
  templates: ScreenTemplate[],
  ref: ScreenTemplateRef,
): ScreenTemplate | undefined {
  return templates.find((template) => template.id === ref.id && template.source === ref.source);
}

async function loadDirCached(
  dir: string,
  source: ScreenTemplateSource,
  relativeBase?: string,
): Promise<DirLoad> {
  const fingerprint = await fingerprintDir(dir);
  const cached = dirCache.get(dir);
  if (cached && cached.fingerprint === fingerprint) {
    return { templates: [...cached.value.templates], diagnostics: [...cached.value.diagnostics] };
  }
  const value = await loadDir(dir, source, relativeBase);
  dirCache.set(dir, { fingerprint, value });
  return { templates: [...value.templates], diagnostics: [...value.diagnostics] };
}

async function loadDir(
  dir: string,
  source: ScreenTemplateSource,
  relativeBase?: string,
): Promise<DirLoad> {
  const templates: ScreenTemplate[] = [];
  const diagnostics: AgentKitDiagnostic[] = [];
  const seen = new Set<string>();

  const entries = await safeReadDir(dir);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(SCREEN_FILE_SUFFIX))
    .filter((entry) => entry.name.toLowerCase() !== SKELETON_FILE)
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of files) {
    const abs = join(dir, entry.name);
    let raw: string;
    try {
      raw = await readFile(abs, 'utf8');
    } catch (err) {
      diagnostics.push({
        level: 'warning',
        code: 'screen_template_unreadable',
        message: err instanceof Error ? err.message : String(err),
        path: publicPath(entry.name, relativeBase),
      });
      continue;
    }
    const result = parseScreenTemplateFile({
      source,
      fileName: entry.name,
      raw,
      ...(relativeBase ? { filePath: `${relativeBase}/${entry.name}` } : {}),
      diagnosticPath: publicPath(entry.name, relativeBase),
    });
    diagnostics.push(...result.diagnostics);
    if (!result.template) continue;
    if (seen.has(result.template.id)) {
      diagnostics.push({
        level: 'warning',
        code: 'screen_template_duplicate_id',
        message: `Duplicate ${source} template id "${result.template.id}" in ${entry.name}; keeping the first.`,
        path: publicPath(entry.name, relativeBase),
      });
      continue;
    }
    seen.add(result.template.id);
    templates.push(result.template);
  }

  return { templates, diagnostics };
}

function byBuiltInOrder(a: ScreenTemplate, b: ScreenTemplate): number {
  const ai = BUILT_IN_ORDER.indexOf(a.id);
  const bi = BUILT_IN_ORDER.indexOf(b.id);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return a.name.localeCompare(b.name);
}

async function fingerprintDir(dir: string): Promise<string> {
  const entries = await safeReadDir(dir);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(SCREEN_FILE_SUFFIX))
    .map((entry) => entry.name)
    .sort();
  const parts: string[] = [];
  for (const name of files) {
    try {
      const stats = await stat(join(dir, name));
      parts.push(`${name}:${stats.mtimeMs}:${stats.size}`);
    } catch {
      // Ignore files that vanished between readdir and stat.
    }
  }
  return parts.join('|');
}

async function safeReadDir(path: string): Promise<import('node:fs').Dirent[]> {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function publicPath(fileName: string, relativeBase?: string): string {
  return relativeBase ? `${relativeBase}/${fileName}` : `${BUILT_IN_DISPLAY_REL}/${fileName}`;
}

// ---------- Legacy project-template compatibility ----------

/**
 * Map a screen template to the deprecated {@link ProjectTemplate} shape used by
 * older callers. Built-in templates keep a synthetic `sber-designer://` URI;
 * project templates expose their real workspace-relative path.
 */
export function screenTemplateToProjectTemplate(template: ScreenTemplate): ProjectTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    source: template.source,
    filePath:
      template.source === 'project' && template.filePath
        ? template.filePath
        : `sber-designer://screen-templates/${template.id}.md`,
    content: template.content,
  };
}

export async function listScreenTemplatesAsProjectTemplates(
  workspacePath?: string | null,
): Promise<ProjectTemplate[]> {
  const { templates } = await resolveScreenTemplates(workspacePath);
  return (
    templates
      .filter((template) => template.status !== 'deprecated')
      // The legacy ProjectTemplate picker predates surfaces and treats every
      // template as a full page; keep modal-surface templates out of it (0132).
      .filter((template) => screenSurface(template) !== 'modal')
      .map(screenTemplateToProjectTemplate)
  );
}
