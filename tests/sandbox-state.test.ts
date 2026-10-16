import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getState, resetState } from '../services/api/src/state-store';
import {
  prepareSandboxSessionRequest,
  selectSandboxSessionForState,
  syncSandboxState,
} from '../services/api/src/routes/sandbox';

test('sandbox state sync selects the latest ready preview from session lists', () => {
  resetState();

  syncSandboxState(
    JSON.stringify([
      {
        id: 'older',
        workspacePath: '/tmp/project',
        status: 'ready',
        previewUrl: 'http://localhost:56030',
        startedAt: 1000,
        readyAt: 2000,
      },
      {
        id: 'newer',
        workspacePath: '/tmp/project',
        status: 'ready',
        previewUrl: 'http://localhost:56344',
        startedAt: 3000,
        readyAt: 4000,
      },
    ]),
  );

  expect(getState().workspacePath).toBe('/tmp/project');
  expect(getState().canvasUrl).toBe('http://localhost:56344');
});

test('sandbox state sync prefers a ready preview over a newer starting session', () => {
  const selected = selectSandboxSessionForState([
    {
      id: 'ready',
      workspacePath: '/tmp/project',
      status: 'ready',
      previewUrl: 'http://localhost:56030',
      readyAt: 2000,
    },
    {
      id: 'starting',
      workspacePath: '/tmp/project',
      status: 'starting',
      previewUrl: null,
      startedAt: 5000,
    },
  ]);

  expect(selected?.previewUrl).toBe('http://localhost:56030');
});

test('sandbox session request selects static-html command for html/css workspaces', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-html-session-request-'));
  await mkdir(join(workspace, 'site'), { recursive: true });
  await writeFile(join(workspace, 'site', 'index.html'), '<main>Hello</main>', 'utf8');
  await writeFile(
    join(workspace, 'site', 'styles.css'),
    ':root { --color-brand: #14532d; }',
    'utf8',
  );

  const body = await prepareSandboxSessionRequest(JSON.stringify({ workspacePath: workspace }));

  expect(JSON.parse(body)).toMatchObject({
    workspacePath: workspace,
    command: 'static-html',
    args: [],
  });
});
