import { expect, test } from 'bun:test';
import {
  buildHtmlDesignSystemApplyDirective,
  type ProjectScreen,
} from '@sber-designer/shared-types';

import { resolveAssistantTarget } from '../apps/web/src/lib/assistant-target';

const activeScreen: ProjectScreen = {
  id: 'screen-base',
  name: 'Base Screen',
  kind: 'story',
  storyId: 'screens-base--default',
  filePath: 'src/stories/screens/2026-05-17/BaseScreen.stories.tsx',
  implementationFilePath: 'src/screens/2026-05-17/BaseScreen.tsx',
};

test('current-page wording resolves to editing the active screen', () => {
  const result = resolveAssistantTarget({
    message: 'Сделай экран по техническому заданию из документа на текущей странице',
    activeScreen,
    preference: 'auto',
    existingIntent: null,
  });

  expect(result).toEqual({
    intent: {
      kind: 'edit-current-screen',
      targetScreenId: 'screen-base',
    },
    target: 'current-screen',
    reason: 'explicit-current',
  });
});

test('current-page wording wins over attached document create wording because attachments are not resolver input', () => {
  const result = resolveAssistantTarget({
    message: [
      'Сделай экран по техническому заданию из документа на текущей странице',
      '',
      'Attached file: drb-demo-04.md',
      'Задача генерации: создать экран детального просмотра сделки',
    ].join('\n'),
    activeScreen,
    preference: 'auto',
    existingIntent: null,
  });

  expect(result.intent).toEqual({
    kind: 'edit-current-screen',
    targetScreenId: 'screen-base',
  });
  expect(result.reason).toBe('explicit-current');
});

test('explicit new screen remains a create flow', () => {
  const result = resolveAssistantTarget({
    message: 'Создай новый экран сделки рядом с текущим',
    activeScreen,
    preference: 'current-screen',
    existingIntent: null,
  });

  expect(result.intent).toBe(null);
  expect(result.target).toBe('new-screen');
  expect(result.reason).toBe('explicit-new');
});

test('duplicate current screen wording remains a new screen flow', () => {
  const result = resolveAssistantTarget({
    message: 'Duplicate the current screen and make the copy more compact',
    activeScreen,
    preference: 'current-screen',
    existingIntent: null,
  });

  expect(result.intent).toBe(null);
  expect(result.target).toBe('new-screen');
  expect(result.reason).toBe('explicit-new');
});

test('current-screen preference targets the selected screen when the message is broad', () => {
  const result = resolveAssistantTarget({
    message: 'Build the deal details from this brief',
    activeScreen,
    preference: 'current-screen',
    existingIntent: null,
  });

  expect(result.intent).toEqual({
    kind: 'edit-current-screen',
    targetScreenId: activeScreen.id,
  });
  expect(result.reason).toBe('preference');
});

test('html-first design-system import does not inherit current-screen edit scope', () => {
  const result = resolveAssistantTarget({
    message:
      'Прикрепил файл с дизайн системой, перенеси его сюда в качестве экрана и обнови файл design.md',
    activeScreen: { ...activeScreen, kind: 'page', filePath: 'index.html' },
    preference: 'current-screen',
    existingIntent: {
      kind: 'edit-current-screen',
      targetScreenId: activeScreen.id,
    },
    projectKind: 'html-first',
  });

  expect(result).toEqual({
    intent: null,
    target: 'auto',
    reason: 'project-scope',
  });
});

test('html-first design-system apply directive does not inherit current-screen edit scope', () => {
  const htmlScreen: ProjectScreen = {
    ...activeScreen,
    kind: 'page',
    filePath: 'index.html',
    implementationFilePath: 'index.html',
  };
  const message = [
    'Apply the accepted HTML design system to existing pages.',
    buildHtmlDesignSystemApplyDirective(['pages/deals.html', 'pages/request.html']),
  ].join('\n\n');

  expect(
    resolveAssistantTarget({
      message,
      activeScreen: htmlScreen,
      preference: 'current-screen',
      existingIntent: null,
      projectKind: 'html-first',
    }),
  ).toEqual({
    intent: null,
    target: 'auto',
    reason: 'project-scope',
  });

  expect(
    resolveAssistantTarget({
      message,
      activeScreen: htmlScreen,
      preference: 'auto',
      existingIntent: {
        kind: 'edit-current-screen',
        targetScreenId: htmlScreen.id,
      },
      projectKind: 'html-first',
    }),
  ).toEqual({
    intent: null,
    target: 'auto',
    reason: 'project-scope',
  });
});

test('html-first screen generation following a design system remains a new screen task', () => {
  const htmlScreen: ProjectScreen = {
    ...activeScreen,
    kind: 'page',
    filePath: 'pages/current.html',
    implementationFilePath: 'pages/current.html',
  };

  const english = resolveAssistantTarget({
    message: 'Create a login screen following our design system',
    activeScreen: htmlScreen,
    preference: 'auto',
    existingIntent: null,
    projectKind: 'html-first',
  });
  const russian = resolveAssistantTarget({
    message: 'Создай экран логина по нашей дизайн-системе',
    activeScreen: htmlScreen,
    preference: 'auto',
    existingIntent: null,
    projectKind: 'html-first',
  });

  expect(english).toEqual({ intent: null, target: 'new-screen', reason: 'explicit-new' });
  expect(russian).toEqual({ intent: null, target: 'new-screen', reason: 'explicit-new' });
});

test('create-screen assistant intents are preserved', () => {
  const result = resolveAssistantTarget({
    message: 'Заполни это по шаблону',
    activeScreen,
    preference: 'current-screen',
    existingIntent: {
      kind: 'fill-generated-screen',
      targetScreenId: activeScreen.id,
      targetName: activeScreen.name,
      targetFolder: '2026-05-17',
      targetStoryFilePath: activeScreen.filePath!,
      targetImplementationFilePath: activeScreen.implementationFilePath,
      targetStoryId: activeScreen.storyId!,
    },
  });

  expect(result.intent?.kind).toBe('fill-generated-screen');
  expect(result.reason).toBe('existing-intent');
});
