import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { createAgentRuntimeStore } from '../services/api/src/agent-runtimes/store';
import {
  agentRuntimesRouter,
  getRuntimeStatusEnvelope,
  listStoredRuntimeStatuses,
  runtimeCanStayConnected,
  selectDetectedRuntimeModel,
  synchronizeDetectedRuntime,
} from '../services/api/src/routes/agent-runtimes';
import type { AgentRuntimeStatus } from '../services/api/src/agent-runtimes/types';

test('settings runtime status reads saved OpenCode connection without discovering every CLI', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sd-runtime-route-'));
  const previousPath = process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH;
  process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH = join(dir, 'runtimes.json');

  try {
    const store = createAgentRuntimeStore();
    await store.connect('opencode', {
      command: '/Users/me/.opencode/bin/opencode',
      selectedModel: 'providerA/model-a',
      authProviders: ['providerA'],
    });

    const statuses = await listStoredRuntimeStatuses();

    expect(statuses.map((runtime) => runtime.kind)).toEqual(['opencode']);
    expect(statuses[0]?.selectedModel).toBe('providerA/model-a');
    expect(statuses[0]?.connected).toBe(true);

    const envelope = await getRuntimeStatusEnvelope('opencode');
    expect(envelope.runtimes).toHaveLength(1);
    expect(envelope.runtimes[0]?.kind).toBe('opencode');
    expect(envelope.checkedAt).toBeGreaterThan(0);
  } finally {
    if (previousPath === undefined) {
      delete process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH;
    } else {
      process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH = previousPath;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test('GigaCode refresh selection skips stale stored and configured models', () => {
  const status = {
    kind: 'gigacode',
    installed: true,
    command: '/usr/local/bin/gigacode',
    auth: { status: 'ready' },
    selectedModel: 'CodeChat',
    models: [{ id: 'Qwen3.6-35B' }, { id: 'DeepSeek-V4-Flash-0731' }],
  } as AgentRuntimeStatus;

  expect(selectDetectedRuntimeModel(status, { stored: 'removed-model' })).toBe('Qwen3.6-35B');
  expect(runtimeCanStayConnected(status)).toBe(true);
  expect(runtimeCanStayConnected({ ...status, models: [] })).toBe(false);
  expect(runtimeCanStayConnected({ ...status, auth: { status: 'none', providers: [] } })).toBe(
    false,
  );
});

test('GigaCode refresh persists disconnect when auth is no longer ready', async () => {
  let connected = true;
  const disconnects: string[] = [];
  const status = {
    kind: 'gigacode',
    installed: true,
    connected: false,
    command: '/usr/local/bin/gigacode',
    auth: { status: 'none', providers: [], action: 'sign-in' },
    models: [],
  } as AgentRuntimeStatus;
  const store = {
    read: async () => ({ agentRuntimes: { gigacode: { connected } } }),
    connect: async () => {
      connected = true;
    },
    selectModel: async () => undefined,
    disconnect: async (kind: string) => {
      disconnects.push(kind);
      connected = false;
    },
  } as never;

  const refreshed = await synchronizeDetectedRuntime(store, status, { connected: true });

  expect(disconnects).toEqual(['gigacode']);
  expect(refreshed.connected).toBe(false);
});

test('GigaCode routes reject unknown models and persist an expired refresh disconnect', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sd-gigacode-route-'));
  const binaryPath = join(dir, 'gigacode');
  const stateDir = join(dir, 'state');
  const tokenPath = join(stateDir, 'gigacode_token.json');
  const previousBinary = process.env.SBER_DESIGNER_GIGACODE_BIN;
  const previousHome = process.env.SBER_DESIGNER_GIGACODE_HOME;
  const previousStore = process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH;

  const writeToken = async (expiryDate: string, models: string[]) => {
    await writeFile(
      tokenPath,
      JSON.stringify({
        token: 'route-test-secret',
        expiryDate,
        config: {
          chat: {
            models: models.map((model) => ({
              model,
              description: `${model}-262k`,
              plugin_side: { context_window_size: 262_144 },
            })),
          },
        },
      }),
    );
  };

  try {
    await writeFile(
      binaryPath,
      `#!/usr/bin/env bun
const command = process.argv.slice(2).join(' ');
if (command === '--version') console.log('26.9.64');
else if (command === '--help') console.log('gigacode --model --output-format');
else if (command === 'auth status') console.log('Authentication is managed by the GigaCode backend');
else if (command === 'mcp list') console.log('Configured MCP servers:');
else process.exit(1);
`,
    );
    await chmod(binaryPath, 0o755);
    await mkdir(stateDir, { recursive: true });
    await writeToken('2099-01-01T00:00:00.000Z', ['Qwen3.6-35B']);
    process.env.SBER_DESIGNER_GIGACODE_BIN = binaryPath;
    process.env.SBER_DESIGNER_GIGACODE_HOME = stateDir;
    process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH = join(dir, 'runtimes.json');

    const invalidModel = await agentRuntimesRouter.request('http://localhost/gigacode/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'CodeChat' }),
    });
    expect(invalidModel.status).toBe(400);
    expect(await invalidModel.json()).toMatchObject({ error: 'runtime_model_unavailable' });

    await writeToken('2099-01-01T00:00:00.000Z', []);
    const withoutModels = await agentRuntimesRouter.request('http://localhost/gigacode/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(withoutModels.status).toBe(409);
    expect(await withoutModels.json()).toMatchObject({ error: 'runtime_models_unavailable' });

    await writeToken('2099-01-01T00:00:00.000Z', ['Qwen3.6-35B']);
    const connected = await agentRuntimesRouter.request('http://localhost/gigacode/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'Qwen3.6-35B' }),
    });
    expect(connected.status).toBe(200);

    await writeToken('2000-01-01T00:00:00.000Z', ['Qwen3.6-35B']);
    const refreshed = await agentRuntimesRouter.request('http://localhost/gigacode/refresh', {
      method: 'POST',
    });
    expect(refreshed.status).toBe(200);
    expect(await refreshed.json()).toMatchObject({
      runtime: { connected: false, auth: { status: 'none', action: 'sign-in' } },
    });
    const stored = await createAgentRuntimeStore().read();
    expect(stored.agentRuntimes.gigacode?.connected).toBe(false);
  } finally {
    restoreEnv('SBER_DESIGNER_GIGACODE_BIN', previousBinary);
    restoreEnv('SBER_DESIGNER_GIGACODE_HOME', previousHome);
    restoreEnv('SBER_DESIGNER_AGENT_RUNTIMES_PATH', previousStore);
    await rm(dir, { recursive: true, force: true });
  }
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
