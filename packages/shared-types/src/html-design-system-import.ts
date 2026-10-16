import { HTML_DESIGN_SYSTEM_PATHS } from './html-design-system-paths';

export const HTML_DESIGN_SYSTEM_IMPORT_MAX_FILES = 20;
export const HTML_DESIGN_SYSTEM_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const HTML_DESIGN_SYSTEM_IMPORT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export type HtmlDesignSystemImportTargetKind = 'source' | 'reference' | 'asset';

export interface HtmlDesignSystemImportClassification {
  kind: HtmlDesignSystemImportTargetKind;
  canonicalPath?: string;
}

export interface HtmlDesignSystemImportedFile {
  originalName: string;
  targetPath: string;
  kind: HtmlDesignSystemImportTargetKind;
  size: number;
  renamed: boolean;
}

export interface HtmlDesignSystemSkippedImportFile {
  name: string;
  reason: 'unsupported' | 'too-large' | 'invalid-name' | 'source-exists';
  detail: string;
}

export function classifyHtmlDesignSystemImportFileName(
  value: string,
): HtmlDesignSystemImportClassification | null {
  const name = value.trim().replace(/\\/gu, '/').split('/').at(-1) ?? '';
  const normalized = name.toLowerCase();
  if (normalized === 'design.md') {
    return { kind: 'source', canonicalPath: HTML_DESIGN_SYSTEM_PATHS.designMd };
  }
  if (normalized === 'tokens.css') {
    return { kind: 'source', canonicalPath: HTML_DESIGN_SYSTEM_PATHS.tokensCss };
  }
  if (normalized === 'components.css') {
    return { kind: 'source', canonicalPath: HTML_DESIGN_SYSTEM_PATHS.componentsCss };
  }
  const extension = normalized.includes('.') ? `.${normalized.split('.').at(-1)}` : '';
  if (['.html', '.htm', '.css', '.js', '.mjs', '.cjs'].includes(extension)) {
    return { kind: 'reference' };
  }
  if (
    [
      '.avif',
      '.eot',
      '.gif',
      '.ico',
      '.jpeg',
      '.jpg',
      '.otf',
      '.png',
      '.svg',
      '.ttf',
      '.webp',
      '.woff',
      '.woff2',
    ].includes(extension)
  ) {
    return { kind: 'asset' };
  }
  return null;
}
