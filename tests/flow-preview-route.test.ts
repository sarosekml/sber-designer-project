import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { expect, test } from 'bun:test';

import { flowRouter } from '../services/api/src/routes/flow';
import { loadProjectForWorkspace } from '../services/api/src/project-store';
import { patchState, resetState } from '../services/api/src/state-store';

test('flow preview capture route reports unavailable capture server without failing refresh', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-flow-capture-'));
  resetState();
  patchState({ workspacePath: workspace });
  const app = new Hono().route('/api/flow', flowRouter);

  const res = await app.request('/api/flow/previews/screens/capture', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      viewport: { width: 1280, height: 720 },
      screens: [
        {
          screenId: 'screen-dashboard',
          url: 'http://localhost:3000/api/preview/iframe.html?id=demo',
          sourceFingerprint: 'fingerprint-1',
        },
      ],
    }),
  });

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    status: 'unavailable',
    captures: [],
  });
});

test('flow preview image route serves captured workspace png', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-flow-image-'));
  resetState();
  patchState({ workspacePath: workspace });
  await mkdir(join(workspace, '.sber-designer', 'previews', 'screens'), { recursive: true });
  await writeFile(
    join(workspace, '.sber-designer', 'previews', 'screens', 'screen-dashboard.png'),
    new Uint8Array([137, 80, 78, 71]),
  );
  const app = new Hono().route('/api/flow', flowRouter);

  const res = await app.request('/api/flow/previews/screens/screen-dashboard.png');

  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('image/png');
  expect(await res.arrayBuffer()).toHaveLength(4);
});

test('flow preview capture falls back to active project workspace when editor state omits it', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-flow-active-project-'));
  resetState();
  await loadProjectForWorkspace(workspace, 'Flow active project');
  patchState({ workspacePath: null });
  const app = new Hono().route('/api/flow', flowRouter);

  const res = await app.request('/api/flow/previews/screens/capture', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      viewport: { width: 1280, height: 720 },
      screens: [
        {
          screenId: 'screen-dashboard',
          url: 'http://localhost:5175/demo-target/index.html',
          sourceFingerprint: 'fingerprint-1',
        },
      ],
    }),
  });

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ status: 'unavailable' });
});
