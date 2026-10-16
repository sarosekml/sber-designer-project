import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HTML_DESIGN_SYSTEM_PATHS, isHtmlDesignSystemPath } from '@sber-designer/shared-types';

import { normalizeScanPath } from './scan-shared';

export function blockForClass(className: string): string {
  const elementIndex = className.indexOf('__');
  const modifierIndex = className.indexOf('--');
  const cut = [elementIndex, modifierIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0];
  return cut === undefined ? className : className.slice(0, cut);
}

export function isModifierClass(className: string, block: string): boolean {
  return className.startsWith(`${block}--`);
}

export function extractElementSnippet(contents: string, start: number, tag: string): string {
  const openEnd = contents.indexOf('>', start);
  if (openEnd === -1) return '';
  const opening = contents.slice(start, openEnd + 1);
  if (/\/>\s*$/u.test(opening)) return trimSnippet(opening);
  const closeRe = new RegExp(`</${escapeRegExp(tag)}\\s*>`, 'iu');
  const close = closeRe.exec(contents.slice(openEnd + 1));
  if (!close) return trimSnippet(opening);
  return trimSnippet(contents.slice(start, openEnd + 1 + close.index + close[0].length));
}

function trimSnippet(value: string): string {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 1200);
}

export function isCatalogHtml(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return (
    isHtmlDesignSystemPath(normalized) ||
    normalized === 'components.html' ||
    normalized === 'ui.html' ||
    normalized.endsWith('/components.html') ||
    normalized.endsWith('/ui.html')
  );
}

export function isDesignSystemPreviewHtml(filePath: string, contents: string): boolean {
  const normalized = normalizeScanPath(filePath).toLowerCase();
  return (
    normalized === HTML_DESIGN_SYSTEM_PATHS.previewHtml ||
    normalized === 'design-system.html' ||
    normalized === 'design/design-system.html' ||
    normalized === 'preview/design-system.html' ||
    /\bdata-sd-managed-design-system-preview\b/u.test(contents)
  );
}

export async function readCatalogText(workspaceRoot: string, filePath: string): Promise<string> {
  return readFile(resolve(workspaceRoot, filePath), 'utf8').catch(() => '');
}

export function pascalCase(value: string): string {
  const words = value.split(/[^A-Za-z0-9]+/u).filter(Boolean);
  const name = words.map((word) => word[0]?.toUpperCase() + word.slice(1)).join('');
  return name || 'Component';
}

export function slug(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function kebabWords(value: string): string[] {
  return value
    .split(/(?=[A-Z])|[^A-Za-z0-9]+/u)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
}

export function groupIdsForBlock(block: string): string[] {
  const text = block.toLowerCase();
  if (/table|grid|list|row|cell/u.test(text)) return ['tables-lists'];
  if (/input|field|form|select|checkbox|radio|textarea|search/u.test(text)) {
    return ['forms-inputs'];
  }
  if (/nav|menu|breadcrumb|tab|sidebar|command/u.test(text)) return ['navigation'];
  if (/button|action|cta|link|toolbar/u.test(text)) return ['actions'];
  if (/badge|status|alert|toast|progress|priority|empty/u.test(text)) return ['status-feedback'];
  if (/chart|graph|metric|kpi|stat/u.test(text)) return ['data-visualization'];
  return ['layout-surfaces'];
}

export function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
