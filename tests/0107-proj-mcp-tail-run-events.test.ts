import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { ALL_TOOLS, callTool, makeContext } from '../packages/proj-mcp/src';

test('proj-mcp tail_run_events returns the latest runtime events', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-proj-mcp-events-'));
  const runId = 'run-2026-07-02T19-28-06-574-a8f8ce41';
  const eventsDir = join(workspace, '.sber-designer/runs', runId, 'external-runtime');
  await mkdir(eventsDir, { recursive: true });
  await writeFile(
    join(eventsDir, 'events.jsonl'),
    [
      JSON.stringify({ seq: 1, type: 'start' }),
      JSON.stringify({ seq: 2, type: 'tool_call', tool: 'read_file' }),
      JSON.stringify({ seq: 3, type: 'error', message: 'HTTP 404' }),
    ].join('\n') + '\n',
    'utf8',
  );

  const tool = findProjMcpTool('tail_run_events');
  const result = (await tool.handler(
    { runId, limit: 2 },
    makeContext({ workspaceRoot: workspace }),
  )) as {
    events: { seq: number; type: string }[];
    totalEvents: number;
    truncated: boolean;
    path: string;
  };

  expect(result.totalEvents).toBe(3);
  expect(result.truncated).toBe(true);
  expect(result.path).toBe(`.sber-designer/runs/${runId}/external-runtime/events.jsonl`);
  expect(result.events.map((event) => event.seq)).toEqual([2, 3]);
});

test('proj-mcp tail_run_events rejects unsafe run ids', async () => {
  const response = await callTool(
    ALL_TOOLS,
    'tail_run_events',
    { runId: '../run-escape' },
    makeContext({ workspaceRoot: await mkdtemp(join(tmpdir(), 'sd-proj-mcp-events-')) }),
  );

  expect(response.isError).toBe(true);
  expect(response.content[0]?.text).toContain('Invalid input');
});

function findProjMcpTool(name: string) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing proj-mcp tool ${name}`);
  return tool;
}
