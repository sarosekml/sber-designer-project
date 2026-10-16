import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ChatRequest, ChatResponse, LlmGateway } from '@sber-designer/llm-gateway';
import { screenReadinessCategoryForRule } from '@sber-designer/shared-types';
import { Project } from 'ts-morph';
import { z } from 'zod';

import { buildExternalRuntimeComponentGapRepairPrompt } from '../services/api/src/agent-runtimes/agent-kit-handoff';
import {
  componentGapRepairFromToolResult,
  componentGapRepairNudge,
} from '../services/api/src/agent/component-gap-repair';
import { runAgent } from '../services/api/src/agent/loop';
import { createAgentRun } from '../services/api/src/agent/run-recorder';
import type { AgentStreamEvent } from '../services/api/src/agent/stream';
import type { ServerTool, ToolContext } from '../services/api/src/agent/types';
import type { RuntimeTargetSnapshot } from '../services/api/src/agent-runtimes/change-validation';
import { validateComponentRoleContractsSource } from '../services/api/src/component-intelligence/component-intent';
import type {
  ComponentUseCandidate,
  TaskRelevantComponentPack,
} from '../services/api/src/component-intelligence/component-pack';
import type { EditorState } from '../services/api/src/state-store';
import { finalizeExternalRuntimeDone } from '../services/api/src/routes/chat-stream/external-finalization';
import {
  analyzeComponentReuse,
  analyzeHtmlComponentReuse,
} from '../services/api/src/screen-craft-reuse';

test('B6.2.8 checks required roles and keeps an unused optional candidate diagnostic-only', () => {
  const componentPack = pack({
    requiredRoles: ['data-table'],
    candidates: [
      candidate('data-table', 'data-grid', 'DataGrid'),
      candidate('side-preview', 'side-preview', 'SidePreview'),
    ],
  });
  const source = 'export function Screen() { return <main><DataGrid /></main>; }';
  const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(
    'Screen.tsx',
    source,
  );

  const result = analyzeComponentReuse(source, sourceFile, 'src/Screen.tsx', componentPack);

  expect(result.findings).toContainEqual(
    expect.objectContaining({
      severity: 'advisory',
      ruleId: 'craft.component-reuse.optional-candidate-unused',
      componentRole: 'side-preview',
    }),
  );
  expect(result.findings.some((finding) => finding.severity === 'blocking')).toBe(false);
  expect(result.summary).toMatchObject({
    expected: ['DataGrid'],
    missing: [],
    requiredRoles: ['data-table'],
    usedComponentIds: ['data-grid'],
    missingRequiredRoles: [],
    optionalSkipped: [
      { role: 'side-preview', expected: 'SidePreview', componentId: 'side-preview' },
    ],
    score: { earned: 1, total: 1, label: '1/1' },
  });
  expect(validateComponentRoleContractsSource(source, componentPack)).toMatchObject({
    status: 'passed',
    reasonCode: 'role_contract_verified',
    usedComponentIds: ['data-grid'],
    optionalUnused: [
      { role: 'side-preview', componentId: 'side-preview', component: 'SidePreview' },
    ],
  });
});

test('B6.2.8 HTML readiness does not require the whole shortlist', () => {
  const componentPack = pack({
    requiredRoles: ['content-panel'],
    candidates: [
      candidate('content-panel', 'tile', 'Tile', ['tile', 'tile__body']),
      candidate('side-preview', 'preview', 'PreviewPane', ['preview-pane']),
    ],
  });
  const result = analyzeHtmlComponentReuse(
    '<main><article class="tile"><div class="tile__body">Client</div></article></main>',
    'screen.html',
    componentPack,
  );

  expect(result.findings).toEqual([
    expect.objectContaining({
      severity: 'advisory',
      ruleId: 'craft.component-reuse.optional-candidate-unused',
    }),
  ]);
  expect(result.summary).toMatchObject({
    expected: ['Tile'],
    usedComponentIds: ['tile'],
    missingRequiredRoles: [],
    score: { earned: 1, total: 1, label: '1/1' },
  });
});

test('B6.2.8 HTML readiness treats optional BEM elements as catalog evidence, not instance requirements', () => {
  const componentPack = pack({
    requiredRoles: ['row-actions'],
    candidates: [
      candidate('row-actions', 'css-catalog-ibtn', 'Ibtn', [
        'ibtn',
        'ibtn__badge',
        'ibtn__spinner',
      ]),
    ],
  });
  const source = '<button class="ibtn ibtn--m" aria-label="Открыть меню"></button>';
  const result = analyzeHtmlComponentReuse(source, 'screen.html', componentPack);

  expect(result.findings).toEqual([]);
  expect(result.summary).toMatchObject({
    expected: ['Ibtn'],
    usedComponentIds: ['css-catalog-ibtn'],
    missingRequiredRoles: [],
    score: { earned: 1, total: 1, label: '1/1' },
  });
  expect(validateComponentRoleContractsSource(source, componentPack)).toMatchObject({
    status: 'passed',
    reasonCode: 'role_contract_verified',
    usedComponentIds: ['css-catalog-ibtn'],
  });
});

test('B6.2.8 exposes a required DS gap as one retrieve-hydrate-repair signal', () => {
  expect(screenReadinessCategoryForRule('craft.component-reuse.design-system-gap')).toBe(
    'designSystemFit',
  );
  expect(screenReadinessCategoryForRule('craft.component-reuse.optional-candidate-unused')).toBe(
    'designSystemFit',
  );
  const componentPack = pack({
    requiredRoles: ['filters'],
    candidates: [candidate('side-preview', 'preview', 'PreviewPane')],
    gaps: [{ role: 'filters', regionIds: ['filters'], reason: 'No compatible component.' }],
  });
  const source = 'export function Screen() { return <main />; }';
  const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(
    'Screen.tsx',
    source,
  );
  const craft = analyzeComponentReuse(source, sourceFile, 'src/Screen.tsx', componentPack);

  expect(craft.findings).toContainEqual(
    expect.objectContaining({
      severity: 'blocking',
      ruleId: 'craft.component-reuse.design-system-gap',
      componentRole: 'filters',
      repairStage: 'retrieve-hydrate-repair',
    }),
  );
  expect(craft.summary).toMatchObject({
    designSystemGaps: ['filters'],
    missingRequiredRoles: ['filters'],
    score: { earned: 0, total: 1, label: '0/1' },
  });
  expect(validateComponentRoleContractsSource(source, componentPack)).toMatchObject({
    status: 'failed',
    reasonCode: 'design_system_gap',
    role: 'filters',
    repair: { kind: 'retrieve-hydrate-repair', role: 'filters' },
  });
});

test('B6.2.8 built-in loop injects the component repair sequence at most once', async () => {
  const requests: ChatRequest[] = [];
  const responses: ChatResponse[] = [
    toolResponse('check-1'),
    toolResponse('check-2'),
    doneResponse(),
  ];
  let responseIndex = 0;
  const gateway: LlmGateway = {
    active: { provider: 'mock', model: 'mock-model' },
    listVisibleModels: () => [],
    chat: async (request) => {
      requests.push(request);
      return responses[responseIndex++] ?? doneResponse();
    },
    chatStream: async function* () {
      yield { type: 'done', final: doneResponse() };
    },
  };
  const validationTool: ServerTool = {
    name: 'validate_screen_craft',
    description: 'Validate craft.',
    inputSchema: z.object({}),
    handler: async () => gapCraftResult(),
  };

  const result = await runAgent({
    gateway,
    messages: [{ role: 'user', content: 'Build the screen.' }],
    tools: [validationTool],
    toolContext: nullWorkspaceContext(),
    permission: { '*': 'allow' },
    maxIterations: 3,
  });
  const nudges = result.transcript.filter(
    (message) =>
      message.role === 'user' &&
      typeof message.content === 'string' &&
      message.content.includes('One bounded design-system readiness repair'),
  );
  expect(nudges).toHaveLength(1);
  expect(requests[1]?.messages).toContainEqual(nudges[0]!);
});

test('B6.2.8 CLI repair prompt uses the injected three-tool chain and stays bounded', () => {
  const request = componentGapRepairFromToolResult(
    'write_file',
    JSON.stringify({ craft: gapCraftResult() }),
  );
  expect(request).toEqual({
    role: 'filters',
    reason: 'Required role filters has no selected design-system component.',
  });
  expect(componentGapRepairNudge(request!)).toContain('update_component_selection');

  const prompt = buildExternalRuntimeComponentGapRepairPrompt({
    runtimeLabel: 'Codex',
    role: 'filters',
    reason: request!.reason,
    messages: [{ role: 'user', content: 'Create a registry.' }],
    state: {
      activeScreen: {
        id: 'registry',
        name: 'Registry',
        kind: 'story',
        implementationFilePath: 'src/screens/Registry.tsx',
      },
    } as EditorState,
  });
  expect(prompt).toContain('search_project_index');
  expect(prompt).toContain('get_usage_card');
  expect(prompt).toContain('update_component_selection');
  expect(prompt).toContain('Do not repeat this readiness loop');
});

test('B6.2.8 external finalization exposes the required gap as a retryable repair', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0114-readiness-'));
  const target = 'src/screens/Registry.tsx';
  const before =
    'export function Registry() { return <main data-sd-screen-root><p>Old</p></main>; }';
  const after =
    'export function Registry() { return <main data-sd-screen-root><DataGrid /></main>; }';
  await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
  await writeFile(join(workspace, target), after, 'utf8');
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test',
    provider: 'codex-runtime',
    model: 'default',
    projectName: 'Readiness fixture',
    workspacePath: workspace,
    userGoal: 'Create a registry with filters.',
    activeScreen: {
      id: 'registry',
      name: 'Registry',
      kind: 'story',
      implementationFilePath: target,
    },
  });
  const snapshots: RuntimeTargetSnapshot[] = [
    {
      path: target,
      before,
      beforeBytes: Buffer.byteLength(before),
      beforeLines: 1,
    },
  ];
  const result = await finalizeExternalRuntimeDone({
    event: completedEvent(),
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun: run,
    snapshots,
    canvasUrl: null,
    visualSnapshot: { status: 'unavailable', bytes: null, path: null, message: 'test' },
    componentPack: pack({
      requiredRoles: ['filters'],
      candidates: [candidate('data-table', 'data-grid', 'DataGrid')],
      gaps: [{ role: 'filters', regionIds: ['filters'], reason: 'No compatible component.' }],
    }),
    sawError: false,
  });

  expect(result).toMatchObject({
    retryableComponentGap: true,
    componentGapRole: 'filters',
    componentGapReason: expect.stringContaining('retrieve, hydrate, and repair'),
  });
});

function pack(input: {
  requiredRoles: string[];
  candidates: ComponentUseCandidate[];
  gaps?: NonNullable<TaskRelevantComponentPack['selectionPlan']>['gaps'];
}): TaskRelevantComponentPack {
  return {
    status: input.gaps?.length ? 'weak' : 'ready',
    source: 'design-index',
    stale: false,
    taskKind: 'screen-generation',
    candidates: input.candidates,
    diagnostics: [],
    selectionPlan: {
      version: 1,
      source: 'screen-structure-plan',
      plannedRoles: [...input.requiredRoles, ...input.candidates.map((item) => item.role)],
      requiredRoles: input.requiredRoles,
      gaps: input.gaps ?? [],
    },
  };
}

function candidate(
  role: string,
  componentId: string,
  shortName: string,
  requiredClasses?: string[],
): ComponentUseCandidate {
  return {
    role,
    componentId,
    title: shortName,
    shortName,
    confidence: 'high',
    recordConfidence: 'confirmed',
    score: 10,
    reason: `Selected for ${role}.`,
    guidance: [`Use ${shortName}.`],
    ...(requiredClasses ? { requiredClasses } : {}),
  };
}

function toolResponse(callId: string): ChatResponse {
  return {
    text: '',
    toolCalls: [{ id: callId, name: 'validate_screen_craft', arguments: '{}' }],
    finishReason: 'tool_calls',
    provider: 'mock',
    model: 'mock-model',
  };
}

function doneResponse(): ChatResponse {
  return { text: 'Done', finishReason: 'stop', provider: 'mock', model: 'mock-model' };
}

function completedEvent(): Extract<AgentStreamEvent, { type: 'done' }> {
  return {
    type: 'done',
    transcript: [{ role: 'assistant', content: 'Implemented.' }],
    iterations: 1,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    finalResponse: doneResponse(),
  };
}

function gapCraftResult() {
  return {
    status: 'blocked',
    checkedFiles: ['src/screens/Registry.tsx'],
    blocking: 1,
    shouldFix: 0,
    advisory: 0,
    findings: [
      {
        severity: 'blocking',
        ruleId: 'craft.component-reuse.design-system-gap',
        componentRole: 'filters',
        repairStage: 'retrieve-hydrate-repair',
        message: 'Required role filters has no selected design-system component.',
      },
    ],
  };
}

function nullWorkspaceContext(): ToolContext {
  return { user: 'test', workspacePath: null, canvasUrl: null, sessionMode: 'design' };
}
