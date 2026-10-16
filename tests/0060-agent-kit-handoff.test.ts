import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { buildHtmlDesignSystemApplyDirective } from '../packages/shared-types/src';
import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import {
  buildAgentKitHandoff,
  buildExternalRuntimeNoTargetChangeRetryPrompt,
  buildExternalRuntimeRenderRepairPrompt,
} from '../services/api/src/agent-runtimes/agent-kit-handoff';
import {
  RuntimePromptBudgetError,
  validateRuntimePromptBudget,
} from '../services/api/src/agent-runtimes/prompt-delivery';
import { CODEX_RUNTIME_DEF } from '../services/api/src/agent-runtimes/registry';
import { resolvePreviousStableContextForHandoff } from '../services/api/src/routes/chat-stream/external';
import { buildExternalRuntimeCraftRepairPrompt } from '../services/api/src/routes/chat-stream/craft-repair';

async function createWorkspaceKit(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0060-handoff-'));
  const root = join(workspace, '.agents');
  await mkdir(join(root, 'agents'), { recursive: true });
  await mkdir(join(root, 'instructions'), { recursive: true });
  await mkdir(join(root, 'skills', 'product-screen-generation'), { recursive: true });
  await mkdir(join(root, 'skills', 'secret-skill'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });

  await writeFile(
    join(root, 'config.json'),
    JSON.stringify(
      {
        defaultAgent: 'ai-product-designer',
        instructions: ['agents/ai-product-designer.md', 'instructions/workspace.md'],
        knowledge: [
          {
            id: 'project-notes',
            path: 'knowledge/project-notes.md',
            description: 'Use for project-specific component rules.',
          },
        ],
        skills: { allow: ['*'], deny: ['secret-skill'] },
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    join(root, 'agents', 'ai-product-designer.md'),
    [
      '---',
      'name: ai-product-designer',
      'description: Workspace product designer.',
      'temperature: 0.2',
      'maxIterations: 10',
      '---',
      '',
      'WORKSPACE_AGENT_MARKER: act as product designer.',
      'When doing skill work, call load_agent_skill first.',
      'Use screen_create only for explicit new-screen flows.',
    ].join('\n'),
    'utf8',
  );

  await writeFile(
    join(root, 'agents', 'ai-screen-architect.md'),
    [
      '---',
      'name: ai-screen-architect',
      'description: Plan screen structure before editing.',
      'mode: subagent',
      '---',
      '',
      'SCREEN_ARCHITECT_MARKER',
    ].join('\n'),
    'utf8',
  );

  await writeFile(
    join(root, 'instructions', 'workspace.md'),
    'Use dense enterprise screens and existing table/card components.',
    'utf8',
  );

  await writeFile(
    join(root, 'skills', 'product-screen-generation', 'SKILL.md'),
    [
      '---',
      'name: product-screen-generation',
      'description: Generate production screens from BRDs and design-system context.',
      '---',
      '',
      'FULL_SKILL_BODY_SHOULD_NOT_BE_IN_PROMPT',
    ].join('\n'),
    'utf8',
  );

  await writeFile(
    join(root, 'skills', 'secret-skill', 'SKILL.md'),
    [
      '---',
      'name: secret-skill',
      'description: Denied skill that must not be exposed.',
      '---',
      '',
      'SECRET_SKILL_BODY_SHOULD_NOT_APPEAR',
    ].join('\n'),
    'utf8',
  );

  await writeFile(
    join(root, 'knowledge', 'project-notes.md'),
    '# Project Notes\n\nKNOWLEDGE_BODY_SHOULD_NOT_BE_IN_PROMPT',
    'utf8',
  );

  return workspace;
}

test('external runtime handoff delegates ai-product-designer role with skill inventory only', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: 'selected-model',
    messages: [
      {
        role: 'system',
        content:
          'Active assistant task summary: User is repairing a broken generated payment screen after Tab import errors.',
      },
      {
        role: 'user',
        content: 'Сгенерируй экран по приложенному BRD на активном screen.',
      },
    ],
    state: {
      projectName: 'IBP UI Kit',
      workspacePath: workspace,
      projectInstructions: 'Prefer compact finance workflows.',
      activeScreen: {
        id: 'screen-payment',
        name: 'Payment screen',
        kind: 'story',
        filePath: 'src/stories/screens/Payment.stories.tsx',
        implementationFilePath: 'src/screens/Payment.tsx',
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-0060',
    promptAttachments: [
      {
        id: 'att-reference',
        name: 'reference.png',
        mimeType: 'image/png',
        size: 421388,
        sha256: 'b'.repeat(64),
        width: 1440,
        height: 900,
        runPath: '.sber-designer/runs/run-0060/attachments/01-reference.png',
      },
    ],
  });

  expect(result.agentName).toBe('ai-product-designer');
  expect(result.prompt).toContain('You are acting as sber-designer');
  expect(result.prompt).toContain('WORKSPACE_AGENT_MARKER');
  expect(result.prompt).toContain('## Task History Summary');
  expect(result.prompt).toContain('Tab import errors');
  expect(result.prompt).toContain('product-screen-generation');
  expect(result.prompt).toContain('skills/product-screen-generation/SKILL.md');
  expect(result.prompt).toContain('read the matching SKILL.md path');
  expect(result.prompt).toContain('Prefer compact finance workflows');
  expect(result.prompt).toContain('Do not change the existing Storybook meta.title');
  expect(result.prompt).toContain('## Attached Image References');
  expect(result.prompt).toContain('01-reference.png');
  expect(result.prompt).toContain('They do not change the allowed target files.');
  expect(result.prompt).toContain(
    'Before finishing, verify that at least one allowed target file has changed.',
  );
  expect(result.prompt).toContain('Write checkpoint for active screens');
  expect(result.prompt).toContain('edit the active implementation file before broad project scans');
  expect(result.prompt).toContain(
    'Do not launch Storybook, Playwright, Chrome, browser automation',
  );
  expect(result.prompt).toContain('sber-designer runs render verification after your file changes');
  expect(result.prompt).toContain('sber-designer snapshots allowed target files before the run');
  expect(result.prompt).toContain('external_runtime_target_diff receipt');
  expect(result.prompt).toContain('Do not run git add -N');
  expect(result.prompt).not.toContain('git diff -- <allowed target files>');
  expect(result.prompt).not.toContain('FULL_SKILL_BODY_SHOULD_NOT_BE_IN_PROMPT');
  expect(result.prompt).not.toContain('secret-skill');
  expect(result.prompt).not.toContain('SECRET_SKILL_BODY_SHOULD_NOT_APPEAR');
});

test('external runtime handoff routes Pixso design-source to Design.md proposal files', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: 'selected-model',
    messages: [
      {
        role: 'user',
        content:
          'Создай Design.md для нового html проекта по https://pixso.net/app/editor/abc?node-id=12-34',
      },
    ],
    state: {
      projectName: 'Static Demo',
      workspacePath: workspace,
      canvasView: 'html',
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-0060-ds',
  });

  expect(result.prompt).toContain('targetMode: design-system');
  expect(result.prompt).toContain('design/proposals/run-0060-ds/Design.md');
  expect(result.prompt).toContain('design/proposals/run-0060-ds/extraction-report.md');
  expect(result.prompt).toContain('Create a reviewable HTML design-system proposal');
  expect(result.prompt).toContain('Do not create or edit screen implementation files');
  expect(result.prompt).not.toContain('Implement the requested static page/change');
});

test('external runtime handoff routes attached image references to Design.md proposal files', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: 'selected-model',
    messages: [
      {
        role: 'user',
        content: 'Создай Design.md для нового html проекта по приложенному скриншоту интерфейса',
      },
    ],
    state: {
      projectName: 'Static Demo',
      workspacePath: workspace,
      canvasView: 'html',
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-0060-image-ds',
    promptAttachments: [
      {
        id: 'att-reference',
        name: 'reference.png',
        mimeType: 'image/png',
        size: 421388,
        sha256: 'c'.repeat(64),
        width: 1440,
        height: 900,
        runPath: '.sber-designer/runs/run-0060-image-ds/attachments/01-reference.png',
      },
    ],
  });

  expect(result.prompt).toContain('## Attached Image References');
  expect(result.prompt).toContain('01-reference.png');
  expect(result.prompt).toContain('design/proposals/run-0060-image-ds/Design.md');
  expect(result.prompt).toContain('design/proposals/run-0060-image-ds/extraction-report.md');
  expect(result.prompt).toContain('Create a reviewable HTML design-system proposal');
  expect(result.prompt).toContain('Do not create or edit screen implementation files');
  expect(result.prompt).not.toContain('Implement the requested static page/change');
});

test('external runtime handoff routes accepted HTML design-system apply runs to existing pages', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });
  const directive = buildHtmlDesignSystemApplyDirective(['pages/deals.html', 'pages/request.html']);

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: 'selected-model',
    messages: [
      {
        role: 'user',
        content: `Apply the accepted HTML design system to existing pages\n\n${directive}`,
      },
    ],
    state: {
      projectName: 'Static Demo',
      workspacePath: workspace,
      canvasView: 'html',
      activeScreen: {
        id: 'index',
        name: 'Index',
        kind: 'page',
        filePath: 'index.html',
        implementationFilePath: 'index.html',
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-0060-apply-ds',
  });

  expect(result.prompt).toContain('## HTML Design-System Apply Context');
  expect(result.prompt).toContain('pages/deals.html');
  expect(result.prompt).toContain('pages/request.html');
  expect(result.prompt).toContain(
    'Apply the accepted HTML design system to the allowed existing page files',
  );
  expect(result.prompt).toContain(
    'Do not create or edit design-system/Design.md, design-system/tokens.css, design-system/components.css, or design-system/index.html',
  );
  expect(result.prompt).toContain('Run static render validation');
  expect(result.prompt).toContain(
    'Allowed target files:\n- pages/deals.html\n- pages/request.html',
  );
  expect(result.prompt).not.toContain('[SBER_DESIGNER_HTML_DS_APPLY]');
  expect(result.prompt).not.toContain('Allowed target files:\n- index.html');
});

test('external runtime handoff keeps HTML design-system apply context under prompt budget', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });
  const directive = buildHtmlDesignSystemApplyDirective(['pages/deals.html']);

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: 'selected-model',
    messages: [
      {
        role: 'user',
        content: `Apply the accepted HTML design system to existing pages\n\n${directive}`,
      },
    ],
    state: {
      projectName: 'Static Demo',
      workspacePath: workspace,
      projectInstructions: 'Heavy project context. '.repeat(600),
      activeScreen: {
        id: 'index',
        name: 'Index',
        kind: 'page',
        filePath: 'index.html',
        implementationFilePath: 'index.html',
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-0060-apply-ds-budget',
    maxPromptBytes: 6500,
  });

  expect(result.prompt).toContain('## HTML Design-System Apply Context');
  expect(result.prompt).toContain('pages/deals.html');
  expect(result.omittedSections).not.toContainEqual(
    expect.objectContaining({ section: 'HTML Design-System Apply Context' }),
  );
});

test('external runtime handoff pins CLI runtime identity over stale transcript claims', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: 'qwen/qwen3.7-plus',
    messages: [
      {
        role: 'assistant',
        content: 'I am Claude, created by Anthropic.',
      },
      {
        role: 'user',
        content: 'Что ты за модель?',
      },
    ],
    state: { projectName: 'Identity Project', workspacePath: workspace },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-runtime-identity',
  });

  expect(result.prompt).toContain('## Runtime identity');
  expect(result.prompt).toContain('- provider: `Codex CLI` (`codex`)');
  expect(result.prompt).toContain('- model: `qwen/qwen3.7-plus`');
  expect(result.prompt).toContain('- targetKind: `cli`');
  expect(result.prompt).toContain('- runtimeKind: `codex`');
  expect(result.prompt).toContain('runtime identity metadata supersedes transcript claims');
  expect(result.prompt).toContain('do not invent a hidden backend provider');
});

test('external runtime handoff makes selected element a hard edit target', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: 'gpt-5.5',
    messages: [{ role: 'user', content: 'сделай эту иконку красной' }],
    state: {
      projectName: 'Selected Target Project',
      workspacePath: workspace,
      activeScreen: {
        id: 'screen-payment',
        name: 'Payment screen',
        kind: 'story',
        filePath: 'src/stories/screens/Payment.stories.tsx',
        implementationFilePath: 'src/screens/Payment.tsx',
      },
      selection: {
        loc: 'src/screens/Payment.tsx:88:13',
        componentLoc: 'src/screens/Payment.tsx:88:13',
        sourceKind: 'react-source',
        tagName: 'button',
        text: 'Отменить',
        selector: '[data-testid="PaymentCancel_Button"]',
        componentName: 'Button',
        componentPath: ['PaymentScreen', 'HeaderActions', 'Button'],
        domPath: 'main > header > button:nth-of-type(2)',
        attributes: { 'data-testid': 'PaymentCancel_Button' },
        rect: { x: 1220, y: 124, width: 110, height: 32 },
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-selected-target',
  });

  expect(result.prompt).toContain('## Selected target (hard contract)');
  expect(result.prompt).toContain('- targetTag: `button`');
  expect(result.prompt).toContain('- targetLoc: `src/screens/Payment.tsx:88:13`');
  expect(result.prompt).toContain('- targetText: `Отменить`');
  expect(result.prompt).toContain('- targetSelector: `[data-testid="PaymentCancel_Button"]`');
  expect(result.prompt).toContain(
    'do not satisfy a scoped request by editing a nearby, visually similar, or same-role element',
  );
});

test('D7.6 html/css page handoff uses static HTML contract without Storybook pressure', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: 'selected-model',
    messages: [{ role: 'user', content: 'Сделай страницу по референсу на активном HTML screen.' }],
    state: {
      projectName: 'Static Site',
      workspacePath: workspace,
      canvasView: 'screen',
      activeScreen: {
        id: 'page-home',
        name: 'Home page',
        kind: 'page',
        filePath: 'site/page.html',
        implementationFilePath: 'site/page.html',
        description: 'Static HTML page',
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-html-profile',
    projectIndex: {
      status: 'valid',
      stale: false,
      promptSummary: '',
      htmlDesignSystem: {
        status: 'missing',
        foundRequired: [],
        missingRequired: ['design-md', 'tokens-css', 'components-css'],
        sources: [],
      },
    },
  });

  expect(result.prompt).toContain('## HTML/CSS Project Profile Contract');
  expect(result.prompt).toContain('- designContext: missing');
  expect(result.prompt).toContain(
    '- missingDesignSystemSources: design-md, tokens-css, components-css',
  );
  expect(result.prompt).toContain(
    'do not author reusable sources until the project is restructured into design-system/',
  );
  expect(result.prompt).toContain('semantic HTML');
  expect(result.prompt).toContain('CSS catalog classes');
  expect(result.prompt).toContain('var(--');
  expect(result.prompt).toContain('- page file: site/page.html');
  expect(result.prompt).not.toContain('Storybook');
  expect(result.prompt).not.toContain('TSX');
  expect(result.prompt).not.toContain('meta.title');
  expect(result.prompt).not.toContain('story file:');
});

test('wireframe generation mode is injected by backend handoff context', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: 'selected-model',
    messages: [{ role: 'user', content: 'Create a first-pass structure for the active screen.' }],
    state: {
      projectName: 'Wireframe Project',
      workspacePath: workspace,
      activeScreen: {
        id: 'screen-wireframe',
        name: 'Wireframe',
        kind: 'story',
        filePath: 'src/stories/screens/Wireframe.stories.tsx',
        implementationFilePath: 'src/screens/Wireframe.tsx',
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-wireframe',
    generation: {
      wireframe: true,
      designBrief: {
        version: 1,
        source: 'mini-form',
        axes: { palette: 'Project neutrals with one teal accent', density: 'compact' },
      },
    },
  });

  expect(result.prompt).toContain('## Generation Mode');
  expect(result.prompt).toContain('Wireframe mode is enabled for this run.');
  expect(result.prompt).toContain('screen-wireframe');
  expect(result.prompt).toContain('## Design brief');
  expect(result.prompt).toContain('- Palette: Project neutrals with one teal accent');
  expect(result.prompt).toContain('- Density: compact');
});

test('requested subagent is represented as a lens without replacing ai-product-designer persona', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });

  const result = buildAgentKitHandoff({
    runtime: 'claude-code',
    runtimeLabel: 'Claude Code CLI',
    model: 'selected-model',
    messages: [{ role: 'user', content: '@ai-screen-architect распланируй экран' }],
    state: { projectName: 'IBP UI Kit', workspacePath: workspace },
    kit,
    primaryAgentName: 'ai-product-designer',
    requestedAgentName: 'ai-screen-architect',
    agentRunId: 'run-0060',
  });

  expect(result.agentName).toBe('ai-product-designer');
  expect(result.prompt).toContain('## Requested Subagent Lens');
  expect(result.prompt).toContain('@ai-screen-architect');
  // 0083 section A: the subagent body is now inlined (the CLI cwd can't read the
  // .agents/ prompt path), while the primary persona is retained.
  expect(result.prompt).toContain('Plan screen structure before editing');
  expect(result.prompt).toContain('You remain sber-designer');
});

test('handoff redacts secret-like values from task summaries', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [
      {
        role: 'system',
        content: 'Active assistant task summary: API_KEY=sk-secret-secret-secret-secret',
      },
      { role: 'user', content: 'Fix the active screen.' },
    ],
    state: { projectName: 'Secret Project', workspacePath: workspace },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-redaction',
  });

  expect(result.prompt).toContain('[redacted-secret]');
  expect(result.prompt).not.toContain('sk-secret-secret-secret-secret');
});

test('handoff prompt budget keeps priority and output contracts while pruning middle context', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [
      { role: 'user', content: 'Create the active screen with the UNIQUE_ACTIVE_REQUEST.' },
    ],
    state: {
      projectName: 'Large Context Project',
      workspacePath: workspace,
      projectInstructions: 'Dense enterprise guidance. '.repeat(500),
      activeScreen: {
        id: 'screen-large',
        name: 'Large',
        kind: 'story',
        filePath: 'src/stories/screens/Large.stories.tsx',
        implementationFilePath: 'src/screens/Large.tsx',
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-budget',
    maxPromptBytes: 9000,
    generation: {
      wireframe: true,
      designBrief: {
        version: 1,
        source: 'mini-form',
        axes: { density: 'compact', palette: 'Neutral greybox only' },
      },
    },
  });

  expect(result.estimatedBytes).toBeLessThanOrEqual(9000);
  expect(result.prompt).toContain('## Priority Contract');
  expect(result.prompt).toContain('## User Request');
  expect(result.prompt).toContain('UNIQUE_ACTIVE_REQUEST');
  expect(result.prompt).toContain('## Generation Mode');
  expect(result.prompt).toContain('Wireframe mode is enabled for this run.');
  expect(result.prompt).toContain('## Design brief');
  expect(result.prompt).toContain('- Palette: Neutral greybox only');
  expect(result.prompt).toContain('## Output Contract');
  expect(result.omittedSections.length).toBeGreaterThan(0);
  expect(result.omittedSections).not.toContainEqual(
    expect.objectContaining({ section: 'Generation Mode' }),
  );
  expect(result.omittedSections).not.toContainEqual(
    expect.objectContaining({ section: 'Design brief' }),
  );
});

test('handoff prompt budget fails before dropping protected task sections', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });

  expect(() =>
    buildAgentKitHandoff({
      runtime: 'codex',
      runtimeLabel: 'Codex CLI',
      model: null,
      messages: [{ role: 'user', content: 'Keep this request protected.' }],
      state: {
        projectName: 'Tiny Protected Budget Project',
        workspacePath: workspace,
        activeScreen: {
          id: 'screen-tiny',
          name: 'Tiny',
          kind: 'story',
          filePath: 'src/stories/screens/Tiny.stories.tsx',
          implementationFilePath: 'src/screens/Tiny.tsx',
        },
      },
      kit,
      primaryAgentName: 'ai-product-designer',
      agentRunId: 'run-tiny-budget',
      maxPromptBytes: 900,
    }),
  ).toThrow(RuntimePromptBudgetError);
});

test('degrade prompt budget omits heavy stable context before runtime hard-cap preflight', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });
  const heavyStableMarker = 'HEAVY_STABLE_PROJECT_CONTEXT';

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [{ role: 'user', content: 'Create the active screen.' }],
    state: {
      projectName: 'Degrade Context Project',
      workspacePath: workspace,
      projectInstructions: `${heavyStableMarker} `.repeat(600),
      activeScreen: {
        id: 'screen-degrade',
        name: 'Degrade',
        kind: 'story',
        filePath: 'src/stories/screens/Degrade.stories.tsx',
        implementationFilePath: 'src/screens/Degrade.tsx',
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-degrade-budget',
    maxPromptBytes: 6500,
  });

  expect(result.estimatedBytes).toBeLessThanOrEqual(6500);
  expect(result.omittedSections).toContainEqual(
    expect.objectContaining({ section: 'Project System Context' }),
  );
  expect(result.prompt).toContain('[Omitted due to context budget:');
  expect(result.prompt).not.toContain(heavyStableMarker);
  expect(validateRuntimePromptBudget(CODEX_RUNTIME_DEF, result.prompt)).toMatchObject({
    ok: true,
  });
  expect(validateRuntimePromptBudget(CODEX_RUNTIME_DEF, 'x'.repeat(200_001))).toMatchObject({
    ok: false,
    code: 'prompt_too_large',
  });
});

test('handoff can resend unchanged stable context by digest reference only', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });
  const baseInput = {
    runtime: 'codex' as const,
    runtimeLabel: 'Codex CLI',
    model: 'gpt-5.5',
    messages: [{ role: 'user', content: 'Create a payment overview screen.' }],
    state: {
      projectName: 'Stable Context Project',
      workspacePath: workspace,
      projectInstructions: 'Use dense enterprise screens and existing table/card components.',
      activeScreen: {
        id: 'screen-stable',
        name: 'Stable',
        kind: 'story' as const,
        filePath: 'src/stories/screens/Stable.stories.tsx',
        implementationFilePath: 'src/screens/Stable.tsx',
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-stable-a',
    componentPack: {
      status: 'ready' as const,
      source: 'design-index' as const,
      stale: false,
      taskKind: 'screen-generation' as const,
      diagnostics: [],
      candidates: [
        {
          role: 'content-panel',
          componentId: 'molecules-tile',
          title: 'Molecules/Tile',
          shortName: 'Tile',
          importHint: '@components/molecules',
          confidence: 'high' as const,
          recordConfidence: 'high' as const,
          score: 24,
          reason: 'Matched content-panel role.',
          guidance: ['Use Tile for white content panels.'],
          snippet: {
            sourcePath: 'src/screens/Nearby.tsx',
            code: '<Tile title="Nearby example">...</Tile>',
          },
        },
      ],
    },
  };

  const first = buildAgentKitHandoff(baseInput);
  const second = buildAgentKitHandoff({
    ...baseInput,
    agentRunId: 'run-stable-b',
    messages: [{ role: 'user', content: 'Continue and repair the same screen.' }],
    componentPack: {
      status: 'ready' as const,
      source: 'design-index' as const,
      stale: false,
      taskKind: 'screen-generation' as const,
      diagnostics: [],
      candidates: [
        {
          role: 'data-table',
          componentId: 'organisms-data-table',
          title: 'Organisms/DataTable',
          shortName: 'DataTable',
          importHint: '@components/organisms',
          confidence: 'high' as const,
          recordConfidence: 'high' as const,
          score: 28,
          reason: 'Matched table role for the follow-up task.',
          guidance: ['Use DataTable for dense registry rows.'],
          snippet: {
            sourcePath: 'src/screens/TableNearby.tsx',
            code: '<DataTable rows={rows} columns={columns} />',
          },
        },
      ],
    },
    previousStableContext: {
      digest: first.stableContextDigest,
      contextBundlePath: '.sber-designer/runs/run-stable-a/external-runtime/prompt.md',
    },
  });

  expect(first.stableContextReuse).toBe('full');
  expect(first.stableContextDigest).toMatch(/^sha256:/u);
  expect(second.stableContextReuse).toBe('reference');
  expect(second.stableContextDigest).toBe(first.stableContextDigest);
  expect(second.prompt).toContain('## Stable Context Reuse');
  expect(second.prompt).toContain(first.stableContextDigest);
  expect(second.prompt).toContain('.sber-designer/runs/run-stable-a/external-runtime/prompt.md');
  expect(second.prompt).toContain('Continue and repair the same screen.');
  expect(second.prompt).toContain('Use DataTable for dense registry rows.');
  expect(second.prompt).toContain('## Output Contract');
  expect(second.prompt).not.toContain('Use Tile for white content panels.');
  expect(second.prompt).not.toContain('WORKSPACE_AGENT_MARKER');
  expect(second.estimatedBytes).toBeLessThan(first.estimatedBytes);
  expect(second.kitStableDigest).toBe(first.kitStableDigest);
  expect(second.kitStableBytes).toBe(first.kitStableBytes);
  expect(second.taskBytes).toBeGreaterThan(0);
});

test('external runtime handoff emits delta prompt for resumed runtime sessions', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });
  const baseInput = {
    runtime: 'claude-code' as const,
    runtimeLabel: 'Claude Code',
    model: 'sonnet',
    messages: [{ role: 'user', content: 'Create a payment overview screen.' }],
    state: {
      projectName: 'Delta Context Project',
      workspacePath: workspace,
      projectInstructions: 'Use dense enterprise screens and existing table/card components.',
      activeScreen: {
        id: 'screen-delta',
        name: 'Delta',
        kind: 'story' as const,
        filePath: 'src/stories/screens/Delta.stories.tsx',
        implementationFilePath: 'src/screens/Delta.tsx',
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-delta-a',
    componentPack: {
      status: 'ready' as const,
      source: 'design-index' as const,
      stale: false,
      taskKind: 'screen-generation' as const,
      diagnostics: [],
      candidates: [
        {
          role: 'content-panel',
          componentId: 'molecules-tile',
          title: 'Molecules/Tile',
          shortName: 'Tile',
          importHint: '@components/molecules',
          confidence: 'high' as const,
          recordConfidence: 'high' as const,
          score: 24,
          reason: 'Matched content-panel role.',
          guidance: ['Use Tile for white content panels.'],
        },
      ],
    },
  };

  const first = buildAgentKitHandoff(baseInput);
  const delta = buildAgentKitHandoff({
    ...baseInput,
    agentRunId: 'run-delta-b',
    messages: [{ role: 'user', content: 'Now tighten table density only.' }],
    previousStableContext: {
      digest: first.stableContextDigest,
      contextBundlePath: '.sber-designer/runs/run-delta-a/external-runtime/prompt.md',
      runManifestPath: '.sber-designer/runs/run-delta-a/run-manifest.json',
      source: 'metadata',
    },
    runtimeSession: {
      mode: 'resume',
      runtime: 'claude-code',
      sessionId: 'claude-session-abc',
      model: 'sonnet',
      workspacePath: workspace,
    },
  });

  expect(delta.resumeUsed).toBe(true);
  expect(delta.deltaBytes).toBe(delta.estimatedBytes);
  expect(delta.stableContextReuse).toBe('reference');
  expect(delta.prompt).toContain('## Runtime Session Resume');
  expect(delta.prompt).toContain('claude-session-abc');
  expect(delta.prompt).toContain('Now tighten table density only.');
  expect(delta.prompt).toContain('.sber-designer/runs/run-delta-a/external-runtime/prompt.md');
  expect(delta.prompt).not.toContain('## Skill Inventory');
  expect(delta.prompt).not.toContain('## Knowledge Inventory');
  expect(delta.prompt).toContain('Use Tile for white content panels.');
  expect(delta.estimatedBytes).toBeLessThan(first.estimatedBytes / 4);
  expect(delta.resumeFallbackPrompt).toContain('## Agent Kit Inventory');
  expect(delta.resumeFallbackPrompt).toContain('Use Tile for white content panels.');
  expect(delta.kitStableDigest).toBe(first.kitStableDigest);
  expect(delta.taskBytes).toBeGreaterThan(0);
});

test('resumed screen-edit handoff keeps a cache-stable bounded prompt', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });
  const baseInput = {
    runtime: 'codex' as const,
    runtimeLabel: 'Codex CLI',
    model: 'gpt-5.5',
    messages: [{ role: 'user', content: 'Create the initial payment screen.' }],
    state: {
      projectName: 'Bounded Edit Project',
      workspacePath: workspace,
      activeScreen: {
        id: 'screen-bounded-edit',
        name: 'Bounded edit',
        kind: 'story' as const,
        filePath: 'src/stories/screens/BoundedEdit.stories.tsx',
        implementationFilePath: 'src/screens/BoundedEdit.tsx',
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    projectIndex: {
      status: 'valid' as const,
      stale: false,
      promptSummary: 'HEAVY_PROJECT_INDEX_MARKER '.repeat(200),
    },
    componentPack: {
      status: 'ready' as const,
      source: 'design-index' as const,
      stale: false,
      taskKind: 'screen-edit' as const,
      diagnostics: [],
      candidates: [
        {
          role: 'requested-component-tile',
          componentId: 'molecules-tile',
          title: 'Molecules/Tile',
          shortName: 'Tile',
          importHint: '@/components/molecules/Tiles/Tile',
          confidence: 'high' as const,
          recordConfidence: 'high' as const,
          score: 100,
          reason: 'Explicit Tile requirement.',
          guidance: ['Keep the existing Tile wrapper.'],
          userRequired: true,
          snippet: {
            sourcePath: 'src/screens/Nearby.tsx',
            code: '<Tile>HYDRATION_MARKER</Tile>'.repeat(200),
          },
        },
      ],
    },
  };
  const first = buildAgentKitHandoff({
    ...baseInput,
    agentRunId: 'run-bounded-first',
  });
  const buildDelta = (runId: string, previousRunId: string, request: string) =>
    buildAgentKitHandoff({
      ...baseInput,
      agentRunId: runId,
      messages: [{ role: 'user', content: request }],
      previousStableContext: {
        digest: first.stableContextDigest,
        contextBundlePath: '.sber-designer/runs/run-bounded-first/external-runtime/prompt.md',
        runManifestPath: `.sber-designer/runs/${previousRunId}/run-manifest.json`,
        source: 'metadata' as const,
      },
      runtimeSession: {
        mode: 'resume' as const,
        runtime: 'codex' as const,
        sessionId: 'codex-bounded-session',
        model: 'gpt-5.5',
        workspacePath: workspace,
      },
    });
  const firstDelta = buildDelta(
    'run-bounded-second',
    'run-bounded-first',
    'Tighten tile spacing only.',
  );
  const secondDelta = buildDelta(
    'run-bounded-third',
    'run-bounded-second',
    'Mute sidebar icons only.',
  );

  expect(firstDelta.prompt).toContain('### Bounded Screen-Edit Execution');
  expect(firstDelta.prompt).toContain('inspect once → patch once → verify once');
  expect(firstDelta.prompt).toContain('requested-component-tile: Tile');
  expect(firstDelta.prompt).not.toContain('previousRunManifest');
  expect(firstDelta.prompt).not.toContain('HEAVY_PROJECT_INDEX_MARKER');
  expect(firstDelta.prompt).not.toContain('HYDRATION_MARKER');
  expect(firstDelta.estimatedBytes).toBeLessThan(12_000);

  let commonPrefixChars = 0;
  while (
    commonPrefixChars < firstDelta.prompt.length &&
    firstDelta.prompt[commonPrefixChars] === secondDelta.prompt[commonPrefixChars]
  ) {
    commonPrefixChars += 1;
  }
  expect(Buffer.byteLength(firstDelta.prompt.slice(0, commonPrefixChars), 'utf8')).toBeGreaterThan(
    4_000,
  );
});

test('external craft repair forbids repeated skill discovery and broad verification', () => {
  const prompt = buildExternalRuntimeCraftRepairPrompt({
    runtimeLabel: 'Codex CLI',
    summary: 'One blocking finding.',
    findings: [{ ruleId: 'craft.fake-metric', message: 'CSS radius was misclassified.' }],
    messages: [{ role: 'user', content: 'Round the tile corners.' }],
    state: {
      projectName: 'Repair project',
      workspacePath: '/tmp/repair-project',
      activeScreen: {
        id: 'repair-screen',
        name: 'Repair screen',
        kind: 'story',
        filePath: 'src/stories/screens/Repair.stories.tsx',
        implementationFilePath: 'src/screens/Repair.tsx',
      },
    },
    agentRunId: 'run-repair-bounded',
  });

  expect(prompt).toContain('Do not read or reopen SKILL.md');
  expect(prompt).toContain('Stay within four CLI/tool calls');
  expect(prompt).toContain('Do not run package-wide typecheck');
});

test('external runtime prompt resolves previous stable context from compact task context', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0060-stable-context-'));
  const runRoot = join(workspace, '.sber-designer', 'runs', 'run-previous', 'external-runtime');
  await mkdir(runRoot, { recursive: true });
  await writeFile(
    join(runRoot, 'context-budget.json'),
    JSON.stringify(
      {
        stableContextDigest:
          'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        stableContextBytes: 123,
        stableContextReuse: 'full',
      },
      null,
      2,
    ),
    'utf8',
  );

  const previous = await resolvePreviousStableContextForHandoff({
    workspacePath: workspace,
    messages: [
      {
        role: 'system',
        content: [
          'Compact assistant task context',
          '',
          'Last run:',
          '- runManifest: .sber-designer/runs/run-previous/run-manifest.json',
        ].join('\n'),
      },
      { role: 'user', content: 'Continue the same screen.' },
    ],
  });

  expect(previous).toEqual({
    digest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    runManifestPath: '.sber-designer/runs/run-previous/run-manifest.json',
    contextBundlePath: '.sber-designer/runs/run-previous/external-runtime/prompt.md',
    source: 'message_scan',
  });
});

test('external runtime prompt resolves previous stable context from session metadata before message scan', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0060-stable-context-metadata-'));
  const runRoot = join(
    workspace,
    '.sber-designer',
    'runs',
    'run-from-metadata',
    'external-runtime',
  );
  await mkdir(runRoot, { recursive: true });
  await writeFile(
    join(runRoot, 'context-budget.json'),
    JSON.stringify(
      {
        stableContextDigest:
          'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        stableContextBytes: 456,
        stableContextReuse: 'full',
      },
      null,
      2,
    ),
    'utf8',
  );

  const previous = await resolvePreviousStableContextForHandoff({
    workspacePath: workspace,
    sessionMetadata: {
      lastRunManifestPath: '.sber-designer/runs/run-from-metadata/run-manifest.json',
    },
    messages: [
      {
        role: 'system',
        content: 'Compact assistant task context without a runManifest line.',
      },
      { role: 'user', content: 'Continue the same screen.' },
    ],
  });

  expect(previous).toEqual({
    digest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    runManifestPath: '.sber-designer/runs/run-from-metadata/run-manifest.json',
    contextBundlePath: '.sber-designer/runs/run-from-metadata/external-runtime/prompt.md',
    source: 'metadata',
  });
});

test('external runtime prompt does not scan messages when session metadata is present but empty', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0060-stable-context-no-scan-'));
  const runRoot = join(workspace, '.sber-designer', 'runs', 'run-message-only', 'external-runtime');
  await mkdir(runRoot, { recursive: true });
  await writeFile(
    join(runRoot, 'context-budget.json'),
    JSON.stringify(
      {
        stableContextDigest:
          'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        stableContextBytes: 789,
        stableContextReuse: 'full',
      },
      null,
      2,
    ),
    'utf8',
  );

  const previous = await resolvePreviousStableContextForHandoff({
    workspacePath: workspace,
    sessionMetadata: null,
    messages: [
      {
        role: 'system',
        content: [
          'Compact assistant task context',
          '',
          'Last run:',
          '- runManifest: .sber-designer/runs/run-message-only/run-manifest.json',
        ].join('\n'),
      },
    ],
  });

  expect(previous).toBeNull();
});

test('render repair prompt preserves generated source and targets exact runtime errors', () => {
  const prompt = buildExternalRuntimeRenderRepairPrompt({
    runtimeLabel: 'Codex CLI',
    reason: 'Cannot find module ./MissingWidget',
    changedFiles: ['src/screens/Payment.tsx'],
    attempt: 1,
    maxAttempts: 2,
    messages: [{ role: 'user', content: 'Fix the payment screen.' }],
    state: {
      projectName: 'IBP UI Kit',
      workspacePath: '/workspace',
      activeScreen: {
        id: 'screen-payment',
        name: 'Payment screen',
        kind: 'story',
        filePath: 'src/stories/screens/Payment.stories.tsx',
        implementationFilePath: 'src/screens/Payment.tsx',
      },
    },
  });

  expect(prompt).toContain('render verification failed');
  expect(prompt).toContain('Cannot find module ./MissingWidget');
  expect(prompt).toContain('Preserve the generated source');
  expect(prompt).toContain('src/screens/Payment.tsx');
  expect(prompt).toContain('Do not rewrite unrelated files');
  expect(prompt).toContain('Do not launch Storybook, Playwright, Chrome, browser automation');
  expect(prompt).toContain('sber-designer will rerun render verification after this repair pass');
  expect(prompt).toContain('Fix the payment screen.');
});

test('render repair prompt hardens misleading import errors and stale patch retries', () => {
  const prompt = buildExternalRuntimeRenderRepairPrompt({
    runtimeLabel: 'Codex CLI',
    reason: 'ReferenceError: DataTable is not defined',
    changedFiles: ['src/screens/Funds.tsx'],
    attempt: 2,
    maxAttempts: 2,
    messages: [{ role: 'user', content: 'Fix the funds register screen.' }],
    state: {
      projectName: 'IBP UI Kit',
      workspacePath: '/workspace',
      activeScreen: {
        id: 'screen-funds',
        name: 'Funds register',
        kind: 'story',
        filePath: 'src/stories/screens/Funds.stories.tsx',
        implementationFilePath: 'src/screens/Funds.tsx',
      },
    },
  });

  expect(prompt).toContain('validate the whole import block');
  expect(prompt).toContain('not only the named symbol');
  expect(prompt).toContain('clean render/typecheck verification');
  expect(prompt).toContain('stale preview errors can name the wrong symbol');
  expect(prompt).toContain('reread the target file before retrying');
  expect(prompt).toContain('Do not repeat the same failed patch');
  expect(prompt).toContain('prefer a full-file write');
});

test('no-target retry prompt keeps render orchestration in the harness', () => {
  const prompt = buildExternalRuntimeNoTargetChangeRetryPrompt({
    runtimeLabel: 'Codex CLI',
    reason: 'no_visible_write: active implementation stayed blank',
    messages: [{ role: 'user', content: 'Create the screen from the image.' }],
    state: {
      projectName: 'IBP UI Kit',
      workspacePath: '/workspace',
      activeScreen: {
        id: 'screen-risk',
        name: 'Risk screen',
        kind: 'story',
        filePath: 'src/stories/screens/Risk.stories.tsx',
        implementationFilePath: 'src/screens/Risk.tsx',
      },
    },
  });

  expect(prompt).toContain('Write the active implementation file now');
  expect(prompt).toContain('Do not launch Storybook, Playwright, Chrome, browser automation');
  expect(prompt).toContain('sber-designer runs render verification after your file changes');
  expect(prompt).toContain('sber-designer snapshots allowed target files before the run');
  expect(prompt).toContain('external_runtime_target_diff receipt');
  expect(prompt).toContain('Do not run git add -N');
  expect(prompt).not.toContain('git diff -- <allowed target files>');
});

test('handoff carries the modal layout contract for an active modal screen (0132)', async () => {
  const workspace = await createWorkspaceKit();
  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });

  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: 'selected-model',
    messages: [{ role: 'user', content: 'Make the confirm dialog destructive.' }],
    state: {
      projectName: 'IBP UI Kit',
      workspacePath: workspace,
      activeScreen: {
        id: 'screen-confirm',
        name: 'Delete confirm',
        kind: 'page',
        surface: 'modal',
        filePath: 'pages/delete-confirm.html',
        implementationFilePath: 'pages/delete-confirm.html',
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-0132-modal',
  });

  expect(result.prompt).toContain('## Modal layout contract');
  expect(result.prompt).toContain('data-sd-modal-window');
  expect(result.prompt).toContain('surface: modal (overlay dialog)');
});
