import { expect, test } from 'bun:test';

import { createLatestProjectCoverCaptureRunner } from './project-cover-capture';

test('project cover capture keeps the running job and coalesces pending runs to the latest', async () => {
  let releaseFirst: (() => void) | null = null;
  const firstBlocked = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const started: string[] = [];
  const runner = createLatestProjectCoverCaptureRunner(async (screenId: string) => {
    started.push(screenId);
    if (screenId === 'screen-1') await firstBlocked;
  });

  const first = runner('screen-1');
  const second = runner('screen-2');
  const latest = runner('screen-3');
  expect(started).toEqual(['screen-1']);

  releaseFirst?.();
  await Promise.all([first, second, latest]);

  expect(started).toEqual(['screen-1', 'screen-3']);
});

test('a failed cover capture does not strand the latest pending run', async () => {
  let releaseFirst: (() => void) | null = null;
  const firstBlocked = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const started: string[] = [];
  const runner = createLatestProjectCoverCaptureRunner(async (screenId: string) => {
    started.push(screenId);
    if (screenId === 'screen-1') {
      await firstBlocked;
      throw new Error('snapshot failed');
    }
  });

  const first = runner('screen-1');
  const latest = runner('screen-2');
  releaseFirst?.();
  await Promise.all([first, latest]);

  expect(started).toEqual(['screen-1', 'screen-2']);
});
