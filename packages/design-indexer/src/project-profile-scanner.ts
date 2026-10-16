import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectProfileFile } from './types';
import { collectSourceFiles } from './scan-shared';
import type {
  HtmlDesignSystemSourceId,
  HtmlDesignSystemSources,
  HtmlDesignSystemSourceStatus,
} from '@sber-designer/shared-types';
import {
  HTML_DESIGN_SYSTEM_PATHS,
  LEGACY_HTML_DESIGN_SYSTEM_PATHS,
} from '@sber-designer/shared-types';

const SCREEN_ROOT_MARKER = 'data-sd-screen-root';
const HTML_SCREEN_GLOB = '{pages,screens,public,site}/**/*.html';
const REACT_SCREEN_GLOB = 'src/**/*.{tsx,jsx}';
const UI_PACKAGE_RE =
  /^(react|@storybook\/|storybook$|@mui\/|@radix-ui\/|@chakra-ui\/|antd$|react-bootstrap$|lucide-react$|tailwindcss$|@fluentui\/|@carbon\/|@adobe\/react-spectrum$)/u;

export async function scanProjectProfile(workspaceRoot: string): Promise<ProjectProfileFile> {
  const projectFile = await readJson<{ projectKind?: string }>(
    workspaceRoot,
    '.sber-designer/project.sdproj',
  );
  const explicitHtmlFirst = projectFile?.projectKind === 'html-first';
  const packageJson = await readJson<Record<string, unknown>>(workspaceRoot, 'package.json');
  const dependencies = {
    ...asRecord(packageJson?.dependencies),
    ...asRecord(packageJson?.devDependencies),
  };
  const scripts = Object.fromEntries(
    Object.entries(asRecord(packageJson?.scripts)).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  const tsconfig = await readJson<{ compilerOptions?: { paths?: Record<string, string[]> } }>(
    workspaceRoot,
    'tsconfig.json',
  );
  const hasStorybookConfig = await exists(workspaceRoot, '.storybook');
  const staticFiles = await detectStaticFiles(workspaceRoot);
  const hasHtml = staticFiles.some((file) => /\.html?$/i.test(file));
  const hasCss = staticFiles.some((file) => /\.(css|scss|sass|less)$/i.test(file));
  const dependencyFrameworks = detectFrameworks(dependencies, scripts, hasStorybookConfig);
  const kind = detectProjectKind({
    explicitHtmlFirst,
    hasPackageJson: Boolean(packageJson),
    frameworks: dependencyFrameworks,
    hasHtml,
    hasCss,
  });

  return {
    kind,
    screenUnit: screenUnitForKind(kind),
    componentModel: kind === 'html-css' ? 'css-catalog' : 'react-index',
    renderProbe: kind === 'react-storybook' ? 'storybook' : 'static-html',
    ...(kind === 'html-css'
      ? { htmlDesignSystem: await detectHtmlDesignSystemSources(workspaceRoot) }
      : {}),
    packageManager: await detectPackageManager(workspaceRoot),
    frameworks: normalizeFrameworks(dependencyFrameworks, kind, hasHtml, hasCss),
    sourceRoots: await detectSourceRoots(workspaceRoot),
    styling: detectStyling(dependencies, hasCss),
    aliases: tsconfig?.compilerOptions?.paths ?? {},
    packageScripts: scripts,
    allowedUiPackages: detectAllowedUiPackages(dependencies),
  };
}

const HTML_DESIGN_SYSTEM_SOURCE_DEFS: Array<
  Omit<HtmlDesignSystemSourceStatus, 'status' | 'foundPath'>
> = [
  {
    id: 'design-md',
    label: 'Design.md',
    required: true,
    canonicalPath: HTML_DESIGN_SYSTEM_PATHS.designMd,
    aliases: [
      'Design.md',
      'DESIGN.md',
      'design.md',
      'design/Design.md',
      'design/DESIGN.md',
      'design/design.md',
    ],
  },
  {
    id: 'tokens-css',
    label: 'tokens.css',
    required: true,
    canonicalPath: HTML_DESIGN_SYSTEM_PATHS.tokensCss,
    aliases: ['tokens.css', 'design/tokens.css', 'styles/tokens.css', 'css/tokens.css'],
  },
  {
    id: 'components-css',
    label: 'components.css',
    required: true,
    canonicalPath: HTML_DESIGN_SYSTEM_PATHS.componentsCss,
    aliases: [
      'components.css',
      'design/components.css',
      'styles/components.css',
      'css/components.css',
    ],
  },
  {
    id: 'design-system-preview',
    label: 'design-system/index.html',
    required: false,
    canonicalPath: HTML_DESIGN_SYSTEM_PATHS.previewHtml,
    aliases: [
      'design-system.html',
      'pages/design-system.html',
      'design/design-system.html',
      'preview/design-system.html',
    ],
  },
];

async function detectHtmlDesignSystemSources(
  workspaceRoot: string,
): Promise<HtmlDesignSystemSources> {
  const sources = await Promise.all(
    HTML_DESIGN_SYSTEM_SOURCE_DEFS.map(async (source): Promise<HtmlDesignSystemSourceStatus> => {
      const candidates = [source.canonicalPath, ...source.aliases];
      const foundPath = await firstExistingPath(workspaceRoot, candidates);
      return {
        ...source,
        status: foundPath ? 'found' : 'missing',
        ...(foundPath ? { foundPath } : {}),
      };
    }),
  );
  const foundRequired = sources
    .filter((source) => source.required && source.status === 'found')
    .map((source) => source.id);
  const missingRequired = sources
    .filter((source) => source.required && source.status === 'missing')
    .map((source) => source.id);
  const canonicalRequired = sources.filter(
    (source) => source.required && source.foundPath === source.canonicalPath,
  ).length;
  const hasLegacyEvidence = await anyExistingPath(workspaceRoot, LEGACY_HTML_DESIGN_SYSTEM_PATHS);
  const referencePages: string[] = [];
  await collectSourceFiles(workspaceRoot, HTML_DESIGN_SYSTEM_PATHS.folder, referencePages, {
    fileRe: /\.html?$/iu,
    maxFiles: 100,
  });
  const status =
    canonicalRequired === sources.filter((source) => source.required).length
      ? 'canonical'
      : foundRequired.length > 0 || hasLegacyEvidence
        ? 'non-canonical'
        : 'missing';
  return {
    status,
    folderPath: HTML_DESIGN_SYSTEM_PATHS.folder,
    referencePages: referencePages
      .filter((path) => path !== HTML_DESIGN_SYSTEM_PATHS.previewHtml)
      .sort(),
    foundRequired: foundRequired as HtmlDesignSystemSourceId[],
    missingRequired: missingRequired as HtmlDesignSystemSourceId[],
    sources,
  };
}

async function anyExistingPath(workspaceRoot: string, paths: readonly string[]): Promise<boolean> {
  for (const filePath of paths) {
    if (await exists(workspaceRoot, filePath)) return true;
  }
  return false;
}

async function firstExistingPath(workspaceRoot: string, paths: string[]): Promise<string | null> {
  for (const filePath of paths) {
    if (await exists(workspaceRoot, filePath)) return filePath;
  }
  return null;
}

async function detectPackageManager(
  workspaceRoot: string,
): Promise<ProjectProfileFile['packageManager']> {
  if (await exists(workspaceRoot, 'bun.lock')) return 'bun';
  if (await exists(workspaceRoot, 'pnpm-lock.yaml')) return 'pnpm';
  if (await exists(workspaceRoot, 'yarn.lock')) return 'yarn';
  if (await exists(workspaceRoot, 'package-lock.json')) return 'npm';
  return 'unknown';
}

function detectFrameworks(
  dependencies: Record<string, unknown>,
  scripts: Record<string, string>,
  hasStorybookConfig: boolean,
) {
  const frameworks = new Set<string>();
  if (dependencies.react) frameworks.add('react');
  if (dependencies.next) frameworks.add('next');
  if (dependencies.vite || dependencies['@vitejs/plugin-react']) frameworks.add('vite');
  if (
    dependencies.storybook ||
    Object.keys(dependencies).some(
      (name) => name === 'storybook' || name.startsWith('@storybook/'),
    ) ||
    hasStorybookConfig ||
    Object.values(scripts).some((script) => script.includes('storybook'))
  )
    frameworks.add('storybook');
  return Array.from(frameworks).sort();
}

function detectStyling(dependencies: Record<string, unknown>, hasCss: boolean) {
  const styling = new Set<string>();
  if (hasCss) styling.add('css');
  if (dependencies.tailwindcss) styling.add('tailwind');
  if (dependencies['styled-components']) styling.add('styled-components');
  if (dependencies['@emotion/react'] || dependencies['@emotion/styled']) styling.add('emotion');
  return Array.from(styling).sort();
}

async function detectSourceRoots(workspaceRoot: string): Promise<string[]> {
  const candidates = [
    'src',
    'app',
    'pages',
    HTML_DESIGN_SYSTEM_PATHS.folder,
    'screens',
    'components',
    'stories',
    'styles',
    'theme',
    'tokens',
    'public',
    'site',
  ];
  const roots: string[] = [];
  for (const candidate of candidates) {
    if (await exists(workspaceRoot, candidate)) roots.push(candidate);
  }
  return roots;
}

async function detectStaticFiles(workspaceRoot: string): Promise<string[]> {
  const files: string[] = [];
  await collectSourceFiles(workspaceRoot, '.', files, {
    fileRe: /\.(html?|css|scss|sass|less)$/i,
    maxFiles: 200,
  });
  return files;
}

function detectProjectKind(input: {
  explicitHtmlFirst?: boolean;
  hasPackageJson: boolean;
  frameworks: string[];
  hasHtml: boolean;
  hasCss: boolean;
}): ProjectProfileFile['kind'] {
  if (input.explicitHtmlFirst) return 'html-css';
  if (input.frameworks.includes('storybook') && input.frameworks.includes('react')) {
    return 'react-storybook';
  }
  if (input.frameworks.includes('react') || input.frameworks.includes('next')) return 'react';
  if (!input.hasPackageJson && input.hasHtml && input.hasCss) return 'html-css';
  if (input.hasHtml && input.hasCss && input.frameworks.length === 0) return 'html-css';
  return 'empty';
}

function screenUnitForKind(kind: ProjectProfileFile['kind']): ProjectProfileFile['screenUnit'] {
  if (kind === 'html-css') {
    return {
      sourceGlob: HTML_SCREEN_GLOB,
      storyRequired: false,
      rootMarker: SCREEN_ROOT_MARKER,
    };
  }
  return {
    sourceGlob: REACT_SCREEN_GLOB,
    storyRequired: kind === 'react-storybook',
    rootMarker: SCREEN_ROOT_MARKER,
  };
}

function normalizeFrameworks(
  frameworks: string[],
  kind: ProjectProfileFile['kind'],
  hasHtml: boolean,
  hasCss: boolean,
): string[] {
  const normalized = new Set(frameworks);
  if (kind === 'html-css') {
    if (hasHtml) normalized.add('html');
    if (hasCss) normalized.add('css');
  }
  return Array.from(normalized).sort();
}

function detectAllowedUiPackages(dependencies: Record<string, unknown>): string[] {
  return Object.keys(dependencies)
    .filter((name) => UI_PACKAGE_RE.test(name))
    .sort();
}

async function exists(workspaceRoot: string, filePath: string): Promise<boolean> {
  try {
    await stat(resolve(workspaceRoot, filePath));
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(workspaceRoot: string, filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(resolve(workspaceRoot, filePath), 'utf8')) as T;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
