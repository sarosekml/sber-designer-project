import { expect, test } from 'bun:test';

import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import {
  buildAgentKitHandoff,
  type ExternalRuntimeKind,
} from '../services/api/src/agent-runtimes/agent-kit-handoff';

const variants: Array<[ExternalRuntimeKind, string]> = [
  ['codex', 'Codex CLI'],
  ['claude-code', 'Claude Code CLI'],
  ['opencode', 'OpenCode'],
  ['kimi', 'Kimi Code CLI'],
  ['gigacode', 'GigaCode CLI'],
];

for (const [runtime, runtimeLabel] of variants) {
  test(`${runtime} gets the same ai-product-designer delegation contract`, async () => {
    resetAgentKitCache();
    const kit = await loadAgentKit();
    const result = buildAgentKitHandoff({
      runtime,
      runtimeLabel,
      model: null,
      messages: [{ role: 'user', content: 'Create a payment schedule screen from this BRD.' }],
      state: {
        projectName: 'sber-designer',
        workspacePath: process.cwd(),
        activeScreen: {
          id: 'screen-test',
          name: 'Test screen',
          kind: 'story',
          filePath: 'src/stories/screens/Test.stories.tsx',
          implementationFilePath: 'src/screens/Test.tsx',
        },
      },
      kit,
      primaryAgentName: 'ai-product-designer',
      agentRunId: 'run-golden',
    });

    expect(result.prompt).toContain(`through ${runtimeLabel}`);
    expect(result.prompt).toContain('ai-product-designer');
    expect(result.prompt).toContain('product-screen-generation');
    expect(result.prompt).toContain('## Priority Contract');
    expect(result.prompt).toContain('## Runtime Contract');
    expect(result.prompt).toContain('## Output Contract');
    expect(result.prompt).toContain('language of the user brief or specification');
    expect(result.prompt).toContain(
      'names, amounts, dates, identifiers, and status labels verbatim',
    );
    expect(result.prompt).not.toContain('Keep product UI text in English.');
    expect(result.prompt).toContain('skills/product-screen-generation/SKILL.md');
    expect(result.prompt).not.toContain('Call `read_agent_knowledge` for these ids');
  });
}

test('Storybook-mode handoff gets a description-aware Output Contract, not screen-gen (0083 E2)', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [{ role: 'user', content: 'Describe my components for AI.' }],
    state: {
      projectName: 'sber-designer',
      workspacePath: process.cwd(),
      canvasView: 'storybook',
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    requestedAgentName: 'ai-description-layer',
    agentRunId: 'run-storybook-mode',
  });

  expect(result.prompt).toContain('## Output Contract');
  // Screen-generation pressure must be gone in Storybook mode.
  expect(result.prompt).not.toContain('- Implement the requested screen/change in project files.');
  expect(result.prompt).not.toContain('Do not report success without allowed target-file changes');
  // The mode-aware contract permits a question-only turn and points at the sidecar.
  expect(result.prompt).toContain('.sber-designer/components/<id>.md');
  expect(result.prompt).toContain('Do not treat an unchanged screen or an empty target-file diff');

  // 0083 H3: the screen-gen primary body is trimmed (it's dead weight here); the
  // requested subagent body stays inlined.
  expect(result.prompt).toContain('persona body is omitted for this Storybook/component run');
  expect(result.prompt).toContain('Canonical Sidecar'); // ai-description-layer body is present
});

test('html-first description handoff gets a description-aware Output Contract by role (0112)', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [{ role: 'user', content: 'Describe my reusable CSS components for AI.' }],
    state: {
      projectName: 'sber-designer',
      workspacePath: process.cwd(),
      canvasView: 'screen',
      activeScreen: {
        id: 'screen-index',
        name: 'Index',
        kind: 'page',
        filePath: 'index.html',
        implementationFilePath: 'index.html',
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    requestedAgentName: 'ai-description-layer',
    agentRunId: 'run-html-description',
  });

  expect(result.prompt).toContain('## Output Contract');
  expect(result.prompt).not.toContain('- Implement the requested static page/change');
  expect(result.prompt).not.toContain('Do not report success without allowed target-file changes');
  expect(result.prompt).toContain('.sber-designer/components/<id>.md');
  expect(result.prompt).toContain('Never edit page/source files in this role');
  expect(result.prompt).toContain('component-description-interview');
  expect(result.prompt).toContain('Prefer MCP tool calls');
  expect(result.prompt).toContain('File conventions are fallback-only');
  expect(result.prompt).toContain('requiredClasses');
});

test('screen-gen handoff keeps the full primary body without a component subagent', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [{ role: 'user', content: 'Create a screen.' }],
    state: { projectName: 'sber-designer', workspacePath: process.cwd() },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-screen-mode',
  });
  // No focused component/description subagent → the primary body is NOT trimmed.
  expect(result.prompt).not.toContain('persona body is omitted');
});

test('project index context is rendered as compact summary and artifact paths', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const result = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [{ role: 'user', content: 'Generate a dashboard screen.' }],
    state: {
      projectName: 'Indexed project',
      workspacePath: process.cwd(),
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-index',
    projectIndex: {
      status: 'valid',
      stale: false,
      promptSummary: 'Use indexed forms and tables before custom markup.',
      freshness: 'ready',
      nextAction: 'ready',
      counts: {
        components: 12,
        tokens: 18,
        icons: 8,
        assets: 2,
        screens: 3,
        routes: 4,
      },
      artifacts: ['.sber-designer/design-index/components.json'],
      warnings: ['warning: sample diagnostic'],
    },
  });

  expect(result.prompt).toContain('projectIndexStatus: valid');
  expect(result.prompt).toContain('Use indexed forms and tables');
  expect(result.prompt).toContain('components: 12');
  expect(result.prompt).toContain('.sber-designer/design-index/components.json');
});

test('external runtime handoff renders image references and runtime warnings', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const result = buildAgentKitHandoff({
    runtime: 'opencode',
    runtimeLabel: 'OpenCode',
    model: 'default',
    messages: [{ role: 'user', content: 'Recreate the attached administration screen.' }],
    state: {
      projectName: 'sber-designer',
      workspacePath: process.cwd(),
      activeScreen: {
        id: 'screen-admin',
        name: 'Administration',
        kind: 'story',
        filePath: 'src/stories/screens/Administration.stories.tsx',
        implementationFilePath: 'src/screens/Administration.tsx',
      },
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-image-golden',
    promptAttachments: [
      {
        id: 'att-png',
        name: 'reference.png',
        mimeType: 'image/png',
        size: 70,
        sha256: 'a'.repeat(64),
        width: 1280,
        height: 720,
        runPath: '.sber-designer/runs/run-image-golden/attachments/01-reference.png',
      },
    ],
    runtimeWarnings: [
      'cli_image_input_unverified: OpenCode receives image attachments as saved workspace files.',
    ],
  });

  expect(result.prompt).toContain('## Runtime Warnings');
  expect(result.runtimeWarnings).toEqual([
    'cli_image_input_unverified: OpenCode receives image attachments as saved workspace files.',
  ]);
  expect(result.prompt).toContain('cli_image_input_unverified');
  expect(result.prompt).toContain('## Attached Image References');
  expect(result.prompt).toContain(
    '.sber-designer/runs/run-image-golden/attachments/01-reference.png',
  );
  expect(result.prompt).toContain('dimensions: 1280x720');
});
