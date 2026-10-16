import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { applyOps } from '../packages/ast-bridge/src/apply';
import { loadAgentToolsForContext } from '../services/api/src/agent/toolset';
import { AGENT_KIT_TOOLS } from '../services/api/src/agent-kit/tools';
import { resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import {
  loadProjectForWorkspace,
  resetProject,
  saveProject,
} from '../services/api/src/project-store';
import type { ToolContext } from '../services/api/src/agent/types';

test('agent kit tools list and load workspace skills and knowledge', async () => {
  const workspace = await createWorkspaceKit();
  const ctx = toolContext(workspace);
  const listSkills = findTool('list_agent_skills');
  const loadSkill = findTool('load_agent_skill');
  const listKnowledge = findTool('list_agent_knowledge');
  const readKnowledge = findTool('read_agent_knowledge');

  resetAgentKitCache();
  const skillList = (await listSkills.handler({}, ctx)) as {
    skills: { name: string; description: string }[];
  };
  const skill = (await loadSkill.handler({ name: 'project-specific-skill' }, ctx)) as {
    name: string;
    contents: string;
  };
  const knowledgeList = (await listKnowledge.handler({}, ctx)) as {
    knowledge: { id: string }[];
  };
  const knowledge = (await readKnowledge.handler({ id: 'project-notes' }, ctx)) as {
    id: string;
    contents: string;
  };

  expect(skillList.skills).toContainEqual(
    expect.objectContaining({
      name: 'project-specific-skill',
      description: 'Use local workflow.',
    }),
  );
  expect(skill.contents).toContain('FULL SKILL BODY');
  expect(knowledgeList.knowledge).toContainEqual(expect.objectContaining({ id: 'project-notes' }));
  expect(knowledge.contents).toContain('Project specific notes.');
});

test('run_agent_script returns permission_required for ask manifests', async () => {
  const workspace = await createWorkspaceKit();
  const ctx = toolContext(workspace);
  const runScript = findTool('run_agent_script');

  resetAgentKitCache();
  const result = (await runScript.handler({ name: 'project-check' }, ctx)) as {
    status: string;
    command: string;
  };

  expect(result.status).toBe('permission_required');
  expect(result.command).toBe('bun');
});

test('agent kit tools reject missing resources clearly', async () => {
  const workspace = await createWorkspaceKit();
  const ctx = toolContext(workspace);
  const loadSkill = findTool('load_agent_skill');

  resetAgentKitCache();
  await expect(loadSkill.handler({ name: 'missing-skill' }, ctx)).rejects.toThrow(
    'Unknown agent skill',
  );
});

test('load_agent_skill returns sampled multi-file package listing', async () => {
  const workspace = await createWorkspaceKit();
  const skillDir = join(workspace, '.agents', 'skills', 'project-specific-skill');
  await mkdir(join(skillDir, 'examples'), { recursive: true });
  await mkdir(join(skillDir, 'templates'), { recursive: true });
  await writeFile(join(skillDir, 'examples', 'dashboard.md'), '# Dashboard example\n', 'utf8');
  await writeFile(
    join(skillDir, 'templates', 'screen.tsx'),
    'export const Screen = null;\n',
    'utf8',
  );
  const ctx = toolContext(workspace);
  const loadSkill = findTool('load_agent_skill');

  resetAgentKitCache();
  const skill = (await loadSkill.handler({ name: 'project-specific-skill' }, ctx)) as {
    package: {
      baseDirectory: string;
      files: { path: string; sizeBytes: number }[];
      totalBytes: number;
      truncated: boolean;
    };
  };

  expect(skill.package.baseDirectory).toBe('skills/project-specific-skill');
  expect(skill.package.files.map((file) => file.path)).toEqual([
    'examples/dashboard.md',
    'templates/screen.tsx',
  ]);
  expect(skill.package.files.some((file) => file.path === 'SKILL.md')).toBe(false);
  expect(skill.package.totalBytes).toBeGreaterThan(0);
  expect(skill.package.truncated).toBe(false);
});

test('agent kit knowledge reads honor maxBytes truncation', async () => {
  const workspace = await createWorkspaceKit({
    knowledgeText: '# Notes\n\nThis project has a deliberately long local knowledge file.',
  });
  const ctx = toolContext(workspace);
  const readKnowledge = findTool('read_agent_knowledge');

  resetAgentKitCache();
  const knowledge = (await readKnowledge.handler({ id: 'project-notes', maxBytes: 12 }, ctx)) as {
    contents: string;
    truncated: boolean;
  };

  expect(knowledge.truncated).toBe(true);
  expect(knowledge.contents).toContain('[resource truncated]');
  expect(knowledge.contents).not.toContain('deliberately long');
});

test('screen_create rejects current-screen edit scope', async () => {
  const workspace = await createWorkspaceKit();
  await loadProjectForWorkspace(workspace, 'Tool Guard Project');
  const screenCreate = await findBuiltInTool('screen_create');

  await expect(
    screenCreate.handler(
      {
        name: 'Wrong New Screen',
        storyId: 'screens-2026-05-17-wrong--default',
        filePath: 'src/stories/screens/2026-05-17/Wrong.stories.tsx',
        implementationFilePath: 'src/screens/2026-05-17/Wrong.tsx',
      },
      scopedToolContext(workspace),
    ),
  ).rejects.toThrow('screen_create is not allowed while editing the current screen');

  resetProject();
});

test('screen_update renames the active screen in current-screen edit scope', async () => {
  const workspace = await createWorkspaceKit();
  await loadProjectForWorkspace(workspace, 'Tool Guard Project');
  await saveProject({
    version: 1,
    name: 'Tool Guard Project',
    workspacePath: workspace,
    screens: [
      {
        id: 'screen-base',
        name: 'New screen 02',
        kind: 'story',
        storyId: 'screens-2026-05-17-base-screen--default',
        filePath: 'src/stories/screens/2026-05-17/BaseScreen.stories.tsx',
        implementationFilePath: 'src/screens/2026-05-17/BaseScreen.tsx',
        folder: '2026-05-17',
        description: 'Empty generated screen',
      },
    ],
    flow: [],
  });
  const screenUpdate = await findBuiltInTool('screen_update');

  await expect(
    screenUpdate.handler(
      {
        screenId: 'screen-base',
        name: 'Риск-сегмент (справочник)',
        description: 'Справочник риск-сегментов контрагентов.',
      },
      scopedToolContext(workspace),
    ),
  ).resolves.toMatchObject({
    ok: true,
    screen: {
      id: 'screen-base',
      name: 'Риск-сегмент (справочник)',
      description: 'Справочник риск-сегментов контрагентов.',
    },
  });

  resetProject();
});

test('screen_update rejects non-active screens in current-screen edit scope', async () => {
  const workspace = await createWorkspaceKit();
  await loadProjectForWorkspace(workspace, 'Tool Guard Project');
  const screenUpdate = await findBuiltInTool('screen_update');

  await expect(
    screenUpdate.handler(
      {
        screenId: 'screen-other',
        name: 'Other',
      },
      scopedToolContext(workspace),
    ),
  ).rejects.toThrow('screen_update is only allowed for the active screen');

  resetProject();
});

test('write_file rejects paths outside current-screen edit scope', async () => {
  const workspace = await createWorkspaceKit();
  await mkdir(join(workspace, 'src', 'screens', '2026-05-17'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'screens', '2026-05-17', 'BaseScreen.tsx'),
    'export function BaseScreen() { return null; }\n',
    'utf8',
  );
  const writeFileTool = await findBuiltInTool('write_file');
  const ctx = scopedToolContext(workspace);

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
        path: 'src/screens/2026-05-17/BaseScreen.tsx',
        contents: 'export function BaseScreen() { return <main />; }\n',
      },
      ctx,
    ),
  ).resolves.toMatchObject({ ok: true, path: 'src/screens/2026-05-17/BaseScreen.tsx' });
  await expect(
    readFile(join(workspace, 'src', 'screens', '2026-05-17', 'BaseScreen.tsx'), 'utf8'),
  ).resolves.toContain('<main />');
});

test('write_file routes html-first Design.md aliases to the canonical package', async () => {
  const workspace = await createWorkspaceKit();
  await writeHtmlFirstProjectFile(workspace);
  await writeFile(join(workspace, 'DESIGN.md'), '# Legacy\n', 'utf8');
  const writeFileTool = await findBuiltInTool('write_file');
  const readFileTool = await findBuiltInTool('read_file');

  await expect(
    writeFileTool.handler(
      {
        path: 'DESIGN.md',
        contents: '# Canonical\n',
      },
      toolContext(workspace),
    ),
  ).resolves.toMatchObject({ ok: true, path: 'design-system/Design.md' });

  expect(await readFile(join(workspace, 'design-system/Design.md'), 'utf8')).toBe('# Canonical\n');
  const rootEntries = await readdir(workspace);
  expect(rootEntries).toContain('design-system');
  expect(rootEntries).toContain('DESIGN.md');

  await expect(
    readFileTool.handler(
      {
        path: 'DESIGN.md',
      },
      toolContext(workspace),
    ),
  ).resolves.toMatchObject({
    path: 'design-system/Design.md',
    contents: '# Canonical\n',
  });
});

test('write_file leaves DESIGN.md casing unchanged outside html-first projects', async () => {
  const workspace = await createWorkspaceKit();
  const writeFileTool = await findBuiltInTool('write_file');

  await expect(
    writeFileTool.handler(
      {
        path: 'DESIGN.md',
        contents: '# React design context\n',
      },
      toolContext(workspace),
    ),
  ).resolves.toMatchObject({ ok: true, path: 'DESIGN.md' });

  const rootEntries = await readdir(workspace);
  expect(rootEntries).toContain('DESIGN.md');
  expect(rootEntries).not.toContain('Design.md');
});

test('write_file accepts contentsLines as a model-friendly multiline payload', async () => {
  const workspace = await createWorkspaceKit();
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  const writeFileTool = await findBuiltInTool('write_file');

  await expect(
    writeFileTool.handler(
      {
        path: 'src/screens/LinesScreen.tsx',
        contentsLines: ['export function LinesScreen() {', '  return <main />;', '}'],
      },
      toolContext(workspace),
    ),
  ).resolves.toMatchObject({ ok: true, path: 'src/screens/LinesScreen.tsx' });
  await expect(
    readFile(join(workspace, 'src', 'screens', 'LinesScreen.tsx'), 'utf8'),
  ).resolves.toBe('export function LinesScreen() {\n  return <main />;\n}');
});

test('write_file coerces a multiline contentsLines string before handling', async () => {
  const workspace = await createWorkspaceKit();
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  const writeFileTool = await findBuiltInTool('write_file');
  const parsed = writeFileTool.inputSchema.safeParse({
    path: 'src/screens/StringLinesScreen.tsx',
    contentsLines: 'export function StringLinesScreen() {\n  return <main />;\n}',
  });

  if (!parsed.success) throw parsed.error;

  await expect(writeFileTool.handler(parsed.data, toolContext(workspace))).resolves.toMatchObject({
    ok: true,
    path: 'src/screens/StringLinesScreen.tsx',
  });
  await expect(
    readFile(join(workspace, 'src', 'screens', 'StringLinesScreen.tsx'), 'utf8'),
  ).resolves.toBe('export function StringLinesScreen() {\n  return <main />;\n}');
});

test('write_file preserves generated TSX for later validation instead of blocking on source health', async () => {
  const workspace = await createWorkspaceKit();
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  const writeFileTool = await findBuiltInTool('write_file');

  await expect(
    writeFileTool.handler(
      {
        path: 'src/screens/Broken.tsx',
        contents: 'export function Broken() { return <Tab />; }\n',
      },
      toolContext(workspace),
    ),
  ).resolves.toMatchObject({ ok: true, path: 'src/screens/Broken.tsx' });
  await expect(
    readFile(join(workspace, 'src', 'screens', 'Broken.tsx'), 'utf8'),
  ).resolves.toContain('<Tab />');
});

test('read_file accepts a line limit for model-compatible source peeks', async () => {
  const workspace = await createWorkspaceKit();
  await mkdir(join(workspace, 'src'), { recursive: true });
  await writeFile(join(workspace, 'src', 'Long.tsx'), 'line 1\nline 2\nline 3\n', 'utf8');
  const readFileTool = await findBuiltInTool('read_file');

  await expect(
    readFileTool.handler(
      {
        path: 'src/Long.tsx',
        limit: 2,
      },
      toolContext(workspace),
    ),
  ).resolves.toMatchObject({
    path: 'src/Long.tsx',
    contents: 'line 1\nline 2\n',
    truncated: true,
    startLine: 1,
    endLine: 2,
    totalLines: 3,
  });
});

test('read_file returns exact JSX locations for targeted AST edits', async () => {
  const workspace = await createWorkspaceKit();
  await mkdir(join(workspace, 'src'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'Screen.tsx'),
    [
      'export function Screen() {',
      '  return (',
      '    <main>',
      '      <Button dataTestId="DocumentsButton" title="Документы">Документы</Button>',
      '    </main>',
      '  );',
      '}',
    ].join('\n'),
    'utf8',
  );
  const readFileTool = await findBuiltInTool('read_file');
  const result = (await readFileTool.handler(
    { path: 'src/Screen.tsx' },
    toolContext(workspace),
  )) as {
    jsxLocations?: Array<Record<string, unknown>>;
  };

  expect(result.jsxLocations).toContainEqual({
    line: 4,
    column: 7,
    tag: 'Button',
    dataTestId: 'DocumentsButton',
    title: 'Документы',
  });
});

test('file tool descriptions guide stale patch recovery and generated screen rewrites', async () => {
  const applyPatchTool = await findBuiltInTool('apply_patch');
  const writeFileTool = await findBuiltInTool('write_file');

  expect(applyPatchTool.description).toContain('reread the target file before retrying');
  expect(applyPatchTool.description).toContain('trust the returned diff');
  expect(applyPatchTool.description).toContain('do not reread only to confirm');
  expect(applyPatchTool.description).toContain('Do not repeat the same failed patch');
  expect(applyPatchTool.description).toContain('For freshly generated screen files');
  expect(writeFileTool.description).toContain('freshly generated screen files');
  expect(writeFileTool.description).toContain('fragile text patch');
});

test('list_components accepts query and limit inputs', async () => {
  const workspace = await createWorkspaceKit();
  await mkdir(join(workspace, 'src', 'components'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'components', 'TabsGroup.tsx'),
    'export function TabsGroup() { return null; }\n',
    'utf8',
  );
  await writeFile(
    join(workspace, 'src', 'components', 'SummaryCard.tsx'),
    'export function SummaryCard() { return null; }\n',
    'utf8',
  );
  const listComponents = await findBuiltInTool('list_components');

  expect(listComponents.inputSchema.safeParse({ query: 'tabs dashboard', limit: 1 }).success).toBe(
    true,
  );
  const result = (await listComponents.handler(
    { query: 'tabs dashboard', limit: 1 },
    toolContext(workspace),
  )) as { components: { shortName: string }[] };

  expect(result.components).toHaveLength(1);
  expect(result.components[0]?.shortName).toBe('TabsGroup');
});

test('apply_patch rejects files outside current-screen edit scope before writing', async () => {
  const workspace = await createWorkspaceKit();
  await mkdir(join(workspace, 'src', 'screens', '2026-05-17'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'screens', '2026-05-17', 'Wrong.tsx'),
    'export function Wrong() { return <h1>Wrong</h1>; }\n',
    'utf8',
  );
  const applyPatchTool = await findBuiltInTool('apply_patch');

  await expect(
    applyPatchTool.handler(
      {
        ops: [
          {
            kind: 'set-children-text',
            file: 'src/screens/2026-05-17/Wrong.tsx',
            loc: { line: 1, column: 34 },
            text: 'Still wrong',
          },
        ],
      },
      scopedToolContext(workspace),
    ),
  ).rejects.toThrow('write_file target is outside the current screen scope');
});

test('ast bridge replace-text replaces one exact generated block', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-replace-text-'));
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  const filePath = join(workspace, 'src', 'screens', 'Deal.tsx');
  const oldText = '<SxBox sx={{ mb: 3 }}>\n  <Tab label={{label}} value={{i}}></Tab>\n</SxBox>';
  const newText =
    '<SxBox sx={{ mb: 3 }}>\n  <TabsGroup value={activeTab} onChange={(_, v) => setActiveTab(v as number)}>\n    {tabs.map((label, i) => <Tab key={label} label={label} value={i} />)}\n  </TabsGroup>\n</SxBox>';
  await writeFile(
    filePath,
    ['export function Deal() {', '  return (', oldText, '  );', '}'].join('\n'),
    'utf8',
  );

  await expect(
    applyOps({
      workspaceRoot: workspace,
      ops: [
        {
          kind: 'replace-text',
          file: 'src/screens/Deal.tsx',
          oldText,
          newText,
        } as never,
      ],
    }),
  ).resolves.toMatchObject({
    ok: true,
    changedFiles: ['src/screens/Deal.tsx'],
  });
  await expect(readFile(filePath, 'utf8')).resolves.toContain(newText);
});

test('set-prop normalizes accidental JSX expression containers without breaking object literals', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-set-prop-'));
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  const filePath = join(workspace, 'src', 'screens', 'Deal.tsx');
  await writeFile(
    filePath,
    [
      'export function Deal() {',
      '  return (',
      '    <SxBox>',
      '      <Tab />',
      '      <Box />',
      '      <Button />',
      '    </SxBox>',
      '  );',
      '}',
    ].join('\n'),
    'utf8',
  );

  await applyOps({
    workspaceRoot: workspace,
    ops: [
      {
        kind: 'set-prop',
        file: 'src/screens/Deal.tsx',
        loc: { line: 4, column: 7 },
        name: 'label',
        value: '{label}',
      },
      {
        kind: 'set-prop',
        file: 'src/screens/Deal.tsx',
        loc: { line: 4, column: 7 },
        name: 'value',
        value: '{i}',
      },
      {
        kind: 'set-prop',
        file: 'src/screens/Deal.tsx',
        loc: { line: 5, column: 7 },
        name: 'sx',
        value: '{ mt: 2 }',
      },
      {
        kind: 'set-prop',
        file: 'src/screens/Deal.tsx',
        loc: { line: 6, column: 7 },
        name: 'label',
        value: '"Overview"',
      },
    ],
  });

  const contents = await readFile(filePath, 'utf8');
  expect(contents).toContain('<Tab label={label} value={i} />');
  expect(contents).toContain('<Box sx={{ mt: 2 }} />');
  expect(contents).toContain('<Button label="Overview" />');
});

function findTool(name: string) {
  const tool = AGENT_KIT_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

async function findBuiltInTool(name: string) {
  const tools = await loadAgentToolsForContext(toolContext('/tmp/sd-agent-tool-builtins'));
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing built-in tool ${name}`);
  return tool;
}

function toolContext(workspacePath: string): ToolContext {
  return {
    user: 'test-user',
    projectName: 'Agent Tool Project',
    activeScreen: null,
    workspacePath,
    canvasUrl: null,
  };
}

function scopedToolContext(workspacePath: string): ToolContext {
  return {
    ...toolContext(workspacePath),
    activeScreen: {
      id: 'screen-base',
      name: 'Base Screen',
      kind: 'story',
      storyId: 'screens-2026-05-17-base-screen--default',
      filePath: 'src/stories/screens/2026-05-17/BaseScreen.stories.tsx',
      implementationFilePath: 'src/screens/2026-05-17/BaseScreen.tsx',
      folder: '2026-05-17',
    },
    assistantTaskIntent: {
      kind: 'edit-current-screen',
      targetScreenId: 'screen-base',
    },
  } as unknown as ToolContext;
}

async function createWorkspaceKit(options: { knowledgeText?: string } = {}): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-tool-'));
  const root = join(workspace, '.agents');
  await mkdir(join(root, 'agents'), { recursive: true });
  await mkdir(join(root, 'skills', 'project-specific-skill'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });
  await mkdir(join(root, 'scripts'), { recursive: true });
  await writeFile(
    join(root, 'config.json'),
    JSON.stringify(
      {
        defaultAgent: 'ai-product-designer',
        instructions: ['agents/ai-product-designer.md'],
        knowledge: [
          {
            id: 'project-notes',
            path: 'knowledge/project-notes.md',
            description: 'Project notes.',
          },
        ],
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
      '---',
      '',
      'Workspace prompt.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'skills', 'project-specific-skill', 'SKILL.md'),
    [
      '---',
      'name: project-specific-skill',
      'description: Use local workflow.',
      '---',
      '',
      'FULL SKILL BODY',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'knowledge', 'project-notes.md'),
    options.knowledgeText ?? '# Notes\n\nProject specific notes.',
  );
  await writeFile(
    join(root, 'scripts', 'project-check.agent-script.json'),
    JSON.stringify(
      {
        name: 'project-check',
        description: 'Run project check.',
        command: 'bun',
        args: ['run', 'typecheck'],
        cwd: 'workspace',
        permission: 'ask',
        timeoutMs: 120000,
      },
      null,
      2,
    ),
    'utf8',
  );
  return workspace;
}

async function writeHtmlFirstProjectFile(workspace: string): Promise<void> {
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  await writeFile(
    join(workspace, '.sber-designer/project.sdproj'),
    JSON.stringify(
      {
        version: 1,
        name: 'html-first',
        workspacePath: workspace,
        projectKind: 'html-first',
        screens: [],
        flow: [],
      },
      null,
      2,
    ),
    'utf8',
  );
}
