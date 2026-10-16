import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { browserSmokeRoot, seedHtmlProject } from './harness';

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('browser smoke state isolation', () => {
  test('accepts only workspaces created under a disposable smoke root', async () => {
    const workspace = await seedHtmlProject();
    const root = join(workspace, '..');
    cleanup.push(root);

    expect(await browserSmokeRoot(workspace)).toBe(await realpath(root));
  });

  test('rejects another temporary project before recursive cleanup can run', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ordinary-project-'));
    const workspace = join(root, 'workspace');
    cleanup.push(root);
    await mkdir(workspace);

    await expect(browserSmokeRoot(workspace)).rejects.toThrow('workspace is not disposable');
  });
});
