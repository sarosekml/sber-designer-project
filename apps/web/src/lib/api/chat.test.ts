import { afterEach, expect, test } from 'bun:test';

import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';

import { pushEditorState } from './chat';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  useProjectStore.setState({ project: null });
  useSandboxStore.setState({ session: null });
});

test('pushEditorState adds the current project workspace to partial mode and selection patches', async () => {
  useProjectStore.setState({
    project: {
      version: 1,
      name: 'Scoped project',
      workspacePath: '/srv/projects/user-a/scoped-project',
      screens: [],
      flow: [],
    },
  });
  let body: Record<string, unknown> = {};
  globalThis.fetch = (async (_input, init) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  await pushEditorState({ mode: 'design' });

  expect(body).toEqual({
    mode: 'design',
    workspacePath: '/srv/projects/user-a/scoped-project',
  });
});
