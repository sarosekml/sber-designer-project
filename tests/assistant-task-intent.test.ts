import { expect, test } from 'bun:test';

import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { EditorStateSchema, patchState, resetState } from '../services/api/src/state-store';

const createFromStoryIntent = {
  kind: 'create-screen-from-story' as const,
  targetScreenId: 'screen-deal-page',
  sourceStoryId: 'templates-base-screen--sidebar-shell',
  sourceStoryFilePath: 'src/stories/BaseScreenTemplate.stories.tsx',
  targetName: 'Deal Page',
  targetFolder: '2026-05-12',
  targetStoryFilePath: 'src/stories/screens/2026-05-12/DealPageabc123.stories.tsx',
  targetStoryId: 'screens-2026-05-12-deal-page-abc123--default',
};

test('editor state accepts assistant create-screen-from-story intent', () => {
  const parsed = EditorStateSchema.safeParse({
    mode: 'interact',
    assistantTaskIntent: createFromStoryIntent,
  });

  expect(parsed.success).toBe(true);
});

test('system prompt includes assistant task intent target and read-only source story', async () => {
  resetState();
  patchState({
    mode: 'interact',
    activeScreen: {
      id: 'screen-deal-page',
      name: 'Deal Page',
      kind: 'story',
      storyId: createFromStoryIntent.targetStoryId,
      filePath: createFromStoryIntent.targetStoryFilePath,
      folder: createFromStoryIntent.targetFolder,
    },
    assistantTaskIntent: createFromStoryIntent,
  });

  const prompt = await buildSystemPrompt();

  expect(prompt.text).toContain('assistantTaskIntent: `create-screen-from-story`');
  expect(prompt.text).toContain(
    'targetStoryFile: `src/stories/screens/2026-05-12/DealPageabc123.stories.tsx`',
  );
  expect(prompt.text).toContain('sourceStory: `templates-base-screen--sidebar-shell`');
  expect(prompt.text).toContain('sourceStoryMode: read-only');
});

test('system prompt makes edit-current-screen a hard write scope', async () => {
  resetState();
  patchState({
    mode: 'interact',
    activeScreen: {
      id: 'screen-base',
      name: 'Base Screen',
      kind: 'story',
      storyId: 'screens-2026-05-17-base-screen--default',
      filePath: 'src/stories/screens/2026-05-17/BaseScreen.stories.tsx',
      implementationFilePath: 'src/screens/2026-05-17/BaseScreen.tsx',
      folder: '2026-05-17',
      description: 'Created from Storybook template: templates-base-screen--sidebar-shell',
    },
    assistantTaskIntent: {
      kind: 'edit-current-screen',
      targetScreenId: 'screen-base',
    },
  });

  const prompt = await buildSystemPrompt();

  expect(prompt.text).toContain('assistantTaskIntent: `edit-current-screen`');
  expect(prompt.text).toContain(
    'targetImplementationFile: `src/screens/2026-05-17/BaseScreen.tsx`',
  );
  expect(prompt.text).toContain(
    'targetStoryFile: `src/stories/screens/2026-05-17/BaseScreen.stories.tsx`',
  );
  expect(prompt.text).toContain('taskWriteGuard: do not call screen_create');
  expect(prompt.text).toContain('attachmentTargetRule: attached files are requirements only');
  expect(prompt.text).toContain(
    'templateWrapperRule: if the implementation file is only a wrapper',
  );
});
