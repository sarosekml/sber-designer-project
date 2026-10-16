import { expect, test } from 'bun:test';
import type {
  ComponentCatalog,
  ProjectScreen,
  SberDesignerProject,
} from '@sber-designer/shared-types';

import { catalogStories } from '@/lib/screen-panel-actions';
import { createScreenActions } from './useScreenActions';

const screen = (
  overrides: Partial<ProjectScreen> & { id: string; name: string },
): ProjectScreen => ({
  kind: 'story',
  ...overrides,
});

const project = (
  screens: ProjectScreen[],
  overrides: Partial<SberDesignerProject> = {},
): SberDesignerProject => ({
  version: 1,
  name: 'Demo',
  workspacePath: '/tmp/demo',
  screens,
  flow: [],
  ...overrides,
});

const storybookCatalog = (): ComponentCatalog => ({
  source: 'storybook',
  generatedAt: 1,
  previewUrl: 'http://localhost:6006',
  components: [
    {
      id: 'checkout',
      title: 'Flows/Checkout',
      shortName: 'Checkout',
      filePath: 'src/components/Checkout.stories.tsx',
      stories: [{ id: 'flows-checkout--default', name: 'Default', previewUrl: 'u1' }],
    },
  ],
});

function harness(input: {
  project: SberDesignerProject;
  catalog?: ComponentCatalog | null;
  refreshCatalog?: () => Promise<void>;
  moveFile?: (input: { fromPath: string; toPath: string }) => Promise<unknown>;
  moveScreenFiles?: () => Promise<never>;
  annotateScreenHealth?: (screens: ProjectScreen[]) => Promise<ProjectScreen[]>;
  updateScreenHealth?: () => Promise<SberDesignerProject>;
}) {
  const projects: SberDesignerProject[] = [];
  const baselines: SberDesignerProject[] = [];
  const messages: string[] = [];
  const activeScreenIds: (string | null)[] = [];
  const canvasViews: string[] = [];
  const storybookReloads: boolean[] = [];
  const writes: string[] = [];
  const fileMoves: { fromPath: string; toPath: string }[] = [];
  let latestCatalog = input.catalog ?? null;
  const actions = createScreenActions({
    project: input.project,
    activeScreenId: 'checkout',
    stories: catalogStories(input.catalog ?? null),
    catalog: input.catalog ?? null,
    refreshCatalog: input.refreshCatalog
      ? async () => {
          await input.refreshCatalog?.();
          latestCatalog = input.catalog ?? null;
        }
      : undefined,
    getLatestCatalog: () => latestCatalog,
    setProject: (next) => projects.push(next),
    setBaseline: (next) => baselines.push(next),
    setActiveScreenId: (id) => activeScreenIds.push(id),
    setCanvasView: (view) => canvasViews.push(view),
    setAssistantTaskIntent: () => undefined,
    setStorybookReloadPending: (value) => storybookReloads.push(value),
    setSyncMessage: (message) => {
      if (message) messages.push(message);
    },
    setExportingScreen: () => undefined,
    hydrateChatFromProject: () => undefined,
    syncTasks: () => undefined,
    pushEditorState: async () => undefined,
    api: {
      saveProjectToApi: async (next) => next,
      deleteFile: async () => undefined,
      fetchFile: async () => ({ contents: 'export const Checkout = () => null;' }),
      writeFile: async (path) => {
        writes.push(path);
      },
      moveFile: async (moveInput) => {
        fileMoves.push(moveInput);
        return input.moveFile?.(moveInput);
      },
      moveScreenFiles:
        input.moveScreenFiles ??
        (async () => ({
          storyFilePath: 'src/stories/screens/Flows/Checkout.stories.tsx',
          implementationFilePath: 'src/screens/Flows/Checkout.tsx',
          storyId: 'screens-flows-checkout--default',
        })),
      renameScreenFiles: async () => ({
        storyFilePath: 'src/stories/screens/Flows/Checkout.stories.tsx',
        implementationFilePath: 'src/screens/Flows/Checkout.tsx',
        storyId: 'screens-flows-checkout--default',
      }),
      renameScreenFolderFiles: async () => undefined,
      annotateScreenHealth: async ({ screens }) => ({
        screens: input.annotateScreenHealth ? await input.annotateScreenHealth(screens) : screens,
      }),
      updateScreenHealth:
        input.updateScreenHealth ?? (async () => ({ ...input.project, savedAt: 42 })),
    },
  });

  return {
    actions,
    projects,
    baselines,
    messages,
    activeScreenIds,
    canvasViews,
    storybookReloads,
    writes,
    fileMoves,
  };
}

test('moveScreen reports generated file name collisions as an actionable message', async () => {
  const current = screen({
    id: 'checkout',
    name: 'Checkout',
    folder: 'Drafts',
    storyId: 'screens-drafts-checkout--default',
    filePath: 'src/stories/screens/Drafts/Checkout.stories.tsx',
    implementationFilePath: 'src/screens/Drafts/Checkout.tsx',
  });
  const { actions, messages } = harness({
    project: project([current]),
    moveScreenFiles: async () => {
      throw new Error('destination already exists');
    },
  });

  await actions.moveScreen('checkout', 'Flows');

  expect(messages.at(-1)).toBe(
    'Cannot move Checkout to Flows: a screen with the same file name already exists there. Rename one of them first.',
  );
});

test('renameScreen renames html page files and keeps page metadata in sync', async () => {
  const current = screen({
    id: 'deal',
    name: 'Deal overview',
    kind: 'page',
    folder: 'Ungrouped',
    filePath: 'pages/deal-overview.html',
    implementationFilePath: 'pages/deal-overview.html',
  });
  const { actions, projects, messages, fileMoves, storybookReloads } = harness({
    project: project([current]),
  });

  await actions.renameScreen('deal', 'Corporate Request 1344');

  expect(fileMoves).toEqual([
    {
      fromPath: 'pages/deal-overview.html',
      toPath: 'pages/corporate-request-1344.html',
    },
  ]);
  expect(projects.at(-1)?.screens[0]).toMatchObject({
    name: 'Corporate Request 1344',
    filePath: 'pages/corporate-request-1344.html',
    implementationFilePath: 'pages/corporate-request-1344.html',
  });
  expect(storybookReloads).toHaveLength(0);
  expect(messages.at(-1)).toBe('Page file renamed. Save the project to persist.');
});

test('moveScreen moves html page files into the target folder slug', async () => {
  const current = screen({
    id: 'deal',
    name: 'Corporate Request 1344',
    kind: 'page',
    folder: 'Ungrouped',
    filePath: 'pages/corporate-request-1344.html',
    implementationFilePath: 'pages/corporate-request-1344.html',
  });
  const { actions, projects, messages, fileMoves, storybookReloads } = harness({
    project: project([current]),
  });

  await actions.moveScreen('deal', 'Corporate Requests');

  expect(fileMoves).toEqual([
    {
      fromPath: 'pages/corporate-request-1344.html',
      toPath: 'pages/corporate-requests/corporate-request-1344.html',
    },
  ]);
  expect(projects.at(-1)?.screens[0]).toMatchObject({
    folder: 'Corporate Requests',
    filePath: 'pages/corporate-requests/corporate-request-1344.html',
    implementationFilePath: 'pages/corporate-requests/corporate-request-1344.html',
  });
  expect(storybookReloads).toHaveLength(0);
  expect(messages.at(-1)).toBe('Page moved. Save the project to persist.');
});

test('duplicateScreen inserts the copy immediately after the selected screen', async () => {
  const checkout = screen({
    id: 'checkout',
    name: 'Checkout',
    storyId: 'flows-checkout--default',
    filePath: 'src/components/Checkout.stories.tsx',
    folder: 'Flows',
  });
  const settings = screen({ id: 'settings', name: 'Settings', folder: 'Admin' });
  const { actions, projects, activeScreenIds, canvasViews, writes } = harness({
    project: project([checkout, settings]),
    catalog: storybookCatalog(),
  });

  await actions.duplicateScreen(checkout);

  expect(projects.at(-1)?.screens.map((item) => item.name)).toEqual([
    'Checkout',
    'Checkout Copy',
    'Settings',
  ]);
  expect(activeScreenIds.at(-1)).toBe(projects.at(-1)?.screens[1]?.id);
  expect(canvasViews.at(-1)).toBe('screen');
  expect(writes).toHaveLength(2);
});

test('syncScreens surfaces catalog refresh failures without mutating the project', async () => {
  const { actions, projects, messages } = harness({
    project: project([]),
    catalog: storybookCatalog(),
    refreshCatalog: async () => {
      throw new Error('Storybook is offline');
    },
  });

  await actions.syncScreens();

  expect(projects).toHaveLength(0);
  expect(messages.at(-1)).toBe('Storybook is offline');
});

test('setScreenHealth rolls back the optimistic health patch when persistence fails', async () => {
  const checkout = screen({ id: 'checkout', name: 'Checkout' });
  const original = project([checkout]);
  const { actions, projects, messages, baselines } = harness({
    project: original,
    updateScreenHealth: async () => {
      throw new Error('save failed');
    },
  });

  await actions.setScreenHealth('checkout', 'broken');

  expect(projects[0]?.screens[0]?.health?.status).toBe('broken');
  expect(projects.at(-1)).toBe(original);
  expect(baselines).toHaveLength(0);
  expect(messages.at(-1)).toBe('save failed');
});

test('renameFolder migrates collapsed Screens panel folder state', async () => {
  const archived = screen({ id: 'archived', name: 'Archived', folder: 'Archive' });
  const { actions, projects } = harness({
    project: project([archived], {
      screensPanel: { collapsedFolderNames: ['Archive', 'Drafts'] },
    }),
  });

  await actions.renameFolder('Archive', 'Old flows');

  expect(projects.at(-1)?.screensPanel?.collapsedFolderNames).toEqual(['Old flows', 'Drafts']);
});

test('deleteFolder prunes collapsed Screens panel folder state', async () => {
  const archived = screen({ id: 'archived', name: 'Archived', folder: 'Archive' });
  const draft = screen({ id: 'draft', name: 'Draft', folder: 'Drafts' });
  const { actions, projects } = harness({
    project: project([archived, draft], {
      screensPanel: { collapsedFolderNames: ['Archive', 'Drafts'] },
    }),
  });

  await actions.deleteFolder('Archive');

  expect(projects.at(-1)?.screensPanel?.collapsedFolderNames).toEqual(['Drafts']);
});

test('syncScreens preserves collapsed Screens panel folders while saving screen changes', async () => {
  const archived = screen({ id: 'archived', name: 'Archived', folder: 'Archive' });
  const { actions, projects } = harness({
    project: project([archived], {
      screensPanel: { collapsedFolderNames: ['Archive'] },
    }),
    annotateScreenHealth: async (screens) =>
      screens.map((item) => ({
        ...item,
        health: {
          status: 'needs-review',
          reason: 'Needs review after sync.',
          source: 'sync',
          updatedAt: 1,
        },
      })),
  });

  await actions.syncScreens();

  expect(projects.at(-1)?.screensPanel?.collapsedFolderNames).toEqual(['Archive']);
  expect(projects.at(-1)?.screens[0]?.health?.status).toBe('needs-review');
});

test('syncScreens prunes collapsed Screens panel folders that no longer exist', async () => {
  const draft = screen({ id: 'draft', name: 'Draft', folder: 'Drafts' });
  const { actions, projects } = harness({
    project: project([draft], {
      screensPanel: { collapsedFolderNames: ['Archive', 'Drafts'] },
    }),
    annotateScreenHealth: async (screens) =>
      screens.map((item) => ({
        ...item,
        health: {
          status: 'needs-review',
          reason: 'Needs review after sync.',
          source: 'sync',
          updatedAt: 1,
        },
      })),
  });

  await actions.syncScreens();

  expect(projects.at(-1)?.screensPanel?.collapsedFolderNames).toEqual(['Drafts']);
});
