/**
 * Pure ScreensPanel actions/plan helpers: folder rename/push plan
 * application, screen record rewrites, and generated-screen path checks.
 */
import type {
  ComponentCatalog,
  ComponentEntry,
  ProjectScreen,
  StoryEntry,
} from '@sber-designer/shared-types';
import {
  moveProjectScreenToFolder,
  normalizeScreenFolder,
  renameProjectScreenNameReferences,
  renameProjectScreenFolderReferences,
} from '@/lib/screen-folders';

export interface CatalogStory {
  component: ComponentEntry;
  story: StoryEntry;
}

export function catalogStories(catalog: ComponentCatalog | null) {
  return (
    catalog?.components.flatMap((component) =>
      component.stories.map((story) => ({ component, story })),
    ) ?? []
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function withScreenFolder(screen: ProjectScreen, folder: string): ProjectScreen {
  return { ...screen, folder: normalizeScreenFolder(folder) };
}

export function withProjectScreenCreationFolder<
  T extends { screenCreation?: { lastFolder?: string } },
>(project: T, folder: string): T {
  return {
    ...project,
    screenCreation: {
      ...project.screenCreation,
      lastFolder: normalizeScreenFolder(folder),
    },
  };
}

export function insertScreenAfter(
  screens: readonly ProjectScreen[],
  afterScreenId: string,
  screen: ProjectScreen,
): ProjectScreen[] {
  const index = screens.findIndex((item) => item.id === afterScreenId);
  if (index < 0) return [...screens, screen];
  return [...screens.slice(0, index + 1), screen, ...screens.slice(index + 1)];
}

export function applyFolderRenamePlansToScreens(
  screens: readonly ProjectScreen[],
  plans: readonly { from: string; to: string }[],
): ProjectScreen[] {
  return plans.reduce(
    (current, plan) =>
      current.map((screen) =>
        screenMatchesFolderRename(screen, plan)
          ? renameProjectScreenFolderReferences(screen, plan.from, plan.to)
          : screen,
      ),
    [...screens],
  );
}

export function applyFileRenamePlansToScreens(
  screens: readonly ProjectScreen[],
  plans: readonly { screenId: string; toName: string }[],
): ProjectScreen[] {
  return plans.reduce(
    (current, plan) =>
      current.map((screen) =>
        screen.id === plan.screenId
          ? renameProjectScreenNameReferences(screen, plan.toName)
          : screen,
      ),
    [...screens],
  );
}

export function describeScreenMoveError(
  err: unknown,
  screenName: string,
  toFolder: string,
): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/destination already exists/i.test(message)) {
    return `Cannot move ${screenName} to ${toFolder}: a screen with the same file name already exists there. Rename one of them first.`;
  }
  return message;
}

export function applyFolderPushPlansToScreens(
  screens: readonly ProjectScreen[],
  plans: readonly { screenId: string; toFolder: string }[],
): ProjectScreen[] {
  return plans.reduce(
    (current, plan) =>
      current.map((screen) =>
        screen.id === plan.screenId ? moveProjectScreenToFolder(screen, plan.toFolder) : screen,
      ),
    [...screens],
  );
}

export function withScreenRenameResult(
  screen: ProjectScreen,
  result: {
    storyFilePath: string;
    implementationFilePath?: string;
    storyId: string;
  },
): ProjectScreen {
  return {
    ...screen,
    storyId: result.storyId,
    filePath: result.storyFilePath,
    ...(result.implementationFilePath
      ? { implementationFilePath: result.implementationFilePath }
      : {}),
  };
}

function screenMatchesFolderRename(
  screen: ProjectScreen,
  plan: { from: string; to: string },
): boolean {
  const folder = normalizeScreenFolder(screen.folder);
  return (
    folder === plan.from ||
    folder === plan.to ||
    pathHasGeneratedScreenFolder(screen.filePath, plan.from) ||
    pathHasGeneratedScreenFolder(screen.implementationFilePath, plan.from)
  );
}

function pathHasGeneratedScreenFolder(path: string | null | undefined, folder: string): boolean {
  const normalized = path?.replace(/\\/g, '/').replace(/^\.?\//, '');
  return Boolean(
    normalized?.startsWith(`src/stories/screens/${folder}/`) ||
    normalized?.startsWith(`src/screens/${folder}/`),
  );
}

export function storySourceFilePath(
  stories: readonly CatalogStory[],
  screen: ProjectScreen,
): string {
  const fromCatalog = stories.find((entry) => entry.story.id === screen.storyId)?.component
    .filePath;
  const source = fromCatalog ?? screen.filePath;
  if (!screen.storyId || !source) {
    throw new Error(
      'Could not duplicate this Storybook screen because its source story is missing.',
    );
  }
  return source;
}

export function isGeneratedScreenStoryFile(filePath: string): boolean {
  return /^src\/stories\/screens\/.+\.stories\.(tsx|ts|jsx|js)$/.test(filePath.replace(/\\/g, '/'));
}
