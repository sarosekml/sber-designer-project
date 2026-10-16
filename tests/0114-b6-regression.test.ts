import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { DesignBrief } from '@sber-designer/shared-types';

import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { buildTaskRelevantComponentPack } from '../services/api/src/component-intelligence/component-pack';
import { buildScreenStructurePlan } from '../services/api/src/screen-planning/screen-structure-plan';
import { resolveTaskRelevantComponentTaskKind } from '../services/api/src/routes/chat-stream/run-context';

interface PaymentFixture {
  name: string;
  instruction: string;
  designBrief: DesignBrief;
  expected: {
    taskKind: 'screen-generation';
    requiredComponent: string;
    forbiddenComponent: string;
    denseRoles: string[];
  };
}

test('0114 B6.2 saved payment brief preserves intent and source-backed Tile selection', async () => {
  const fixture = JSON.parse(
    await readFile(join(import.meta.dir, 'fixtures', '0114-b6', 'payment-brief.json'), 'utf8'),
  ) as PaymentFixture;
  const state = {
    canvasView: 'screen' as const,
    activeScreen: {
      id: 'payment-details',
      name: fixture.name,
      kind: 'story' as const,
      filePath: 'src/screens/PaymentDetails.stories.tsx',
      implementationFilePath: 'src/screens/PaymentDetails.tsx',
    },
    assistantTaskIntent: {
      kind: 'fill-generated-screen' as const,
      targetScreenId: 'payment-details',
      targetName: fixture.name,
      targetFolder: 'PaymentDetails',
      targetStoryFilePath: 'src/screens/PaymentDetails.stories.tsx',
      targetImplementationFilePath: 'src/screens/PaymentDetails.tsx',
      targetStoryId: 'screens-payment-details--default',
    },
  };
  const taskKind = resolveTaskRelevantComponentTaskKind(state, [], fixture.instruction);
  expect(taskKind).toBe(fixture.expected.taskKind);
  const plan = buildScreenStructurePlan({
    taskKind,
    userRequest: fixture.instruction,
    designBrief: fixture.designBrief,
    target: {
      screenId: state.activeScreen.id,
      screenName: state.activeScreen.name,
      files: [state.activeScreen.filePath, state.activeScreen.implementationFilePath],
    },
  });
  const plannedRoles = plan?.regions.flatMap((region) => region.uiRoles) ?? [];
  for (const role of fixture.expected.denseRoles) expect(plannedRoles).not.toContain(role);
  expect(plannedRoles).not.toContain('form-section');

  const workspace = await paymentWorkspace();
  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: workspace,
    taskKind,
    userRequest: fixture.instruction,
    designBrief: fixture.designBrief,
    screenStructurePlan: plan,
  });
  const tile = pack.candidates.find(
    (candidate) => candidate.shortName === fixture.expected.requiredComponent,
  );
  expect(tile).toMatchObject({
    shortName: 'Tile',
    userRequired: true,
  });
  expect(tile?.variantHints?.[0]).toContain('density: compact');
  expect(tile?.variantHints?.[0]).toContain('comfortable');
  expect(tile?.resolution?.chosenVariants[0]).toMatchObject({
    prop: 'density',
    value: 'compact',
    allowedBy: 'source-type',
    selectedBy: 'task-intent',
  });
  expect(pack.candidates.some((candidate) => candidate.shortName === 'Grid')).toBe(false);
  expect(pack.candidates.length).not.toBe(12);
  expect(pack.screenReferencePolicy).toBe('forbidden');
});

async function paymentWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0114-payment-brief-'));
  const indexRoot = join(workspace, '.sber-designer', 'design-index');
  await mkdir(indexRoot, { recursive: true });
  await mkdir(join(workspace, 'src', 'components'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'components', 'Tile.tsx'),
    [
      "export interface TileProps { density?: 'compact' | 'comfortable'; title: string }",
      'export function Tile(props: TileProps) { return <section>{props.title}</section>; }',
    ].join('\n'),
    'utf8',
  );
  const components = [
    component('tile', 'Tile', 'Content panel tile surface for payment detail information.', [
      'tile',
      'content',
      'panel',
      'summary',
      'detail',
    ]),
    component('grid', 'Grid', 'Generic layout grid.', ['grid', 'layout']),
    component('button', 'Button', 'Primary and secondary action control.', ['button', 'action']),
    component('breadcrumbs', 'BreadCrumbs', 'Hierarchy navigation trail.', [
      'breadcrumb',
      'navigation',
    ]),
  ];
  await writeFile(
    join(workspace, CANONICAL_DESIGN_INDEX_PATHS.components),
    components.map(JSON.stringify).join('\n'),
    'utf8',
  );
  await writeFile(
    join(workspace, CANONICAL_DESIGN_INDEX_PATHS.usageCards),
    JSON.stringify({
      componentId: 'tile',
      publicImport: { name: 'Tile', module: 'src/components/Tile.tsx' },
      purpose: 'Content panel tile surface for payment detail information.',
      whenToUse: ['Use for separated payment facts.'],
      whenNotToUse: [],
      variantGuidance: [
        {
          prop: 'density',
          values: [
            { value: 'compact', meaning: 'Reduced spacing.' },
            { value: 'comfortable', meaning: 'Default spacing.' },
          ],
          source: 'ts-union',
        },
      ],
      propsThatMatter: [{ name: 'title', note: 'required prop' }],
      snippets: [],
      pairsWith: [],
      usageCount: 0,
      visualRefs: [],
      facts: [],
    }),
    'utf8',
  );
  return workspace;
}

function component(id: string, shortName: string, description: string, tags: string[]) {
  return {
    id,
    title: `Fixture/${shortName}`,
    shortName,
    filePath: `src/components/${shortName}.tsx`,
    source: 'react-index',
    storyCount: 0,
    stories: [],
    description,
    tags,
    groupIds: [],
    noteCount: 0,
    confidence: 'high',
  };
}
