import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, posix, relative, resolve } from 'node:path';
import {
  HTML_DESIGN_SYSTEM_PATHS,
  LEGACY_HTML_DESIGN_SYSTEM_PATHS,
  isHtmlDesignSystemPath,
  type HtmlProjectStructureConflict,
  type HtmlProjectStructureFile,
  type HtmlProjectStructureFileKind,
  type HtmlProjectStructureLink,
  type HtmlProjectStructureMapping,
  type HtmlProjectStructureReport,
} from '@sber-designer/shared-types';

import { scanProjectProfile } from './project-profile-scanner';

const MAX_STRUCTURE_FILES = 300;
const SKIPPED_DIRS = new Set([
  '.git',
  '.sber-designer',
  '.next',
  '.nuxt',
  '.output',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'vendor',
]);
const BUILD_DIRS = new Set(['.next', '.nuxt', '.output', 'build', 'coverage', 'dist', 'out']);
const ASSET_EXTENSIONS = new Set([
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
]);
const MANAGED_MARKERS = ['data-sd-managed-design-system-preview', 'data-sd-managed-screen-index'];
const HTML_REFERENCE_RE = /(?:href|src)\s*=\s*["']([^"']+)["']/giu;
const CSS_URL_RE = /url\(\s*["']?([^"')]+)["']?\s*\)/giu;

export async function getHtmlProjectStructureReport(
  workspaceRoot: string,
): Promise<HtmlProjectStructureReport> {
  const { files: scannedPaths, buildArtifacts, truncated } = await scanWorkspaceTree(workspaceRoot);
  const projectProfile = await scanProjectProfile(workspaceRoot);
  const unsupported = await unsupportedProjectReason(workspaceRoot, projectProfile.kind);
  const files = await Promise.all(
    scannedPaths.map(async (path): Promise<HtmlProjectStructureFile> => {
      const contents = isTextCandidate(path)
        ? await readFile(resolve(workspaceRoot, path), 'utf8').catch(() => '')
        : '';
      const managed = MANAGED_MARKERS.some((marker) => contents.includes(marker));
      return {
        path,
        kind: classifyFile(path, managed, buildArtifacts),
        ...(managed ? { managed: true } : {}),
      };
    }),
  );
  const pageCandidates = files.filter((file) => file.kind === 'page').map((file) => file.path);
  const designSystemCandidates = files
    .filter(
      (file) => file.kind === 'design-system-source' || file.kind === 'design-system-reference',
    )
    .map((file) => file.path);
  const stylesheets = files.filter((file) => file.kind === 'stylesheet').map((file) => file.path);
  const scripts = files.filter((file) => file.kind === 'script').map((file) => file.path);
  const assets = files.filter((file) => file.kind === 'asset').map((file) => file.path);
  const links = await inspectWorkspaceLinks(workspaceRoot, scannedPaths);
  const hasManagedScreenIndex = files.some(
    (file) => file.path === 'index.html' && file.managed === true,
  );
  const hasManagedDesignSystemPreview = files.some(
    (file) => file.path === HTML_DESIGN_SYSTEM_PATHS.previewHtml && file.managed === true,
  );
  const misplacedPages = pageCandidates.filter((path) => !path.startsWith('pages/'));
  const legacyDesignSystemPaths = files
    .filter((file) => isLegacyDesignSystemPath(file.path))
    .map((file) => file.path);
  const canonicalLayout =
    projectProfile.htmlDesignSystem?.status === 'canonical' &&
    hasManagedScreenIndex &&
    hasManagedDesignSystemPreview &&
    misplacedPages.length === 0 &&
    legacyDesignSystemPaths.length === 0;
  const hasHtmlWorkspaceEvidence =
    pageCandidates.length > 0 ||
    designSystemCandidates.length > 0 ||
    stylesheets.length > 0 ||
    scripts.length > 0;
  const status = unsupported
    ? 'unsupported'
    : projectProfile.htmlDesignSystem?.status === 'missing' && !hasHtmlWorkspaceEvidence
      ? 'missing'
      : canonicalLayout
        ? 'canonical'
        : 'non-canonical';
  const violations = buildViolations({
    status,
    files,
    pageCandidates,
    profileStatus: projectProfile.htmlDesignSystem?.status,
    hasManagedScreenIndex,
    hasManagedDesignSystemPreview,
    legacyDesignSystemPaths,
  });
  const proposedMappings = buildProposedMappings(files, status);
  const conflicts = buildStructureConflicts(files, proposedMappings);
  const linksWithProposals = applyProposedLinkRewrites(links, proposedMappings);
  const brokenLinks = linksWithProposals.filter((link) => link.status === 'broken');
  const manualFollowUps = buildManualFollowUps({
    unsupported,
    truncated,
    buildArtifacts,
    links: linksWithProposals,
    proposedMappings,
    conflicts,
  });
  const planDigest = await buildPlanDigest(workspaceRoot, scannedPaths, {
    status,
    proposedMappings,
    links: linksWithProposals,
    conflicts,
  });

  return {
    version: 1,
    planDigest,
    status,
    supported: !unsupported,
    reason: unsupported
      ? unsupported
      : status === 'canonical'
        ? 'The project already uses the canonical sber-designer HTML layout.'
        : status === 'missing'
          ? 'No static HTML pages or design-system sources were found.'
          : 'Static HTML was found, but the project does not yet use the complete canonical layout.',
    alreadyCanonical:
      status === 'canonical' &&
      violations.length === 0 &&
      conflicts.length === 0 &&
      brokenLinks.length === 0,
    scannedFiles: files.length,
    truncated,
    files,
    pageCandidates,
    designSystemCandidates,
    stylesheets,
    scripts,
    assets,
    buildArtifacts,
    violations,
    proposedMappings,
    conflicts,
    links: linksWithProposals,
    brokenLinks,
    manualFollowUps,
  };
}

function applyProposedLinkRewrites(
  links: HtmlProjectStructureLink[],
  mappings: HtmlProjectStructureMapping[],
): HtmlProjectStructureLink[] {
  const moved = new Map(
    mappings
      .filter(
        (mapping): mapping is HtmlProjectStructureMapping & { sourcePath: string } =>
          mapping.action === 'move' && Boolean(mapping.sourcePath),
      )
      .map((mapping) => [mapping.sourcePath, mapping.targetPath]),
  );
  return links.map((link) => {
    if (link.status !== 'ok' || !link.resolvedPath) return link;
    const nextSourcePath = moved.get(link.sourcePath) ?? link.sourcePath;
    const nextTargetPath = moved.get(link.resolvedPath) ?? link.resolvedPath;
    if (nextSourcePath === link.sourcePath && nextTargetPath === link.resolvedPath) return link;
    const relativeReference = posix.relative(posix.dirname(nextSourcePath), nextTargetPath);
    const proposedReference = relativeReference.startsWith('.')
      ? relativeReference
      : `./${relativeReference}`;
    return proposedReference === link.reference ? link : { ...link, proposedReference };
  });
}

export async function checkHtmlProjectLinks(
  workspaceRoot: string,
): Promise<{ checked: number; broken: HtmlProjectStructureLink[] }> {
  const { files } = await scanWorkspaceTree(workspaceRoot);
  const links = await inspectWorkspaceLinks(workspaceRoot, files);
  return { checked: links.length, broken: links.filter((link) => link.status === 'broken') };
}

async function scanWorkspaceTree(workspaceRoot: string): Promise<{
  files: string[];
  buildArtifacts: string[];
  truncated: boolean;
}> {
  const files: string[] = [];
  const buildArtifacts: string[] = [];
  let truncated = false;

  const visit = async (relativeDir: string): Promise<void> => {
    if (truncated) return;
    const absoluteDir = resolve(workspaceRoot, relativeDir);
    const entries = await readdir(absoluteDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = normalizePath(posix.join(relativeDir, entry.name));
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (BUILD_DIRS.has(entry.name)) buildArtifacts.push(path);
        if (!SKIPPED_DIRS.has(entry.name)) await visit(path);
        continue;
      }
      if (!entry.isFile()) continue;
      const stats = await lstat(resolve(workspaceRoot, path)).catch(() => null);
      if (!stats?.isFile()) continue;
      files.push(path);
      if (files.length >= MAX_STRUCTURE_FILES) {
        truncated = true;
        return;
      }
    }
  };

  await visit('.');
  return {
    files: files.sort(),
    buildArtifacts: buildArtifacts.sort(),
    truncated,
  };
}

async function unsupportedProjectReason(
  workspaceRoot: string,
  kind: string,
): Promise<string | null> {
  const packageJson = await readJson(workspaceRoot, 'package.json');
  const packages = {
    ...asRecord(packageJson?.dependencies),
    ...asRecord(packageJson?.devDependencies),
  };
  const scripts = Object.values(asRecord(packageJson?.scripts)).filter(
    (value): value is string => typeof value === 'string',
  );
  const frameworkPackages = ['react', 'next', 'vue', 'svelte', 'angular', '@angular/core'];
  const bundlerPackages = ['vite', 'webpack', 'parcel', 'rollup', 'esbuild'];
  const detected = [...frameworkPackages, ...bundlerPackages].filter((name) => name in packages);
  if (kind === 'react' || kind === 'react-storybook' || detected.length > 0) {
    return `Automatic HTML restructuring is disabled for framework or bundler projects (${detected.join(', ') || kind}).`;
  }
  if (scripts.some((script) => /\b(next|vite|webpack|parcel|rollup)\b/u.test(script))) {
    return 'Automatic HTML restructuring is disabled because package scripts use a framework or bundler.';
  }
  return null;
}

function classifyFile(
  path: string,
  managed: boolean,
  buildArtifacts: string[],
): HtmlProjectStructureFileKind {
  if (buildArtifacts.some((dir) => path === dir || path.startsWith(`${dir}/`))) {
    return 'build-artifact';
  }
  if (managed) return 'managed';
  if (isHtmlDesignSystemPath(path)) {
    if (path === HTML_DESIGN_SYSTEM_PATHS.designMd || path.endsWith('.css')) {
      return 'design-system-source';
    }
    if (/\.html?$/iu.test(path)) return 'design-system-reference';
  }
  if (
    LEGACY_HTML_DESIGN_SYSTEM_PATHS.some((legacy) => legacy.toLowerCase() === path.toLowerCase())
  ) {
    return 'design-system-source';
  }
  const extension = extname(path).toLowerCase();
  if (extension === '.html' || extension === '.htm') return 'page';
  if (
    extension === '.css' ||
    extension === '.scss' ||
    extension === '.sass' ||
    extension === '.less'
  ) {
    return 'stylesheet';
  }
  if (extension === '.js' || extension === '.mjs' || extension === '.cjs') return 'script';
  if (ASSET_EXTENSIONS.has(extension)) return 'asset';
  return 'other';
}

function buildViolations(input: {
  status: HtmlProjectStructureReport['status'];
  files: HtmlProjectStructureFile[];
  pageCandidates: string[];
  profileStatus: string | undefined;
  hasManagedScreenIndex: boolean;
  hasManagedDesignSystemPreview: boolean;
  legacyDesignSystemPaths: string[];
}): string[] {
  if (input.status === 'unsupported') return [];
  const violations: string[] = [];
  if (input.profileStatus !== 'canonical') {
    violations.push('The canonical design-system/ package is incomplete or missing.');
  }
  const misplacedPages = input.pageCandidates.filter((path) => !path.startsWith('pages/'));
  if (misplacedPages.length > 0) violations.push('Product pages exist outside pages/.');
  if (!input.hasManagedScreenIndex) {
    violations.push('The managed root Screens Index is missing or user-owned.');
  }
  if (!input.hasManagedDesignSystemPreview) {
    violations.push('The managed design-system preview is missing or user-owned.');
  }
  if (input.legacyDesignSystemPaths.length > 0) {
    violations.push('Legacy design-system files remain outside the canonical package.');
  }
  const designSystemScreens = input.files.filter(
    (file) => file.kind === 'page' && isHtmlDesignSystemPath(file.path),
  );
  if (designSystemScreens.length > 0)
    violations.push('Design-system files are classified as screens.');
  return violations;
}

function buildProposedMappings(
  files: HtmlProjectStructureFile[],
  status: HtmlProjectStructureReport['status'],
): HtmlProjectStructureMapping[] {
  if (status === 'unsupported' || status === 'missing') return [];
  if (status === 'canonical') {
    return files
      .filter((file) => isCanonicalManagedOrSource(file.path))
      .map((file) => ({
        sourcePath: file.path,
        targetPath: file.path,
        action: 'keep' as const,
        reason: 'Already canonical.',
      }));
  }
  const mappings: HtmlProjectStructureMapping[] = [];
  const mappedTargets = new Set<string>();
  for (const file of files) {
    if (file.path === HTML_DESIGN_SYSTEM_PATHS.previewHtml && !file.managed) {
      addMapping(mappings, mappedTargets, {
        sourcePath: file.path,
        targetPath: `${HTML_DESIGN_SYSTEM_PATHS.refsDir}/imported-index.html`,
        action: 'move',
        reason: 'Preserve the user-owned design-system index as a reference before rebuilding.',
      });
      continue;
    }
    if (isLegacyDesignSystemPreview(file.path)) {
      addMapping(mappings, mappedTargets, {
        sourcePath: file.path,
        targetPath: file.managed
          ? file.path
          : `${HTML_DESIGN_SYSTEM_PATHS.refsDir}/${posix.basename(file.path)}`,
        action: file.managed ? 'remove-managed' : 'move',
        reason: file.managed
          ? 'Remove the obsolete generated preview after the canonical preview is rebuilt.'
          : 'Preserve the legacy user-authored preview as a design-system reference.',
      });
      continue;
    }
    const legacyTarget = legacyDesignSystemTarget(file.path);
    if (legacyTarget) {
      addMapping(mappings, mappedTargets, {
        sourcePath: file.path,
        targetPath: legacyTarget,
        action: 'move',
        reason: 'Move the legacy design-system source into the canonical package.',
      });
      continue;
    }
    if (file.kind === 'page' && !file.path.startsWith('pages/')) {
      addMapping(mappings, mappedTargets, {
        sourcePath: file.path,
        targetPath: `pages/${posix.basename(file.path)}`,
        action: 'move',
        reason: 'Product screens belong under pages/.',
      });
    }
  }
  for (const targetPath of [
    HTML_DESIGN_SYSTEM_PATHS.designMd,
    HTML_DESIGN_SYSTEM_PATHS.tokensCss,
    HTML_DESIGN_SYSTEM_PATHS.componentsCss,
  ]) {
    if (!files.some((file) => file.path === targetPath) && !mappedTargets.has(targetPath)) {
      addMapping(mappings, mappedTargets, {
        sourcePath: null,
        targetPath,
        action: 'create',
        reason:
          'Create the missing canonical design-system source after reviewing existing evidence.',
      });
    }
  }
  if (!mappedTargets.has(HTML_DESIGN_SYSTEM_PATHS.previewHtml)) {
    addMapping(mappings, mappedTargets, {
      sourcePath: files.some((file) => file.path === HTML_DESIGN_SYSTEM_PATHS.previewHtml)
        ? HTML_DESIGN_SYSTEM_PATHS.previewHtml
        : null,
      targetPath: HTML_DESIGN_SYSTEM_PATHS.previewHtml,
      action: 'rebuild',
      reason: 'Rebuild the managed design-system preview from canonical sources.',
    });
  }
  addMapping(mappings, mappedTargets, {
    sourcePath: files.some((file) => file.path === 'index.html') ? 'index.html' : null,
    targetPath: 'index.html',
    action: 'rebuild',
    reason: 'Rebuild the managed root Screens Index after registering pages.',
  });
  return mappings;
}

function addMapping(
  mappings: HtmlProjectStructureMapping[],
  targets: Set<string>,
  mapping: HtmlProjectStructureMapping,
) {
  if (targets.has(mapping.targetPath)) {
    mappings.push({
      ...mapping,
      reason: `${mapping.reason} Target collision requires manual resolution.`,
    });
    return;
  }
  targets.add(mapping.targetPath);
  mappings.push(mapping);
}

function legacyDesignSystemTarget(path: string): string | null {
  if (!isLegacyDesignSystemPath(path)) return null;
  const lower = path.toLowerCase();
  if (/^(design\/)?design\.md$/u.test(lower)) return HTML_DESIGN_SYSTEM_PATHS.designMd;
  if (/(^|\/)tokens\.css$/u.test(lower)) return HTML_DESIGN_SYSTEM_PATHS.tokensCss;
  if (/(^|\/)components\.css$/u.test(lower)) return HTML_DESIGN_SYSTEM_PATHS.componentsCss;
  return null;
}

function isLegacyDesignSystemPreview(path: string): boolean {
  const normalized = path.toLowerCase();
  return [
    'design-system.html',
    'pages/design-system.html',
    'design/design-system.html',
    'preview/design-system.html',
  ].includes(normalized);
}

function isLegacyDesignSystemPath(path: string): boolean {
  const normalized = path.toLowerCase();
  return LEGACY_HTML_DESIGN_SYSTEM_PATHS.some(
    (candidate) => candidate.toLowerCase() === normalized,
  );
}

function isCanonicalManagedOrSource(path: string): boolean {
  return [
    HTML_DESIGN_SYSTEM_PATHS.designMd,
    HTML_DESIGN_SYSTEM_PATHS.tokensCss,
    HTML_DESIGN_SYSTEM_PATHS.componentsCss,
    HTML_DESIGN_SYSTEM_PATHS.previewHtml,
    'index.html',
  ].includes(path);
}

function buildStructureConflicts(
  files: HtmlProjectStructureFile[],
  mappings: HtmlProjectStructureMapping[],
): HtmlProjectStructureConflict[] {
  const existing = new Map(files.map((file) => [file.path, file]));
  const movedAway = new Set(
    mappings.flatMap((mapping) =>
      mapping.sourcePath && (mapping.action === 'move' || mapping.action === 'remove-managed')
        ? [mapping.sourcePath]
        : [],
    ),
  );
  const conflicts = new Map<string, HtmlProjectStructureConflict>();
  const byTarget = new Map<string, HtmlProjectStructureMapping[]>();
  for (const mapping of mappings.filter((item) => item.action !== 'keep')) {
    const current = byTarget.get(mapping.targetPath) ?? [];
    current.push(mapping);
    byTarget.set(mapping.targetPath, current);
  }
  for (const [targetPath, targetMappings] of byTarget) {
    const writers = targetMappings.filter((mapping) => mapping.action !== 'remove-managed');
    if (writers.length > 1) {
      conflicts.set(targetPath, {
        targetPath,
        sourcePaths: writers.map((mapping) => mapping.sourcePath ?? '[create]'),
        reason: 'Multiple plan operations write the same target.',
      });
      continue;
    }
    const mapping = writers[0];
    if (!mapping) continue;
    const target = existing.get(targetPath);
    if (!target || mapping.sourcePath === targetPath || movedAway.has(targetPath)) continue;
    if (mapping.action === 'rebuild' && target.managed) continue;
    conflicts.set(targetPath, {
      targetPath,
      sourcePaths: [mapping.sourcePath ?? '[create]', targetPath],
      reason: 'The target already exists and is not moved away by this plan.',
    });
  }
  return [...conflicts.values()].sort((left, right) =>
    left.targetPath.localeCompare(right.targetPath),
  );
}

async function inspectWorkspaceLinks(
  workspaceRoot: string,
  files: string[],
): Promise<HtmlProjectStructureLink[]> {
  const knownFiles = new Set(files);
  const links: HtmlProjectStructureLink[] = [];
  for (const sourcePath of files.filter((path) => /\.(?:html?|css)$/iu.test(path))) {
    const contents = await readFile(resolve(workspaceRoot, sourcePath), 'utf8').catch(() => '');
    const references = /\.html?$/iu.test(sourcePath)
      ? collectMatches(contents, HTML_REFERENCE_RE)
      : collectMatches(contents, CSS_URL_RE);
    for (const reference of references) {
      if (isExternalReference(reference)) {
        links.push({ sourcePath, reference, resolvedPath: null, status: 'external' });
        continue;
      }
      const cleanReference = reference.split(/[?#]/u)[0] ?? '';
      if (!cleanReference) continue;
      const resolvedPath = cleanReference.startsWith('/')
        ? normalizePath(cleanReference.slice(1))
        : normalizePath(posix.join(dirname(sourcePath), cleanReference));
      const exists =
        knownFiles.has(resolvedPath) ||
        knownFiles.has(`${resolvedPath}/index.html`) ||
        files.some((path) => path.startsWith(`${resolvedPath}/`));
      links.push({
        sourcePath,
        reference,
        resolvedPath,
        status: exists ? 'ok' : 'broken',
      });
    }
  }
  return links.sort((left, right) =>
    `${left.sourcePath}:${left.reference}`.localeCompare(`${right.sourcePath}:${right.reference}`),
  );
}

function buildManualFollowUps(input: {
  unsupported: string | null;
  truncated: boolean;
  buildArtifacts: string[];
  links: HtmlProjectStructureLink[];
  proposedMappings: HtmlProjectStructureMapping[];
  conflicts: HtmlProjectStructureConflict[];
}): string[] {
  const followUps: string[] = [];
  if (input.unsupported) followUps.push(input.unsupported);
  if (input.truncated) {
    followUps.push(
      `The scan stopped at ${MAX_STRUCTURE_FILES} files; narrow the project before restructuring.`,
    );
  }
  if (input.buildArtifacts.length > 0) {
    followUps.push(
      'Generated build directories are excluded and must not be moved into the canonical layout.',
    );
  }
  if (input.links.some((link) => link.status === 'broken')) {
    followUps.push('Resolve every broken local reference before completing the restructure run.');
  }
  if (input.conflicts.length > 0) {
    followUps.push(
      'Resolve target-name collisions explicitly; do not overwrite either source file.',
    );
  }
  return followUps;
}

async function buildPlanDigest(
  workspaceRoot: string,
  files: string[],
  plan: {
    status: HtmlProjectStructureReport['status'];
    proposedMappings: HtmlProjectStructureMapping[];
    links: HtmlProjectStructureLink[];
    conflicts: HtmlProjectStructureConflict[];
  },
): Promise<string> {
  const hash = createHash('sha256');
  for (const path of files) {
    await updatePlanDigestWithFile(hash, workspaceRoot, path);
  }
  await updatePlanDigestWithProjectStructure(hash, workspaceRoot);
  hash.update(JSON.stringify(plan));
  return hash.digest('hex');
}

async function updatePlanDigestWithProjectStructure(
  hash: ReturnType<typeof createHash>,
  workspaceRoot: string,
): Promise<void> {
  const path = '.sber-designer/project.sdproj';
  hash.update(path);
  hash.update('\0');
  try {
    const project = JSON.parse(await readFile(resolve(workspaceRoot, path), 'utf8')) as Record<
      string,
      unknown
    >;
    hash.update(
      JSON.stringify({
        version: project.version,
        name: project.name,
        projectKind: project.projectKind,
        screens: project.screens,
        flow: project.flow,
      }),
    );
  } catch {
    hash.update('missing-or-invalid');
  }
  hash.update('\0');
}

async function updatePlanDigestWithFile(
  hash: ReturnType<typeof createHash>,
  workspaceRoot: string,
  path: string,
): Promise<void> {
  const absolutePath = resolve(workspaceRoot, path);
  const stats = await lstat(absolutePath).catch(() => null);
  hash.update(path);
  hash.update('\0');
  if (!stats?.isFile()) {
    hash.update('missing\0');
    return;
  }
  hash.update(`${stats.size}:`);
  try {
    for await (const chunk of createReadStream(absolutePath)) hash.update(chunk);
  } catch {
    hash.update('[unreadable]');
  }
  hash.update('\0');
}

function collectMatches(contents: string, pattern: RegExp): string[] {
  pattern.lastIndex = 0;
  return Array.from(contents.matchAll(pattern), (match) => match[1]?.trim() ?? '').filter(Boolean);
}

function isExternalReference(reference: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/iu.test(reference);
}

function isTextCandidate(path: string): boolean {
  return /\.(?:html?|css|md)$/iu.test(path);
}

async function readJson(
  workspaceRoot: string,
  path: string,
): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(resolve(workspaceRoot, path), 'utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePath(path: string): string {
  const normalized = relative('.', path).replace(/\\/gu, '/');
  return normalized === '' ? '.' : normalized.replace(/^\.\//u, '');
}
