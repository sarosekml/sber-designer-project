import { describe, expect, test } from 'bun:test';

import {
  createAgentRuntimeInventoryStore,
  type AgentRuntimesFetcher,
  type AgentRuntimeRefresher,
} from './agent-runtime-store';
import type { AgentRuntimeKind, AgentRuntimeStatus } from '@/lib/api/agent-runs';

function runtime(
  kind: AgentRuntimeKind,
  overrides: Partial<AgentRuntimeStatus> = {},
): AgentRuntimeStatus {
  return {
    kind,
    displayName: kind,
    installed: true,
    connected: true,
    command: kind,
    version: '1.0.0',
    selectedModel: undefined,
    auth: { status: 'ready', providers: [] },
    models: [],
    mcpServers: [],
    capabilities: {
      modelList: true,
      mcpList: false,
      runJson: true,
      modelFlag: true,
      promptViaStdin: true,
      jsonEventStream: true,
      cancel: true,
      usesOwnMcpConfig: true,
      supportsProjectMcpHandoff: true,
      chatHandoff: true,
      imageInputMode: 'none',
      rasterImageInput: false,
      svgSourceInput: false,
      nativeFileInput: false,
    },
    diagnostics: [],
    ...overrides,
  };
}

function deferredFetcher() {
  let calls = 0;
  let resolve!: (value: {
    runtimes: AgentRuntimeStatus[];
    enabledKinds: AgentRuntimeKind[];
  }) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<{ runtimes: AgentRuntimeStatus[]; enabledKinds: AgentRuntimeKind[] }>(
    (res, rej) => {
      resolve = res;
      reject = rej;
    },
  );
  const fetcher: AgentRuntimesFetcher = () => {
    calls += 1;
    return promise;
  };
  return {
    fetcher,
    get calls() {
      return calls;
    },
    resolve,
    reject,
  };
}

describe('agent runtime inventory store', () => {
  test('concurrent ensureLoaded calls share one request', async () => {
    const deferred = deferredFetcher();
    const store = createAgentRuntimeInventoryStore(deferred.fetcher);
    const first = store.getState().ensureLoaded();
    const second = store.getState().ensureLoaded();
    expect(deferred.calls).toBe(1);
    deferred.resolve({ runtimes: [runtime('opencode')], enabledKinds: ['opencode'] });
    await Promise.all([first, second]);
    expect(store.getState().loaded).toBe(true);
    expect(store.getState().statuses.map((item) => item.kind)).toEqual(['opencode']);
    // Already loaded: no further requests.
    await store.getState().ensureLoaded();
    expect(deferred.calls).toBe(1);
  });

  test('failed load records the error and allows a retry', async () => {
    let calls = 0;
    const fetcher: AgentRuntimesFetcher = () => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new Error('runtime endpoint down'))
        : Promise.resolve({ runtimes: [runtime('codex')], enabledKinds: ['codex'] });
    };
    const store = createAgentRuntimeInventoryStore(fetcher);
    await store.getState().ensureLoaded();
    expect(store.getState().error).toBe('runtime endpoint down');
    expect(store.getState().loaded).toBe(false);
    await store.getState().ensureLoaded();
    expect(calls).toBe(2);
    expect(store.getState().loaded).toBe(true);
    expect(store.getState().error).toBeNull();
  });

  test('reload forces a fresh fetch even when already loaded', async () => {
    let calls = 0;
    const fetcher: AgentRuntimesFetcher = () => {
      calls += 1;
      return Promise.resolve({
        runtimes: [runtime('claude-code', { version: `v${calls}` })],
        enabledKinds: ['claude-code'],
      });
    };
    const store = createAgentRuntimeInventoryStore(fetcher);
    await store.getState().ensureLoaded();
    await store.getState().reload();
    expect(calls).toBe(2);
    expect(store.getState().statuses[0]!.version).toBe('v2');
  });

  test('refreshConnectedRuntimes re-probes every known kind once and reports busy state', async () => {
    const refreshed: AgentRuntimeKind[] = [];
    let releaseRefresh!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const refresher: AgentRuntimeRefresher = (kind) => {
      refreshed.push(kind);
      return gate.then(() => ({ runtime: runtime(kind, { connected: false }) }));
    };
    const fetcher: AgentRuntimesFetcher = () =>
      Promise.resolve({
        runtimes: [runtime('opencode'), runtime('kimi')],
        enabledKinds: ['opencode', 'kimi'],
      });
    const store = createAgentRuntimeInventoryStore(fetcher, refresher);
    await store.getState().ensureLoaded();

    const refresh = store.getState().refreshConnectedRuntimes();
    expect(store.getState().refreshing).toBe(true);
    releaseRefresh();
    await refresh;
    expect(refreshed).toEqual(['opencode', 'kimi']);
    expect(store.getState().refreshing).toBe(false);
    expect(store.getState().statuses.every((item) => !item.connected)).toBe(true);
  });

  test('updateRuntime replaces by kind or appends a new kind', () => {
    const store = createAgentRuntimeInventoryStore(() =>
      Promise.resolve({ runtimes: [], enabledKinds: [] }),
    );
    store.getState().updateRuntime(runtime('opencode', { connected: true }));
    store.getState().updateRuntime(runtime('opencode', { connected: false }));
    store.getState().updateRuntime(runtime('gigacode'));
    expect(store.getState().statuses.map((item) => [item.kind, item.connected])).toEqual([
      ['opencode', false],
      ['gigacode', true],
    ]);
  });
});
