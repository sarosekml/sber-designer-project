import { expect, test } from 'bun:test';

import {
  ALL_TOOLS,
  makeContext,
  type CreateScreenBridgeInput,
  type EditorBridge,
} from '../packages/proj-mcp/src';

test('proj-mcp exposes create_screen and routes through the editor bridge', async () => {
  const calls: CreateScreenBridgeInput[] = [];
  const bridge = fakeBridge({
    createScreen: async (input) => {
      calls.push(input);
      return { ok: true, id: 'screen-1', screens: [{ id: 'screen-1', name: input.name }] };
    },
  });
  const tool = findProjMcpTool('create_screen');

  const result = await tool.handler(
    {
      name: 'Pixso Payment',
      storyId: 'screens-2026-05-25-pixso-payment--default',
      filePath: 'src/stories/screens/2026-05-25/PixsoPayment.stories.tsx',
      implementationFilePath: 'src/screens/2026-05-25/PixsoPayment.tsx',
      folder: '2026-05-25',
    },
    makeContext({ workspaceRoot: '/tmp/sd-proj-mcp-create-screen', bridge }),
  );

  expect(result).toEqual({
    ok: true,
    id: 'screen-1',
    screens: [{ id: 'screen-1', name: 'Pixso Payment' }],
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    filePath: 'src/stories/screens/2026-05-25/PixsoPayment.stories.tsx',
    implementationFilePath: 'src/screens/2026-05-25/PixsoPayment.tsx',
  });
});

test('proj-mcp create_screen rejects out-of-scope paths before bridge mutation', async () => {
  let called = false;
  const bridge = fakeBridge({
    createScreen: async (input) => {
      called = true;
      return { ok: true, id: 'screen-1', screens: [{ id: 'screen-1', name: input.name }] };
    },
  });
  const tool = findProjMcpTool('create_screen');

  await expect(
    tool.handler(
      {
        name: 'Bad Screen',
        storyId: 'screens-bad--default',
        filePath: '../Bad.stories.tsx',
        implementationFilePath: 'src/screens/2026-05-25/Bad.tsx',
      },
      makeContext({ workspaceRoot: '/tmp/sd-proj-mcp-create-screen', bridge }),
    ),
  ).rejects.toThrow('create_screen filePath must be a Storybook file');
  expect(called).toBe(false);
});

function findProjMcpTool(name: string) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing proj-mcp tool ${name}`);
  return tool;
}

function fakeBridge(overrides: Partial<EditorBridge>): EditorBridge {
  return {
    postMessage: async () => undefined,
    getSelection: async () => null,
    announceToolCall: async () => undefined,
    getCatalog: async () => ({ source: 'static', components: [] }),
    applyPatch: async () => ({ ok: true, changedFiles: [], ops: [] }),
    markStorybookReloadPending: async () => undefined,
    createScreen: async (input) => ({
      ok: true,
      id: 'screen-fake',
      screens: [{ id: 'screen-fake', name: input.name }],
    }),
    sendPr: async () => ({ ok: true, branch: 'test', committed: false, prUrl: null }),
    requestProjectReindex: async () => ({
      started: true,
      alreadyRunning: false,
      jobId: 'idxjob-test',
      statusEndpoint: '/api/project/design-index/jobs/idxjob-test',
      reason: 'test',
      message: 'Project re-index started; poll the status endpoint for completion.',
    }),
    ...overrides,
  };
}
