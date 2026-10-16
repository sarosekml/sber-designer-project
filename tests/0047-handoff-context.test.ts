import { expect, test } from 'bun:test';

import {
  allowedTargetsFromState,
  buildOpenCodeHandoffPrompt,
  buildPromptFromEditorState,
} from '../services/api/src/agent-runtimes/handoff-prompt';

test('builds a handoff prompt with validation contract before user request', () => {
  const prompt = buildOpenCodeHandoffPrompt({
    userRequest: 'Создай экран по выбранному frame в Pixso',
    projectName: 'Demo CRM',
    workspacePath: '/work/demo',
    projectInstructions:
      'Reuse the project table, button, and card components before creating custom UI.',
    activeScreen: {
      id: 'screen-current',
      name: 'Current Screen',
      filePath: 'src/screens/Current.stories.tsx',
      implementationFilePath: 'src/screens/Current.tsx',
    },
    allowedTargets: ['src/screens/NewFromPixso.tsx', 'src/screens/NewFromPixso.stories.tsx'],
    designSource: {
      source: {
        kind: 'pixso',
        input: 'selection',
      },
      target: {
        mode: 'new-screen',
        name: 'New From Pixso',
        storyFilePath: 'src/stories/screens/2026-05-25/NewFromPixso.stories.tsx',
        implementationFilePath: 'src/screens/2026-05-25/NewFromPixso.tsx',
      },
      policies: {
        tokens: 'prefer-project-tokens',
        components: 'prefer-existing',
      },
    },
    designIndexSummary: 'Use Button, Card, Input from the project design system.',
    agentRunId: 'run-test',
  });

  expect(prompt.indexOf('## Validation Contract')).toBeGreaterThanOrEqual(0);
  expect(prompt.indexOf('## Validation Contract')).toBeLessThan(prompt.indexOf('## User Request'));
  expect(prompt.indexOf('## Project Instructions')).toBeLessThan(prompt.indexOf('## User Request'));
  expect(prompt).toContain('Reuse the project table');
  expect(prompt).toContain('src/screens/NewFromPixso.tsx');
  expect(prompt).toContain('Pixso');
  expect(prompt).toContain(
    'Use only Pixso MCP tools that are exposed in the current MCP inventory',
  );
  expect(prompt).toContain('ask for a screenshot or export fallback');
  expect(prompt).not.toContain('get_code');
  expect(prompt).not.toContain('get_image');
  expect(prompt).toContain('exactly one selected frame');
  expect(prompt).toContain('.sber-designer/runs/run-test/reference/design-source/');
  expect(prompt).toContain('mapping-report.md');
});

test('includes selected element metadata in local CLI handoff prompt', () => {
  const prompt = buildPromptFromEditorState({
    messages: [{ role: 'user', content: 'сделай эту кнопку размером xs' }],
    state: {
      projectName: 'IBP UI Kit',
      projectInstructions: 'Keep spacing dense and avoid decorative sections.',
      workspacePath: '/work/ibp-ui-kit',
      activeScreen: {
        id: 'screen-current',
        name: 'Payment Detail',
        kind: 'story',
        filePath: 'src/stories/screens/PaymentDetail.stories.tsx',
        implementationFilePath: 'src/screens/PaymentDetail.tsx',
      },
      selection: {
        loc: 'src/screens/PaymentDetail.tsx:500:9',
        sourceKind: 'react-source',
        tagName: 'button',
        text: 'В реестр платежей',
        selector: '[data-testid="PaymentDetailBackToRegistry_Button"]',
        componentName: 'Button',
        componentLoc: 'src/screens/PaymentDetail.tsx:500:9',
        attributes: {
          'data-testid': 'PaymentDetailBackToRegistry_Button',
        },
        rect: {
          x: 340,
          y: 80,
          width: 144,
          height: 32,
        },
      },
    },
  });

  expect(prompt).toContain('## Selected Element');
  expect(prompt).toContain('## Project Instructions');
  expect(prompt).toContain('Keep spacing dense');
  expect(prompt).toContain('src/screens/PaymentDetail.tsx:500:9');
  expect(prompt).toContain('В реестр платежей');
  expect(prompt).toContain('PaymentDetailBackToRegistry_Button');
  expect(prompt).toContain('selectionScope: active');
  expect(prompt).toContain('## Selected target (hard contract)');
  expect(prompt).toContain('hardTargetRule');
  expect(prompt).toContain('do not satisfy a scoped request by editing a nearby');
});

test('external runtime handoff requires a visible change to allowed targets', () => {
  const prompt = buildPromptFromEditorState({
    messages: [
      {
        role: 'user',
        content:
          'Переделай текущий экран по приложенному документу payment-detail-html-js-screen-prompt.md',
      },
    ],
    state: {
      projectName: 'IBP UI Kit',
      workspacePath: '/work/ibp-ui-kit',
      activeScreen: {
        id: 'screen-payment-detail',
        name: 'Test gen',
        kind: 'story',
        filePath: 'src/stories/screens/TestGen.stories.tsx',
        implementationFilePath: 'src/screens/TestGen.tsx',
      },
    },
  });

  expect(prompt).toContain('must edit at least one allowed target file');
  expect(prompt).toContain('Attached documents and pasted file contents are task requirements');
  expect(prompt).toContain('src/screens/TestGen.tsx');
});

test('html-first design-system import targets canonical sources and a dedicated page, not Index', () => {
  const targets = allowedTargetsFromState(
    {
      projectName: 'Demo HTML',
      workspacePath: '/work/demo-html',
      activeScreen: {
        id: 'index',
        name: 'Index',
        kind: 'page',
        filePath: 'index.html',
        implementationFilePath: 'index.html',
      },
      assistantTaskIntent: null,
    },
    'Прикрепил файл с дизайн системой, перенеси его сюда в качестве экрана и обнови файл design.md',
  );

  expect(targets).toEqual([
    'design-system/Design.md',
    'design-system/tokens.css',
    'design-system/components.css',
    'design-system/refs/**',
  ]);
});

test('screen generation that follows a design system does not become a proposal target task', () => {
  const reactTargets = allowedTargetsFromState(
    {
      projectName: 'React project',
      workspacePath: '/work/react',
      activeScreen: {
        id: 'login',
        name: 'Login',
        kind: 'story',
        filePath: 'src/stories/screens/Login.stories.tsx',
        implementationFilePath: 'src/screens/Login.tsx',
      },
      assistantTaskIntent: null,
    },
    'Create a login screen following our design system',
    { agentRunId: 'run-login' },
  );
  const htmlTargets = allowedTargetsFromState(
    {
      projectName: 'HTML project',
      workspacePath: '/work/html',
      activeScreen: {
        id: 'login',
        name: 'Login',
        kind: 'page',
        filePath: 'pages/login.html',
        implementationFilePath: 'pages/login.html',
      },
      assistantTaskIntent: null,
    },
    'Создай экран логина по нашей дизайн-системе',
    { agentRunId: 'run-login' },
  );

  expect(reactTargets).toEqual(['src/stories/screens/Login.stories.tsx', 'src/screens/Login.tsx']);
  expect(htmlTargets).toEqual(['pages/login.html']);
});
