import { expect, test } from 'bun:test';

import {
  buildHtmlDesignSystemApplyDirective,
  buildExternalDesignSourceDirective,
  createExternalDesignSystemProposalTargetDefaults,
  createExternalDesignSourceTargetDefaults,
  detectDesignSystemBootstrapIntent,
  detectExternalDesignSourceIntent,
  parseHtmlDesignSystemApplyDirective,
  isExternalDesignSourceTargetPath,
} from '../packages/shared-types/src';
import { buildPromptFromEditorState } from '../services/api/src/agent-runtimes/handoff-prompt';
import {
  chatRunTargetPaths,
  validateHtmlDesignSystemApplyPreflight,
} from '../services/api/src/routes/chat-stream/run-context';

test('detects Pixso URL design-source intent without fetching it', () => {
  const intent = detectExternalDesignSourceIntent(
    'Create a new screen from https://pixso.net/app/editor/abc?node-id=12-34',
  );

  expect(intent).toMatchObject({
    source: {
      kind: 'pixso',
      input: 'link',
      url: 'https://pixso.net/app/editor/abc?node-id=12-34',
    },
    target: { mode: 'new-screen' },
    policies: { tokens: 'prefer-project-tokens', components: 'prefer-existing' },
  });
});

test('detects selected Pixso frame intent', () => {
  const intent = detectExternalDesignSourceIntent('Создай экран по выбранному frame в Pixso');

  expect(intent).toMatchObject({
    source: { kind: 'pixso', input: 'selection' },
    target: { mode: 'new-screen' },
  });
});

test('detects Pixso design-system bootstrap intent without screen target', () => {
  const intent = detectExternalDesignSourceIntent(
    'Создай Design.md для нового html проекта по https://pixso.net/app/editor/abc?node-id=12-34',
  );

  expect(intent).toMatchObject({
    source: {
      kind: 'pixso',
      input: 'link',
      url: 'https://pixso.net/app/editor/abc?node-id=12-34',
    },
    target: {
      mode: 'design-system',
      proposalRoot: 'design/proposals/design-source',
      designSystemFilePath: 'design/proposals/design-source/Design.md',
      extractionReportFilePath: 'design/proposals/design-source/extraction-report.md',
    },
    policies: { tokens: 'allow-source-values', components: 'allow-new-components' },
  });
});

test('design-system bootstrap run targets proposal files instead of empty scope', () => {
  const paths = chatRunTargetPaths(
    {
      activeScreen: null,
      assistantTaskIntent: null,
    } as never,
    'Создай Design.md для нового html проекта по https://pixso.net/app/editor/abc?node-id=12-34',
  );

  expect(paths).toEqual([
    'design/proposals/design-source/Design.md',
    'design/proposals/design-source/tokens.css',
    'design/proposals/design-source/components.css',
    'design/proposals/design-source/design-system.html',
    'design/proposals/design-source/extraction-report.md',
  ]);
});

test('html-first design-system import run targets canonical sources instead of Index', () => {
  const paths = chatRunTargetPaths(
    {
      activeScreen: {
        id: 'index',
        name: 'Index',
        kind: 'page',
        filePath: 'index.html',
        implementationFilePath: 'index.html',
      },
      assistantTaskIntent: null,
    } as never,
    'Прикрепил файл с дизайн системой, перенеси его сюда в качестве экрана и обнови файл design.md',
  );

  expect(paths).toEqual([
    'design-system/Design.md',
    'design-system/tokens.css',
    'design-system/components.css',
    'design-system/refs/**',
  ]);
  expect(paths).not.toContain('index.html');
});

test('html-first reusable component work targets design-system sources instead of active page', () => {
  const paths = chatRunTargetPaths(
    {
      activeScreen: {
        id: 'index',
        name: 'Index',
        kind: 'page',
        filePath: 'index.html',
        implementationFilePath: 'index.html',
      },
      assistantTaskIntent: null,
    } as never,
    'Добавь новый reusable CSS component для pricing card в html проект',
  );

  expect(paths).toEqual([
    'design-system/Design.md',
    'design-system/tokens.css',
    'design-system/components.css',
    'design-system/refs/**',
  ]);
  expect(paths).not.toContain('index.html');
});

test('html-first design-system apply directive targets existing pages instead of active Index', () => {
  const directive = buildHtmlDesignSystemApplyDirective(['pages/deals.html', 'pages/request.html']);
  const request = `Apply the accepted HTML design system to existing pages\n\n${directive}`;
  const state = {
    activeScreen: {
      id: 'index',
      name: 'Index',
      kind: 'page',
      filePath: 'index.html',
      implementationFilePath: 'index.html',
    },
    assistantTaskIntent: null,
  } as never;

  expect(parseHtmlDesignSystemApplyDirective(request)).toEqual([
    'pages/deals.html',
    'pages/request.html',
  ]);
  expect(chatRunTargetPaths(state, request)).toEqual(['pages/deals.html', 'pages/request.html']);

  const prompt = buildPromptFromEditorState({
    messages: [{ role: 'user', content: request }],
    state: {
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
  });

  expect(prompt).toContain('Allowed target files:\n- pages/deals.html\n- pages/request.html');
  expect(prompt).toContain('pages/deals.html');
  expect(prompt).toContain('pages/request.html');
  expect(prompt).not.toContain('Allowed target files:\n- index.html');
  expect(prompt).toContain('Apply the accepted HTML design system');
  expect(prompt).toContain('static render validation');
  expect(prompt).toContain(
    'Do not create or edit design-system/Design.md, design-system/tokens.css, design-system/components.css, or design-system/index.html',
  );
  expect(prompt).not.toContain('[SBER_DESIGNER_HTML_DS_APPLY]');
});

test('html-first design-system apply directive rejects managed files and supports html variants', () => {
  const request = [
    'Apply the accepted HTML design system to existing pages',
    '[SBER_DESIGNER_HTML_DS_APPLY]',
    'targetPage=index.html',
    'targetPage=design-system.html',
    'targetPage=pages/design-system.html',
    'targetPage=pages/deal.htm',
    'targetPage=pages/Upper.HTML',
    'targetPage=design/proposals/run-123/page.html',
    '[/SBER_DESIGNER_HTML_DS_APPLY]',
  ].join('\n');

  expect(parseHtmlDesignSystemApplyDirective(request)).toEqual([
    'pages/Upper.HTML',
    'pages/deal.htm',
    'pages/design-system.html',
  ]);
  expect(
    chatRunTargetPaths({ activeScreen: null, assistantTaskIntent: null } as never, request),
  ).toEqual(['pages/Upper.HTML', 'pages/deal.htm', 'pages/design-system.html']);
});

test('html-first design-system apply preflight requires connected design-system sources', () => {
  const directive = buildHtmlDesignSystemApplyDirective(['pages/deals.html']);
  const request = `Apply the accepted HTML design system\n\n${directive}`;

  expect(
    validateHtmlDesignSystemApplyPreflight({
      userRequest: request,
      htmlDesignSystem: {
        status: 'bootstrap',
        foundRequired: ['design-md'],
        missingRequired: ['tokens-css', 'components-css'],
        sources: [],
      },
    }),
  ).toEqual({
    error: 'html_design_system_not_connected',
    detail:
      'Apply design system requires connected HTML design-system sources. Add or accept Design.md, tokens.css, and components.css before applying them to pages.',
  });

  expect(
    validateHtmlDesignSystemApplyPreflight({
      userRequest: request,
      htmlDesignSystem: {
        status: 'connected',
        foundRequired: ['design-md', 'tokens-css', 'components-css'],
        missingRequired: [],
        sources: [],
      },
    }),
  ).toBeNull();
});

test('does not treat screen generation that follows a design system as design-system bootstrap', () => {
  expect(
    detectDesignSystemBootstrapIntent('Create a login screen following our design system'),
  ).toBe(false);
  expect(detectDesignSystemBootstrapIntent('Создай экран логина по нашей дизайн-системе')).toBe(
    false,
  );
});

test('structured new-screen task does not become a bootstrap when catalog guidance mentions the design system', () => {
  const request = `[act-mode] Create a new production-quality screen named "Payments wireframe".

Target Storybook story:
- implementation file: src/screens/PaymentsWireframe.tsx

Use the existing Storybook catalog as the design system:
- First read the relevant component source files from the catalog snapshot.
- Follow the selected screen template's layout schema and regions.
- If a requested piece is missing from the design system, keep new markup small.`;

  expect(detectDesignSystemBootstrapIntent(request)).toBe(false);
  expect(detectExternalDesignSourceIntent(request)).toBeNull();

  const prompt = buildPromptFromEditorState({
    messages: [{ role: 'user', content: request }],
    state: {
      projectName: 'React Project',
      workspacePath: '/tmp/react-project',
      activeScreen: {
        id: 'payments-wireframe',
        name: 'Payments wireframe',
        kind: 'story',
        filePath: 'src/stories/PaymentsWireframe.stories.tsx',
        implementationFilePath: 'src/screens/PaymentsWireframe.tsx',
      },
    } as never,
    agentRunId: 'run-screen-not-bootstrap',
  });

  expect(prompt).toContain('- src/screens/PaymentsWireframe.tsx');
  expect(prompt).not.toContain('design/proposals/run-screen-not-bootstrap');
  expect(prompt).not.toContain('This is an HTML design-system bootstrap task');
});

test('detects Figma URL and normalizes node id', () => {
  const intent = detectExternalDesignSourceIntent(
    'Use https://www.figma.com/design/fileKey/Product?node-id=123-456&t=abc',
  );

  expect(intent).toMatchObject({
    source: {
      kind: 'figma',
      input: 'link',
      nodeId: '123:456',
    },
  });
});

test('defaults design-source targets to the Ungrouped screen folder', () => {
  const target = createExternalDesignSourceTargetDefaults({
    name: 'Payment Overview',
  });

  expect(target).toMatchObject({
    folder: 'Ungrouped',
    storyId: 'screens-ungrouped-payment-overview--default',
    storyFilePath: 'src/stories/screens/Ungrouped/PaymentOverview.stories.tsx',
    implementationFilePath: 'src/screens/Ungrouped/PaymentOverview.tsx',
  });
});

test('defaults design-source design-system proposal target paths', () => {
  const target = createExternalDesignSystemProposalTargetDefaults({ proposalId: 'run-123' });

  expect(target).toEqual({
    proposalRoot: 'design/proposals/run-123',
    designSystemFilePath: 'design/proposals/run-123/Design.md',
    tokensFilePath: 'design/proposals/run-123/tokens.css',
    componentsFilePath: 'design/proposals/run-123/components.css',
    designSystemPreviewFilePath: 'design/proposals/run-123/design-system.html',
    extractionReportFilePath: 'design/proposals/run-123/extraction-report.md',
  });
  expect(isExternalDesignSourceTargetPath(target.designSystemPreviewFilePath)).toBe(true);
  expect(isExternalDesignSourceTargetPath(target.designSystemFilePath)).toBe(true);
  expect(isExternalDesignSourceTargetPath(target.extractionReportFilePath)).toBe(true);
});

test('parses structured mini-form directive and target paths', () => {
  const target = createExternalDesignSourceTargetDefaults({
    name: 'Payment Overview',
    date: '2026-05-25',
  });
  const directive = buildExternalDesignSourceDirective({
    source: {
      kind: 'figma',
      input: 'link',
      url: 'https://www.figma.com/design/fileKey/Product?node-id=1-2',
    },
    target: {
      mode: 'new-screen',
      name: target.name,
      folder: target.folder,
      storyId: target.storyId,
      storyFilePath: target.storyFilePath,
      implementationFilePath: target.implementationFilePath,
    },
    policies: {
      tokens: 'allow-source-values',
      components: 'allow-new-components',
    },
  });

  const intent = detectExternalDesignSourceIntent(`Build it\n\n${directive}`);

  expect(intent).toMatchObject({
    source: { kind: 'figma', input: 'link', nodeId: '1:2' },
    target: {
      mode: 'new-screen',
      name: 'Payment Overview',
      storyFilePath: 'src/stories/screens/2026-05-25/PaymentOverview.stories.tsx',
      implementationFilePath: 'src/screens/2026-05-25/PaymentOverview.tsx',
    },
    policies: {
      tokens: 'allow-source-values',
      components: 'allow-new-components',
    },
  });
  expect(isExternalDesignSourceTargetPath(target.storyFilePath)).toBe(true);
  expect(isExternalDesignSourceTargetPath(target.implementationFilePath)).toBe(true);
  expect(isExternalDesignSourceTargetPath('../src/screens/2026-05-25/Payment.tsx')).toBe(false);
});

test('handoff prompt strips directive and adds design-source target files', () => {
  const target = createExternalDesignSourceTargetDefaults({
    name: 'Pixso Payment',
    date: '2026-05-25',
  });
  const directive = buildExternalDesignSourceDirective({
    source: { kind: 'pixso', input: 'selection' },
    target: {
      mode: 'new-screen',
      name: target.name,
      folder: target.folder,
      storyId: target.storyId,
      storyFilePath: target.storyFilePath,
      implementationFilePath: target.implementationFilePath,
    },
    policies: { tokens: 'prefer-project-tokens', components: 'prefer-existing' },
  });

  const prompt = buildPromptFromEditorState({
    messages: [
      { role: 'user', content: `Create it from the selected Pixso frame\n\n${directive}` },
    ],
    state: {
      projectName: 'Demo',
      workspacePath: '/work/demo',
      activeScreen: null,
    },
    agentRunId: 'run-123',
  });

  expect(prompt).toContain('src/screens/2026-05-25/PixsoPayment.tsx');
  expect(prompt).toContain('src/stories/screens/2026-05-25/PixsoPayment.stories.tsx');
  expect(prompt).toContain('.sber-designer/runs/run-123/reference/design-source/');
  expect(prompt).toContain('Create it from the selected Pixso frame');
  expect(prompt).not.toContain('[SBER_DESIGNER_DESIGN_SOURCE]');
});

test('handoff prompt routes Pixso design-source to Design.md proposal files', () => {
  const target = createExternalDesignSystemProposalTargetDefaults({ proposalId: 'run-123' });
  const directive = buildExternalDesignSourceDirective({
    source: {
      kind: 'pixso',
      input: 'link',
      url: 'https://pixso.net/app/editor/abc?node-id=12-34',
    },
    target: {
      mode: 'design-system',
      ...target,
    },
    policies: { tokens: 'allow-source-values', components: 'allow-new-components' },
  });

  const prompt = buildPromptFromEditorState({
    messages: [{ role: 'user', content: `Create Design.md from Pixso\n\n${directive}` }],
    state: {
      projectName: 'Demo',
      workspacePath: '/work/demo',
      activeScreen: null,
    },
    agentRunId: 'run-123',
  });

  expect(prompt).toContain('targetMode: design-system');
  expect(prompt).toContain('design/proposals/run-123/Design.md');
  expect(prompt).toContain('design/proposals/run-123/design-system.html');
  expect(prompt).toContain('design/proposals/run-123/extraction-report.md');
  expect(prompt).toContain('Create a reviewable HTML design-system proposal');
  expect(prompt).toContain(
    'Use only Pixso MCP tools that are exposed in the current MCP inventory',
  );
  expect(prompt).not.toContain('get_code');
  expect(prompt).not.toContain('get_image');
  expect(prompt).not.toContain('src/screens/');
  expect(prompt).not.toContain('[SBER_DESIGNER_DESIGN_SOURCE]');
});
