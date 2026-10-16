import { expect, test } from 'bun:test';

import { createSseEventWriter } from '../services/api/src/routes/sse-event-writer';

test('SSE event writer sends heartbeat frames while the agent is otherwise idle', async () => {
  const frames: string[] = [];
  const writer = createSseEventWriter(
    {
      writeSSE: async ({ data }) => {
        frames.push(data);
      },
    },
    {
      heartbeatMs: 5,
      heartbeat: () => ({ type: 'heartbeat' as const }),
    },
  );

  await sleep(25);
  await writer.close();

  expect(frames.some((frame) => JSON.parse(frame).type === 'heartbeat')).toBe(true);
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
