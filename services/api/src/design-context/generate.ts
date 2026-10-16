/**
 * Generates DESIGN.md and component-selection-map.md from the catalog and
 * workspace component discovery, then refreshes the design index.
 */
import { readdir, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import type { ComponentCatalog, ComponentEntry } from '@sber-designer/shared-types';
import { GOOGLE_DESIGN_MD_SPEC_VERSION } from '../design-md-spec';
import { generateProjectDesignIndexFiles } from '../design-index';
import { readWorkspaceFile } from '../safe-fs';
import {
  COMPONENT_FAMILY_RULES,
  type GenerateDesignContextOptions,
  type GenerateDesignContextResult,
  SKIPPED_FINGERPRINT_DIRS,
} from './contract';
import { compactLine, isNotFound, kebabCase, normalizeSearchText, sentenceCase } from './markdown';
import { normalizeRelativePath } from './state';
import { validateProjectDesignContext } from './validate';

export async function generateProjectDesignContextFiles(
  workspaceRoot: string,
  options: GenerateDesignContextOptions = {},
): Promise<GenerateDesignContextResult> {
  const projectName = normalizeProjectName(options.projectName, workspaceRoot);
  const catalog = await enrichCatalogWithWorkspaceComponents(
    workspaceRoot,
    options.catalog ?? null,
  );
  const result = await generateProjectDesignIndexFiles(workspaceRoot, {
    projectName,
    catalog,
  });
  const context = await validateProjectDesignContext(workspaceRoot);
  return { changedFiles: result.changedFiles, skippedFiles: [], context };
}

async function enrichCatalogWithWorkspaceComponents(
  workspaceRoot: string,
  catalog: ComponentCatalog | null,
): Promise<ComponentCatalog | null> {
  const discovered = await discoverWorkspaceComponentEntries(workspaceRoot);
  if (discovered.length === 0) return catalog;

  const existing = catalog?.components ?? [];
  const seen = new Set(existing.map((component) => `${component.title}::${component.filePath}`));
  const merged = [...existing];
  for (const component of discovered) {
    const key = `${component.title}::${component.filePath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(component);
  }

  return {
    source: catalog?.source ?? 'static',
    generatedAt: catalog?.generatedAt ?? Date.now(),
    ...(catalog?.previewUrl ? { previewUrl: catalog.previewUrl } : {}),
    components: merged,
  };
}

async function discoverWorkspaceComponentEntries(workspaceRoot: string): Promise<ComponentEntry[]> {
  const files = new Set<string>();
  for (const root of ['src/components', 'components']) {
    await collectComponentSourceFiles(workspaceRoot, root, files);
  }

  const entries: ComponentEntry[] = [];
  for (const filePath of Array.from(files).sort().slice(0, 800)) {
    const contents = await readWorkspaceFile(workspaceRoot, filePath).catch(() => '');
    const componentName = extractExportedComponentName(contents) ?? componentNameFromPath(filePath);
    if (!componentName) continue;
    const title = componentTitleFromPath(filePath);
    entries.push({
      id: kebabCase(title),
      title,
      shortName: componentName,
      filePath,
      description: `Workspace component discovered from ${filePath}.`,
      stories: [],
    });
  }
  return entries;
}

async function collectComponentSourceFiles(
  root: string,
  relPath: string,
  files: Set<string>,
): Promise<void> {
  let abs: string;
  try {
    abs = resolveInside(root, relPath);
  } catch {
    return;
  }

  let entry;
  try {
    entry = await stat(abs);
  } catch (err) {
    if (isNotFound(err)) return;
    throw err;
  }

  if (entry.isFile()) {
    const normalized = normalizeRelativePath(root, abs);
    if (isLikelyComponentSource(normalized)) files.add(normalized);
    return;
  }
  if (!entry.isDirectory()) return;

  const dirName = relPath.split('/').filter(Boolean).at(-1);
  if (dirName && SKIPPED_FINGERPRINT_DIRS.has(dirName)) return;

  const children = await readdir(abs, { withFileTypes: true });
  for (const child of children) {
    const childRel = relPath ? `${relPath}/${child.name}` : child.name;
    if (child.isDirectory() && shouldSkipComponentDirectory(childRel)) continue;
    await collectComponentSourceFiles(root, childRel, files);
    if (files.size >= 800) return;
  }
}

function isLikelyComponentSource(filePath: string): boolean {
  if (!/\.(tsx|jsx)$/.test(filePath)) return false;
  if (filePath.includes('/Icon/icons/') || filePath.includes('/Icon/dashboardIcons/')) return false;
  if (
    /\.(stories|test|spec|styles|types|const|mocks|utils|handler|context|hooks)\.(tsx|jsx)$/.test(
      filePath,
    )
  ) {
    return false;
  }
  const fileName = filePath.split('/').at(-1) ?? '';
  if (fileName === 'index.tsx' || fileName === 'index.jsx') return false;
  return true;
}

function shouldSkipComponentDirectory(relPath: string): boolean {
  return (
    relPath.includes('/Icon/icons') ||
    relPath.includes('/Icon/dashboardIcons') ||
    relPath.endsWith('/__tests__')
  );
}

function extractExportedComponentName(contents: string): string | null {
  const direct = /export\s+(?:const|function|class)\s+([A-Z][A-Za-z0-9_]*)/.exec(contents);
  if (direct?.[1]) return direct[1];
  const namedDefault = /export\s+default\s+(?:function|class)\s+([A-Z][A-Za-z0-9_]*)/.exec(
    contents,
  );
  if (namedDefault?.[1]) return namedDefault[1];
  const memo =
    /const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:memo|React\.memo|forwardRef|React\.forwardRef)/.exec(
      contents,
    );
  if (memo?.[1]) return memo[1];
  return null;
}

function componentNameFromPath(filePath: string): string | null {
  const base =
    filePath
      .split('/')
      .at(-1)
      ?.replace(/\.(tsx|jsx)$/, '') ?? '';
  if (!base || !/^[A-Z]/.test(base)) return null;
  return base;
}

function componentTitleFromPath(filePath: string): string {
  return filePath
    .replace(/^src\/components\//, '')
    .replace(/^components\//, '')
    .replace(/\.(tsx|jsx)$/, '');
}

function generateDesignMd(projectName: string, catalog: ComponentCatalog | null): string {
  const componentSummary = summarizeCatalogForDesignMd(catalog);
  return [
    '---',
    `version: ${GOOGLE_DESIGN_MD_SPEC_VERSION}`,
    `name: ${projectName}`,
    'description: "Project design-system brief generated by sber-designer. Review and refine before using it as a source of truth."',
    '---',
    '',
    `# ${projectName} Design System`,
    '',
    '## Overview',
    '',
    `${projectName} uses this file as the compact, canonical design-system brief for AI-assisted screen composition. Keep it focused on visual language, density, layout rules, tokens, and high-level component families.`,
    '',
    '## Colors',
    '',
    '- Prefer existing token variables and theme files from the project.',
    '- Do not introduce one-off colors unless the product team adds them to the token layer first.',
    '- Use semantic roles such as primary, secondary, surface, border, success, warning, and destructive when documenting tokens.',
    '',
    '## Typography',
    '',
    '- Reuse the project font stack and text scale.',
    '- Keep data-heavy product UI compact and scannable.',
    '- Avoid viewport-scaled type and negative letter spacing unless the design system explicitly defines it.',
    '',
    '## Layout',
    '',
    '- Prefer responsive layouts that adapt to the editor viewport presets.',
    '- Use established screen patterns, spacing primitives, and container widths before inventing new layout wrappers.',
    '- Keep operational screens dense, predictable, and optimized for repeated use.',
    '',
    '## Elevation & Depth',
    '',
    '- Use elevation only for active overlays, popovers, menus, sticky controls, and focused surfaces.',
    '- Avoid decorative nested cards; frame only repeated items, modals, and genuinely independent tools.',
    '',
    '## Shapes',
    '',
    '- Follow project primitives for radius and control height.',
    '- Keep cards and panels restrained unless the project design system says otherwise.',
    '',
    '## Components',
    '',
    componentSummary,
    '',
    "## Do's and Don'ts",
    '',
    '- Do inspect component source files and stories before composing a new screen.',
    '- Do use `component-selection-map.md` to choose the first component family to inspect.',
    '- Do keep generated screens aligned with selected built-in templates, existing screens, and responsive behavior.',
    '- Do not duplicate detailed component routing here; keep concrete routing in `component-selection-map.md`.',
    '- Do not replace catalog components with standalone HTML/CSS when a project primitive exists.',
    '',
  ].join('\n');
}

function generateComponentSelectionMap(
  projectName: string,
  catalog: ComponentCatalog | null,
): string {
  const grouped = groupCatalogComponents(catalog?.components ?? []);
  const lines: string[] = [
    '# Component selection map',
    '',
    `Project: ${projectName}`,
    '',
    'This file is sber-designer-specific. It tells the agent which concrete component families to inspect first. Keep canonical brand, token, and visual-language rules in `DESIGN.md`.',
    '',
    '## How to use this map',
    '',
    '- Read `DESIGN.md` first for visual language and constraints.',
    '- Pick the closest product job below, then inspect the listed component source files and stories.',
    '- If no family matches, inspect the catalog before creating new primitives.',
    '',
  ];

  for (const rule of COMPONENT_FAMILY_RULES) {
    lines.push(`## ${rule.heading}`, '', rule.guidance, '');
    const components = grouped.get(rule.heading) ?? [];
    if (components.length === 0) {
      lines.push(
        '- No obvious catalog match yet. Add project guidance here after reviewing the component library.',
        '',
      );
      continue;
    }
    for (const component of components.slice(0, 12)) {
      lines.push(`- ${renderComponentReference(component)}`);
    }
    lines.push('');
  }

  const uncategorized = grouped.get('uncategorized') ?? [];
  if (uncategorized.length > 0) {
    lines.push('## uncategorized catalog entries', '');
    for (const component of uncategorized.slice(0, 24)) {
      lines.push(`- ${renderComponentReference(component)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function summarizeCatalogForDesignMd(catalog: ComponentCatalog | null): string {
  if (!catalog || catalog.components.length === 0) {
    return [
      '- Catalog was not available during generation.',
      '- Document the main component families manually, then regenerate the component selection map when the catalog is connected.',
    ].join('\n');
  }
  const grouped = groupCatalogComponents(catalog.components);
  const lines: string[] = [];
  for (const rule of COMPONENT_FAMILY_RULES) {
    const components = grouped.get(rule.heading) ?? [];
    if (components.length === 0) continue;
    const names = components
      .slice(0, 5)
      .map((component) => component.shortName || component.title)
      .join(', ');
    lines.push(`- ${sentenceCase(rule.heading)}: ${names}.`);
  }
  const uncategorized = grouped.get('uncategorized') ?? [];
  if (uncategorized.length > 0) {
    lines.push(
      `- Other primitives: ${uncategorized
        .slice(0, 8)
        .map((component) => component.shortName || component.title)
        .join(', ')}.`,
    );
  }
  return lines.length > 0 ? lines.join('\n') : '- No component families were detected yet.';
}

function groupCatalogComponents(
  components: readonly ComponentEntry[],
): Map<string, ComponentEntry[]> {
  const grouped = new Map<string, ComponentEntry[]>();
  for (const rule of COMPONENT_FAMILY_RULES) grouped.set(rule.heading, []);
  grouped.set('uncategorized', []);

  for (const component of components) {
    const haystack = normalizeSearchText(
      [
        component.title,
        component.shortName,
        component.description ?? '',
        component.stories.map((story) => story.name).join(' '),
      ].join(' '),
    );
    const tokens = new Set(haystack.split(/\s+/).filter(Boolean));
    const rule =
      COMPONENT_FAMILY_RULES.find((candidate) =>
        candidate.keywords.some((keyword) => keywordMatches(keyword, haystack, tokens)),
      ) ?? null;
    grouped.get(rule?.heading ?? 'uncategorized')?.push(component);
  }
  for (const rule of COMPONENT_FAMILY_RULES) {
    const entries = grouped.get(rule.heading) ?? [];
    entries.sort(
      (a, b) => componentRuleScore(a, rule.heading) - componentRuleScore(b, rule.heading),
    );
  }
  return grouped;
}

function keywordMatches(keyword: string, haystack: string, tokens: Set<string>): boolean {
  const normalized = normalizeSearchText(keyword);
  if (normalized.includes(' ')) return haystack.includes(normalized);
  if (normalized === 'datatable') return haystack.includes('data table') || tokens.has('datatable');
  return (
    tokens.has(normalized) ||
    tokens.has(`${normalized}s`) ||
    (normalized.endsWith('s') && tokens.has(normalized.slice(0, -1)))
  );
}

function componentRuleScore(component: ComponentEntry, heading: string): number {
  const title = component.title.toLowerCase();
  let score = title.length / 1_000;
  if (title.startsWith('organisms/') || title.includes('/organisms/')) score -= 30;
  if (title.startsWith('molecules/') || title.includes('/molecules/')) score -= 15;
  if (title.startsWith('atoms/') || title.includes('/atoms/')) score += 5;

  if (heading === 'data tables' && title.includes('tables')) score -= 60;
  if (heading === 'forms and inputs' && (title.includes('form') || title.includes('inputs'))) {
    score -= 60;
  }
  if (
    heading === 'navigation' &&
    (title.includes('navigation') || title.includes('breadcrumbs') || title.includes('tabs'))
  ) {
    score -= 60;
  }
  if (heading === 'actions' && (title.includes('buttons') || title.includes('actions'))) {
    score -= 60;
  }
  if (
    heading === 'status and feedback' &&
    (title.includes('badge') ||
      title.includes('alert') ||
      title.includes('toast') ||
      title.includes('progress'))
  ) {
    score -= 60;
  }
  if (
    heading === 'surfaces and layout' &&
    (title.includes('modal') || title.includes('card') || title.includes('dialog'))
  ) {
    score -= 60;
  }
  if (heading === 'data visualization' && title.includes('charts')) score -= 60;
  return score;
}

function renderComponentReference(component: ComponentEntry): string {
  const description = compactLine(component.description ?? '', 140);
  const stories =
    component.stories.length > 0
      ? `; stories: ${component.stories
          .slice(0, 4)
          .map((story) => story.name)
          .join(', ')}`
      : '';
  return [
    `\`${component.title}\``,
    `source: \`${component.filePath}\``,
    description ? `notes: ${description}` : '',
    stories,
  ]
    .filter(Boolean)
    .join(' — ');
}

function normalizeProjectName(
  projectName: string | null | undefined,
  workspaceRoot: string,
): string {
  const candidate = projectName?.trim() || basename(workspaceRoot) || 'Project';
  return candidate.replace(/\s+/g, ' ').trim();
}
