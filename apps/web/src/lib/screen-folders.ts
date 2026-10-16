import type { ComponentCatalog, ProjectScreen, StoryEntry } from '@sber-designer/shared-types';

export const UNGROUPED_SCREEN_FOLDER = 'Ungrouped';
export const DEFAULT_SCREEN_FOLDER_NAME = UNGROUPED_SCREEN_FOLDER;
export const NEW_SCREEN_FOLDER_NAME = 'New folder';
export const NEW_SCREEN_FOLDER_OPTION = '__new-folder__';

export interface ScreenGroup {
  id: string;
  name: string;
  screens: ProjectScreen[];
}

export interface GeneratedScreenMetadata {
  cleanName: string;
  componentName: string;
  exportName: 'Default';
  filePath: string;
  folder: string;
  implementationFilePath: string;
  screenSlug: string;
  storyId: string;
  storyTitle: string;
}

export interface StorybookTemplateCopyInput {
  screenName: string;
  componentName: string;
  storyTitle: string;
  sourceStoryId: string;
  sourceFilePath: string;
  targetFilePath: string;
}

export interface StorybookScreenSyncResult {
  screens: ProjectScreen[];
  changed: boolean;
  added: number;
  moved: number;
  repaired: number;
}

export interface StorybookScreenFolderRenamePlan {
  from: string;
  to: string;
  reason: 'storybook-title' | 'filesystem-path';
}

export interface ProjectScreenFileRenamePlan {
  screenId: string;
  storyFilePath: string;
  implementationFilePath?: string;
  toName: string;
}

interface StorybookScreenEntry {
  folder: string;
  name: string;
  story: StoryEntry;
  filePath: string;
}

interface ComponentEntryWithStory {
  component: ComponentCatalog['components'][number];
  story: StoryEntry;
}

export function groupProjectScreens(screens: readonly ProjectScreen[]): ScreenGroup[] {
  const groups = new Map<string, ScreenGroup>();

  for (const screen of screens) {
    const folder = normalizeScreenFolder(screen.folder);
    const existing = groups.get(folder);
    if (existing) {
      existing.screens.push(screen);
    } else {
      groups.set(folder, { id: folder, name: folder, screens: [screen] });
    }
  }

  return Array.from(groups.values());
}

export function listScreenCreationFolders(screens: readonly ProjectScreen[]): string[] {
  const folders = [DEFAULT_SCREEN_FOLDER_NAME];
  const seen = new Set([DEFAULT_SCREEN_FOLDER_NAME.toLowerCase()]);

  for (const group of groupProjectScreens(screens)) {
    const folder = normalizeScreenFolder(group.name);
    const key =
      folder.toLowerCase() === DEFAULT_SCREEN_FOLDER_NAME.toLowerCase()
        ? DEFAULT_SCREEN_FOLDER_NAME.toLowerCase()
        : folder;
    if (seen.has(key)) continue;
    seen.add(key);
    folders.push(folder);
  }

  return folders;
}

export function uniqueNewScreenFolderName(
  existingFolders: readonly string[],
  base = NEW_SCREEN_FOLDER_NAME,
): string {
  const cleanBase = normalizeScreenFolder(base);
  const used = new Set(existingFolders.map((folder) => normalizeScreenFolder(folder)));
  if (!used.has(cleanBase)) return cleanBase;

  let index = 2;
  while (used.has(`${cleanBase} ${index}`)) index += 1;
  return `${cleanBase} ${index}`;
}

export function resolveScreenCreationFolder(input: {
  selectedValue: string;
  existingFolders: readonly string[];
  fallbackFolder?: string | null | undefined;
}): string {
  const existingFolders = listScreenCreationFolders(
    input.existingFolders.map((folder, index) => ({
      id: `folder-${index}`,
      name: folder,
      kind: 'story' as const,
      folder,
    })),
  );
  const selected = normalizeScreenFolder(input.selectedValue);
  if (selected === NEW_SCREEN_FOLDER_OPTION) return uniqueNewScreenFolderName(existingFolders);
  if (existingFolders.includes(selected)) return selected;

  const fallback = input.fallbackFolder ? normalizeScreenFolder(input.fallbackFolder) : null;
  if (fallback && existingFolders.includes(fallback)) return fallback;
  return DEFAULT_SCREEN_FOLDER_NAME;
}

export function planStorybookScreenFolderRenames(
  screens: readonly ProjectScreen[],
  catalog: ComponentCatalog | null,
): StorybookScreenFolderRenamePlan[] {
  if (!catalog || catalog.source !== 'storybook') return [];

  const screensByStoryId = new Map<string, ProjectScreen>();
  const screensByFilePath = new Map<string, ProjectScreen>();
  for (const screen of screens) {
    if (screen.storyId) screensByStoryId.set(screen.storyId, screen);
    if (screen.filePath) screensByFilePath.set(normalizeStorybookFilePath(screen.filePath), screen);
  }

  const planned = new Map<string, StorybookScreenFolderRenamePlan>();
  for (const component of catalog.components) {
    const titleFolder = storybookScreensFolder(component.title);
    const fileFolder = storybookScreensFolderFromFilePath(component.filePath);
    if (!titleFolder || !fileFolder || titleFolder === fileFolder) continue;

    const screen =
      component.stories.map((story) => screensByStoryId.get(story.id)).find(Boolean) ??
      screensByFilePath.get(normalizeStorybookFilePath(component.filePath));
    if (!screen) continue;

    const currentFolder = normalizeScreenFolder(screen.folder);
    if (currentFolder === fileFolder) {
      addFolderRenamePlan(planned, {
        from: fileFolder,
        to: titleFolder,
        reason: 'storybook-title',
      });
      continue;
    }
    if (currentFolder === titleFolder) {
      addFolderRenamePlan(planned, {
        from: titleFolder,
        to: fileFolder,
        reason: 'filesystem-path',
      });
    }
  }

  return Array.from(planned.values());
}

export function planProjectScreenFileRenames(
  screens: readonly ProjectScreen[],
  catalog: ComponentCatalog | null,
): ProjectScreenFileRenamePlan[] {
  const catalogByStoryId = new Map<string, ComponentEntryWithStory>();
  const catalogByFilePath = new Map<string, ComponentEntryWithStory>();
  if (catalog?.source === 'storybook') {
    for (const component of catalog.components) {
      const firstStory = component.stories[0];
      if (!firstStory) continue;
      catalogByFilePath.set(normalizeStorybookFilePath(component.filePath), {
        component,
        story: firstStory,
      });
      for (const story of component.stories) {
        catalogByStoryId.set(story.id, { component, story });
      }
    }
  }

  return screens.flatMap((screen) => {
    if (!screen.filePath || !isGeneratedScreenStoryFile(screen.filePath)) return [];
    const catalogEntry =
      (screen.storyId ? catalogByStoryId.get(screen.storyId) : undefined) ??
      catalogByFilePath.get(normalizeStorybookFilePath(screen.filePath));
    const storyFilePath = catalogEntry?.component.filePath ?? screen.filePath;
    if (!isGeneratedScreenStoryFile(storyFilePath)) return [];

    const expected = renameProjectScreenNameReferences(
      {
        ...screen,
        filePath: storyFilePath,
      },
      screen.name,
    );
    const catalogName = catalogEntry
      ? screenNameFromStory(catalogEntry.component.title, catalogEntry.story.name)
      : screen.name;
    const storyPathMatches =
      normalizeStorybookFilePath(storyFilePath) ===
      normalizeStorybookFilePath(expected.filePath ?? storyFilePath);
    const implementationPathMatches =
      !screen.implementationFilePath ||
      normalizeStorybookFilePath(screen.implementationFilePath) ===
        normalizeStorybookFilePath(
          expected.implementationFilePath ?? screen.implementationFilePath,
        );
    if (storyPathMatches && implementationPathMatches && catalogName === screen.name) return [];

    return [
      {
        screenId: screen.id,
        storyFilePath,
        ...(screen.implementationFilePath
          ? { implementationFilePath: screen.implementationFilePath }
          : {}),
        toName: screen.name,
      },
    ];
  });
}

export function syncProjectScreensWithStorybook(
  screens: readonly ProjectScreen[],
  catalog: ComponentCatalog | null,
): StorybookScreenSyncResult {
  if (!catalog || catalog.source !== 'storybook') {
    return { screens: [...screens], changed: false, added: 0, moved: 0, repaired: 0 };
  }

  const storybookScreens = collectStorybookScreens(catalog);
  if (storybookScreens.size === 0) {
    return { screens: [...screens], changed: false, added: 0, moved: 0, repaired: 0 };
  }

  const usedIds = new Set(screens.map((screen) => screen.id));
  const storybookScreensByFilePath = collectStorybookScreensByFilePath(storybookScreens);
  const seenStoryIds = new Set<string>();
  let moved = 0;
  let repaired = 0;
  const nextScreens = screens.map((screen) => {
    const storybookScreen =
      (screen.storyId ? storybookScreens.get(screen.storyId) : undefined) ??
      (screen.filePath
        ? storybookScreensByFilePath.get(normalizeStorybookFilePath(screen.filePath))
        : undefined);
    if (!storybookScreen) return screen;
    seenStoryIds.add(storybookScreen.story.id);

    let next = screen;
    if (
      screen.storyId !== storybookScreen.story.id ||
      screen.filePath !== storybookScreen.filePath
    ) {
      repaired += 1;
      next = {
        ...next,
        storyId: storybookScreen.story.id,
        filePath: storybookScreen.filePath,
      };
    }
    if (normalizeScreenFolder(next.folder) !== storybookScreen.folder) {
      moved += 1;
      next = withFolder(next, storybookScreen.folder);
    }
    return next;
  });

  let added = 0;
  for (const storybookScreen of storybookScreens.values()) {
    if (seenStoryIds.has(storybookScreen.story.id)) continue;
    const id = uniqueScreenId(`screen-${storybookScreen.story.id}`, usedIds);
    usedIds.add(id);
    added += 1;
    nextScreens.push({
      id,
      name: storybookScreen.name,
      kind: 'story',
      storyId: storybookScreen.story.id,
      filePath: storybookScreen.filePath,
      folder: storybookScreen.folder,
      ...(storybookScreen.story.description
        ? { description: storybookScreen.story.description }
        : {}),
    });
  }

  return {
    screens: nextScreens,
    changed: repaired > 0 || moved > 0 || added > 0,
    added,
    moved,
    repaired,
  };
}

export function normalizeScreenFolder(folder: string | null | undefined): string {
  return folder?.trim() || UNGROUPED_SCREEN_FOLDER;
}

export function renameProjectScreenFolderReferences(
  screen: ProjectScreen,
  fromFolder: string,
  toFolder: string,
): ProjectScreen {
  const from = normalizeScreenFolder(fromFolder);
  const to = normalizeScreenFolder(toFolder);
  let next = withFolder(screen, to);
  if (next.filePath) {
    next = { ...next, filePath: replaceGeneratedScreenFolderInPath(next.filePath, from, to) };
  }
  if (next.implementationFilePath) {
    next = {
      ...next,
      implementationFilePath: replaceGeneratedScreenFolderInPath(
        next.implementationFilePath,
        from,
        to,
      ),
    };
  }
  if (next.storyId) {
    next = { ...next, storyId: replaceStorybookFolderInId(next.storyId, from, to) };
  }
  return next;
}

/**
 * Move a single generated screen into `toFolder`, keeping `folder`, `filePath`,
 * `implementationFilePath` and `storyId` consistent. The "from" folder is read
 * from the on-disk story path (the authoritative location), not from
 * `screen.folder`, which may already have been changed by a metadata-only move
 * (task 0077).
 */
export function moveProjectScreenToFolder(screen: ProjectScreen, toFolder: string): ProjectScreen {
  const fromFolder =
    screenFolderFromStoryPath(screen.filePath) ?? normalizeScreenFolder(screen.folder);
  return renameProjectScreenFolderReferences(screen, fromFolder, normalizeScreenFolder(toFolder));
}

export interface ProjectScreenFolderPushPlan {
  screenId: string;
  storyFilePath: string;
  implementationFilePath?: string;
  fromFolder: string;
  toFolder: string;
}

/**
 * Find generated screens whose panel folder (`screen.folder`) disagrees with
 * the folder encoded in their on-disk story path. These are the screens that a
 * metadata-only move left diverged from Storybook; each needs a real file move
 * from the path folder to the panel folder to reconcile (task 0077).
 */
export function planProjectScreenFolderPushes(
  screens: readonly ProjectScreen[],
): ProjectScreenFolderPushPlan[] {
  return screens.flatMap((screen) => {
    if (!screen.filePath || !isGeneratedScreenStoryFile(screen.filePath)) return [];
    const pathFolder = storybookScreensFolderFromFilePath(screen.filePath);
    if (!pathFolder) return [];
    const targetFolder = normalizeScreenFolder(screen.folder);
    if (pathFolder === targetFolder) return [];
    return [
      {
        screenId: screen.id,
        storyFilePath: screen.filePath,
        ...(screen.implementationFilePath
          ? { implementationFilePath: screen.implementationFilePath }
          : {}),
        fromFolder: pathFolder,
        toFolder: targetFolder,
      },
    ];
  });
}

export function renameProjectScreenNameReferences(
  screen: ProjectScreen,
  toName: string,
): ProjectScreen {
  const cleanName = toName.trim();
  if (!cleanName) return screen;
  const folder = screenFolderFromStoryPath(screen.filePath) ?? normalizeScreenFolder(screen.folder);
  const componentName = toComponentName(cleanName);
  const storyTitle = `Screens/${folder}/${cleanName}`;
  let next: ProjectScreen = {
    ...screen,
    name: cleanName,
    storyId: storybookIdFromTitleAndExport(storyTitle, 'Default'),
    folder,
  };
  if (next.filePath) {
    next = { ...next, filePath: replaceGeneratedScreenFileBase(next.filePath, componentName) };
  }
  if (next.implementationFilePath) {
    next = {
      ...next,
      implementationFilePath: replaceGeneratedScreenFileBase(
        next.implementationFilePath,
        componentName,
      ),
    };
  }
  return next;
}

export function buildUniqueGeneratedScreenName(
  name: string,
  screens: readonly Pick<ProjectScreen, 'name'>[],
): string {
  const cleanName = name.trim();
  const usedNames = new Set(
    screens.map((screen) => normalizeScreenNameKey(screen.name)).filter(Boolean),
  );

  if (!cleanName || isLegacyNewScreenName(cleanName)) {
    return nextNumberedNewScreenName(usedNames);
  }
  if (!usedNames.has(normalizeScreenNameKey(cleanName))) {
    return cleanName;
  }
  if (isNumberedNewScreenName(cleanName)) {
    return nextNumberedNewScreenName(usedNames);
  }
  return nextNumberedName(cleanName, usedNames);
}

export function storybookIdFromTitleAndExport(title: string, exportName: string): string {
  const titleId = sanitizeStorybookId(title) || 'screens';
  const exportId = sanitizeStorybookId(exportName) || 'default';
  return `${titleId}--${exportId}`;
}

export function buildGeneratedScreenMetadata({
  name,
  folder,
}: {
  name: string;
  folder: string;
}): GeneratedScreenMetadata {
  const cleanName = name.trim() || 'New screen';
  const normalizedFolder = normalizeScreenFolder(folder);
  const screenSlug = slugifyStorybookSegment(cleanName) || 'screen';
  const componentName = toComponentName(cleanName);
  const storyTitle = `Screens/${normalizedFolder}/${cleanName}`;

  return {
    cleanName,
    componentName,
    exportName: 'Default',
    filePath: `src/stories/screens/${normalizedFolder}/${componentName}.stories.tsx`,
    folder: normalizedFolder,
    implementationFilePath: `src/screens/${normalizedFolder}/${componentName}.tsx`,
    screenSlug,
    storyId: storybookIdFromTitleAndExport(storyTitle, 'Default'),
    storyTitle,
  };
}

export function buildStorybookTemplateCopy(input: StorybookTemplateCopyInput): string {
  const implementationPath = input.targetFilePath
    .replace(/^src\/stories\/screens\//, 'src/screens/')
    .replace(/\.stories\.(tsx|ts|jsx|js)$/, '.tsx');
  const componentImportPath = relativeImportPath(input.targetFilePath, implementationPath);
  return buildGeneratedScreenStoryWrapper({
    screenName: input.screenName,
    componentName: input.componentName,
    storyTitle: input.storyTitle,
    componentImportPath,
  });
}

export function buildGeneratedScreenStoryWrapper({
  screenName,
  componentName,
  storyTitle,
  componentImportPath,
}: {
  screenName: string;
  componentName: string;
  storyTitle: string;
  componentImportPath: string;
}): string {
  return `import type { Meta, StoryObj } from '@storybook/react';

import { ${componentName} } from '${componentImportPath}';

const meta = {
  title: ${quoteSingle(storyTitle)},
  component: ${componentName},
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ${componentName}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: ${quoteSingle(screenName)},
};
`;
}

export function buildStorybookTemplateImplementation({
  componentName,
  sourceStoryId,
  sourceFilePath,
  targetFilePath,
}: {
  componentName: string;
  sourceStoryId: string;
  sourceFilePath: string;
  targetFilePath: string;
}): string {
  const importPath = relativeImportPath(targetFilePath, sourceFilePath);
  const sourceExportName = storyExportNameFromId(sourceStoryId);
  return `import React from 'react';

import * as SourceStories from '${importPath}';

type SourceStory = {
  args?: Record<string, unknown>;
  render?: React.ComponentType<Record<string, unknown>>;
};
type SourceMeta = {
  component?: React.ComponentType<Record<string, unknown>>;
};

const sourceMeta = SourceStories.default as SourceMeta;
const sourceStory = SourceStories.${sourceExportName} as SourceStory | undefined;
const SourceComponent = sourceMeta.component;
const sourceArgs = sourceStory?.args ?? {};

export function ${componentName}() {
  const SourceRender = sourceStory?.render;
  if (SourceRender) return <SourceRender {...sourceArgs} />;
  return SourceComponent ? <SourceComponent {...sourceArgs} /> : null;
}
`;
}

export function storyExportNameFromId(storyId: string): string {
  const exportId = storyId.split('--').at(-1) ?? 'default';
  return toComponentName(exportId);
}

export function relativeImportPath(fromFile: string, toFile: string): string {
  const fromParts = fromFile.split('/').filter(Boolean).slice(0, -1);
  const toParts = stripImportExtension(toFile).split('/').filter(Boolean);
  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common += 1;
  }
  const up = fromParts.slice(common).map(() => '..');
  const down = toParts.slice(common);
  const relative = [...up, ...down].join('/') || '.';
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function slugifyStorybookSegment(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isLegacyNewScreenName(value: string): boolean {
  return /^new screen$/iu.test(value.trim());
}

function isNumberedNewScreenName(value: string): boolean {
  return /^new screen \d+$/iu.test(value.trim());
}

function nextNumberedNewScreenName(usedNames: ReadonlySet<string>): string {
  let index = usedNames.has('new screen') ? 2 : 1;
  while (usedNames.has(normalizeScreenNameKey(numberedScreenName('New screen', index)))) {
    index += 1;
  }
  return numberedScreenName('New screen', index);
}

function nextNumberedName(baseName: string, usedNames: ReadonlySet<string>): string {
  let index = 2;
  while (usedNames.has(normalizeScreenNameKey(numberedScreenName(baseName, index)))) {
    index += 1;
  }
  return numberedScreenName(baseName, index);
}

function numberedScreenName(baseName: string, index: number): string {
  return `${baseName} ${String(index).padStart(2, '0')}`;
}

function normalizeScreenNameKey(value: string): string {
  return value.trim().toLowerCase();
}

function sanitizeStorybookId(value: string): string {
  // Mirrors @storybook/csf sanitize(): Storybook computes iframe ids
  // from the title/export, so generated screens must use the same rules.
  return value
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function collectStorybookScreens(catalog: ComponentCatalog): Map<string, StorybookScreenEntry> {
  const out = new Map<string, StorybookScreenEntry>();
  for (const component of catalog.components) {
    const folder = storybookScreensFolder(component.title);
    if (!folder) continue;
    for (const story of component.stories) {
      out.set(story.id, {
        folder,
        name: screenNameFromStory(component.title, story.name),
        story,
        filePath: component.filePath,
      });
    }
  }
  return out;
}

function collectStorybookScreensByFilePath(
  screens: Map<string, StorybookScreenEntry>,
): Map<string, StorybookScreenEntry> {
  const out = new Map<string, StorybookScreenEntry>();
  for (const screen of screens.values()) {
    const key = normalizeStorybookFilePath(screen.filePath);
    if (!out.has(key)) out.set(key, screen);
  }
  return out;
}

function normalizeStorybookFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.?\//, '');
}

function isGeneratedScreenStoryFile(filePath: string): boolean {
  return /^src\/stories\/screens\/.+\.stories\.(tsx|ts|jsx|js)$/iu.test(
    normalizeStorybookFilePath(filePath),
  );
}

function addFolderRenamePlan(
  planned: Map<string, StorybookScreenFolderRenamePlan>,
  plan: StorybookScreenFolderRenamePlan,
): void {
  if (plan.from === plan.to) return;
  const key = `${plan.from}\0${plan.to}`;
  if (!planned.has(key)) planned.set(key, plan);
}

function storybookScreensFolder(title: string): string | null {
  const segments = title
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments[0]?.toLowerCase() !== 'screens' || !segments[1]) return null;
  return segments[1];
}

function storybookScreensFolderFromFilePath(filePath: string): string | null {
  const segments = normalizeStorybookFilePath(filePath).split('/').filter(Boolean);
  if (
    segments[0] !== 'src' ||
    segments[1] !== 'stories' ||
    segments[2] !== 'screens' ||
    !segments[3]
  ) {
    return null;
  }
  return segments[3];
}

function screenFolderFromStoryPath(filePath: string | null | undefined): string | null {
  return filePath ? storybookScreensFolderFromFilePath(filePath) : null;
}

function replaceGeneratedScreenFolderInPath(path: string, from: string, to: string): string {
  const normalized = normalizeStorybookFilePath(path);
  for (const prefix of ['src/stories/screens/', 'src/screens/']) {
    const fromPrefix = `${prefix}${from}/`;
    if (normalized.startsWith(fromPrefix)) {
      return `${prefix}${to}/${normalized.slice(fromPrefix.length)}`;
    }
  }
  return path;
}

function replaceGeneratedScreenFileBase(path: string, componentName: string): string {
  const normalized = normalizeStorybookFilePath(path);
  if (/\.stories\.(tsx|ts|jsx|js)$/iu.test(normalized)) {
    return normalized.replace(
      /\/[^/]+\.stories\.(tsx|ts|jsx|js)$/iu,
      `/${componentName}.stories.$1`,
    );
  }
  return normalized.replace(/\/[^/]+\.(tsx|ts|jsx|js)$/iu, `/${componentName}.$1`);
}

function replaceStorybookFolderInId(storyId: string, from: string, to: string): string {
  const fromId = sanitizeStorybookId(from);
  const toId = sanitizeStorybookId(to);
  if (!fromId || !toId) return storyId;
  const prefix = `screens-${fromId}-`;
  if (!storyId.startsWith(prefix)) return storyId;
  return `screens-${toId}-${storyId.slice(prefix.length)}`;
}

function screenNameFromStory(title: string, storyName: string): string {
  const trimmedStoryName = storyName.trim();
  if (trimmedStoryName && trimmedStoryName.toLowerCase() !== 'default') return trimmedStoryName;
  const segments = title
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments.at(-1) ?? (trimmedStoryName || 'Screen');
}

function withFolder(screen: ProjectScreen, folder: string): ProjectScreen {
  return { ...screen, folder: normalizeScreenFolder(folder) };
}

function uniqueScreenId(baseId: string, usedIds: Set<string>): string {
  const clean = baseId.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'screen';
  if (!usedIds.has(clean)) return clean;
  let index = 2;
  while (usedIds.has(`${clean}-${index}`)) index += 1;
  return `${clean}-${index}`;
}

function toComponentName(value: string): string {
  const name =
    value
      .trim()
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('') || 'Screen';
  return /^[A-Za-z_]/.test(name) ? name : `Screen${name}`;
}

function stripImportExtension(filePath: string): string {
  return filePath.replace(/\.(tsx|ts|jsx|js|mjs|cjs)$/, '');
}

function quoteSingle(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
