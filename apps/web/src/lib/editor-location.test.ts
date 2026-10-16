import { expect, test } from 'bun:test';
import type { ComponentEntry, ProjectScreen } from '@sber-designer/shared-types';

import {
  componentDisplayPath,
  editorFooterLocation,
  screenDisplayPath,
} from '@/lib/editor-location';

const screen = (overrides: Partial<ProjectScreen>): ProjectScreen => ({
  id: 'screen-1',
  name: 'ClientInfoPage Test 02',
  kind: 'story',
  storyId: 'screens-deepseekv4pro-clientinfopage-test-02--default',
  ...overrides,
});

const component = (overrides: Partial<ComponentEntry>): ComponentEntry => ({
  id: 'atoms-button',
  title: 'Atoms/Button',
  shortName: 'Button',
  filePath: 'src/components/Button.tsx',
  stories: [],
  ...overrides,
});

test('screenDisplayPath prefers the editable implementation path', () => {
  expect(
    screenDisplayPath(
      screen({
        filePath: 'src/stories/screens/DeepseekV4Pro/ClientInfoPageTest02.stories.tsx',
        implementationFilePath: 'src/screens/DeepseekV4Pro/ClientInfoPageTest02.tsx',
      }),
    ),
  ).toBe('src/screens/DeepseekV4Pro/ClientInfoPageTest02.tsx');
});

test('screenDisplayPath falls back to a slash-separated story path', () => {
  expect(
    screenDisplayPath(screen({ filePath: undefined, implementationFilePath: undefined })),
  ).toBe('screens/deepseekv4pro/clientinfopage-test-02--default');
});

test('componentDisplayPath returns the component source path', () => {
  expect(componentDisplayPath(component({ filePath: 'src/components/Button.tsx' }))).toBe(
    'src/components/Button.tsx',
  );
});

test('editorFooterLocation shows the active file under the workspace', () => {
  expect(
    editorFooterLocation({
      canvasView: 'screen',
      activeScreen: screen({
        implementationFilePath: 'src/screens/DeepseekV4Pro/ClientInfoPageTest02.tsx',
      }),
      activeComponent: component({ filePath: 'src/components/Button.tsx' }),
      workspacePath: '/Users/example/project',
    }),
  ).toBe('/Users/example/project/src/screens/DeepseekV4Pro/ClientInfoPageTest02.tsx');

  expect(
    editorFooterLocation({
      canvasView: 'storybook',
      activeScreen: screen({
        implementationFilePath: 'src/screens/DeepseekV4Pro/ClientInfoPageTest02.tsx',
      }),
      activeComponent: component({ filePath: 'src/components/Button.tsx' }),
      workspacePath: '/Users/example/project/',
    }),
  ).toBe('/Users/example/project/src/components/Button.tsx');
});
