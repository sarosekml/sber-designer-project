/**
 * 0108.5.4 / 0303: deterministic `design-system/index.html` catalog preview.
 *
 * The source of truth for an HTML-first design system stays the three text
 * files (`Design.md`, `tokens.css`, `components.css`). `design-system.html` is
 * a generated, rebuildable preview so it can never silently drift: given the
 * same sources it always produces the same file (no timestamps, stable order),
 * which keeps its git diff meaningful.
 */
import { readdir } from 'node:fs/promises';
import { join, posix } from 'node:path';

import {
  DESIGN_INDEX_PATHS,
  parseHtmlDesignSystemDesignMd,
  type IndexedComponentRecord,
} from '@sber-designer/design-indexer';
import { readComponentSidecarLayer } from '@sber-designer/storybook-indexer';
import {
  HTML_DESIGN_SYSTEM_PATHS,
  type ComponentDescriptionLayer,
} from '@sber-designer/shared-types';

import { restoreHtmlDesignSystemDescriptionSections } from './html-design-system-description-write';
import { readWorkspaceFile, writeWorkspaceFile } from './safe-fs';

export const DESIGN_SYSTEM_PREVIEW_PATH = HTML_DESIGN_SYSTEM_PATHS.previewHtml;
const MANAGED_ATTR = 'data-sd-managed-design-system-preview';
const MAX_USAGE_SNIPPET = 200;
const MAX_COMPONENT_CLASSES = 60;
const MAX_IMPORTED_CSS_FILES = 200;
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?[^;]*;/giu;

export type PreviewTokenKind = 'color' | 'typography' | 'spacing' | 'radius' | 'unknown';

export interface PreviewToken {
  name: string;
  value: string;
  theme: string;
  kind: PreviewTokenKind;
}

export interface PreviewUsageExample {
  className: string;
  snippet: string;
  sourcePath: string;
}

export interface HtmlDesignSystemPreviewInput {
  projectName: string;
  tokens: PreviewToken[];
  componentClasses: string[];
  designMdSections: Array<{ label: string; body: string }>;
  usageExamples: PreviewUsageExample[];
  referencePages?: PreviewReferencePage[];
}

export interface PreviewReferencePage {
  path: string;
  title: string;
}

export interface RegenerateDesignSystemPreviewResult {
  changedFile: string;
  contents: string;
  tokenCount: number;
  componentClassCount: number;
  referencePageCount: number;
  descriptionSections: RegenerateDesignSystemPreviewDescriptionSections;
}

export interface RegenerateDesignSystemPreviewDescriptionSections {
  keepDescriptions: boolean;
  restored: number;
  changedFiles: string[];
  diagnostics: string[];
  layerCount: number;
}

export interface RegenerateDesignSystemPreviewOptions {
  keepDescriptions?: boolean;
}

/**
 * Read the source files and rewrite `design-system/index.html`. Returns the written
 * file path and content so callers can surface a diff/summary.
 */
export async function regenerateHtmlDesignSystemPreview(
  workspaceRoot: string,
  projectName: string,
  options: RegenerateDesignSystemPreviewOptions = {},
): Promise<RegenerateDesignSystemPreviewResult> {
  const existingPreview = await readWorkspaceFile(workspaceRoot, DESIGN_SYSTEM_PREVIEW_PATH).catch(
    () => null,
  );
  if (existingPreview !== null && !existingPreview.includes(MANAGED_ATTR)) {
    throw new Error(
      `${DESIGN_SYSTEM_PREVIEW_PATH} exists without the managed preview marker. Rename the user-authored file before rebuilding.`,
    );
  }
  const [tokensCss, componentsCss] = await Promise.all([
    readLocalCssGraph(workspaceRoot, HTML_DESIGN_SYSTEM_PATHS.tokensCss),
    readLocalCssGraph(workspaceRoot, HTML_DESIGN_SYSTEM_PATHS.componentsCss),
  ]);
  const designMd = await readWorkspaceFile(workspaceRoot, HTML_DESIGN_SYSTEM_PATHS.designMd).catch(
    () => '',
  );
  const tokens = parsePreviewTokens(tokensCss);
  const componentClasses = parseComponentClassNames(componentsCss);
  const parsedDesignMd = parseHtmlDesignSystemDesignMd(designMd, HTML_DESIGN_SYSTEM_PATHS.designMd);
  const designMdSections = (parsedDesignMd?.sections ?? [])
    .filter((section) => section.body.length > 0)
    .map((section) => ({ label: section.label, body: section.body }));
  const usageExamples = await collectUsageExamples(workspaceRoot, componentClasses);
  const referencePages = await collectReferencePages(workspaceRoot);

  const contents = buildHtmlDesignSystemPreview({
    projectName,
    tokens,
    componentClasses,
    designMdSections,
    usageExamples,
    referencePages,
  });
  await writeWorkspaceFile(workspaceRoot, DESIGN_SYSTEM_PREVIEW_PATH, contents);
  const descriptionSections = await restorePreviewDescriptionSections(
    workspaceRoot,
    options.keepDescriptions ?? true,
  );
  const finalContents =
    descriptionSections.changedFiles.length > 0
      ? await readWorkspaceFile(workspaceRoot, DESIGN_SYSTEM_PREVIEW_PATH)
      : contents;
  return {
    changedFile: DESIGN_SYSTEM_PREVIEW_PATH,
    contents: finalContents,
    tokenCount: tokens.length,
    componentClassCount: componentClasses.length,
    referencePageCount: referencePages.length,
    descriptionSections,
  };
}

/**
 * Resolve a bounded graph of local CSS imports for the generated preview.
 * Foreign HTML design-system bundles can keep their own folder structure and
 * expose it through thin canonical tokens.css/components.css facades.
 */
export async function readLocalCssGraph(workspaceRoot: string, entryPath: string): Promise<string> {
  const visited = new Set<string>();
  const chunks: string[] = [];

  const visit = async (filePath: string): Promise<void> => {
    const normalized = normalizeLocalCssPath(filePath);
    if (!normalized || visited.has(normalized) || visited.size >= MAX_IMPORTED_CSS_FILES) return;
    visited.add(normalized);
    const contents = await readWorkspaceFile(workspaceRoot, normalized).catch(() => '');
    if (!contents) return;
    chunks.push(`/* sber-designer source: ${normalized} */\n${contents}`);
    CSS_IMPORT_RE.lastIndex = 0;
    const imports = Array.from(contents.matchAll(CSS_IMPORT_RE), (match) => match[1] ?? '');
    for (const reference of imports) {
      const importedPath = resolveLocalCssImport(normalized, reference);
      if (importedPath) await visit(importedPath);
    }
  };

  await visit(entryPath);
  return chunks.join('\n');
}

function resolveLocalCssImport(sourcePath: string, reference: string): string | null {
  const clean = reference.split(/[?#]/u)[0]?.trim() ?? '';
  if (!clean || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/iu.test(clean)) return null;
  const resolved = normalizeLocalCssPath(posix.join(posix.dirname(sourcePath), clean));
  return resolved?.toLowerCase().endsWith('.css') ? resolved : null;
}

function normalizeLocalCssPath(path: string): string | null {
  const normalized = posix.normalize(path.replace(/\\/gu, '/')).replace(/^\.\//u, '');
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    return null;
  }
  return normalized;
}

export function buildHtmlDesignSystemPreview(input: HtmlDesignSystemPreviewInput): string {
  const title = titleCase(input.projectName);
  const colorTokens = sortTokens(input.tokens.filter((token) => token.kind === 'color'));
  const typographyTokens = sortTokens(input.tokens.filter((token) => token.kind === 'typography'));
  const spacingTokens = sortTokens(
    input.tokens.filter((token) => token.kind === 'spacing' || token.kind === 'radius'),
  );
  const componentClasses = [...input.componentClasses].sort().slice(0, MAX_COMPONENT_CLASSES);
  const usageByClass = new Map(input.usageExamples.map((example) => [example.className, example]));

  const body = [
    `    <header class="dsp-header">`,
    `      <p class="dsp-eyebrow">HTML design system</p>`,
    `      <h1 class="dsp-title">${escapeHtml(title)} Design System</h1>`,
    `      <p class="dsp-lead">Generated preview. Edit Design.md, tokens.css, and components.css, then rebuild this page.</p>`,
    `    </header>`,
    renderColorSection(colorTokens),
    renderTypographySection(typographyTokens),
    renderScaleSection(spacingTokens),
    renderComponentSection(componentClasses, usageByClass),
    renderReferencePagesSection(input.referencePages ?? []),
    renderDesignNotesSection(input.designMdSections),
  ]
    .filter(Boolean)
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} - Design System</title>
    <link rel="stylesheet" href="./tokens.css" />
    <link rel="stylesheet" href="./components.css" />
    <style>
${previewStyles()}
    </style>
  </head>
  <body data-sd-screen-root ${MANAGED_ATTR}>
    <main class="dsp-shell" aria-label="Design system preview">
${body}
    </main>
  </body>
</html>
`;
}

function renderReferencePagesSection(referencePages: PreviewReferencePage[]): string {
  if (referencePages.length === 0) return '';
  const cards = referencePages
    .map(
      (page) => `        <a class="dsp-reference" href="${escapeAttribute(
        relativePreviewHref(page.path),
      )}">
          <strong>${escapeHtml(page.title)}</strong>
          <span>${escapeHtml(page.path)}</span>
        </a>`,
    )
    .join('\n');
  return sectionShell(
    'Reference pages',
    `      <div class="dsp-reference-grid">\n${cards}\n      </div>`,
  );
}

function relativePreviewHref(path: string): string {
  const prefix = `${HTML_DESIGN_SYSTEM_PATHS.folder}/`;
  return path.startsWith(prefix) ? `./${path.slice(prefix.length)}` : `../${path}`;
}

function renderColorSection(tokens: PreviewToken[]): string {
  if (tokens.length === 0) return '';
  const swatches = tokens
    .map(
      (token) => `        <figure class="dsp-swatch">
          <span class="dsp-swatch-chip" style="background: var(${cssVarRef(token.name)})"></span>
          <figcaption>
            <span class="dsp-token-name">${escapeHtml(cssVarRef(token.name))}</span>
            <span class="dsp-token-value">${escapeHtml(token.value)}${themeSuffix(token.theme)}</span>
          </figcaption>
        </figure>`,
    )
    .join('\n');
  return sectionShell('Color', `      <div class="dsp-swatch-grid">\n${swatches}\n      </div>`);
}

function renderTypographySection(tokens: PreviewToken[]): string {
  if (tokens.length === 0) return '';
  const rows = tokens
    .map(
      (token) => `        <div class="dsp-type-row">
          <p class="dsp-type-sample" style="font-family: var(${cssVarRef(token.name)})">The quick brown fox</p>
          <span class="dsp-token-name">${escapeHtml(cssVarRef(token.name))}</span>
          <span class="dsp-token-value">${escapeHtml(token.value)}${themeSuffix(token.theme)}</span>
        </div>`,
    )
    .join('\n');
  return sectionShell('Typography', `      <div class="dsp-type-list">\n${rows}\n      </div>`);
}

function renderScaleSection(tokens: PreviewToken[]): string {
  if (tokens.length === 0) return '';
  const rows = tokens
    .map(
      (token) => `        <div class="dsp-scale-row">
          <span class="dsp-scale-bar" style="inline-size: var(${cssVarRef(token.name)})"></span>
          <span class="dsp-token-name">${escapeHtml(cssVarRef(token.name))}</span>
          <span class="dsp-token-value">${escapeHtml(token.value)}${themeSuffix(token.theme)}</span>
        </div>`,
    )
    .join('\n');
  return sectionShell(
    'Spacing & radius',
    `      <div class="dsp-scale-list">\n${rows}\n      </div>`,
  );
}

function renderComponentSection(
  componentClasses: string[],
  usageByClass: Map<string, PreviewUsageExample>,
): string {
  if (componentClasses.length === 0) return '';
  const cards = componentClasses
    .map((className) => {
      const usage = usageByClass.get(className);
      const usageBlock = usage
        ? `          <pre class="dsp-usage"><code>${escapeHtml(usage.snippet)}</code></pre>
          <span class="dsp-usage-source">${escapeHtml(usage.sourcePath)}</span>`
        : `          <div class="${escapeAttribute(className)}">Sample</div>`;
      return `        <article class="dsp-component">
          <span class="dsp-token-name">.${escapeHtml(className)}</span>
${usageBlock}
        </article>`;
    })
    .join('\n');
  return sectionShell(
    'Components',
    `      <div class="dsp-component-grid">\n${cards}\n      </div>`,
  );
}

function renderDesignNotesSection(sections: Array<{ label: string; body: string }>): string {
  if (sections.length === 0) return '';
  const rows = sections
    .map(
      (section) => `        <div class="dsp-note">
          <h3>${escapeHtml(section.label)}</h3>
          <p>${escapeHtml(compact(section.body, 240))}</p>
        </div>`,
    )
    .join('\n');
  return sectionShell('Design notes', `      <div class="dsp-note-list">\n${rows}\n      </div>`);
}

function sectionShell(title: string, inner: string): string {
  return `    <section class="dsp-section" aria-label="${escapeAttribute(title)}">
      <h2 class="dsp-section-title">${escapeHtml(title)}</h2>
${inner}
    </section>`;
}

export function parsePreviewTokens(css: string): PreviewToken[] {
  const tokens: PreviewToken[] = [];
  const seen = new Set<string>();
  const blockRe =
    /(:root|\[data-(?:theme|mode)[~^|$*]?=["']?([a-z0-9_-]+)["']?\])\s*\{([^}]*)\}/giu;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(css))) {
    const theme = block[1]?.startsWith(':root') ? 'default' : (block[2] ?? 'default').toLowerCase();
    const declarationRe = /--([A-Za-z0-9_-]+)\s*:\s*([^;]+);/gu;
    let declaration: RegExpExecArray | null;
    while ((declaration = declarationRe.exec(block[3] ?? ''))) {
      const name = declaration[1]?.trim();
      const value = declaration[2]?.replace(/\s+/gu, ' ').trim();
      if (!name || !value) continue;
      const key = `${theme}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push({ name, value, theme, kind: classifyPreviewToken(name, value) });
    }
  }
  return tokens;
}

export function parseComponentClassNames(css: string): string[] {
  const classes = new Set<string>();
  const classRe = /(?:^|[\s,}])\.([a-zA-Z][a-zA-Z0-9_-]*)/gu;
  let match: RegExpExecArray | null;
  while ((match = classRe.exec(css))) {
    if (match[1]) classes.add(match[1]);
  }
  return [...classes];
}

function classifyPreviewToken(name: string, value: string): PreviewTokenKind {
  const lowerName = name.toLowerCase();
  const lowerValue = value.toLowerCase();
  if (
    lowerName.includes('color') ||
    lowerName.includes('surface') ||
    lowerName.includes('brand') ||
    lowerName.includes('accent') ||
    /^#[0-9a-f]{3,8}\b/u.test(lowerValue) ||
    /\b(?:rgb|rgba|hsl|hsla)\(/u.test(lowerValue)
  ) {
    return 'color';
  }
  if (lowerName.includes('radius')) return 'radius';
  if (
    lowerName.includes('font') ||
    lowerName.includes('leading') ||
    lowerName.includes('tracking') ||
    /\b(?:sans|serif|monospace|system-ui|ui-monospace)\b/u.test(lowerValue)
  ) {
    return 'typography';
  }
  if (
    lowerName.includes('space') ||
    lowerName.includes('gap') ||
    lowerName.includes('size') ||
    /^\d/u.test(lowerValue)
  ) {
    return 'spacing';
  }
  return 'unknown';
}

async function collectUsageExamples(
  workspaceRoot: string,
  componentClasses: string[],
): Promise<PreviewUsageExample[]> {
  if (componentClasses.length === 0) return [];
  const pages = await listPreviewPages(workspaceRoot);
  const wanted = new Set(componentClasses);
  const found = new Map<string, PreviewUsageExample>();
  for (const page of pages) {
    const contents = await readWorkspaceFile(workspaceRoot, page).catch(() => '');
    if (!contents) continue;
    for (const element of contents.matchAll(
      /<([a-z][a-z0-9-]*)\b[^>]*class\s*=\s*"([^"]*)"[^>]*>/giu,
    )) {
      const classAttr = element[2] ?? '';
      for (const className of classAttr.split(/\s+/u)) {
        if (!wanted.has(className) || found.has(className)) continue;
        found.set(className, {
          className,
          snippet: compact(element[0] ?? '', MAX_USAGE_SNIPPET),
          sourcePath: page,
        });
      }
    }
  }
  return [...found.values()];
}

async function listPreviewPages(workspaceRoot: string): Promise<string[]> {
  const pages: string[] = [];
  const rootEntries = await readdir(workspaceRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of rootEntries) {
    if (entry.isFile() && isPreviewPage(entry.name)) pages.push(entry.name);
  }
  const pagesDir = join(workspaceRoot, 'pages');
  const pageEntries = await readdir(pagesDir, { withFileTypes: true }).catch(() => []);
  for (const entry of pageEntries) {
    if (entry.isFile() && isPreviewPage(entry.name)) pages.push(`pages/${entry.name}`);
  }
  pages.push(...(await listHtmlFilesRecursive(workspaceRoot, HTML_DESIGN_SYSTEM_PATHS.folder)));
  return pages.sort();
}

function isPreviewPage(name: string): boolean {
  return /\.html?$/iu.test(name) && name.toLowerCase() !== DESIGN_SYSTEM_PREVIEW_PATH.toLowerCase();
}

async function collectReferencePages(workspaceRoot: string): Promise<PreviewReferencePage[]> {
  const paths = await listHtmlFilesRecursive(workspaceRoot, HTML_DESIGN_SYSTEM_PATHS.folder);
  const pages: PreviewReferencePage[] = [];
  for (const path of paths) {
    const source = await readWorkspaceFile(workspaceRoot, path).catch(() => '');
    const title = /<title\b[^>]*>([\s\S]*?)<\/title>/iu
      .exec(source)?.[1]
      ?.replace(/<[^>]+>/gu, '')
      .trim();
    const basename =
      path
        .split('/')
        .at(-1)
        ?.replace(/\.html?$/iu, '') ?? path;
    pages.push({ path, title: title || titleCase(basename) });
  }
  return pages;
}

async function listHtmlFilesRecursive(
  workspaceRoot: string,
  relativeDir: string,
  maxFiles = 100,
): Promise<string[]> {
  const files: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    if (files.length >= maxFiles) return;
    const entries = await readdir(join(workspaceRoot, dir), { withFileTypes: true }).catch(
      () => [],
    );
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (files.length >= maxFiles || entry.isSymbolicLink()) continue;
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && isPreviewPage(path)) files.push(path);
    }
  };
  await visit(relativeDir);
  return files.sort();
}

async function restorePreviewDescriptionSections(
  workspaceRoot: string,
  keepDescriptions: boolean,
): Promise<RegenerateDesignSystemPreviewDescriptionSections> {
  if (!keepDescriptions) {
    return {
      keepDescriptions: false,
      restored: 0,
      changedFiles: [],
      diagnostics: [],
      layerCount: 0,
    };
  }

  const components = await readDescriptionPreviewComponents(workspaceRoot);
  const layers: Record<string, ComponentDescriptionLayer | undefined> = {};
  for (const component of components) {
    const sidecar = await readComponentSidecarLayer(workspaceRoot, component).catch(() => null);
    if (sidecar?.descriptionLayer) layers[component.id] = sidecar.descriptionLayer;
  }
  const layerCount = Object.values(layers).filter(Boolean).length;
  if (layerCount === 0) {
    return {
      keepDescriptions: true,
      restored: 0,
      changedFiles: [],
      diagnostics: [],
      layerCount,
    };
  }

  const restored = await restoreHtmlDesignSystemDescriptionSections({
    workspacePath: workspaceRoot,
    components,
    layers,
    filePath: DESIGN_SYSTEM_PREVIEW_PATH,
  });
  return {
    keepDescriptions: true,
    restored: restored.restored,
    changedFiles: restored.changedFiles,
    diagnostics: restored.diagnostics,
    layerCount,
  };
}

async function readDescriptionPreviewComponents(
  workspaceRoot: string,
): Promise<IndexedComponentRecord[]> {
  const raw = await readWorkspaceFile(workspaceRoot, DESIGN_INDEX_PATHS.components).catch(() => '');
  if (!raw.trim()) return [];
  return raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as IndexedComponentRecord];
      } catch {
        return [];
      }
    })
    .filter((component) => {
      return (
        component.source === 'css-catalog' ||
        Boolean(component.docsAnchor) ||
        Boolean(component.requiredClasses?.length)
      );
    });
}

function sortTokens(tokens: PreviewToken[]): PreviewToken[] {
  return [...tokens].sort(
    (a, b) =>
      Number(b.theme === 'default') - Number(a.theme === 'default') ||
      a.name.localeCompare(b.name) ||
      a.theme.localeCompare(b.theme),
  );
}

function cssVarRef(name: string): string {
  return `--${name}`;
}

function themeSuffix(theme: string): string {
  return theme === 'default' ? '' : ` (${theme})`;
}

function compact(value: string, maxLength: number): string {
  const compacted = value.replace(/\s+/gu, ' ').trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, maxLength - 1).trimEnd()}…`;
}

function titleCase(value: string): string {
  return (
    value
      .split(/[-_\s]+/u)
      .filter(Boolean)
      .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
      .join(' ') || 'Project'
  );
}

function previewStyles(): string {
  return `      .dsp-shell { box-sizing: border-box; min-height: 100vh; padding: clamp(24px, 4vw, 56px); display: grid; gap: 32px; }
      .dsp-header { display: grid; gap: 8px; }
      .dsp-eyebrow { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0; text-transform: uppercase; color: var(--color-accent, #14532d); }
      .dsp-title { margin: 0; font-size: clamp(28px, 4vw, 44px); color: var(--color-text, #111827); }
      .dsp-lead { margin: 0; color: var(--color-muted, #6b7280); }
      .dsp-section { display: grid; gap: 12px; }
      .dsp-section-title { margin: 0; font-size: 18px; color: var(--color-text, #111827); }
      .dsp-swatch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
      .dsp-swatch { margin: 0; display: grid; gap: 6px; }
      .dsp-swatch-chip { display: block; block-size: 56px; border-radius: var(--radius-control, 8px); border: 1px solid var(--color-border, #d1d5db); }
      .dsp-token-name { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--color-text, #111827); }
      .dsp-token-value { font-size: 12px; color: var(--color-muted, #6b7280); }
      .dsp-type-list, .dsp-scale-list, .dsp-note-list, .dsp-component-grid, .dsp-reference-grid { display: grid; gap: 12px; }
      .dsp-type-row, .dsp-scale-row { display: grid; gap: 4px; }
      .dsp-type-sample { margin: 0; font-size: 20px; color: var(--color-text, #111827); }
      .dsp-scale-bar { display: block; block-size: 12px; min-inline-size: 4px; background: var(--color-accent, #14532d); border-radius: 4px; }
      .dsp-component-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
      .dsp-component { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--color-border, #d1d5db); border-radius: var(--radius-control, 8px); }
      .dsp-usage { margin: 0; overflow: auto; padding: 8px; font-size: 11px; background: var(--color-muted-surface, #f3f4f6); border-radius: 6px; }
      .dsp-usage-source { font-size: 11px; color: var(--color-muted, #6b7280); }
      .dsp-note h3 { margin: 0 0 4px; font-size: 14px; color: var(--color-text, #111827); }
      .dsp-note p { margin: 0; color: var(--color-muted, #6b7280); }
      .dsp-reference-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
      .dsp-reference { display: grid; gap: 6px; padding: 12px; color: var(--color-text, #111827); text-decoration: none; border: 1px solid var(--color-border, #d1d5db); border-radius: var(--radius-control, 8px); }
      .dsp-reference span { overflow: hidden; color: var(--color-muted, #6b7280); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
