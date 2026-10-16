import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ProjectScreen } from '@sber-designer/shared-types';

import { resolveAssistantTarget } from '../apps/web/src/lib/assistant-target';
import { loadAgentToolsForContext } from '../services/api/src/agent/toolset';
import type { ToolContext } from '../services/api/src/agent/types';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { loadProjectForWorkspace, resetProject } from '../services/api/src/project-store';
import { patchState, resetState } from '../services/api/src/state-store';

const activeScreen: ProjectScreen = {
  id: 'screen-base',
  name: 'Base Screen',
  kind: 'story',
  storyId: 'screens-2026-05-17-base-screen--default',
  filePath: 'src/stories/screens/2026-05-17/BaseScreen.stories.tsx',
  implementationFilePath: 'src/screens/2026-05-17/BaseScreen.tsx',
  folder: '2026-05-17',
};

test('current-screen BRD generation cannot drift into creating another screen', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-current-screen-regression-'));
  await mkdir(join(workspace, 'src', 'screens', '2026-05-17'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'screens', '2026-05-17', 'BaseScreen.tsx'),
    'export function BaseScreen() { return null; }\n',
    'utf8',
  );
  await loadProjectForWorkspace(workspace, 'Current Screen Regression');

  const resolved = resolveAssistantTarget({
    message: 'Сделай экран по техническому заданию из документа на текущей странице',
    activeScreen,
    preference: 'auto',
    existingIntent: null,
  });
  expect(resolved.intent).toEqual({
    kind: 'edit-current-screen',
    targetScreenId: 'screen-base',
  });

  resetState();
  patchState({
    mode: 'interact',
    activeScreen,
    assistantTaskIntent: resolved.intent,
    workspacePath: workspace,
  });
  const prompt = await buildSystemPrompt();
  expect(prompt.text).toContain('taskWriteGuard: do not call screen_create');
  expect(prompt.text).toContain(
    'iconNameGuard: before using project `<Icon iconName="...">`, call `get_indexed_icon` or read `.sber-designer/design-index/icon-candidates.jsonl`',
  );
  expect(prompt.text).toContain(
    'targetImplementationFile: `src/screens/2026-05-17/BaseScreen.tsx`',
  );
  expect(prompt.text).toContain(
    'currentScreenWriteContract: the only writable files for this request are `src/screens/2026-05-17/BaseScreen.tsx` and `src/stories/screens/2026-05-17/BaseScreen.stories.tsx`',
  );
  expect(prompt.text).toContain(
    'never write to component source/story files under `src/components/**`',
  );
  expect(prompt.text).toContain(
    'currentScreenPrimaryOutput: write the generated screen UI into `src/screens/2026-05-17/BaseScreen.tsx`',
  );
  expect(prompt.text).toContain(
    'currentScreenStoryIdGuard: keep `src/stories/screens/2026-05-17/BaseScreen.stories.tsx` as a thin wrapper with its existing Storybook title/id',
  );
  expect(prompt.text).toContain(
    'if you change its title, you must also call screen_update with the matching storyId',
  );

  const ctx: ToolContext = {
    user: 'test-user',
    projectName: 'Current Screen Regression',
    activeScreen,
    assistantTaskIntent: resolved.intent,
    workspacePath: workspace,
    canvasUrl: null,
  };
  const tools = await loadAgentToolsForContext(ctx);
  const screenCreate = requireTool(tools, 'screen_create');
  const writeFileTool = requireTool(tools, 'write_file');

  await expect(
    screenCreate.handler(
      {
        name: 'Wrong New Screen',
        storyId: 'screens-2026-05-17-wrong--default',
        filePath: 'src/stories/screens/2026-05-17/Wrong.stories.tsx',
        implementationFilePath: 'src/screens/2026-05-17/Wrong.tsx',
      },
      ctx,
    ),
  ).rejects.toThrow('screen_create is not allowed while editing the current screen');

  await expect(
    writeFileTool.handler(
      {
        path: 'src/screens/2026-05-17/Wrong.tsx',
        contents: 'export function Wrong() { return null; }\n',
      },
      ctx,
    ),
  ).rejects.toThrow('write_file target is outside the current screen scope');

  await expect(
    writeFileTool.handler(
      {
        path: activeScreen.implementationFilePath!,
        contents: 'export function BaseScreen() { return <main />; }\n',
      },
      ctx,
    ),
  ).resolves.toMatchObject({ ok: true, path: activeScreen.implementationFilePath });

  resetState();
  resetProject();
});

test('html-first current page follow-up keeps writes on the active html page', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-html-current-page-regression-'));
  await mkdir(join(workspace, 'pages'), { recursive: true });
  await writeFile(
    join(workspace, 'pages', 'deal.html'),
    '<main data-sd-screen-root><h1>Deal</h1></main>\n',
    'utf8',
  );
  await loadProjectForWorkspace(workspace, 'HTML Current Page Regression');

  const htmlScreen: ProjectScreen = {
    id: 'deal-page',
    name: 'Deal Page',
    kind: 'page',
    filePath: 'pages/deal.html',
    implementationFilePath: 'pages/deal.html',
  };
  const resolved = resolveAssistantTarget({
    message: 'Добавь блок статуса на текущей странице',
    activeScreen: htmlScreen,
    preference: 'auto',
    existingIntent: null,
    projectKind: 'html-first',
  });
  expect(resolved.intent).toEqual({
    kind: 'edit-current-screen',
    targetScreenId: 'deal-page',
  });

  resetState();
  patchState({
    mode: 'interact',
    workspacePath: workspace,
    activeScreen: htmlScreen,
    assistantTaskIntent: resolved.intent,
  });
  const prompt = await buildSystemPrompt();
  expect(prompt.text).toContain('targetImplementationFile: `pages/deal.html`');
  expect(prompt.text).not.toContain('targetStoryFile: `pages/deal.html`');
  expect(prompt.text).toContain(
    'currentScreenWriteContract: the only writable file for this request is `pages/deal.html`',
  );
  expect(prompt.text).toContain(
    'currentHtmlPageGuard: keep this follow-up on `pages/deal.html`; do not create another HTML page unless the user explicitly asks',
  );
  expect(prompt.text).not.toContain('currentScreenStoryIdGuard');

  const ctx: ToolContext = {
    user: 'test-user',
    projectName: 'HTML Current Page Regression',
    activeScreen: htmlScreen,
    assistantTaskIntent: resolved.intent,
    workspacePath: workspace,
    canvasUrl: null,
  };
  const tools = await loadAgentToolsForContext(ctx);
  const screenCreate = requireTool(tools, 'screen_create');
  const writeFileTool = requireTool(tools, 'write_file');

  await expect(
    screenCreate.handler(
      {
        name: 'Wrong HTML Page',
        filePath: 'pages/wrong.html',
        implementationFilePath: 'pages/wrong.html',
      },
      ctx,
    ),
  ).rejects.toThrow('screen_create is not allowed while editing the current screen');

  await expect(
    writeFileTool.handler(
      {
        path: 'pages/wrong.html',
        contents: '<main data-sd-screen-root>Wrong</main>\n',
      },
      ctx,
    ),
  ).rejects.toThrow('write_file target is outside the current screen scope');

  await expect(
    writeFileTool.handler(
      {
        path: 'pages/deal.html',
        contents: '<main data-sd-screen-root><h1>Deal</h1><section>Status</section></main>\n',
      },
      ctx,
    ),
  ).resolves.toMatchObject({ ok: true, path: 'pages/deal.html' });

  resetState();
  resetProject();
});

function requireTool(tools: Awaited<ReturnType<typeof loadAgentToolsForContext>>, name: string) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}
