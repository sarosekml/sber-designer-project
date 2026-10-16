import { descriptionLayerFromMarkdown } from '@sber-designer/storybook-indexer';
import {
  HTML_DESIGN_SYSTEM_PATHS,
  type ComponentDescriptionLayer,
} from '@sber-designer/shared-types';
import type { IndexedComponentRecord } from '@sber-designer/design-indexer';

import { readWorkspaceFile, writeWorkspaceFile } from './safe-fs';
import { htmlDescriptionSectionToMarkdown } from './html-description-section';

const DEFAULT_DESIGN_SYSTEM_PREVIEW = HTML_DESIGN_SYSTEM_PATHS.previewHtml;

export interface HtmlDesignSystemDescriptionWriteResult {
  written: boolean;
  filePath: string;
  block?: string;
  reason?: string;
  roundTripFields?: string[];
}

export interface HtmlDesignSystemDescriptionRestoreResult {
  restored: number;
  changedFiles: string[];
  diagnostics: string[];
}

export interface HtmlDesignSystemDescriptionProjection {
  filePath: string;
  block: string;
  descriptionLayer: ComponentDescriptionLayer;
  markdown: string;
}

export async function readHtmlDesignSystemDescriptionProjection(input: {
  workspacePath: string;
  component: IndexedComponentRecord;
  filePath?: string;
}): Promise<HtmlDesignSystemDescriptionProjection | null> {
  const filePath = input.filePath ?? DEFAULT_DESIGN_SYSTEM_PREVIEW;
  const block = descriptionBlockForComponent(input.component);
  if (!block) return null;

  let source: string;
  try {
    source = await readWorkspaceFile(input.workspacePath, filePath);
  } catch {
    return null;
  }

  const parsed = parseDescriptionSection(source, block);
  if (!parsed) return null;
  return {
    filePath,
    block,
    descriptionLayer: parsed.descriptionLayer,
    markdown: parsed.markdown,
  };
}

export async function writeHtmlDesignSystemDescription(input: {
  workspacePath: string;
  component: IndexedComponentRecord;
  layer: ComponentDescriptionLayer;
  filePath?: string;
}): Promise<HtmlDesignSystemDescriptionWriteResult> {
  const filePath = input.filePath ?? DEFAULT_DESIGN_SYSTEM_PREVIEW;
  const block = descriptionBlockForComponent(input.component);
  if (!block) return { written: false, filePath, reason: 'missing_description_block' };

  let original: string;
  try {
    original = await readWorkspaceFile(input.workspacePath, filePath);
  } catch {
    return { written: false, filePath, block, reason: 'design_system_preview_unreadable' };
  }

  const next = mergeDescriptionSection(original, block, input.layer);
  await writeWorkspaceFile(input.workspacePath, filePath, next);
  const parsed = parseDescriptionSectionLayer(next, block);
  const roundTrip = verifyRoundTrip(input.layer, parsed);
  if (!roundTrip.ok) {
    await writeWorkspaceFile(input.workspacePath, filePath, original);
    return {
      written: false,
      filePath,
      block,
      reason: 'round_trip_failed',
      roundTripFields: roundTrip.fields,
    };
  }

  return { written: true, filePath, block, roundTripFields: roundTrip.fields };
}

export async function restoreHtmlDesignSystemDescriptionSections(input: {
  workspacePath: string;
  components: IndexedComponentRecord[];
  layers: Record<string, ComponentDescriptionLayer | undefined>;
  filePath?: string;
}): Promise<HtmlDesignSystemDescriptionRestoreResult> {
  const filePath = input.filePath ?? DEFAULT_DESIGN_SYSTEM_PREVIEW;
  let source: string;
  try {
    source = await readWorkspaceFile(input.workspacePath, filePath);
  } catch {
    return {
      restored: 0,
      changedFiles: [],
      diagnostics: [`${filePath} is not readable.`],
    };
  }

  let next = source;
  let restored = 0;
  const diagnostics: string[] = [];
  for (const component of input.components) {
    const layer = input.layers[component.id];
    if (!layer) continue;
    const block = descriptionBlockForComponent(component);
    if (!block) {
      diagnostics.push(`No description block could be resolved for ${component.id}.`);
      continue;
    }
    const before = next;
    next = mergeDescriptionSection(next, block, layer);
    if (next !== before) restored += 1;
  }

  if (next !== source) {
    await writeWorkspaceFile(input.workspacePath, filePath, next);
    return { restored, changedFiles: [filePath], diagnostics };
  }
  return { restored: 0, changedFiles: [], diagnostics };
}

export function descriptionBlockForComponent(component: IndexedComponentRecord): string {
  return (
    component.docsAnchor?.trim() ||
    component.requiredClasses?.[0]?.trim() ||
    component.id.replace(/^css-catalog-/u, '').trim()
  );
}

function mergeDescriptionSection(
  source: string,
  block: string,
  layer: ComponentDescriptionLayer,
): string {
  const section = renderDescriptionSection(block, layer);
  const sectionRe = descriptionSectionRegex(block);
  if (sectionRe.test(source)) {
    return source.replace(sectionRe, () => section);
  }
  const lines = source.split(/\r?\n/);
  const anchorIndex = findDemoAnchorLine(lines, block);
  if (anchorIndex >= 0) {
    lines.splice(anchorIndex + 1, 0, '', indentLike(lines[anchorIndex] ?? '') + section);
    return lines.join('\n');
  }
  const closingMainIndex = lines.findIndex((line) => /<\/main>/iu.test(line));
  if (closingMainIndex >= 0) {
    lines.splice(closingMainIndex, 0, `  ${section}`, '');
    return lines.join('\n');
  }
  const closingBodyIndex = lines.findIndex((line) => /<\/body>/iu.test(line));
  if (closingBodyIndex >= 0) {
    lines.splice(closingBodyIndex, 0, `  ${section}`, '');
    return lines.join('\n');
  }
  return `${source.trimEnd()}\n\n${section}\n`;
}

function renderDescriptionSection(block: string, layer: ComponentDescriptionLayer): string {
  const lines = [
    `<section data-sd-description-for="${escapeHtml(block)}">`,
    '  <h2>Description for AI</h2>',
    `  <p><strong>Purpose:</strong> ${escapeHtml(layer.purpose)}</p>`,
  ];
  if (layer.whenToUse?.length) {
    lines.push(`  <p><strong>Use when:</strong> ${escapeHtml(layer.whenToUse.join('; '))}</p>`);
  }
  if (layer.whenNotToUse?.length) {
    lines.push(
      `  <p><strong>Use instead:</strong> ${escapeHtml(layer.whenNotToUse.join('; '))}</p>`,
    );
  }
  if (layer.variantGuidance?.length) {
    lines.push('  <p><strong>Variants:</strong></p>', '  <ul>');
    for (const guidance of layer.variantGuidance) {
      const values = guidance.values
        .map((value) => `<code>${escapeHtml(value.value)}</code> - ${escapeHtml(value.meaning)}`)
        .join('; ');
      lines.push(`    <li><code>${escapeHtml(guidance.prop)}</code>: ${values}</li>`);
    }
    lines.push('  </ul>');
  }
  if (layer.requiredProps?.length) {
    lines.push(
      `  <p><strong>Required props:</strong> ${layer.requiredProps
        .map((item) => `<code>${escapeHtml(item)}</code>`)
        .join(', ')}</p>`,
    );
  }
  if (layer.canonicalSnippets?.length) {
    const snippet = layer.canonicalSnippets[0];
    if (snippet) {
      lines.push(
        '  <p><strong>Canonical usage:</strong></p>',
        `  <pre><code class="language-html">${escapeHtml(snippet.code)}</code></pre>`,
      );
    }
  }
  if (layer.keywords?.length) {
    lines.push(`  <p><strong>Keywords:</strong> ${escapeHtml(layer.keywords.join(', '))}</p>`);
  }
  lines.push('</section>');
  return lines.join('\n');
}

function parseDescriptionSectionLayer(
  source: string,
  block: string,
): ComponentDescriptionLayer | null {
  return parseDescriptionSection(source, block)?.descriptionLayer ?? null;
}

function parseDescriptionSection(
  source: string,
  block: string,
): { markdown: string; descriptionLayer: ComponentDescriptionLayer } | null {
  const html = descriptionSectionRegex(block).exec(source)?.[0] ?? null;
  if (!html) return null;
  const markdown = htmlDescriptionSectionToMarkdown(html);
  const descriptionLayer = descriptionLayerFromMarkdown(markdown, { status: 'confirmed' });
  return descriptionLayer ? { markdown, descriptionLayer } : null;
}

function verifyRoundTrip(
  authored: ComponentDescriptionLayer,
  parsed: ComponentDescriptionLayer | null | undefined,
): { ok: boolean; fields: string[] } {
  const a = compareableLayer(authored);
  const b = compareableLayer(parsed);
  const fields: string[] = [];
  let ok = true;
  for (const key of [
    'purpose',
    'keywords',
    'requiredProps',
    'variantGuidance',
    'canonicalSnippets',
  ] as const) {
    const value = a[key];
    const authoredHas = Array.isArray(value) ? value.length > 0 : Boolean(value);
    if (!authoredHas) continue;
    fields.push(key);
    if (JSON.stringify(value) !== JSON.stringify(b[key])) ok = false;
  }
  return { ok, fields };
}

function compareableLayer(layer: ComponentDescriptionLayer | null | undefined) {
  const normMeaning = (value: string) => value.trim().replace(/[.;]+$/u, '');
  return {
    purpose: layer?.purpose?.trim() ?? '',
    keywords: (layer?.keywords ?? []).map((keyword) => keyword.trim()),
    requiredProps: layer?.requiredProps ?? [],
    variantGuidance: (layer?.variantGuidance ?? []).map((guidance) => ({
      prop: guidance.prop,
      values: guidance.values.map((value) => ({
        value: value.value,
        meaning: normMeaning(value.meaning),
      })),
    })),
    canonicalSnippets: (layer?.canonicalSnippets ?? []).map((snippet) => snippet.code.trim()),
  };
}

function descriptionSectionRegex(block: string): RegExp {
  const escaped = escapeRegExp(block);
  return new RegExp(
    `<section\\b(?=[^>]*\\bdata-sd-description-for\\s*=\\s*(["'])${escaped}\\1)[^>]*>[\\s\\S]*?<\\/section>`,
    'iu',
  );
}

function findDemoAnchorLine(lines: string[], block: string): number {
  return lines.findIndex((line) => lineHasExactClassToken(line, block));
}

function lineHasExactClassToken(line: string, block: string): boolean {
  const classAttrRe = /\bclass\s*=\s*(["'])(.*?)\1/giu;
  let match: RegExpExecArray | null;
  while ((match = classAttrRe.exec(line))) {
    const classList = match[2] ?? '';
    if (classList.split(/\s+/u).includes(block)) return true;
  }
  return false;
}

function indentLike(line: string): string {
  return /^\s*/u.exec(line)?.[0] ?? '';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
