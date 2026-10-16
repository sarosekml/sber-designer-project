import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { IndexedComponentRecord } from '@sber-designer/design-indexer';
import type { ChatResponse, LlmGateway } from '@sber-designer/llm-gateway';

import { ALL_TOOLS as PROJ_MCP_TOOLS, makeContext } from '../packages/proj-mcp/src';
import type { EditorBridge } from '../packages/proj-mcp/src/context';
import { resolveAgentToolPermission } from '../services/api/src/agent-kit/permissions';
import { prepareExternalMcpInjection } from '../services/api/src/agent-runtimes/mcp-injection';
import { CLAUDE_CODE_RUNTIME_DEF } from '../services/api/src/agent-runtimes/registry';
import { recordComponentPack } from '../services/api/src/agent/run-record/evidence';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { ALL_TOOLS } from '../services/api/src/agent/toolset';
import { runAgentStream, type AgentStreamEvent } from '../services/api/src/agent/stream';
import type { ServerTool, ToolContext } from '../services/api/src/agent/types';
import { updateTaskRelevantComponentSelection } from '../services/api/src/component-intelligence/component-reselection';
import type { TaskRelevantComponentPack } from '../services/api/src/component-intelligence/component-pack';
import { componentPackRunSummary } from '../services/api/src/component-intelligence/component-pack-summary';
import { filterToolsForSessionMode } from '../services/api/src/session-mode';
import { streamExternalRuntimeHandoff } from '../services/api/src/routes/chat-stream/external';

test('0114 B6.2.7 adds and replaces only planned roles within the run budget', async () => {
  const workspace = await createLateSelectionWorkspace();
  const pack = initialPack();
  const original = pack;

  const added = await updateTaskRelevantComponentSelection({
    workspaceRoot: workspace,
    componentPack: pack,
    action: 'add',
    role: 'side-preview',
    componentId: 'PreviewPane',
    reason: 'The selected row needs a persistent detail preview.',
  });
  expect(added.componentPack).toBe(original);
  expect(pack.candidates.map((candidate) => candidate.componentId)).toEqual([
    'old-table',
    'preview-pane',
  ]);
  expect(pack.selectionPlan?.gaps).toEqual([]);
  expect(pack.hydrationManifest?.hydratedComponentIds).toEqual(['old-table', 'preview-pane']);
  expect(added.change).toMatchObject({
    sequence: 1,
    action: 'add',
    role: 'side-preview',
    componentId: 'preview-pane',
    regionIds: ['preview'],
  });

  const replaced = await updateTaskRelevantComponentSelection({
    workspaceRoot: workspace,
    componentPack: pack,
    action: 'replace',
    role: 'data-table',
    componentId: 'data-grid',
    reason: 'Usage evidence requires sortable columns.',
  });
  expect(pack.candidates.map((candidate) => candidate.componentId)).toEqual([
    'data-grid',
    'preview-pane',
  ]);
  expect(replaced.change).toMatchObject({
    sequence: 2,
    action: 'replace',
    componentId: 'data-grid',
    replacedComponentId: 'old-table',
  });
  expect(pack.selectionPlan?.resolutions?.map((trace) => trace.componentId)).toEqual([
    'data-grid',
    'preview-pane',
  ]);
  expect(pack.lateSelection).toMatchObject({ version: 1, maxChanges: 2 });
  await expect(
    updateTaskRelevantComponentSelection({
      workspaceRoot: workspace,
      componentPack: pack,
      action: 'replace',
      role: 'data-table',
      componentId: 'old-table',
      reason: 'Try to exceed the bounded loop.',
    }),
  ).rejects.toMatchObject({ code: 'selection_budget_exhausted' });

  expect(componentPackRunSummary(pack)).toMatchObject({
    workspaceFreshness: 'current',
    selectedCount: 2,
    hydratedCount: 2,
    gapCount: 0,
    lateSelectionCount: 2,
    lateSelectionBudget: 2,
    selections: expect.arrayContaining([
      expect.objectContaining({
        role: 'data-table',
        componentId: 'data-grid',
        regionIds: ['registry'],
        hydrated: true,
      }),
      expect.objectContaining({
        role: 'side-preview',
        componentId: 'preview-pane',
        regionIds: ['preview'],
        hydrated: true,
      }),
    ]),
    lateSelections: [
      expect.objectContaining({
        sequence: 1,
        action: 'add',
        role: 'side-preview',
        componentId: 'preview-pane',
        regionIds: ['preview'],
      }),
      expect.objectContaining({
        sequence: 2,
        action: 'replace',
        role: 'data-table',
        componentId: 'data-grid',
        replacedComponentId: 'old-table',
        regionIds: ['registry'],
      }),
    ],
  });
});

test('built-in late selection is Design-only, auto-allowed, persisted, and continues the run', async () => {
  const workspace = await createLateSelectionWorkspace();
  const pack = initialPack();
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'late-selection-test',
    provider: 'mock',
    model: 'mock',
    projectName: 'Late selection fixture',
    workspacePath: workspace,
    userGoal: 'Build a registry with a side preview.',
  });
  await recordComponentPack({ workspacePath: workspace, runId: run.runId, componentPack: pack });
  const tool = builtInTool('update_component_selection');
  expect(resolveAgentToolPermission({ toolName: tool.name, input: {} }).action).toBe('allow');
  expect(filterToolsForSessionMode([tool], 'ask')).toEqual([]);
  expect(filterToolsForSessionMode([tool], 'design')).toEqual([tool]);

  const result = (await tool.handler(
    {
      action: 'add',
      role: 'side-preview',
      componentId: 'preview-pane',
      reason: 'The plan needs selected-row details.',
    },
    toolContext(workspace, run.runId, pack),
  )) as {
    interruption: boolean;
    userTurnCreated: boolean;
    next: string;
  };
  expect(result).toMatchObject({ interruption: false, userTurnCreated: false });
  expect(result.next).toContain('Continue implementation in this run');
  expect(pack.candidates.some((candidate) => candidate.componentId === 'preview-pane')).toBe(true);

  const runRoot = join(workspace, '.sber-designer', 'runs', run.runId);
  const saved = JSON.parse(await readFile(join(runRoot, 'component-pack.json'), 'utf8'));
  expect(saved.lateSelection.changes).toHaveLength(1);
  const receipts = await readdir(join(runRoot, 'receipts'));
  const records = await Promise.all(
    receipts.map(async (file) =>
      JSON.parse(await readFile(join(runRoot, 'receipts', file), 'utf8')),
    ),
  );
  expect(records).toContainEqual(
    expect.objectContaining({
      tool: 'update_component_selection',
      metadata: expect.objectContaining({
        action: 'add',
        componentId: 'preview-pane',
        lateChangeCount: 1,
      }),
    }),
  );
});

test('built-in stream publishes the refreshed component pack on tool result and done', async () => {
  const workspace = await createLateSelectionWorkspace();
  const pack = initialPack();
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'late-selection-test',
    provider: 'mock',
    model: 'mock',
    projectName: 'Late selection fixture',
    workspacePath: workspace,
    userGoal: 'Build a registry with a side preview.',
  });
  await recordComponentPack({ workspacePath: workspace, runId: run.runId, componentPack: pack });
  const events: AgentStreamEvent[] = [];
  for await (const event of runAgentStream({
    gateway: scriptedGateway([
      {
        text: '',
        toolCalls: [
          {
            id: 'late-selection',
            name: 'update_component_selection',
            arguments: JSON.stringify({
              action: 'add',
              role: 'side-preview',
              componentId: 'preview-pane',
              reason: 'The selected row needs a persistent detail preview.',
            }),
          },
        ],
        finishReason: 'tool_calls',
        provider: 'mock',
        model: 'mock',
      },
      {
        text: 'Done.',
        finishReason: 'stop',
        provider: 'mock',
        model: 'mock',
      },
    ]),
    messages: [{ role: 'user', content: 'Build a registry with a side preview.' }],
    tools: [builtInTool('update_component_selection')],
    toolContext: toolContext(workspace, run.runId, pack),
    permission: { '*': 'allow' },
    maxIterations: 2,
  })) {
    events.push(event);
  }

  expect(
    events.find(
      (event) => event.type === 'tool-result' && event.toolName === 'update_component_selection',
    ),
  ).toMatchObject({
    componentPack: { selectedCount: 2, hydratedCount: 2, lateSelectionCount: 1 },
  });
  expect(events.at(-1)).toMatchObject({
    type: 'done',
    componentPack: { selectedCount: 2, hydratedCount: 2, lateSelectionCount: 1 },
  });
});
test('proj-mcp forwards late selection with its injected run id', async () => {
  const workspace = await createLateSelectionWorkspace();
  const calls: Array<{ runId: string; input: Record<string, unknown> }> = [];
  const bridge = {
    announceToolCall: async () => undefined,
    updateComponentSelection: async (runId: string, input: Record<string, unknown>) => {
      calls.push({ runId, input });
      return {
        ok: true as const,
        interruption: false as const,
        userTurnCreated: false as const,
        change: { sequence: 1 },
        componentPack: { lateSelection: { changes: [{ sequence: 1 }] } },
      };
    },
  } as unknown as EditorBridge;
  const readContext = makeContext({ workspaceRoot: workspace });
  const searchResult = (await projMcpTool('search_project_index').handler(
    { query: 'PreviewPane', types: ['component'] },
    readContext,
  )) as { results: Array<{ id: string }> };
  expect(searchResult.results[0]?.id).toBe('preview-pane');
  const usageResult = (await projMcpTool('get_usage_card').handler(
    { componentId: 'preview-pane' },
    readContext,
  )) as { card: { componentId: string } };
  expect(usageResult.card.componentId).toBe('preview-pane');

  const tool = projMcpTool('update_component_selection');
  const result = await tool.handler(
    {
      action: 'replace',
      role: 'data-table',
      componentId: 'data-grid',
      replaceComponentId: 'old-table',
      reason: 'The indexed usage card confirms sorting.',
    },
    makeContext({ workspaceRoot: workspace, runId: 'run-0114-late', bridge }),
  );
  expect(result).toMatchObject({ interruption: false, userTurnCreated: false });
  expect(calls).toEqual([
    {
      runId: 'run-0114-late',
      input: {
        action: 'replace',
        role: 'data-table',
        componentId: 'data-grid',
        replaceComponentId: 'old-table',
        reason: 'The indexed usage card confirms sorting.',
      },
    },
  ]);

  const injection = await prepareExternalMcpInjection({
    def: CLAUDE_CODE_RUNTIME_DEF,
    cwd: workspace,
    packageRoot: '/repo/packages/proj-mcp',
    runId: 'run-0114-late',
  });
  expect(injection.status).toBe('applied');
  const config = JSON.parse(await readFile(join(workspace, '.mcp.json'), 'utf8'));
  expect(config.mcpServers['sber-designer'].args).toEqual(
    expect.arrayContaining(['--run-id', 'run-0114-late']),
  );
  await injection.cleanup();
});
test('external finalization reloads the late component pack from run evidence', async () => {
  const workspace = await createLateSelectionWorkspace();
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'late-selection-test',
    provider: 'codex-runtime',
    model: 'default',
    projectName: 'Late selection fixture',
    workspacePath: workspace,
  });
  const initial = initialPack();
  await recordComponentPack({ workspacePath: workspace, runId: run.runId, componentPack: initial });
  const updated = structuredClone(initial);
  updated.lateSelection = {
    version: 1,
    maxChanges: 2,
    changes: [
      {
        sequence: 1,
        action: 'add',
        role: 'side-preview',
        regionIds: ['preview'],
        componentId: 'preview-pane',
        reason: 'Late retrieval.',
        resolutionStatus: 'unverified',
      },
    ],
  };
  await recordComponentPack({ workspacePath: workspace, runId: run.runId, componentPack: updated });
  let finalizedPack: TaskRelevantComponentPack | null | undefined;
  const streamedEvents: AgentStreamEvent[] = [];
  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE: ({ data }) => {
        streamedEvents.push(JSON.parse(data) as AgentStreamEvent);
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun: run,
    snapshots: [],
    canvasUrl: null,
    visualSnapshot: { status: 'unavailable', bytes: null, path: null, message: 'test' },
    componentPack: initial,
    events: completedExternalEvents(),
    finalizeWithDesignJury: async (mechanical, componentPack) => {
      finalizedPack = componentPack;
      return mechanical;
    },
  });
  expect(finalizedPack?.lateSelection?.changes[0]?.componentId).toBe('preview-pane');
  expect(streamedEvents.find((event) => event.type === 'done')).toMatchObject({
    componentPack: {
      selectedCount: 1,
      lateSelectionCount: 1,
      lateSelections: [expect.objectContaining({ componentId: 'preview-pane' })],
    },
  });
});
function initialPack(): TaskRelevantComponentPack {
  return {
    status: 'weak',
    source: 'design-index',
    stale: false,
    taskKind: 'screen-generation',
    candidates: [
      {
        role: 'data-table',
        componentId: 'old-table',
        title: 'Old Table',
        shortName: 'OldTable',
        confidence: 'high',
        recordConfidence: 'high',
        score: 10,
        reason: 'Initial selection.',
        guidance: ['Use for tabular data.'],
        regionIds: ['registry'],
      },
    ],
    diagnostics: [],
    selectionPlan: {
      version: 1,
      source: 'screen-structure-plan',
      plannedRoles: ['data-table', 'side-preview'],
      gaps: [
        {
          role: 'side-preview',
          regionIds: ['preview'],
          reason: 'Initial semantic search did not find a confident match.',
        },
      ],
      resolutions: [],
    },
  };
}
async function createLateSelectionWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0114-late-selection-'));
  const indexRoot = join(root, '.sber-designer', 'design-index');
  await mkdir(indexRoot, { recursive: true });
  const components = [
    component('old-table', 'OldTable', ['table']),
    component('data-grid', 'DataGrid', ['data-grid', 'data-grid--sortable']),
    component('preview-pane', 'PreviewPane', ['preview-pane']),
  ];
  await writeFile(
    join(indexRoot, 'components.jsonl'),
    `${components.map((record) => JSON.stringify(record)).join('\n')}\n`,
    'utf8',
  );
  await writeFile(
    join(indexRoot, 'usage-cards.jsonl'),
    `${JSON.stringify({
      componentId: 'preview-pane',
      publicImport: { name: 'PreviewPane', module: '' },
      whenToUse: ['Selected-row details need persistent context.'],
      whenNotToUse: [],
      variantGuidance: [],
      propsThatMatter: [],
      snippets: [],
      pairsWith: [],
      usageCount: 1,
      visualRefs: [],
      facts: [],
    })}\n`,
    'utf8',
  );
  await writeFile(join(indexRoot, 'agent-notes.jsonl'), '', 'utf8');
  await writeFile(
    join(indexRoot, 'component-groups.json'),
    `${JSON.stringify({ version: 1, groups: [] }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(root, 'design-system.html'),
    '<div class="table"></div><div class="data-grid data-grid--sortable"></div><aside class="preview-pane"></aside>',
    'utf8',
  );
  return root;
}

function component(
  id: string,
  shortName: string,
  requiredClasses: string[],
): IndexedComponentRecord {
  return {
    id,
    title: shortName,
    shortName,
    filePath: 'design-system.html',
    source: 'css-catalog',
    storyCount: 0,
    stories: [],
    description: `${shortName} fixture component.`,
    requiredClasses,
    canonicalHtml: `<div class="${requiredClasses.join(' ')}"></div>`,
    tags: [],
    groupIds: [],
    noteCount: 0,
    confidence: 'high',
  };
}

function toolContext(
  workspacePath: string,
  runId: string,
  componentPack: TaskRelevantComponentPack,
): ToolContext {
  return {
    user: 'test',
    workspacePath,
    canvasUrl: null,
    runId,
    sessionMode: 'design',
    componentPack,
  };
}

function builtInTool(name: string): ServerTool {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Missing built-in tool ${name}`);
  return tool;
}

function projMcpTool(name: string) {
  const tool = PROJ_MCP_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Missing proj-mcp tool ${name}`);
  return tool;
}

async function* completedExternalEvents(): AsyncGenerator<AgentStreamEvent> {
  yield {
    type: 'done',
    transcript: [{ role: 'assistant', content: 'Implemented the screen.' }],
    iterations: 1,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    finalResponse: {
      text: 'Implemented the screen.',
      provider: 'codex-runtime',
      model: 'default',
      finishReason: 'stop',
    },
  };
}

function scriptedGateway(responses: ChatResponse[]): LlmGateway {
  let index = 0;
  return {
    active: { provider: 'mock', model: 'mock' },
    listVisibleModels: () => [],
    chat: async () => responses[index++] ?? responses.at(-1)!,
    chatStream: async function* () {
      const response = responses[index++] ?? responses.at(-1)!;
      for (const call of response.toolCalls ?? []) yield { type: 'tool-call', call };
      yield { type: 'done', final: response };
    },
  };
}
