export const HTML_DESIGN_SYSTEM_FOLDER = 'design-system';

export interface HtmlDesignSystemPaths {
  folder: string;
  designMd: string;
  tokensCss: string;
  componentsCss: string;
  previewHtml: string;
  refsDir: string;
  assetsDir: string;
}

export const LEGACY_HTML_DESIGN_SYSTEM_PATHS = [
  'Design.md',
  'DESIGN.md',
  'design.md',
  'tokens.css',
  'components.css',
  'design-system.html',
  'pages/design-system.html',
  'design/Design.md',
  'design/DESIGN.md',
  'design/design.md',
  'design/tokens.css',
  'styles/tokens.css',
  'css/tokens.css',
  'design/components.css',
  'styles/components.css',
  'css/components.css',
  'design/design-system.html',
  'preview/design-system.html',
] as const;

export function resolveHtmlDesignSystemPaths(
  folder = HTML_DESIGN_SYSTEM_FOLDER,
): HtmlDesignSystemPaths {
  const normalizedFolder = normalizeWorkspacePath(folder).replace(/\/$/u, '');
  if (!normalizedFolder || normalizedFolder === '.' || normalizedFolder.startsWith('../')) {
    throw new Error(`Invalid HTML design-system folder: ${folder}`);
  }
  const child = (name: string) => `${normalizedFolder}/${name}`;
  return {
    folder: normalizedFolder,
    designMd: child('Design.md'),
    tokensCss: child('tokens.css'),
    componentsCss: child('components.css'),
    previewHtml: child('index.html'),
    refsDir: child('refs'),
    assetsDir: child('assets'),
  };
}

export const HTML_DESIGN_SYSTEM_PATHS = resolveHtmlDesignSystemPaths();

export function normalizeWorkspacePath(value: string): string {
  return value
    .trim()
    .replace(/\\/gu, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+/gu, '/');
}

export function isHtmlDesignSystemPath(value: string | null | undefined): boolean {
  const normalized = normalizeWorkspacePath(value ?? '').toLowerCase();
  const folder = `${HTML_DESIGN_SYSTEM_PATHS.folder.toLowerCase()}/`;
  return (
    normalized === HTML_DESIGN_SYSTEM_PATHS.folder.toLowerCase() || normalized.startsWith(folder)
  );
}

export function isHtmlDesignSystemReferencePath(value: string | null | undefined): boolean {
  const normalized = normalizeWorkspacePath(value ?? '').toLowerCase();
  return normalized.startsWith(`${HTML_DESIGN_SYSTEM_PATHS.refsDir.toLowerCase()}/`);
}

export function isLegacyHtmlDesignSystemPath(value: string | null | undefined): boolean {
  const normalized = normalizeWorkspacePath(value ?? '').toLowerCase();
  return LEGACY_HTML_DESIGN_SYSTEM_PATHS.some(
    (candidate) => candidate.toLowerCase() === normalized,
  );
}
