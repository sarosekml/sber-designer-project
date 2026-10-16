import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { listRuntimeTraceFixtures } from '../services/api/src/agent-runtimes/replay-trace-contract';
import {
  readOrUpdateRuntimeReplayGolden,
  replayRuntimeTraceFixture,
} from './helpers/runtime-replay-golden';

test('runtime replay fixtures match normalized event goldens', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'sd-runtime-goldens-'));
  const fixtures = listRuntimeTraceFixtures(join(import.meta.dir, 'fixtures', 'runtime-traces'));

  expect(fixtures.length).toBeGreaterThan(0);
  for (const fixture of fixtures) {
    const events = await replayRuntimeTraceFixture(fixture, { cwd });
    const golden = await readOrUpdateRuntimeReplayGolden(fixture, events);

    expect(golden.actual, `${fixture.runtime}/${fixture.id}`).toEqual(golden.expected);
  }
});
