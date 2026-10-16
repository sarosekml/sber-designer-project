import type {
  ComponentCatalog,
  ProjectScreen,
  ProjectScreenHealthStatus,
  SberDesignerProject,
} from '@sber-designer/shared-types';

import {
  annotateScreenHealth,
  deleteFile,
  fetchFile,
  moveFile,
  moveScreenFiles,
  pushEditorState,
  renameScreenFiles,
  renameScreenFolderFiles,
  saveProjectToApi,
  updateScreenHealth,
  writeFile,
} from '@/lib/api-client';
import { archiveAssistantSessionsForDeletedScreen } from '@/lib/assistant-sessions';
import {
  moveProjectScreenToFolder,
  listScreenCreationFolders,
  normalizeScreenFolder,
  planProjectScreenFileRenames,
  planProjectScreenFolderPushes,
  planStorybookScreenFolderRenames,
  renameProjectScreenNameReferences,
  renameProjectScreenFolderReferences,
  resolveScreenCreationFolder,
  syncProjectScreensWithStorybook,
  UNGROUPED_SCREEN_FOLDER,
} from '@/lib/screen-folders';
import {
  buildGeneratedScreenDuplicate,
  buildStorybookScreenDuplicate,
} from '@/lib/screen-duplicate';
import { migrateHiddenFlowFolder } from '@/lib/flow-view';
import { useCatalogStore } from '@/stores/catalog-store';
import { useChatStore } from '@/stores/chat-store';
import type { CanvasView } from '@/stores/editor-store';
import {
  type CatalogStory,
  applyFileRenamePlansToScreens,
  applyFolderPushPlansToScreens,
  applyFolderRenamePlansToScreens,
  describeScreenMoveError,
  insertScreenAfter,
  isGeneratedScreenStoryFile,
  sleep,
  storySourceFilePath,
  withProjectScreenCreationFolder,
  withScreenFolder,
  withScreenRenameResult,
} from '@/lib/screen-panel-actions';
import {
  migrateCollapsedScreenFolder,
  pruneCollapsedScreenFolders,
} from '@/lib/screens-panel-state';

interface ScreenFileRenameResult {
  storyFilePath: string;
  implementationFilePath?: string;
  storyId: string;
}

interface ScreenActionsApi {
  saveProjectToApi: (project: SberDesignerProject) => Promise<SberDesignerProject>;
  deleteFile: (path: string) => Promise<unknown>;
  fetchFile: (path: string) => Promise<{ contents: string }>;
  writeFile: (path: string, contents: string) => Promise<unknown>;
  moveFile: (input: { fromPath: string; toPath: string }) => Promise<unknown>;
  moveScreenFiles: (input: {
    storyFilePath: string;
    toFolder: string;
    implementationFilePath?: string;
  }) => Promise<ScreenFileRenameResult>;
  renameScreenFiles: (input: {
    storyFilePath: string;
    toName: string;
    implementationFilePath?: string;
  }) => Promise<ScreenFileRenameResult>;
  renameScreenFolderFiles: (input: { from: string; to: string }) => Promise<unknown>;
  annotateScreenHealth: (input: {
    screens: ProjectScreen[];
  }) => Promise<{ screens: ProjectScreen[] }>;
  updateScreenHealth: (
    screenId: string,
    input: { status: ProjectScreenHealthStatus; reason: string },
  ) => Promise<SberDesignerProject>;
}

export interface ScreenActionsInput {
  project: SberDesignerProject | null;
  activeScreenId: string | null;
  stories: readonly CatalogStory[];
  catalog: ComponentCatalog | null;
  refreshCatalog?: () => Promise<void> | void;
  getLatestCatalog: () => ComponentCatalog | null;
  setProject: (project: SberDesignerProject) => void;
  setBaseline: (project: SberDesignerProject) => void;
  setActiveScreenId: (screenId: string | null) => void;
  setCanvasView: (view: CanvasView) => void;
  setAssistantTaskIntent: (intent: null) => void;
  setStorybookReloadPending: (pending: boolean) => void;
  setSyncMessage: (message: string | null) => void;
  setExportingScreen: (screen: ProjectScreen | null) => void;
  hydrateChatFromProject: (project: SberDesignerProject) => void;
  syncTasks: () => void;
  pushEditorState: (state: { storybookReloadPending: boolean }) => Promise<unknown> | unknown;
  api: ScreenActionsApi;
}

const defaultApi: ScreenActionsApi = {
  saveProjectToApi,
  deleteFile,
  fetchFile,
  writeFile,
  moveFile,
  moveScreenFiles,
  renameScreenFiles,
  renameScreenFolderFiles,
  annotateScreenHealth,
  updateScreenHealth,
};

export function useScreenActions(
  input: Omit<
    ScreenActionsInput,
    'api' | 'getLatestCatalog' | 'hydrateChatFromProject' | 'pushEditorState'
  >,
) {
  return createScreenActions({
    ...input,
    api: defaultApi,
    getLatestCatalog: () => useCatalogStore.getState().catalog,
    hydrateChatFromProject: (project) => useChatStore.getState().hydrateFromProject(project),
    pushEditorState,
  });
}

export function createScreenActions(input: ScreenActionsInput) {
  const reloadStorybook = () => {
    input.setStorybookReloadPending(true);
    void input.pushEditorState({ storybookReloadPending: true });
  };

  const pinStory = async (entry: CatalogStory) => {
    const { project } = input;
    if (!project) return;
    const id = `screen-${Date.now()}-${entry.story.id}`;
    const folder = resolveScreenCreationFolder({
      selectedValue: project.screenCreation?.lastFolder ?? UNGROUPED_SCREEN_FOLDER,
      existingFolders: listScreenCreationFolders(project.screens),
    });
    const screen: ProjectScreen = {
      id,
      name: `${entry.component.shortName} · ${entry.story.name}`,
      kind: 'story',
      storyId: entry.story.id,
      folder,
    };
    const nextProject = withProjectScreenCreationFolder(
      { ...project, screens: [...project.screens, screen] },
      folder,
    );
    try {
      const saved = await input.api.saveProjectToApi(nextProject);
      input.setProject(saved);
      input.setBaseline(saved);
    } catch {
      input.setProject(nextProject);
    }
    input.setActiveScreenId(id);
    input.setCanvasView('screen');
    input.setAssistantTaskIntent(null);
  };

  const removeScreen = async (id: string) => {
    const { project } = input;
    if (!project) return;
    const screen = project.screens.find((item) => item.id === id);
    const nextProject = {
      ...project,
      assistant: archiveAssistantSessionsForDeletedScreen(project.assistant, id),
      screens: project.screens.filter((s) => s.id !== id),
      flow: project.flow.filter((e) => e.fromScreenId !== id && e.toScreenId !== id),
    };
    input.setProject(nextProject);
    input.hydrateChatFromProject(nextProject);
    if (input.activeScreenId === id) input.setActiveScreenId(null);
    if (!screen?.filePath || !isGeneratedScreenStoryFile(screen.filePath)) return;
    try {
      await input.api.deleteFile(screen.filePath);
      if (screen.implementationFilePath) {
        await input.api.deleteFile(screen.implementationFilePath).catch(() => undefined);
      }
      reloadStorybook();
      input.setSyncMessage('Generated story file deleted. Save the project to persist.');
    } catch (err) {
      input.setSyncMessage(errorMessage(err));
    }
  };

  const renameFolder = async (from: string, to: string) => {
    const { project } = input;
    if (!project) return;
    const fromFolder = normalizeScreenFolder(from);
    const toFolder = normalizeScreenFolder(to);
    if (fromFolder === toFolder) return;
    input.setSyncMessage(null);
    try {
      await input.api.renameScreenFolderFiles({ from: fromFolder, to: toFolder });
    } catch (err) {
      input.setSyncMessage(errorMessage(err));
      return;
    }

    input.setProject({
      ...project,
      ...(project.screenCreation
        ? {
            screenCreation:
              project.screenCreation.lastFolder &&
              normalizeScreenFolder(project.screenCreation.lastFolder) === fromFolder
                ? { ...project.screenCreation, lastFolder: toFolder }
                : project.screenCreation,
          }
        : {}),
      flowView: migrateHiddenFlowFolder(project.flowView, fromFolder, toFolder),
      screensPanel: migrateCollapsedScreenFolder(project.screensPanel, fromFolder, toFolder),
      screens: project.screens.map((screen) =>
        normalizeScreenFolder(screen.folder) === fromFolder
          ? renameProjectScreenFolderReferences(screen, fromFolder, toFolder)
          : screen,
      ),
    });
    reloadStorybook();
    input.setSyncMessage('Folder renamed in Storybook files. Save the project to persist.');
    void input.refreshCatalog?.();
  };

  const deleteFolder = async (folder: string) => {
    const { project } = input;
    if (!project) return;
    const fromFolder = normalizeScreenFolder(folder);
    if (fromFolder === UNGROUPED_SCREEN_FOLDER) return;
    const target = UNGROUPED_SCREEN_FOLDER;
    const folderScreens = project.screens.filter(
      (screen) => normalizeScreenFolder(screen.folder) === fromFolder,
    );
    input.setSyncMessage(null);

    const updatedById = new Map<string, ProjectScreen>();
    let fileErrors = 0;
    for (const screen of folderScreens) {
      if (screen.filePath && isGeneratedScreenStoryFile(screen.filePath)) {
        try {
          const result = await input.api.moveScreenFiles({
            storyFilePath: screen.filePath,
            toFolder: target,
            ...(screen.implementationFilePath
              ? { implementationFilePath: screen.implementationFilePath }
              : {}),
          });
          updatedById.set(
            screen.id,
            withScreenRenameResult(moveProjectScreenToFolder(screen, target), result),
          );
        } catch {
          fileErrors += 1;
          updatedById.set(screen.id, withScreenFolder(screen, target));
        }
      } else {
        updatedById.set(screen.id, withScreenFolder(screen, target));
      }
    }

    const nextScreens = project.screens.map((screen) => updatedById.get(screen.id) ?? screen);
    input.setProject({
      ...project,
      screens: nextScreens,
      screensPanel: pruneCollapsedScreenFolders(project.screensPanel, nextScreens),
    });
    reloadStorybook();
    input.setSyncMessage(
      fileErrors > 0
        ? `Folder deleted; ${fileErrors} screen file move${fileErrors === 1 ? '' : 's'} failed. Save the project to persist.`
        : 'Folder deleted; screens moved to Ungrouped in Storybook files. Save the project to persist.',
    );
    void input.refreshCatalog?.();
  };

  const syncScreens = async () => {
    const { project } = input;
    if (!project) return;
    if (input.catalog?.source === 'storybook' && input.refreshCatalog) {
      try {
        await input.refreshCatalog();
      } catch (err) {
        input.setSyncMessage(errorMessage(err));
        return;
      }
    }
    let latestCatalog = input.getLatestCatalog();
    let workingScreens = project.screens;
    let workingScreensPanel = project.screensPanel;

    const folderPushPlans = planProjectScreenFolderPushes(workingScreens);
    let folderPushApplied = 0;
    const folderPushFailures: string[] = [];
    if (folderPushPlans.length > 0) {
      const appliedPlans: typeof folderPushPlans = [];
      for (const plan of folderPushPlans) {
        try {
          await input.api.moveScreenFiles({
            storyFilePath: plan.storyFilePath,
            toFolder: plan.toFolder,
            ...(plan.implementationFilePath
              ? { implementationFilePath: plan.implementationFilePath }
              : {}),
          });
          appliedPlans.push(plan);
        } catch {
          const name =
            workingScreens.find((screen) => screen.id === plan.screenId)?.name ??
            plan.storyFilePath;
          folderPushFailures.push(`${name} -> ${plan.toFolder}`);
        }
      }
      folderPushApplied = appliedPlans.length;
      if (appliedPlans.length > 0) {
        workingScreens = applyFolderPushPlansToScreens(workingScreens, appliedPlans);
        reloadStorybook();
        if (input.refreshCatalog) {
          await sleep(350);
          await input.refreshCatalog();
          latestCatalog = input.getLatestCatalog();
        }
      }
    }

    const renamePlans = planStorybookScreenFolderRenames(workingScreens, latestCatalog);
    if (renamePlans.length > 0) {
      try {
        for (const plan of renamePlans) {
          await input.api.renameScreenFolderFiles({ from: plan.from, to: plan.to });
        }
        workingScreens = applyFolderRenamePlansToScreens(workingScreens, renamePlans);
        workingScreensPanel = renamePlans.reduce(
          (settings, plan) => migrateCollapsedScreenFolder(settings, plan.from, plan.to),
          workingScreensPanel,
        );
        reloadStorybook();
        if (input.refreshCatalog) {
          await sleep(350);
          await input.refreshCatalog();
          latestCatalog = input.getLatestCatalog();
        }
      } catch (err) {
        input.setSyncMessage(errorMessage(err));
        return;
      }
    }
    const fileRenamePlans = planProjectScreenFileRenames(workingScreens, latestCatalog);
    if (fileRenamePlans.length > 0) {
      try {
        for (const plan of fileRenamePlans) {
          await input.api.renameScreenFiles({
            storyFilePath: plan.storyFilePath,
            toName: plan.toName,
            ...(plan.implementationFilePath
              ? { implementationFilePath: plan.implementationFilePath }
              : {}),
          });
        }
        workingScreens = applyFileRenamePlansToScreens(workingScreens, fileRenamePlans);
        reloadStorybook();
        if (input.refreshCatalog) {
          await sleep(350);
          await input.refreshCatalog();
          latestCatalog = input.getLatestCatalog();
        }
      } catch (err) {
        input.setSyncMessage(errorMessage(err));
        return;
      }
    }
    const synced = syncProjectScreensWithStorybook(workingScreens, latestCatalog);
    const screensAfterFileRenames = applyFileRenamePlansToScreens(synced.screens, fileRenamePlans);
    const fileRenameChanged =
      fileRenamePlans.length > 0 &&
      JSON.stringify(screensAfterFileRenames) !== JSON.stringify(synced.screens);
    const result = {
      ...synced,
      screens: screensAfterFileRenames,
      changed:
        synced.changed || renamePlans.length > 0 || fileRenameChanged || folderPushApplied > 0,
      moved: synced.moved + renamePlans.length + (fileRenameChanged ? fileRenamePlans.length : 0),
    };
    let screensWithHealth = result.screens;
    let healthChanged = false;
    let healthError: string | null = null;
    try {
      const health = await input.api.annotateScreenHealth({ screens: result.screens });
      screensWithHealth = health.screens;
      healthChanged = JSON.stringify(screensWithHealth) !== JSON.stringify(result.screens);
    } catch (err) {
      healthError = errorMessage(err);
    }
    if (project.taskTracker || project.comments?.some((comment) => comment.status === 'open')) {
      input.syncTasks();
    }
    const failureNote =
      folderPushFailures.length > 0
        ? `Could not move ${folderPushFailures.length} screen${folderPushFailures.length === 1 ? '' : 's'} (a screen with the same file name already exists in the target folder - rename one of them first): ${folderPushFailures.join('; ')}.`
        : '';
    if (!result.changed && !healthChanged) {
      if (failureNote) {
        input.setSyncMessage(failureNote);
        return;
      }
      input.setSyncMessage(
        healthError
          ? `Screens already match Storybook. Health check failed: ${healthError}`
          : renamePlans.length > 0
            ? 'Storybook files already moved; wait a moment and sync again if the sidebar is still rebuilding.'
            : 'Screens already match Storybook.',
      );
      return;
    }
    input.setProject({
      ...project,
      screens: screensWithHealth,
      screensPanel: pruneCollapsedScreenFolders(workingScreensPanel, screensWithHealth),
    });
    const parts = [
      folderPushApplied > 0
        ? `${folderPushApplied} screen${folderPushApplied === 1 ? '' : 's'} pushed to Storybook`
        : '',
      renamePlans.length > 0
        ? `${renamePlans.length} folder rename${renamePlans.length === 1 ? '' : 's'} applied`
        : '',
      fileRenamePlans.length > 0
        ? `${fileRenamePlans.length} file rename${fileRenamePlans.length === 1 ? '' : 's'} applied`
        : '',
      result.moved > 0 ? `${result.moved} folder${result.moved === 1 ? '' : 's'} aligned` : '',
      result.added > 0 ? `${result.added} screen${result.added === 1 ? '' : 's'} added` : '',
      result.repaired > 0
        ? `${result.repaired} story link${result.repaired === 1 ? '' : 's'} repaired`
        : '',
      healthChanged ? 'screen health updated' : '',
      healthError ? `health check failed: ${healthError}` : '',
    ].filter(Boolean);
    input.setSyncMessage(
      `${parts.join(', ')}. Save the project to persist.${failureNote ? ` ${failureNote}` : ''}`,
    );
  };

  const moveScreen = async (screenId: string, folder: string) => {
    const { project } = input;
    if (!project) return;
    const toFolder = normalizeScreenFolder(folder);
    const current = project.screens.find((screen) => screen.id === screenId);
    if (!current) return;
    if (normalizeScreenFolder(current.folder) === toFolder) return;

    if (isHtmlPageScreen(current)) {
      const movePlan = buildHtmlPageMovePath(current, toFolder);
      if (!movePlan) {
        input.setProject({
          ...project,
          screens: project.screens.map((screen) =>
            screen.id === screenId ? withScreenFolder(screen, toFolder) : screen,
          ),
        });
        return;
      }
      input.setSyncMessage(null);
      try {
        await input.api.moveFile(movePlan);
        input.setProject({
          ...project,
          screens: project.screens.map((screen) =>
            screen.id === screenId
              ? withHtmlPagePath(withScreenFolder(screen, toFolder), movePlan.toPath)
              : screen,
          ),
        });
        input.setSyncMessage('Page moved. Save the project to persist.');
      } catch (err) {
        input.setSyncMessage(describeScreenMoveError(err, current.name, toFolder));
      }
      return;
    }

    if (!current.filePath || !isGeneratedScreenStoryFile(current.filePath)) {
      input.setProject({
        ...project,
        screens: project.screens.map((screen) =>
          screen.id === screenId ? withScreenFolder(screen, toFolder) : screen,
        ),
      });
      return;
    }

    input.setSyncMessage(null);
    try {
      const result = await input.api.moveScreenFiles({
        storyFilePath: current.filePath,
        toFolder,
        ...(current.implementationFilePath
          ? { implementationFilePath: current.implementationFilePath }
          : {}),
      });
      const moved = withScreenRenameResult(moveProjectScreenToFolder(current, toFolder), result);
      input.setProject({
        ...project,
        screens: project.screens.map((screen) => (screen.id === screenId ? moved : screen)),
      });
      reloadStorybook();
      input.setSyncMessage('Screen moved in Storybook files. Save the project to persist.');
      void input.refreshCatalog?.();
    } catch (err) {
      input.setSyncMessage(describeScreenMoveError(err, current.name, toFolder));
    }
  };

  const renameScreen = async (screenId: string, name: string) => {
    const { project } = input;
    if (!project) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = project.screens.find((screen) => screen.id === screenId);
    if (!current) return;

    if (isHtmlPageScreen(current)) {
      const renamePlan = buildHtmlPageRenamePath(current, trimmed);
      if (!renamePlan) {
        input.setProject({
          ...project,
          screens: project.screens.map((screen) =>
            screen.id === screenId ? { ...screen, name: trimmed } : screen,
          ),
        });
        return;
      }
      input.setSyncMessage(null);
      try {
        await input.api.moveFile(renamePlan);
        input.setProject({
          ...project,
          screens: project.screens.map((screen) =>
            screen.id === screenId
              ? withHtmlPagePath({ ...screen, name: trimmed }, renamePlan.toPath)
              : screen,
          ),
        });
        input.setSyncMessage('Page file renamed. Save the project to persist.');
        return;
      } catch (err) {
        input.setSyncMessage(errorMessage(err));
        return;
      }
    }

    if (current.filePath && isGeneratedScreenStoryFile(current.filePath)) {
      input.setSyncMessage(null);
      try {
        const result = await input.api.renameScreenFiles({
          storyFilePath: current.filePath,
          toName: trimmed,
          ...(current.implementationFilePath
            ? { implementationFilePath: current.implementationFilePath }
            : {}),
        });
        const renamed = withScreenRenameResult(
          renameProjectScreenNameReferences(current, trimmed),
          result,
        );
        input.setProject({
          ...project,
          screens: project.screens.map((screen) => (screen.id === screenId ? renamed : screen)),
        });
        reloadStorybook();
        input.setSyncMessage('Screen files renamed. Save the project to persist.');
        void input.refreshCatalog?.();
        return;
      } catch (err) {
        input.setSyncMessage(errorMessage(err));
        return;
      }
    }

    input.setProject({
      ...project,
      screens: project.screens.map((screen) =>
        screen.id === screenId ? { ...screen, name: trimmed } : screen,
      ),
    });
  };

  const duplicateScreen = async (screen: ProjectScreen) => {
    const { project } = input;
    if (!project) return;
    input.setSyncMessage(null);
    try {
      const plan =
        screen.filePath && screen.implementationFilePath
          ? buildGeneratedScreenDuplicate({
              original: screen,
              screens: project.screens,
              implementationContents: (await input.api.fetchFile(screen.implementationFilePath))
                .contents,
            })
          : buildStorybookScreenDuplicate({
              original: screen,
              screens: project.screens,
              sourceStoryFilePath: storySourceFilePath(input.stories, screen),
            });

      for (const file of plan.files) {
        await input.api.writeFile(file.path, file.contents);
      }

      const nextScreens = insertScreenAfter(project.screens, screen.id, plan.screen);
      input.setProject({ ...project, screens: nextScreens });
      input.setActiveScreenId(plan.screen.id);
      input.setCanvasView('screen');
      input.setAssistantTaskIntent(null);
      reloadStorybook();
      input.setSyncMessage('Screen duplicated. Save the project to persist.');
    } catch (err) {
      input.setSyncMessage(errorMessage(err));
    }
  };

  const exportScreen = (screen: ProjectScreen) => {
    input.setActiveScreenId(screen.id);
    input.setCanvasView('screen');
    input.setAssistantTaskIntent(null);
    input.setExportingScreen(screen);
  };

  const setScreenHealth = async (screenId: string, status: ProjectScreenHealthStatus) => {
    const { project } = input;
    if (!project) return;
    const reason =
      status === 'ok'
        ? 'Marked healthy manually.'
        : status === 'needs-review'
          ? 'Marked as needing review manually.'
          : 'Marked broken manually.';
    const nextProject = {
      ...project,
      screens: project.screens.map((screen) =>
        screen.id === screenId
          ? {
              ...screen,
              health: {
                status,
                reason,
                source: 'manual' as const,
                updatedAt: Date.now(),
              },
            }
          : screen,
      ),
    };
    input.setProject(nextProject);
    try {
      const saved = await input.api.updateScreenHealth(screenId, { status, reason });
      input.setProject(saved);
      input.setBaseline(saved);
    } catch (err) {
      input.setProject(project);
      input.setSyncMessage(errorMessage(err));
    }
  };

  return {
    pinStory,
    removeScreen,
    renameFolder,
    deleteFolder,
    syncScreens,
    moveScreen,
    renameScreen,
    duplicateScreen,
    exportScreen,
    setScreenHealth,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isHtmlPageScreen(screen: ProjectScreen): boolean {
  return screen.kind === 'page' && Boolean(htmlPageFilePath(screen));
}

function buildHtmlPageRenamePath(
  screen: ProjectScreen,
  toName: string,
): { fromPath: string; toPath: string } | null {
  const fromPath = htmlPageFilePath(screen);
  if (!fromPath || !isHtmlFilePath(fromPath)) return null;
  const normalized = normalizeWorkspacePath(fromPath);
  const slash = normalized.lastIndexOf('/');
  const dir = slash >= 0 ? normalized.slice(0, slash) : '';
  const extension = htmlExtension(normalized);
  const toPath = `${dir ? `${dir}/` : ''}${slugHtmlSegment(toName)}${extension}`;
  return normalized === toPath ? null : { fromPath: normalized, toPath };
}

function buildHtmlPageMovePath(
  screen: ProjectScreen,
  toFolder: string,
): { fromPath: string; toPath: string } | null {
  const fromPath = htmlPageFilePath(screen);
  if (!fromPath || !isHtmlFilePath(fromPath)) return null;
  const normalized = normalizeWorkspacePath(fromPath);
  const parts = normalized.split('/').filter(Boolean);
  const fileName = parts.at(-1);
  if (!fileName) return null;
  const root = parts.length > 1 ? parts[0] : 'pages';
  const folder = normalizeScreenFolder(toFolder);
  const folderSegment =
    folder && folder !== UNGROUPED_SCREEN_FOLDER ? `/${slugHtmlSegment(folder)}` : '';
  const toPath = `${root}${folderSegment}/${fileName}`;
  return normalized === toPath ? null : { fromPath: normalized, toPath };
}

function withHtmlPagePath(screen: ProjectScreen, path: string): ProjectScreen {
  return {
    ...screen,
    filePath: path,
    implementationFilePath: path,
  };
}

function htmlPageFilePath(screen: ProjectScreen): string | null {
  const path = screen.implementationFilePath ?? screen.filePath;
  return isHtmlFilePath(path) ? path! : null;
}

function isHtmlFilePath(path: string | null | undefined): boolean {
  return Boolean(path && /\.html?$/iu.test(path));
}

function htmlExtension(path: string): string {
  return path.match(/\.html?$/iu)?.[0] ?? '.html';
}

function normalizeWorkspacePath(path: string): string {
  return path.replace(/\\/gu, '/').replace(/^\.?\//u, '');
}

function slugHtmlSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'screen'
  );
}
