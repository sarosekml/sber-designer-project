import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp } from 'node:fs/promises';
import { expect, test } from 'bun:test';
import { z } from 'zod';
import { BUILTIN_DEFAULTS, createGateway } from '@sber-designer/llm-gateway';
import type { AgentKitPermission } from '@sber-designer/shared-types';
import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { indexFromStaticAst } from '../packages/storybook-indexer/src';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';
import { resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import { runAgent } from '../services/api/src/agent/loop';
import type { ToolContext } from '../services/api/src/agent/types';
import { ALL_TOOLS } from '../services/api/src/agent/toolset';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { resetProject, saveProject } from '../services/api/src/project-store';
import { patchState, resetState, type EditorState } from '../services/api/src/state-store';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const GOLDEN_ROOT = join(TEST_DIR, 'agent-golden-tasks');
const PROJECT_FIXTURES_ROOT = join(TEST_DIR, 'fixtures', 'project-index');
const FULL_ALLOW_PERMISSION: AgentKitPermission = {
  '*': 'allow',
  read: 'allow',
  edit: 'allow',
  run_script: 'allow',
  load_skill: 'allow',
  send_pr: 'allow',
  set_mode: 'allow',
};

const FixtureSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    agentName: z.string().optional(),
    workspace: z
      .enum(['none', 'no-storybook-static', 'custom-token-system', 'generated-readable-screen'])
      .default('none'),
    input: z.string().min(1),
    editorState: z.record(z.unknown()).optional(),
    permission: z.record(z.unknown()).optional(),
    mockResponses: z.array(z.record(z.unknown())).min(1),
    expectedToolSequence: z.array(z.string()).min(1),
    expectedFinalResponseContains: z.string().optional(),
    expectedToolResultsContain: z.array(z.string()).default([]),
    expectedFiles: z
      .array(
        z
          .object({
            path: z.string().min(1),
            contains: z.string().min(1),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

type GoldenFixture = z.infer<typeof FixtureSchema>;

const fixtures = await loadGoldenFixtures();

for (const fixture of fixtures) {
  test(`agent golden task: ${fixture.name}`, async () => {
    const workspacePath = await prepareWorkspace(fixture.workspace);
    const state = buildEditorState(fixture, workspacePath);
    resetState();
    resetAgentKitCache();
    patchState(state);
    try {
      const prompt = await buildSystemPrompt(
        fixture.agentName ? { agentName: fixture.agentName } : {},
      );
      const script = `<mock-script>${JSON.stringify(fixture.mockResponses)}</mock-script>`;
      const result = await runAgent({
        gateway: createGateway(BUILTIN_DEFAULTS),
        messages: [
          { role: 'system', content: prompt.text },
          { role: 'system', content: script },
          { role: 'user', content: fixture.input },
        ],
        tools: ALL_TOOLS,
        toolContext: toolContext(workspacePath, state),
        permission: { ...FULL_ALLOW_PERMISSION, ...fixture.permission } as AgentKitPermission,
        maxIterations: fixture.mockResponses.length + 1,
      });

      expect(toolSequence(result.transcript)).toEqual(fixture.expectedToolSequence);
      if (fixture.expectedFinalResponseContains) {
        expect(result.finalResponse.text).toContain(fixture.expectedFinalResponseContains);
      }
      const toolResults = result.transcript
        .filter((message) => message.role === 'tool')
        .map((message) => String(message.content))
        .join('\n');
      for (const expected of fixture.expectedToolResultsContain) {
        expect(toolResults).toContain(expected);
      }
      for (const expected of fixture.expectedFiles) {
        if (!workspacePath) throw new Error(`Fixture ${fixture.name} expected a workspace file.`);
        expect(await readFile(join(workspacePath, expected.path), 'utf8')).toContain(
          expected.contains,
        );
      }
    } finally {
      resetState();
      resetProject();
      resetAgentKitCache();
    }
  });
}

async function loadGoldenFixtures(): Promise<GoldenFixture[]> {
  const files = (await readdir(GOLDEN_ROOT)).filter((file) => file.endsWith('.json')).sort();
  const loaded: GoldenFixture[] = [];
  for (const file of files) {
    loaded.push(FixtureSchema.parse(JSON.parse(await readFile(join(GOLDEN_ROOT, file), 'utf8'))));
  }
  return loaded;
}

async function prepareWorkspace(fixture: GoldenFixture['workspace']): Promise<string | null> {
  if (fixture === 'none') return null;
  if (fixture === 'generated-readable-screen') return createGeneratedReadableWorkspace();

  const tempRoot = await mkdtemp(join(tmpdir(), `sd-golden-${fixture}-`));
  const workspaceRoot = join(tempRoot, fixture);
  await cp(join(PROJECT_FIXTURES_ROOT, fixture), workspaceRoot, { recursive: true });
  const catalog = await indexFromStaticAst(workspaceRoot);
  await generateProjectDesignIndexFiles(workspaceRoot, {
    projectName: `Golden ${fixture}`,
    catalog,
  });
  return workspaceRoot;
}

function buildEditorState(fixture: GoldenFixture, workspacePath: string | null): EditorState {
  return {
    mode: 'design',
    projectName: `Golden ${fixture.name}`,
    workspacePath,
    canvasUrl: null,
    ...(fixture.editorState as EditorState | undefined),
  };
}

function toolContext(workspacePath: string | null, state: EditorState): ToolContext {
  return {
    user: 'golden-test',
    projectName: state.projectName,
    activeScreen: state.activeScreen ?? null,
    assistantTaskIntent: state.assistantTaskIntent ?? null,
    workspacePath,
    canvasUrl: null,
  };
}

function toolSequence(transcript: Awaited<ReturnType<typeof runAgent>>['transcript']): string[] {
  return transcript.flatMap((message) =>
    message.role === 'assistant' ? (message.toolCalls ?? []).map((call) => call.name) : [],
  );
}

async function createGeneratedReadableWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-golden-generated-screen-'));
  await mkdir(join(root, 'src', 'screens'), { recursive: true });
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });
  await writeFile(
    join(root, 'src', 'components', 'MetricCard.tsx'),
    ['export function MetricCard(props: any) {', '  return <section {...props} />;', '}', ''].join(
      '\n',
    ),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'Button.tsx'),
    ['export function Button(props: any) {', '  return <button {...props} />;', '}', ''].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'screens', 'QueueScreen.tsx'),
    [
      "import { MetricCard } from '../components/MetricCard';",
      "import { Button } from '../components/Button';",
      '',
      'export function QueueScreen() {',
      '  return (',
      '    <main className="queue-screen" data-testid="queue-screen">',
      '      <MetricCard data-testid="queue-card">',
      '        <h1>Approval queue</h1>',
      '        <Button className="primary-action">Approve</Button>',
      '      </MetricCard>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'screens', 'SummaryScreen.tsx'),
    [
      "import { MetricCard } from '../components/MetricCard';",
      '',
      'export function SummaryScreen() {',
      '  return (',
      '    <main className="summary-screen" data-testid="summary-screen">',
      '      <MetricCard data-testid="summary-card">',
      '        <h1>Approval summary</h1>',
      '      </MetricCard>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.screens),
    [
      JSON.stringify({
        id: 'queue-screen',
        name: 'Queue Screen',
        implementationPath: 'src/screens/QueueScreen.tsx',
        designReadableStatus: 'candidate',
        source: 'agent',
      }),
      JSON.stringify({
        id: 'summary-screen',
        name: 'Summary Screen',
        implementationPath: 'src/screens/SummaryScreen.tsx',
        designReadableStatus: 'candidate',
        source: 'agent',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    [
      JSON.stringify(indexedComponent('components-button', 'Components/Button', 'Button')),
      JSON.stringify(
        indexedComponent('components-metric-card', 'Components/MetricCard', 'MetricCard'),
      ),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.tokens),
    JSON.stringify({ tokens: [] }, null, 2),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.projectProfile),
    JSON.stringify({ sourceRoots: ['src'], frameworks: ['react'], styling: ['tailwind'] }, null, 2),
    'utf8',
  );
  await saveProject({
    version: 1,
    name: 'Golden Generated Screen',
    workspacePath: root,
    screens: [
      {
        id: 'queue-screen',
        name: 'Queue Screen',
        kind: 'story',
        implementationFilePath: 'src/screens/QueueScreen.tsx',
      },
      {
        id: 'summary-screen',
        name: 'Summary Screen',
        kind: 'story',
        implementationFilePath: 'src/screens/SummaryScreen.tsx',
      },
    ],
    flow: [],
  });
  return root;
}

function indexedComponent(id: string, title: string, shortName: string) {
  return {
    id,
    title,
    shortName,
    filePath: `src/components/${shortName}.tsx`,
    storyCount: 0,
    stories: [],
    tags: [],
    groupIds: [],
    noteCount: 0,
    confidence: 'high',
  };
}
