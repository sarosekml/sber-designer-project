import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ScreenStructurePlan } from '@sber-designer/shared-types';

import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { buildTaskRelevantComponentPack } from '../services/api/src/component-intelligence/component-pack';

test('0114 B6.2.4 semantic purpose and public roots outrank plugin path coincidence', async () => {
  const root = await createRankerWorkspace([
    component('side-preview-root', 'DetailSurface', 'src/components/SidePreview/index.ts'),
    component('side-preview-tab', 'Tab', 'src/components/SidePreview/plugins/Tab.tsx', {
      groupIds: ['side-preview'],
    }),
    component('data-table-root', 'RegistrySurface', 'src/components/DataTable/index.ts'),
    component('data-table-overlay', 'Overlay', 'src/components/DataTable/plugins/Overlay.tsx', {
      groupIds: ['data-table'],
    }),
  ]);
  await writeUsageCards(root, [
    usageCard('side-preview-root', 'DetailSurface', {
      purpose: 'Side preview rail for selected row details.',
      whenToUse: ['Use for master detail inspection beside a collection.'],
    }),
    usageCard('side-preview-tab', 'Tab', {
      purpose: 'Side preview rail for selected row details.',
      whenToUse: ['Use for master detail inspection beside a collection.'],
    }),
    usageCard('data-table-root', 'RegistrySurface', {
      purpose: 'Operational data table for dense record comparison.',
      whenToUse: ['Use for registry rows, columns, and sorting.'],
    }),
    usageCard('data-table-overlay', 'Overlay', {
      purpose: 'Operational data table for dense record comparison.',
      whenToUse: ['Use for registry rows, columns, and sorting.'],
    }),
  ]);

  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-generation',
    userRequest: 'Build the planned registry.',
    screenStructurePlan: selectionPlan(),
  });

  expect(pack.candidates).toContainEqual(
    expect.objectContaining({ role: 'side-preview', componentId: 'side-preview-root' }),
  );
  expect(pack.candidates).toContainEqual(
    expect.objectContaining({ role: 'data-table', componentId: 'data-table-root' }),
  );
  expect(pack.candidates.some((candidate) => candidate.componentId === 'side-preview-tab')).toBe(
    false,
  );
  expect(pack.candidates.some((candidate) => candidate.componentId === 'data-table-overlay')).toBe(
    false,
  );
  expect(pack.selectionPlan?.gaps).toEqual([]);
});

test('0114 B6.2.4 Tab and Overlay path-only plugins become explicit gaps', async () => {
  const root = await createRankerWorkspace([
    component('side-preview-tab', 'Tab', 'src/components/SidePreview/plugins/Tab.tsx', {
      groupIds: ['side-preview'],
    }),
    component('data-table-overlay', 'Overlay', 'src/components/DataTable/plugins/Overlay.tsx', {
      groupIds: ['data-table'],
    }),
  ]);

  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-generation',
    userRequest: 'Build the planned registry.',
    screenStructurePlan: selectionPlan(),
  });

  expect(pack.candidates).toEqual([]);
  expect(pack.selectionPlan?.gaps.map((gap) => gap.role)).toEqual(['side-preview', 'data-table']);
  expect(pack.diagnostics).toContainEqual(expect.stringContaining('Design-system gap'));
});

test('0114 B6.2.4 a forbidden Grid mention does not activate dense workflow roles', async () => {
  const root = await createRankerWorkspace([
    component('side-preview-tab', 'Tab', 'src/components/SidePreview/plugins/Tab.tsx', {
      groupIds: ['side-preview'],
    }),
    component('bulk-plugin', 'BulkPlugin', 'src/components/BulkActions/plugins/BulkPlugin.tsx', {
      groupIds: ['mass-actions'],
    }),
  ]);

  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-generation',
    userRequest: 'Create a simple profile. Не используй Grid.',
  });

  expect(pack.selectionPlan?.plannedRoles).not.toContain('side-preview');
  expect(pack.selectionPlan?.plannedRoles).not.toContain('mass-actions');
});

async function createRankerWorkspace(components: object[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0114-semantic-rerank-'));
  const indexRoot = join(root, '.sber-designer', 'design-index');
  await mkdir(indexRoot, { recursive: true });
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    components.map((record) => JSON.stringify(record)).join('\n'),
    'utf8',
  );
  return root;
}

async function writeUsageCards(root: string, cards: object[]): Promise<void> {
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.usageCards),
    cards.map((record) => JSON.stringify(record)).join('\n'),
    'utf8',
  );
}

function component(
  id: string,
  shortName: string,
  filePath: string,
  optional: { groupIds?: string[] } = {},
) {
  return {
    id,
    title: `Fixture/${shortName}`,
    shortName,
    filePath,
    source: 'react-index',
    storyCount: 0,
    stories: [],
    tags: [],
    groupIds: optional.groupIds ?? [],
    noteCount: 0,
    confidence: 'high',
  };
}

function usageCard(
  componentId: string,
  publicName: string,
  input: { purpose: string; whenToUse: string[] },
) {
  return {
    componentId,
    publicImport: { name: publicName, module: '@/components' },
    purpose: input.purpose,
    whenToUse: input.whenToUse,
    whenNotToUse: [],
    variantGuidance: [],
    propsThatMatter: [],
    snippets: [],
    pairsWith: [],
    usageCount: 0,
    visualRefs: [],
    facts: [],
  };
}

function selectionPlan(): ScreenStructurePlan {
  return {
    version: 1,
    taskKind: 'screen-generation',
    source: 'request',
    intent: 'Build an operational registry.',
    regions: [
      {
        id: 'preview',
        label: 'Side preview',
        purpose: 'Inspect selected row details beside the collection.',
        uiRoles: ['side-preview'],
        required: true,
      },
      {
        id: 'collection',
        label: 'Collection',
        purpose: 'Scan and compare dense registry rows.',
        uiRoles: ['data-table'],
        required: true,
      },
    ],
    data: [],
    actions: [],
    states: [],
    constraints: [],
    assumptions: [],
  };
}
