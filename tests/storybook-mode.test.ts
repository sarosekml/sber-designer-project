import { expect, test } from 'bun:test';

import { screenPreviewUrl } from '../apps/web/src/lib/screen-url';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { EditorStateSchema, patchState, resetState } from '../services/api/src/state-store';

const activeComponent = {
  id: 'components-button',
  title: 'Components/Button',
  shortName: 'Button',
  filePath: 'src/stories/Button.stories.tsx',
  stories: [
    {
      id: 'components-button--primary',
      name: 'Primary',
      previewUrl: 'http://localhost:6006/iframe.html?id=components-button--primary',
    },
  ],
};

test('storybook mode preview opens active component docs in the iframe', () => {
  const url = screenPreviewUrl(
    null,
    'http://localhost:6006',
    'http://localhost:4173/demo.html',
    'storybook',
    activeComponent,
  );

  expect(url).toBe(
    'http://localhost:3000/api/preview/iframe.html?id=components-button--primary&viewMode=docs&shortcuts=false&singleStory=true',
  );
});

test('editor state accepts Storybook mode component context', () => {
  const parsed = EditorStateSchema.safeParse({
    mode: 'interact',
    canvasView: 'storybook',
    activeComponent,
    storybookReloadPending: true,
  });

  expect(parsed.success).toBe(true);
});

test('storybook mode prompt is component scoped and excludes screen context', async () => {
  resetState();
  patchState({
    canvasView: 'storybook',
    mode: 'design',
    projectName: 'demo',
    workspacePath: '/tmp/demo',
    canvasUrl: 'http://localhost:6006',
    activeComponent,
    activeScreen: {
      id: 'screen-a',
      name: 'AI Analysis',
      kind: 'story',
      storyId: 'screens-demo--ai-analysis',
      filePath: 'src/stories/Screens.stories.tsx',
    },
    commentContext: [
      {
        id: 'comment-1',
        screenId: 'screen-a',
        body: 'Fix this screen',
        anchor: { x: 0.1, y: 0.2 },
        status: 'open',
      },
    ],
    assistantTaskIntent: {
      kind: 'edit-current-screen',
      targetScreenId: 'screen-a',
    },
  });

  const prompt = await buildSystemPrompt();

  expect(prompt.text).toContain('## Storybook component context');
  expect(prompt.text).toContain('- canvasView: `storybook`');
  expect(prompt.text).toContain('- activeComponent: `Button` (Components/Button)');
  expect(prompt.text).toContain('- activeComponentFile: `src/stories/Button.stories.tsx`');
  expect(prompt.text).not.toContain('activeScreen:');
  expect(prompt.text).not.toContain('Comments context');
  expect(prompt.text).not.toContain('assistantTaskIntent');
});

test('description role prompt in html-first view excludes active screen and selection context', async () => {
  resetState();
  patchState({
    canvasView: 'html',
    mode: 'design',
    projectName: 'html-demo',
    workspacePath: '/tmp/html-demo',
    canvasUrl: 'http://localhost:4173/design-system.html',
    activeScreen: {
      id: 'screen-index',
      name: 'Index',
      kind: 'page',
      filePath: 'index.html',
      implementationFilePath: 'index.html',
      description: 'Project home page.',
    },
    selection: {
      loc: 'index.html:12:4',
      tagName: 'BUTTON',
      text: 'Buy now',
      selector: '.hero .button',
      componentName: 'HeroCta',
      componentLoc: 'index.html:12:4',
      rect: { x: 40, y: 50, width: 120, height: 44 },
    },
    visualDesign: {
      draftChanges: [{ kind: 'style', label: 'Change button color' }],
    },
    assistantTaskIntent: {
      kind: 'edit-current-screen',
      targetScreenId: 'screen-index',
    },
  });

  const prompt = await buildSystemPrompt({ agentName: 'ai-description-layer' });

  expect(prompt.text).toContain('## Component description context');
  expect(prompt.text).toContain('- canvasView: `html`');
  expect(prompt.text).not.toContain('activeScreen:');
  expect(prompt.text).not.toContain('activeScreenFile');
  expect(prompt.text).not.toContain('selection: `button`');
  expect(prompt.text).not.toContain('selectionText: Buy now');
  expect(prompt.text).not.toContain('Visual design context');
  expect(prompt.text).not.toContain('assistantTaskIntent');
});
