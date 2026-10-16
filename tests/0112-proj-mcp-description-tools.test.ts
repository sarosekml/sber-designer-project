import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  CANONICAL_DESIGN_INDEX_PATHS,
  type ComponentUsageCard,
  type IndexedComponentRecord,
} from '../packages/design-indexer/src';
import { ALL_TOOLS, makeContext, type EditorBridge } from '../packages/proj-mcp/src';

function record(partial: Partial<IndexedComponentRecord> & { id: string }): IndexedComponentRecord {
  return {
    title: partial.id,
    shortName: partial.id,
    filePath: 'src/unknown.tsx',
    storyCount: 0,
    stories: [],
    tags: [],
    groupIds: [],
    noteCount: 0,
    confidence: 'low',
    ...partial,
  } as IndexedComponentRecord;
}

function card(partial: Partial<ComponentUsageCard> & { componentId: string }): ComponentUsageCard {
  return {
    publicImport: { name: partial.componentId, module: '' },
    whenToUse: [],
    whenNotToUse: [],
    variantGuidance: [],
    propsThatMatter: [],
    snippets: [],
    pairsWith: [],
    usageCount: 0,
    visualRefs: [],
    facts: [],
    ...partial,
  };
}

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-proj-mcp-description-'));
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });
  const components: IndexedComponentRecord[] = [
    record({
      id: 'css-catalog-card',
      shortName: 'Card',
      title: 'CSS/Card',
      source: 'css-catalog',
      filePath: 'components.css',
      confidence: 'high',
    }),
    record({
      id: 'css-catalog-badge',
      shortName: 'Badge',
      title: 'CSS/Badge',
      source: 'css-catalog',
      filePath: 'components.css',
      confidence: 'medium',
      descriptionLayer: {
        purpose: 'Already described badge.',
        anatomy: [],
        usage: [],
        agentGuidance: [],
        schemaVersion: 1,
      },
    }),
  ];
  const usageCards: ComponentUsageCard[] = [
    card({
      componentId: 'css-catalog-card',
      usageCount: 4,
      requiredClasses: ['card'],
      modifiers: ['card--elevated'],
      snippets: [
        {
          code: '<article class="card card--elevated">...</article>',
          origin: 'catalog',
        },
      ],
    }),
  ];
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    `${components.map((component) => JSON.stringify(component)).join('\n')}\n`,
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.usageCards),
    `${usageCards.map((usageCard) => JSON.stringify(usageCard)).join('\n')}\n`,
    'utf8',
  );
  return root;
}

test('proj-mcp exposes description interview tools backed by the shared description core', async () => {
  const workspace = await createWorkspace();
  const reindexCalls: { workspacePath: string; reason?: string }[] = [];
  const ctx = makeContext({
    workspaceRoot: workspace,
    bridge: fakeBridge({
      requestProjectReindex: async (input) => {
        reindexCalls.push(input);
        return {
          started: true,
          alreadyRunning: false,
          jobId: 'idxjob-proj-mcp',
          statusEndpoint: '/api/project/design-index/jobs/idxjob-proj-mcp',
          reason: input.reason ?? 'Project index may be stale or missing.',
          message: 'Project re-index started; poll the status endpoint for completion.',
        };
      },
    }),
  });

  const queue = (await findProjMcpTool('list_undescribed_components').handler(
    { limit: 10 },
    ctx,
  )) as {
    queue: { componentId: string; usageCount: number }[];
    remaining: number;
    describedCount: number;
  };
  expect(queue.queue).toContainEqual(
    expect.objectContaining({ componentId: 'css-catalog-card', usageCount: 4 }),
  );
  expect(queue.queue.some((entry) => entry.componentId === 'css-catalog-badge')).toBe(false);
  expect(queue.remaining).toBe(1);
  expect(queue.describedCount).toBe(1);

  const writeResult = (await findProjMcpTool('write_component_description').handler(
    {
      componentId: 'css-catalog-card',
      layer: {
        purpose: 'Container for grouped content in static pages.',
        whenToUse: ['group related metrics', 'show summary content'],
        variantGuidance: [
          {
            prop: 'modifier',
            values: [{ value: 'card--elevated', meaning: 'adds visual lift' }],
          },
        ],
        requiredProps: ['card'],
        canonicalSnippets: [
          { code: '<article class="card card--elevated">...</article>', label: 'Card' },
        ],
        keywords: ['content card', 'static layout'],
        status: 'confirmed',
      },
    },
    ctx,
  )) as { ok: true; sidecarPath: string; reindexHint: string };
  expect(writeResult.ok).toBe(true);
  expect(writeResult.sidecarPath).toBe('.sber-designer/components/css-catalog-card.md');
  expect(writeResult.reindexHint).toContain('request_project_reindex');

  const sidecar = await readFile(join(workspace, writeResult.sidecarPath), 'utf8');
  expect(sidecar).toContain('Container for grouped content in static pages.');
  expect(sidecar).toContain('```sberDesigner');

  const source = (await findProjMcpTool('get_component_description_source').handler(
    { componentId: 'Card' },
    ctx,
  )) as { source: string; descriptionLayer: { purpose: string } | null; markdown: string | null };
  expect(source.source).toBe('sidecar');
  expect(source.descriptionLayer?.purpose).toBe('Container for grouped content in static pages.');
  expect(source.markdown).toContain('Container for grouped content');

  const reindex = (await findProjMcpTool('request_project_reindex').handler(
    { reason: 'proj-mcp description write' },
    ctx,
  )) as { started: boolean; alreadyRunning: boolean; jobId: string; statusEndpoint: string };
  expect(reindex.started).toBe(true);
  expect(reindex.alreadyRunning).toBe(false);
  expect(reindex.jobId).toMatch(/^idxjob-/);
  expect(reindex.statusEndpoint).toBe(`/api/project/design-index/jobs/${reindex.jobId}`);
  expect(reindexCalls).toEqual([
    { workspacePath: workspace, reason: 'proj-mcp description write' },
  ]);
});

function findProjMcpTool(name: string) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing proj-mcp tool ${name}`);
  return tool;
}

function fakeBridge(overrides: Partial<EditorBridge>): EditorBridge {
  return {
    postMessage: async () => undefined,
    getSelection: async () => null,
    announceToolCall: async () => undefined,
    getCatalog: async () => ({ source: 'static', components: [] }),
    applyPatch: async () => ({ ok: true, changedFiles: [], ops: [] }),
    markStorybookReloadPending: async () => undefined,
    createScreen: async (input) => ({
      ok: true,
      id: 'screen-fake',
      screens: [{ id: 'screen-fake', name: input.name }],
    }),
    sendPr: async () => ({ ok: true, branch: 'test', committed: false, prUrl: null }),
    requestProjectReindex: async () => ({
      started: true,
      alreadyRunning: false,
      jobId: 'idxjob-test',
      statusEndpoint: '/api/project/design-index/jobs/idxjob-test',
      reason: 'test',
      message: 'Project re-index started; poll the status endpoint for completion.',
    }),
    ...overrides,
  };
}
