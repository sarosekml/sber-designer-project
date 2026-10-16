import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { expect, test } from 'bun:test';

import { filesRouter } from '../services/api/src/routes/files';
import { patchState, resetState } from '../services/api/src/state-store';

test('/api/files/move moves a workspace-relative html file', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-files-move-'));
  resetState();
  patchState({ workspacePath: workspace });
  await mkdir(join(workspace, 'pages'), { recursive: true });
  await writeFile(join(workspace, 'pages', 'old.html'), '<main>Old</main>', 'utf8');

  const app = new Hono().route('/api/files', filesRouter);
  const res = await app.request('/api/files/move', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fromPath: 'pages/old.html',
      toPath: 'pages/archive/new.html',
    }),
  });

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    ok: true,
    fromPath: 'pages/old.html',
    toPath: 'pages/archive/new.html',
  });
  expect(await readFile(join(workspace, 'pages', 'archive', 'new.html'), 'utf8')).toBe(
    '<main>Old</main>',
  );
  await expect(stat(join(workspace, 'pages', 'old.html'))).rejects.toThrow();
});
