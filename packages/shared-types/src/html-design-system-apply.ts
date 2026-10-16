export const HTML_DESIGN_SYSTEM_APPLY_DIRECTIVE_START = '[SBER_DESIGNER_HTML_DS_APPLY]';
export const HTML_DESIGN_SYSTEM_APPLY_DIRECTIVE_END = '[/SBER_DESIGNER_HTML_DS_APPLY]';

export function buildHtmlDesignSystemApplyDirective(paths: readonly string[]): string {
  const targets = normalizeHtmlDesignSystemApplyTargets(paths);
  return [
    HTML_DESIGN_SYSTEM_APPLY_DIRECTIVE_START,
    ...targets.map((path) => `targetPage=${path}`),
    HTML_DESIGN_SYSTEM_APPLY_DIRECTIVE_END,
  ].join('\n');
}

export function parseHtmlDesignSystemApplyDirective(text: string): string[] {
  const start = text.indexOf(HTML_DESIGN_SYSTEM_APPLY_DIRECTIVE_START);
  if (start < 0) return [];
  const end = text.indexOf(HTML_DESIGN_SYSTEM_APPLY_DIRECTIVE_END, start);
  if (end < 0) return [];
  const body = text.slice(start + HTML_DESIGN_SYSTEM_APPLY_DIRECTIVE_START.length, end);
  const targets: string[] = [];
  for (const rawLine of body.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key === 'targetPage') targets.push(value);
  }
  return normalizeHtmlDesignSystemApplyTargets(targets);
}

export function stripHtmlDesignSystemApplyDirective(text: string): string {
  const start = text.indexOf(HTML_DESIGN_SYSTEM_APPLY_DIRECTIVE_START);
  if (start < 0) return text;
  const end = text.indexOf(HTML_DESIGN_SYSTEM_APPLY_DIRECTIVE_END, start);
  if (end < 0) return text;
  return `${text.slice(0, start)}${text.slice(
    end + HTML_DESIGN_SYSTEM_APPLY_DIRECTIVE_END.length,
  )}`.trim();
}

export function isHtmlDesignSystemApplyTargetPath(path: string): boolean {
  return normalizeHtmlDesignSystemApplyTargetPath(path) !== null;
}

function normalizeHtmlDesignSystemApplyTargets(paths: readonly string[]): string[] {
  return Array.from(
    new Set(paths.flatMap((path) => normalizeHtmlDesignSystemApplyTargetPath(path) ?? [])),
  ).sort();
}

function normalizeHtmlDesignSystemApplyTargetPath(path: string): string | null {
  const normalized = path
    .trim()
    .replace(/\\/gu, '/')
    .replace(/^\.\/+/u, '')
    .replace(/\/{2,}/gu, '/');
  if (!normalized || normalized.startsWith('/') || /^[a-z]:\//iu.test(normalized)) return null;
  if (normalized.split('/').some((segment) => segment === '..')) return null;
  if (!/\.html?$/iu.test(normalized)) return null;
  if (normalized.startsWith('design/proposals/')) return null;
  if (isHtmlDesignSystemPath(normalized)) return null;
  const basename = normalized.split('/').at(-1)?.toLowerCase() ?? normalized.toLowerCase();
  if (basename === 'index.html') return null;
  if (normalized.toLowerCase() === 'design-system.html') return null;
  return normalized;
}
import { isHtmlDesignSystemPath } from './html-design-system-paths';
