import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { createAgentRun, readRunManifest } from '../services/api/src/agent/run-recorder';

test('run records preserve the authenticated session email', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-attribution-run-'));
  try {
    const run = await createAgentRun({
      route: 'chat-stream',
      user: 'ada@example.com',
      provider: 'mock',
      model: 'mock-model',
      runtimeKind: 'api',
      projectName: 'Attribution test',
      userGoal: 'Verify identity persistence.',
      workspacePath: workspace,
    });

    expect((await readRunManifest(workspace, run.runId))?.user).toBe('ada@example.com');
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('server-side records never fall back to the local-mode identity literal', async () => {
  const sourceRoot = join(import.meta.dir, '..', 'services', 'api', 'src');
  const offenders: string[] = [];
  for (const path of await listTypeScriptFiles(sourceRoot)) {
    if ((await readFile(path, 'utf8')).includes('local-dev')) offenders.push(path);
  }
  expect(offenders).toEqual([]);
});

async function listTypeScriptFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await listTypeScriptFiles(path)));
    else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(path);
  }
  return files;
}
