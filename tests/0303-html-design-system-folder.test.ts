import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { getHtmlProjectStructureReport } from '@sber-designer/design-indexer';
import { buildScreenIndex } from '../packages/design-indexer/src/screen-scanner';
import {
  extractHtmlDataIconNames,
  scanProjectIconContracts,
} from '../packages/design-indexer/src/icon-contract-scanner';
import { resolveHtmlDesignSystemPaths } from '@sber-designer/shared-types';
import { resolveAgentToolPermission } from '../services/api/src/agent-kit/permissions';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { readAgentRunReceipts } from '../services/api/src/agent/run-record/receipts';
import { ALL_TOOLS as BUILT_IN_TOOLS } from '../services/api/src/agent/toolset';
import { ALL_TOOLS as PROJ_MCP_TOOLS } from '../packages/proj-mcp/src/tools/index';
import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import { buildAgentKitHandoff } from '../services/api/src/agent-runtimes/agent-kit-handoff';
import { chatRunTargetPaths } from '../services/api/src/routes/chat-stream/run-context';
import { applyHtmlProjectRestructure } from '../services/api/src/project-restructure';
import { regenerateHtmlDesignSystemPreview } from '../services/api/src/html-design-system-preview';
import type { EditorState } from '../services/api/src/state-store';

test('0303 resolver owns the canonical HTML design-system layout', () => {
  expect(resolveHtmlDesignSystemPaths()).toEqual({
    folder: 'design-system',
    designMd: 'design-system/Design.md',
    tokensCss: 'design-system/tokens.css',
    componentsCss: 'design-system/components.css',
    previewHtml: 'design-system/index.html',
    refsDir: 'design-system/refs',
    assetsDir: 'design-system/assets',
  });
  expect(resolveHtmlDesignSystemPaths('./packages/design-system/').previewHtml).toBe(
    'packages/design-system/index.html',
  );
  expect(() => resolveHtmlDesignSystemPaths('../outside')).toThrow(/Invalid/);
});

test('design-system catalog references never become product screens', () => {
  const screens = buildScreenIndex({
    routes: [],
    catalog: null,
    htmlPages: [
      'pages/customer-list.html',
      'design-system/index.html',
      'design-system/pages/atoms/Button.html',
      'design-system/refs/imported-index.html',
    ],
  });

  expect(screens).toEqual([
    expect.objectContaining({
      implementationPath: 'pages/customer-list.html',
      source: 'file-system',
    }),
  ]);
});

test('managed root index and registered HTML pages are not duplicated in screen index', () => {
  const screens = buildScreenIndex({
    routes: [],
    catalog: null,
    projectScreens: [
      {
        id: 'page-customer-list',
        name: 'Customer list',
        kind: 'page',
        filePath: 'pages/customer-list.html',
        implementationFilePath: 'pages/customer-list.html',
      },
    ],
    htmlPages: ['index.html', 'pages/customer-list.html'],
  });

  expect(screens).toEqual([
    expect.objectContaining({
      id: 'page-customer-list',
      implementationPath: 'pages/customer-list.html',
      source: 'project-file',
    }),
  ]);
});

test('HTML data-icon specs become project icon contracts without reading the runtime bundle', async () => {
  const workspace = await createHtmlWorkspace('html-icon-contract');
  await mkdir(join(workspace, 'design-system', 'specs'), { recursive: true });
  await writeFile(
    join(workspace, 'design-system', 'specs', 'Icons.md'),
    '# Icons\n\nUse `<i data-icon="name"></i>`.\n\n## Glyphs\nsearch · check-circle · Info-filled\n',
    'utf8',
  );

  expect(extractHtmlDataIconNames('data-icon\nsearch · check-circle')).toEqual([
    'check-circle',
    'search',
  ]);
  expect(extractHtmlDataIconNames('window.DS_ICONS\nsearch · check-circle')).toEqual([
    'check-circle',
    'search',
  ]);
  expect(await scanProjectIconContracts(workspace)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'search',
        source: 'project-icon-prop',
        componentName: 'i',
        propName: 'data-icon',
        filePath: 'design-system/specs/Icons.md',
      }),
      expect.objectContaining({ name: 'check-circle' }),
    ]),
  );
});

test('structure report proposes a reviewable legacy-root restructure and link rewrite', async () => {
  const workspace = await createHtmlWorkspace('legacy-root');
  await writeFile(join(workspace, 'Design.md'), '# Legacy design\n', 'utf8');
  await writeFile(join(workspace, 'tokens.css'), ':root { --brand: #14532d; }\n', 'utf8');
  await writeFile(join(workspace, 'components.css'), '.button { color: var(--brand); }\n', 'utf8');
  await writeFile(
    join(workspace, 'home.html'),
    '<!doctype html><link rel="stylesheet" href="./tokens.css"><main>Home</main>',
    'utf8',
  );

  const report = await getHtmlProjectStructureReport(workspace);

  expect(report).toMatchObject({
    status: 'non-canonical',
    supported: true,
    alreadyCanonical: false,
    truncated: false,
  });
  expect(report.proposedMappings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        sourcePath: 'Design.md',
        targetPath: 'design-system/Design.md',
        action: 'move',
      }),
      expect.objectContaining({
        sourcePath: 'home.html',
        targetPath: 'pages/home.html',
        action: 'move',
      }),
      expect.objectContaining({
        targetPath: 'design-system/index.html',
        action: 'rebuild',
      }),
    ]),
  );
  expect(report.links).toContainEqual(
    expect.objectContaining({
      sourcePath: 'home.html',
      reference: './tokens.css',
      status: 'ok',
      proposedReference: '../design-system/tokens.css',
    }),
  );
  expect(report.brokenLinks).toEqual([]);
});

test('structure report is a no-op for a canonical HTML workspace', async () => {
  const workspace = await createHtmlWorkspace('canonical');
  await writeCanonicalPackage(workspace);
  await mkdir(join(workspace, 'pages'), { recursive: true });
  await writeFile(join(workspace, 'pages', 'home.html'), '<main>Home</main>', 'utf8');

  const report = await getHtmlProjectStructureReport(workspace);

  expect(report).toMatchObject({
    status: 'canonical',
    supported: true,
    alreadyCanonical: true,
    violations: [],
    brokenLinks: [],
  });
  expect(report.proposedMappings.every((mapping) => mapping.action === 'keep')).toBe(true);
});

test('structure report leaves user reference files named tokens.css inside refs', async () => {
  const workspace = await createHtmlWorkspace('reference-token-name');
  await writeCanonicalPackage(workspace);
  await writeFile(
    join(workspace, 'design-system', 'refs', 'tokens.css'),
    ':root { --reference-only: 1; }',
    'utf8',
  );

  const report = await getHtmlProjectStructureReport(workspace);

  expect(report.status).toBe('canonical');
  expect(
    report.proposedMappings.some(
      (mapping) => mapping.sourcePath === 'design-system/refs/tokens.css',
    ),
  ).toBe(false);
});

test('structure report recognizes a design-system-only HTML bundle as non-canonical evidence', async () => {
  const workspace = await createHtmlWorkspace('design-system-only');
  await mkdir(join(workspace, 'design-system', 'styles'), { recursive: true });
  await mkdir(join(workspace, 'design-system', 'pages', 'atoms'), { recursive: true });
  await writeFile(
    join(workspace, 'design-system', 'index.html'),
    '<!doctype html><title>Imported catalog</title><a href="./pages/atoms/Button.html">Button</a>',
    'utf8',
  );
  await writeFile(
    join(workspace, 'design-system', 'pages', 'atoms', 'Button.html'),
    '<!doctype html><link rel="stylesheet" href="../../styles/button.css"><button class="button">Save</button>',
    'utf8',
  );
  await writeFile(
    join(workspace, 'design-system', 'styles', 'button.css'),
    '.button { border-radius: 8px; }\n',
    'utf8',
  );

  const report = await getHtmlProjectStructureReport(workspace);

  expect(report).toMatchObject({
    status: 'non-canonical',
    supported: true,
    pageCandidates: [],
  });
  expect(report.designSystemCandidates).toEqual(
    expect.arrayContaining(['design-system/index.html', 'design-system/pages/atoms/Button.html']),
  );
  expect(report.proposedMappings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        sourcePath: 'design-system/index.html',
        targetPath: 'design-system/refs/imported-index.html',
        action: 'move',
      }),
      expect.objectContaining({
        sourcePath: null,
        targetPath: 'design-system/Design.md',
        action: 'create',
      }),
    ]),
  );
});

test('managed preview resolves a thin canonical facade over an imported CSS bundle', async () => {
  const workspace = await createHtmlWorkspace('imported-css-facade');
  await mkdir(join(workspace, 'design-system', 'styles'), { recursive: true });
  await writeFile(join(workspace, 'design-system', 'Design.md'), '# Imported system\n', 'utf8');
  await writeFile(
    join(workspace, 'design-system', 'tokens.css'),
    '@import url("./styles/foundations.css");\n',
    'utf8',
  );
  await writeFile(
    join(workspace, 'design-system', 'components.css'),
    '@import "./styles/button.css";\n',
    'utf8',
  );
  await writeFile(
    join(workspace, 'design-system', 'styles', 'foundations.css'),
    ':root { --color-brand: #14532d; }\n',
    'utf8',
  );
  await writeFile(
    join(workspace, 'design-system', 'styles', 'button.css'),
    '.button { color: var(--color-brand); }\n',
    'utf8',
  );

  const preview = await regenerateHtmlDesignSystemPreview(workspace, 'Imported bundle');

  expect(preview).toMatchObject({ tokenCount: 1, componentClassCount: 1 });
  expect(preview.contents).toContain('--color-brand');
  expect(preview.contents).toContain('.button');
});

test('plan digest ignores chat persistence but changes with structural project metadata', async () => {
  const workspace = await createHtmlWorkspace('digest-project-structure');
  await writeFile(join(workspace, 'home.html'), '<main>Home</main>', 'utf8');
  const projectPath = join(workspace, '.sber-designer', 'project.sdproj');
  const first = await getHtmlProjectStructureReport(workspace);
  const project = JSON.parse(await readFile(projectPath, 'utf8')) as Record<string, unknown>;
  await writeFile(
    projectPath,
    JSON.stringify({ ...project, assistant: { activeSessionId: 'chat-session' }, savedAt: 123 }),
    'utf8',
  );
  const chatOnly = await getHtmlProjectStructureReport(workspace);
  expect(chatOnly.planDigest).toBe(first.planDigest);

  await writeFile(
    projectPath,
    JSON.stringify({
      ...project,
      screens: [
        {
          id: 'page-home',
          name: 'Home',
          kind: 'page',
          filePath: 'home.html',
          implementationFilePath: 'home.html',
        },
      ],
    }),
    'utf8',
  );
  const structural = await getHtmlProjectStructureReport(workspace);
  expect(structural.planDigest).not.toBe(first.planDigest);
});

test('structure report refuses framework repos and reports broken local references', async () => {
  const unsupported = await mkdtemp(join(tmpdir(), 'sd-0303-react-'));
  await writeFile(
    join(unsupported, 'package.json'),
    JSON.stringify({ dependencies: { react: '^19.0.0', vite: '^7.0.0' } }),
    'utf8',
  );
  await writeFile(join(unsupported, 'index.html'), '<main>App</main>', 'utf8');
  await writeFile(join(unsupported, 'styles.css'), 'body {}', 'utf8');
  expect(await getHtmlProjectStructureReport(unsupported)).toMatchObject({
    status: 'unsupported',
    supported: false,
  });

  const mislabeled = await createHtmlWorkspace('mislabeled-bundler');
  await writeFile(
    join(mislabeled, 'package.json'),
    JSON.stringify({ scripts: { dev: 'vite' }, devDependencies: { vite: '^7.0.0' } }),
    'utf8',
  );
  await writeFile(join(mislabeled, 'index.html'), '<main>Bundled app</main>', 'utf8');
  expect(await getHtmlProjectStructureReport(mislabeled)).toMatchObject({
    status: 'unsupported',
    supported: false,
  });

  const broken = await createHtmlWorkspace('broken');
  await writeFile(
    join(broken, 'page.html'),
    '<link rel="stylesheet" href="./missing.css"><img src="https://example.test/a.png">',
    'utf8',
  );
  const report = await getHtmlProjectStructureReport(broken);
  expect(report.brokenLinks).toContainEqual(
    expect.objectContaining({ reference: './missing.css', status: 'broken' }),
  );
  expect(report.links).toContainEqual(
    expect.objectContaining({ reference: 'https://example.test/a.png', status: 'external' }),
  );
});

test('structure report is registered as a read tool for built-in and proj-mcp runtimes', () => {
  expect(BUILT_IN_TOOLS.some((tool) => tool.name === 'get_project_structure_report')).toBe(true);
  expect(PROJ_MCP_TOOLS.some((tool) => tool.name === 'get_project_structure_report')).toBe(true);
  expect(
    resolveAgentToolPermission({
      toolName: 'get_project_structure_report',
      input: {},
      permission: { '*': 'deny', read: 'allow' },
    }),
  ).toMatchObject({ action: 'allow', category: 'read' });
  expect(BUILT_IN_TOOLS.some((tool) => tool.name === 'apply_project_restructure')).toBe(true);
  expect(
    resolveAgentToolPermission({
      toolName: 'apply_project_restructure',
      input: { planDigest: 'a'.repeat(64), confirmedByUser: true },
      permission: { '*': 'deny', edit: 'ask' },
    }),
  ).toMatchObject({ action: 'ask', category: 'edit' });
});

test('confirmed restructure applies one immutable plan, registers pages, and records a receipt', async () => {
  const workspace = await createHtmlWorkspace('apply');
  await writeFile(join(workspace, 'Design.md'), '# Legacy design\n', 'utf8');
  await writeFile(join(workspace, 'tokens.css'), ':root { --brand: #14532d; }\n', 'utf8');
  await writeFile(join(workspace, 'components.css'), '.button { color: var(--brand); }\n', 'utf8');
  await writeFile(
    join(workspace, 'home.html'),
    '<!doctype html><title>Home screen</title><link rel="stylesheet" href="./tokens.css"><main>Home</main>',
    'utf8',
  );
  const report = await getHtmlProjectStructureReport(workspace);
  const run = await createAgentRun({
    route: 'chat',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'apply',
    workspacePath: workspace,
    activeScreen: null,
    assistantTaskIntent: null,
  });

  const receipt = await applyHtmlProjectRestructure({
    workspacePath: workspace,
    planDigest: report.planDigest,
    confirmedByUser: true,
    runId: run.runId,
  });

  expect(receipt).toMatchObject({
    previousStatus: 'non-canonical',
    finalStatus: 'canonical',
    completed: true,
    previewFile: 'design-system/index.html',
  });
  expect(receipt.movedFiles).toEqual(
    expect.arrayContaining([
      { fromPath: 'Design.md', toPath: 'design-system/Design.md' },
      { fromPath: 'home.html', toPath: 'pages/home.html' },
    ]),
  );
  expect(await readFile(join(workspace, 'pages', 'home.html'), 'utf8')).toContain(
    'href="../design-system/tokens.css"',
  );
  expect(await readFile(join(workspace, 'index.html'), 'utf8')).toContain(
    'data-sd-managed-screen-index',
  );
  const project = JSON.parse(
    await readFile(join(workspace, '.sber-designer', 'project.sdproj'), 'utf8'),
  ) as { screens: Array<{ name: string; implementationFilePath?: string }> };
  expect(project.screens).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'Home screen', implementationFilePath: 'pages/home.html' }),
    ]),
  );
  expect(await readAgentRunReceipts(workspace, run.runId)).toContainEqual(
    expect.objectContaining({
      tool: 'apply_project_restructure',
      status: 'ok',
      metadata: expect.objectContaining({ planDigest: report.planDigest }),
    }),
  );
});

test('restructure refuses stale plans and target collisions without touching source files', async () => {
  const staleWorkspace = await createHtmlWorkspace('stale');
  await writeFile(join(staleWorkspace, 'home.html'), '<main>Home</main>', 'utf8');
  const staleReport = await getHtmlProjectStructureReport(staleWorkspace);
  await writeFile(join(staleWorkspace, 'new-page.html'), '<main>New</main>', 'utf8');
  await expect(
    applyHtmlProjectRestructure({
      workspacePath: staleWorkspace,
      planDigest: staleReport.planDigest,
      confirmedByUser: true,
    }),
  ).rejects.toThrow(/changed after the plan/u);
  expect(await readFile(join(staleWorkspace, 'home.html'), 'utf8')).toContain('Home');

  const collisionWorkspace = await createHtmlWorkspace('collision');
  await mkdir(join(collisionWorkspace, 'pages'), { recursive: true });
  await writeFile(join(collisionWorkspace, 'home.html'), '<main>Root</main>', 'utf8');
  await writeFile(join(collisionWorkspace, 'pages', 'home.html'), '<main>Canonical</main>', 'utf8');
  const collisionReport = await getHtmlProjectStructureReport(collisionWorkspace);
  expect(collisionReport.conflicts).toContainEqual(
    expect.objectContaining({ targetPath: 'pages/home.html' }),
  );
  await expect(
    applyHtmlProjectRestructure({
      workspacePath: collisionWorkspace,
      planDigest: collisionReport.planDigest,
      confirmedByUser: true,
    }),
  ).rejects.toThrow(/conflicts/u);
  expect(await readFile(join(collisionWorkspace, 'home.html'), 'utf8')).toContain('Root');
});

test('restructure receipt keeps a broken local reference as a blocking post-check', async () => {
  const workspace = await createHtmlWorkspace('broken-post-check');
  await writeFile(
    join(workspace, 'home.html'),
    '<!doctype html><link rel="stylesheet" href="./missing.css"><main>Home</main>',
    'utf8',
  );
  const report = await getHtmlProjectStructureReport(workspace);

  const receipt = await applyHtmlProjectRestructure({
    workspacePath: workspace,
    planDigest: report.planDigest,
    confirmedByUser: true,
  });

  expect(receipt).toMatchObject({ finalStatus: 'canonical', completed: false });
  expect(receipt.postCheck.brokenLinks).toContainEqual(
    expect.objectContaining({
      sourcePath: 'pages/home.html',
      reference: './missing.css',
      status: 'broken',
    }),
  );
  expect(receipt.postCheck.manualFollowUps).toContain(
    'Resolve every broken local reference before completing the restructure run.',
  );
});

test('Design system runs receive package-only targets and a matching external handoff', async () => {
  const targets = chatRunTargetPaths({ canvasView: 'design-system' } as EditorState);
  expect(targets).toEqual([
    'design-system/Design.md',
    'design-system/tokens.css',
    'design-system/components.css',
    'design-system/refs/**',
    'design-system/assets/**',
    '.sber-designer/components/**',
  ]);
  expect(targets.some((path) => path.startsWith('pages/'))).toBe(false);

  resetAgentKitCache();
  const kit = await loadAgentKit();
  const handoff = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [{ role: 'user', content: 'Add a reusable card component.' }],
    state: {
      projectName: 'HTML project',
      workspacePath: process.cwd(),
      canvasView: 'design-system',
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-0303-design-system',
    allowedTargets: targets,
  });

  expect(handoff.prompt).toContain('HTML Design System Package Contract');
  expect(handoff.prompt).toContain('design-system/components.css');
  expect(handoff.prompt).toContain(
    'Product pages under `pages/**` and root `index.html` are read-only',
  );
  expect(handoff.prompt).toContain('This is an HTML design-system component task');
});

async function createHtmlWorkspace(label: string): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), `sd-0303-${label}-`));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  await writeFile(
    join(workspace, '.sber-designer', 'project.sdproj'),
    JSON.stringify({
      version: 1,
      name: label,
      workspacePath: workspace,
      projectKind: 'html-first',
      screens: [],
      flow: [],
    }),
    'utf8',
  );
  return workspace;
}

async function writeCanonicalPackage(workspace: string): Promise<void> {
  await mkdir(join(workspace, 'design-system', 'refs'), { recursive: true });
  await writeFile(join(workspace, 'design-system', 'Design.md'), '# Design system\n', 'utf8');
  await writeFile(
    join(workspace, 'design-system', 'tokens.css'),
    ':root { --brand: #14532d; }\n',
    'utf8',
  );
  await writeFile(
    join(workspace, 'design-system', 'components.css'),
    '.button { color: var(--brand); }\n',
    'utf8',
  );
  await writeFile(
    join(workspace, 'design-system', 'index.html'),
    '<!doctype html><body data-sd-managed-design-system-preview><main>Catalog</main></body>',
    'utf8',
  );
  await writeFile(
    join(workspace, 'index.html'),
    '<!doctype html><body data-sd-managed-screen-index><main>Screens</main></body>',
    'utf8',
  );
}
