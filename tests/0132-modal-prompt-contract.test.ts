/**
 * 0132.1 — the modal layout contract reaches the system prompt for an active
 * modal screen, in both profiles, and is absent for a normal page.
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ProjectScreen } from '@sber-designer/shared-types';

import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { resetProject } from '../services/api/src/project-store';
import { patchState, resetState } from '../services/api/src/state-store';

const htmlModal: ProjectScreen = {
  id: 'screen-modal',
  name: 'Delete confirm',
  kind: 'page',
  surface: 'modal',
  filePath: 'pages/delete-confirm.html',
  implementationFilePath: 'pages/delete-confirm.html',
};

const reactModal: ProjectScreen = {
  id: 'screen-modal-react',
  name: 'Invite member',
  kind: 'page',
  surface: 'modal',
  filePath: 'src/stories/screens/InviteMember.stories.tsx',
  implementationFilePath: 'src/screens/InviteMember.tsx',
};

const htmlPage: ProjectScreen = {
  id: 'screen-page',
  name: 'Deals',
  kind: 'page',
  filePath: 'pages/deals.html',
  implementationFilePath: 'pages/deals.html',
};

function expectModalContract(text: string) {
  expect(text).toContain('## Modal layout contract');
  expect(text).toContain('data-sd-modal-window');
  expect(text).toContain('--sd-modal-width');
  expect(text).toContain('data-sd-modal-region="header|body|footer"');
  expect(text).toContain('Do NOT expand this into a full-screen page');
  expect(text).toContain('activeScreenSurface: `modal`');
}

test('html-first active modal injects the modal contract (html profile)', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-modal-prompt-html-'));
  resetProject();
  resetState();
  patchState({ mode: 'interact', workspacePath: workspace, activeScreen: htmlModal });
  const prompt = await buildSystemPrompt();
  expectModalContract(prompt.text);
  // html profile does not carry the react-only Storybook-host line.
  expect(prompt.text).not.toContain('transparent (`html`, `body`, `#storybook-root`');
  resetState();
  resetProject();
});

test('react active modal injects the modal contract with the Storybook-host note', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-modal-prompt-react-'));
  resetProject();
  resetState();
  patchState({ mode: 'interact', workspacePath: workspace, activeScreen: reactModal });
  const prompt = await buildSystemPrompt();
  expectModalContract(prompt.text);
  expect(prompt.text).toContain('#storybook-root');
  resetState();
  resetProject();
});

test('a normal page does not inject the modal contract', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-modal-prompt-page-'));
  resetProject();
  resetState();
  patchState({ mode: 'interact', workspacePath: workspace, activeScreen: htmlPage });
  const prompt = await buildSystemPrompt();
  expect(prompt.text).not.toContain('## Modal layout contract');
  expect(prompt.text).not.toContain('activeScreenSurface: `modal`');
  resetState();
  resetProject();
});
