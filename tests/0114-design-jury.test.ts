import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ChatRequest, LlmGateway } from '@sber-designer/llm-gateway';

import {
  createAgentRun,
  readAgentRunReceipts,
  recordToolReceipt,
} from '../services/api/src/agent/run-recorder';
import {
  DESIGN_JURY_ROLE_DEFINITIONS,
  designJuryComposite,
  parseDesignJuryRoleResponse,
  recordDesignJuryRoundSafely,
  resolveDesignJuryEnabled,
  runDesignJury,
} from '../services/api/src/design-jury';
import type { TaskRelevantComponentPack } from '../services/api/src/component-intelligence/component-pack';
import {
  DESIGN_JURY_REVIEW_MAX_TOKENS,
  finalizeBuiltInRunWithDesignJury,
  loadDesignJuryContextForRun,
  resolveDesignJuryRunPlan,
  type BuiltInRunFinalization,
} from '../services/api/src/routes/chat-stream/design-jury-finalization';
import { createExternalDesignJuryGateway } from '../services/api/src/routes/chat-stream/external-design-jury';
import { streamExternalRuntimeHandoff } from '../services/api/src/routes/chat-stream/external';
import type { AgentStreamEvent } from '../services/api/src/agent/stream';

const context = {
  userGoal: 'Create a compact Russian-language operations dashboard.',
  taskKind: 'screen_generation' as const,
  targetFiles: [
    { path: 'src/screens/Dashboard.tsx', contents: 'export const Dashboard = () => null;' },
  ],
};

test('Design Jury policy supports required, opt-in, and opt-out skills', () => {
  expect(resolveDesignJuryEnabled('required', false)).toBe(true);
  expect(resolveDesignJuryEnabled('opt-in', undefined)).toBe(false);
  expect(resolveDesignJuryEnabled('opt-in', true)).toBe(true);
  expect(resolveDesignJuryEnabled('opt-out', undefined)).toBe(true);
  expect(resolveDesignJuryEnabled('opt-out', false)).toBe(false);
  expect(resolveDesignJuryEnabled(undefined, true)).toBe(true);
});

test('Design Jury parses fenced JSON and rejects a mismatched role', () => {
  expect(
    parseDesignJuryRoleResponse(
      '```json\n{"role":"brief_fit","score":8.24,"summary":"Fits.","mustFix":[],"evidence":["Brief covered"]}\n```',
      'brief_fit',
    ),
  ).toEqual({
    role: 'brief_fit',
    score: 8.2,
    summary: 'Fits.',
    mustFix: [],
    evidence: ['Brief covered'],
  });

  expect(() =>
    parseDesignJuryRoleResponse(
      '{"role":"copy_language","score":8,"summary":"OK","mustFix":[],"evidence":[]}',
      'brief_fit',
    ),
  ).toThrow('while "brief_fit" was requested');
});

test('Design Jury keeps a valid role score when a provider exceeds bounded evidence lengths', () => {
  const response = {
    role: 'brief_fit',
    score: 8.4,
    summary: 'Fits the requested workflow.',
    mustFix: [],
    evidence: ['one', 'two', 'three', 'four', 'five', 'six'],
  };

  expect(parseDesignJuryRoleResponse(JSON.stringify(response), 'brief_fit')).toEqual({
    ...response,
    evidence: ['one', 'two', 'three', 'four', 'five'],
  });
});

test('Design Jury normalizes structured provider evidence into the string receipt contract', () => {
  const response = {
    role: 'tokens_consistency',
    score: 8.2,
    summary: 'Uses the project catalog.',
    mustFix: [],
    evidence: [
      { component: 'DataTable', result: 'reused' },
      { component: 'Badge', result: 'reused' },
    ],
  };

  expect(
    parseDesignJuryRoleResponse(JSON.stringify(response), 'tokens_consistency').evidence,
  ).toEqual([
    '{"component":"DataTable","result":"reused"}',
    '{"component":"Badge","result":"reused"}',
  ]);
});

test('weak fixture gets one bounded revision and a second jury round', async () => {
  const reviewedRoles: string[] = [];
  let revisionCalls = 0;
  const rounds: number[] = [];

  const result = await runDesignJury({
    context,
    review: async ({ role, round }) => {
      reviewedRoles.push(`${round}:${role}`);
      const score = round === 1 ? 5 : 8.5;
      return {
        text: juryResponse(role, score, round === 1 ? ['Strengthen the primary hierarchy.'] : []),
        usage: { inputTokens: 100, outputTokens: 20 },
      };
    },
    revise: async ({ prompt }) => {
      revisionCalls += 1;
      expect(prompt).toContain('Strengthen the primary hierarchy.');
      expect(prompt).toContain('Your first assistant action must write or patch');
      return {
        ...context,
        targetFiles: [
          { ...context.targetFiles[0]!, contents: 'export const Dashboard = () => <main />;' },
        ],
      };
    },
    onRound: (round) => {
      rounds.push(round.round);
    },
  });

  expect(revisionCalls).toBe(1);
  expect(rounds).toEqual([1, 2]);
  expect(reviewedRoles).toEqual([
    ...DESIGN_JURY_ROLE_DEFINITIONS.map(({ role }) => `1:${role}`),
    ...DESIGN_JURY_ROLE_DEFINITIONS.map(({ role }) => `2:${role}`),
  ]);
  expect(result).toMatchObject({
    status: 'passed',
    juryComposite: 8.5,
    revisionAttempted: true,
    usage: { inputTokens: 1_000, outputTokens: 200, totalTokens: 1_200 },
  });
  expect(result.rounds).toHaveLength(2);
});

test('strong fixture passes without spending a revision turn', async () => {
  let revisionCalls = 0;
  const result = await runDesignJury({
    context,
    review: async ({ role }) => ({ text: juryResponse(role, 9, []) }),
    revise: async () => {
      revisionCalls += 1;
    },
  });

  expect(result.status).toBe('passed');
  expect(result.juryComposite).toBe(9);
  expect(result.rounds).toHaveLength(1);
  expect(result.revisionAttempted).toBe(false);
  expect(revisionCalls).toBe(0);
});

test('structured design brief is auditable and becomes Design Jury evidence', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-design-brief-jury-'));
  const targetPath = 'src/screens/BriefScreen.tsx';
  await mkdir(join(workspacePath, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspacePath, targetPath),
    'export const BriefScreen = () => <main data-sd-screen-root>Ready</main>;\n',
    'utf8',
  );
  const designBrief = {
    version: 1 as const,
    source: 'direction-picker' as const,
    axes: {
      mood: 'Calm and operational',
      density: 'compact' as const,
      constraints: ['Keep the current navigation'],
    },
  };
  const directionSelection = {
    version: 1 as const,
    optionId: '2' as const,
    label: 'Operational overview',
    summary: 'Expose status and decision context together.',
  };
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'brief-test',
    workspacePath,
    userGoal: 'Create the operations screen.',
    activeScreen: {
      id: 'brief-screen',
      name: 'Brief Screen',
      kind: 'page',
      filePath: targetPath,
      implementationFilePath: targetPath,
    },
    designBrief,
    directionSelection,
  });
  await recordToolReceipt({
    workspacePath,
    runId: run.runId,
    tool: 'write_file',
    status: 'ok',
    changedFiles: [targetPath],
  });

  const loaded = await loadDesignJuryContextForRun({
    workspacePath,
    agentRun: run,
    taskKind: 'screen_generation',
  });
  let reviewPrompt = '';
  await runDesignJury({
    context: loaded.context,
    review: async ({ role, prompt }) => {
      reviewPrompt ||= prompt;
      return { text: juryResponse(role, 9, []) };
    },
  });
  const receipts = await readAgentRunReceipts(workspacePath, run.runId);

  expect(loaded.context.designBrief).toEqual(designBrief);
  expect(reviewPrompt).toContain('Structured design brief (direction-picker):');
  expect(reviewPrompt).toContain('- Mood: Calm and operational');
  expect(reviewPrompt).toContain('- Density: compact');
  expect(reviewPrompt).toContain(
    'Selected direction: 2. Operational overview — Expose status and decision context together.',
  );
  expect(receipts.find((receipt) => receipt.tool === 'design_brief')).toMatchObject({
    status: 'ok',
    metadata: { designBrief },
  });
  expect(receipts.find((receipt) => receipt.tool === 'direction_selection')).toMatchObject({
    status: 'ok',
    metadata: { directionSelection, designBrief },
  });
});

test('jury composite is weighted and round receipt preserves every role score', async () => {
  const roles = DESIGN_JURY_ROLE_DEFINITIONS.map(({ role }, index) => ({
    role,
    score: index + 5,
    summary: `${role} review`,
    mustFix: [],
    evidence: [`${role} evidence`],
  }));
  expect(designJuryComposite(roles)).toBe(6.7);

  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-design-jury-'));
  const round = {
    round: 1,
    roles,
    composite: 6.7,
    threshold: 8,
    passed: false,
  };
  await recordDesignJuryRoundSafely({
    workspacePath,
    runId: 'run-jury-fixture',
    changedFiles: ['src/screens/Dashboard.tsx'],
    round,
  });

  const receipts = await readAgentRunReceipts(workspacePath, 'run-jury-fixture');
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({
    tool: 'jury_round',
    status: 'ok',
    changedFiles: ['src/screens/Dashboard.tsx'],
    metadata: {
      juryComposite: 6.7,
      designJury: {
        passed: false,
        roles: expect.arrayContaining([
          expect.objectContaining({ role: 'layout_hierarchy', score: 5 }),
          expect.objectContaining({ role: 'copy_language', score: 9 }),
        ]),
      },
    },
  });
});

test('built-in jury runs only for an enabled generation/redesign policy', () => {
  expect(
    resolveDesignJuryRunPlan({
      componentPack: componentPack('screen-generation'),
      skills: [jurySkill('required')],
      generation: { critique: false },
    }),
  ).toMatchObject({
    enabled: true,
    taskKind: 'screen_generation',
    skillName: 'product-screen-generation',
    policy: 'required',
  });
  expect(
    resolveDesignJuryRunPlan({
      componentPack: componentPack('screen-generation'),
      skills: [jurySkill('opt-in')],
      generation: undefined,
    }).enabled,
  ).toBe(false);
  expect(
    resolveDesignJuryRunPlan({
      componentPack: componentPack('screen-edit'),
      skills: [jurySkill('required')],
      generation: { critique: true },
    }).enabled,
  ).toBe(false);
});

test('built-in strong screen appends a jury verdict, receipt, diagnostics, and token usage', async () => {
  const fixture = await builtInFixture();
  const requests: ChatRequest[] = [];
  const gateway = mockJuryGateway(() => 9);
  const review = gateway.chat;
  gateway.chat = async (request) => {
    requests.push(request);
    return review(request);
  };
  const result = await finalizeBuiltInRunWithDesignJury({
    mechanical: fixture.mechanical,
    plan: resolveDesignJuryRunPlan({
      componentPack: fixture.componentPack,
      skills: [jurySkill('opt-in')],
      generation: { critique: true },
    }),
    gateway,
    workspacePath: fixture.workspacePath,
    agentRun: fixture.agentRun,
    componentPack: fixture.componentPack,
  });

  expect(result.status).toBe('complete');
  expect(requests).toHaveLength(5);
  expect(requests.every((request) => request.maxTokens === DESIGN_JURY_REVIEW_MAX_TOKENS)).toBe(
    true,
  );
  expect(result.event.finalResponse.text).toContain('Design Jury: 9.0/10, passed in round 1.');
  expect(result.event.usage).toEqual({ inputTokens: 510, outputTokens: 105, totalTokens: 615 });
  expect(result.diagnostics.designJury).toMatchObject({
    status: 'passed',
    juryComposite: 9,
    rounds: 1,
    revisionAttempted: false,
  });
  const receipts = await readAgentRunReceipts(fixture.workspacePath, fixture.agentRun.runId);
  expect(receipts.find((receipt) => receipt.tool === 'jury_round')).toMatchObject({
    status: 'ok',
    metadata: { juryComposite: 9 },
  });
});

test('built-in weak screen receives exactly one bounded revision before its second jury round', async () => {
  const fixture = await builtInFixture();
  let reviewCalls = 0;
  let revisionCalls = 0;
  const result = await finalizeBuiltInRunWithDesignJury({
    mechanical: fixture.mechanical,
    plan: resolveDesignJuryRunPlan({
      componentPack: fixture.componentPack,
      skills: [jurySkill('opt-in')],
      generation: { critique: true },
    }),
    gateway: mockJuryGateway(() => {
      reviewCalls += 1;
      return reviewCalls <= 5 ? 5 : 9;
    }),
    workspacePath: fixture.workspacePath,
    agentRun: fixture.agentRun,
    componentPack: fixture.componentPack,
    revise: async (prompt) => {
      revisionCalls += 1;
      expect(prompt).toContain('Fix the reviewed screen.');
      const loaded = await loadDesignJuryContextForRun({
        workspacePath: fixture.workspacePath,
        agentRun: fixture.agentRun,
        taskKind: 'screen_generation',
        componentPack: fixture.componentPack,
      });
      return { context: loaded.context, mechanical: fixture.mechanical };
    },
  });

  expect(reviewCalls).toBe(10);
  expect(revisionCalls).toBe(1);
  expect(result.status).toBe('complete');
  expect(result.diagnostics.designJury).toMatchObject({
    status: 'passed',
    juryComposite: 9,
    rounds: 2,
    revisionAttempted: true,
  });
  const receipts = await readAgentRunReceipts(fixture.workspacePath, fixture.agentRun.runId);
  expect(receipts.filter((receipt) => receipt.tool === 'jury_round')).toHaveLength(2);
});

test('built-in reviewer outage preserves the screen and returns needs_review, never failed', async () => {
  const fixture = await builtInFixture();
  const gateway = mockJuryGateway(() => 9);
  gateway.chat = async () => {
    throw new Error('review provider unavailable');
  };
  const result = await finalizeBuiltInRunWithDesignJury({
    mechanical: fixture.mechanical,
    plan: resolveDesignJuryRunPlan({
      componentPack: fixture.componentPack,
      skills: [jurySkill('required')],
      generation: undefined,
    }),
    gateway,
    workspacePath: fixture.workspacePath,
    agentRun: fixture.agentRun,
    componentPack: fixture.componentPack,
  });

  expect(result.status).toBe('needs_review');
  expect(result.summary).toContain('review provider unavailable');
  expect(result.diagnostics.designJury).toMatchObject({ status: 'unavailable' });
  const receipts = await readAgentRunReceipts(fixture.workspacePath, fixture.agentRun.runId);
  expect(receipts.find((receipt) => receipt.tool === 'screen_jury')).toMatchObject({
    status: 'skipped',
  });
});

test('external jury gateway consumes a resumed CLI turn without exposing panel events', async () => {
  let receivedPrompt = '';
  const gateway = createExternalDesignJuryGateway({
    provider: 'codex-runtime',
    model: 'default',
    run: (prompt) => {
      receivedPrompt = prompt;
      return externalEvents(juryResponse('brief_fit', 9, []), {
        inputTokens: 80,
        outputTokens: 20,
        totalTokens: 100,
      });
    },
  });
  const response = await gateway.chat({
    messages: [
      { role: 'system', content: 'Review only.' },
      {
        role: 'user',
        content: '{"role":"brief_fit","score":0,"summary":"...","mustFix":[],"evidence":[]}',
      },
    ],
  });

  expect(receivedPrompt).toContain('internal Design Jury review turn');
  expect(receivedPrompt).toContain('Do not edit files');
  expect(response.usage).toEqual({ inputTokens: 80, outputTokens: 20, totalTokens: 100 });
  expect(parseDesignJuryRoleResponse(response.text, 'brief_fit').score).toBe(9);
});

test('external stream applies the jury hook after mechanical finalization', async () => {
  const written: Array<{ data: string }> = [];
  let juryCalls = 0;
  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: null,
    agentRun: null,
    snapshots: [],
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: externalEvents('Implemented the screen.'),
    finalizeWithDesignJury: async (mechanical) => {
      juryCalls += 1;
      return {
        ...mechanical,
        status: 'needs_review',
        summary: 'Design Jury scored 6.0/10.',
      };
    },
  });

  const events = written.map(
    (item) => JSON.parse(item.data) as AgentStreamEvent & { runStatus?: string },
  );
  expect(juryCalls).toBe(1);
  expect(events.findLast((event) => event.type === 'done')?.runStatus).toBe('needs_review');
});

function juryResponse(role: string, score: number, mustFix: string[]): string {
  return JSON.stringify({
    role,
    score,
    summary: `${role} review`,
    mustFix,
    evidence: [`${role} evidence`],
  });
}

function jurySkill(policy: 'required' | 'opt-in' | 'opt-out') {
  return {
    name: 'product-screen-generation',
    description: 'Generate screens.',
    path: 'skills/product-screen-generation/SKILL.md',
    source: 'default' as const,
    critiquePolicy: policy,
  };
}

function componentPack(taskKind: TaskRelevantComponentPack['taskKind']): TaskRelevantComponentPack {
  return {
    status: 'ready',
    source: 'design-index',
    stale: false,
    taskKind,
    candidates: [],
    diagnostics: [],
  };
}

function mockJuryGateway(score: () => number): LlmGateway {
  return {
    active: { provider: 'mock', model: 'mock-model' },
    listVisibleModels: () => [],
    chat: async (request) => {
      const prompt = String(request.messages.at(-1)?.content ?? '');
      const role = /"role":"([a-z_]+)"/u.exec(prompt)?.[1] ?? 'brief_fit';
      const nextScore = score();
      return {
        text: juryResponse(role, nextScore, nextScore < 8 ? ['Fix the reviewed screen.'] : []),
        provider: 'mock',
        model: 'mock-model',
        finishReason: 'stop',
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      };
    },
    chatStream: async function* () {
      yield { type: 'error', message: 'not implemented' };
    },
  };
}

async function builtInFixture(): Promise<{
  workspacePath: string;
  agentRun: Awaited<ReturnType<typeof createAgentRun>>;
  componentPack: TaskRelevantComponentPack;
  mechanical: BuiltInRunFinalization;
}> {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-built-in-jury-'));
  const targetPath = 'src/screens/Dashboard.tsx';
  await mkdir(join(workspacePath, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspacePath, targetPath),
    'export const Dashboard = () => <main data-sd-screen-root>Ready</main>;\n',
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'jury-test',
    provider: 'mock',
    model: 'mock-model',
    projectName: 'Jury fixture',
    userGoal: context.userGoal,
    workspacePath,
    activeScreen: {
      id: 'dashboard',
      name: 'Dashboard',
      kind: 'page',
      filePath: targetPath,
      implementationFilePath: targetPath,
    },
    assistantTaskIntent: null,
  });
  await recordToolReceipt({
    workspacePath,
    runId: agentRun.runId,
    tool: 'write_file',
    status: 'ok',
    changedFiles: [targetPath],
    summary: 'Created dashboard.',
  });
  const event = {
    type: 'done' as const,
    transcript: [{ role: 'assistant' as const, content: 'Created dashboard.' }],
    iterations: 1,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    finalResponse: {
      text: 'Created dashboard.',
      provider: 'mock',
      model: 'mock-model',
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    },
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  };
  return {
    workspacePath,
    agentRun,
    componentPack: componentPack('screen-generation'),
    mechanical: {
      event,
      status: 'complete',
      summary: 'Completed 1 agent turn.',
      diagnostics: {
        iterations: 1,
        truncated: false,
        hadErrors: false,
        stoppedAfterPermissionDeny: false,
        finishReason: 'stop',
      },
    },
  };
}

async function* externalEvents(
  text: string,
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number },
): AsyncGenerator<AgentStreamEvent> {
  yield {
    type: 'done',
    transcript: [{ role: 'assistant', content: text }],
    iterations: 1,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    finalResponse: {
      text,
      provider: 'codex-runtime',
      model: 'default',
      finishReason: 'stop',
      ...(usage ? { usage } : {}),
    },
    ...(usage ? { usage } : {}),
  };
}
