import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ComponentCatalog } from '@sber-designer/shared-types';

import {
  buildComponentSelectionMap,
  CANONICAL_DESIGN_INDEX_PATHS,
  type ComponentDescriptionMapEntry,
  type ComponentUsageCard,
  type IndexedComponentRecord,
} from '../packages/design-indexer/src';
import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import { buildAgentKitHandoff } from '../services/api/src/agent-runtimes/agent-kit-handoff';
import {
  buildTaskRelevantComponentPack,
  renderComponentSelectionMap,
} from '../services/api/src/component-intelligence/component-pack';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { patchState, resetState } from '../services/api/src/state-store';

test('0114 B6.2 selection map keeps every indexed component without thick hydration fields', () => {
  const components = Array.from({ length: 14 }, (_, index) =>
    componentRecord(index, index === 0 ? 'Button' : `Component${index}`),
  );
  const usageCards = [
    usageCard({
      componentId: components[0]!.id,
      publicName: 'Button',
      purpose: 'Primary and secondary action control.',
    }),
  ];
  const descriptionMap: ComponentDescriptionMapEntry[] = components.map((component, index) => ({
    componentId: component.id,
    shortName: component.shortName,
    keywords: index === 0 ? ['action', 'submit', 'button'] : [`component-${index}`],
    status: index === 0 ? 'authored' : 'missing',
    docsRef: { sourcePath: component.filePath },
  }));

  const map = buildComponentSelectionMap({
    components,
    usageCards,
    descriptionMap,
    diagnostics: [
      {
        level: 'warning',
        filePath: components[1]!.filePath,
        message: `description-diverged: ${components[1]!.id} has divergent purpose.`,
      },
    ],
    generatedAt: 123,
    indexFingerprint: 'fixture-fingerprint',
  });

  expect(map.counts).toEqual({ indexed: 14, described: 1, diverged: 1 });
  expect(map.entries).toHaveLength(14);
  expect(map.entries[0]).toMatchObject({
    publicName: 'Button',
    purpose: 'Primary and secondary action control.',
    descriptionStatus: 'authored',
    variantAxes: [{ prop: 'variant', values: ['primary', 'secondary'] }],
    whenToUse: ['Use for explicit user actions.'],
    whenNotToUse: ['Do not use as navigation text.'],
  });
  expect(map.entries.find((entry) => entry.componentId === components[1]!.id)).toMatchObject({
    descriptionStatus: 'diverged',
  });
  const serialized = JSON.stringify(map);
  expect(serialized).not.toContain('propsThatMatter');
  expect(serialized).not.toContain('snippets');
  expect(serialized).not.toContain('canonicalSnippets');
});

test('0114 B6.2 generated selection map reaches API and CLI screen prompts', async () => {
  const root = await createIndexedWorkspace();
  const generated = await generateProjectDesignIndexFiles(root, {
    projectName: '0114 component map fixture',
    catalog: catalogFixture(14),
  });
  expect(generated.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.componentSelectionMap);

  const artifact = JSON.parse(
    await readFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.componentSelectionMap), 'utf8'),
  ) as { counts: { indexed: number }; entries: Array<{ componentId: string }> };
  expect(artifact.counts.indexed).toBe(14);
  expect(artifact.entries).toHaveLength(14);

  const pack = await buildTaskRelevantComponentPack({
    workspaceRoot: root,
    taskKind: 'screen-generation',
    userRequest: 'Create a registry with actions and status feedback.',
  });
  expect(pack.candidates.length).toBeLessThanOrEqual(pack.selectionPlan!.plannedRoles.length);
  expect(pack.selectionPlan).toMatchObject({ source: 'legacy-role-profile' });
  expect(pack.selectionMap).toMatchObject({
    source: 'artifact',
    counts: { indexed: 14 },
  });
  const rendered = renderComponentSelectionMap(pack.selectionMap);
  expect(rendered).toContain('14 indexed');
  expect(rendered).toContain('component-selection-map.json');
  expect(rendered).toContain('component-13');

  resetState();
  try {
    patchState({
      projectName: '0114 component map fixture',
      workspacePath: root,
      canvasView: 'screen',
    });
    const apiPrompt = await buildSystemPrompt({
      taskKind: 'screen-generation',
      userRequest: 'Create a registry with actions and status feedback.',
      componentPack: pack,
    });
    expect(apiPrompt.text).toContain('## Project Component Selection Map');
    expect(apiPrompt.text).toContain('component-13');
  } finally {
    resetState();
  }

  resetAgentKitCache();
  const kit = await loadAgentKit();
  const cliHandoff = buildAgentKitHandoff({
    runtime: 'codex',
    runtimeLabel: 'Codex CLI',
    model: null,
    messages: [{ role: 'user', content: 'Create a registry with actions and status feedback.' }],
    state: {
      projectName: '0114 component map fixture',
      workspacePath: root,
      canvasView: 'screen',
    },
    kit,
    primaryAgentName: 'ai-product-designer',
    agentRunId: 'run-0114-component-map',
    componentPack: pack,
  });
  expect(cliHandoff.prompt).toContain('## Project Component Selection Map');
  expect(cliHandoff.prompt).toContain('component-13');
});

async function createIndexedWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0114-component-map-'));
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      dependencies: { react: '^19.0.0' },
      devDependencies: { storybook: '^8.0.0' },
    }),
    'utf8',
  );
  return root;
}

function catalogFixture(count: number): ComponentCatalog {
  return {
    source: 'static',
    generatedAt: 123,
    components: Array.from({ length: count }, (_, index) => ({
      id: `component-${String(index).padStart(2, '0')}`,
      title: `Atoms/Component${index}`,
      shortName: `Component${index}`,
      filePath: `src/components/Component${index}.tsx`,
      description: index === 0 ? 'Action button control.' : `Fixture component ${index}.`,
      stories: [],
      ...(index === 0
        ? {
            descriptionLayer: {
              purpose: 'Action button control.',
              anatomy: ['root'],
              usage: [{ title: 'Action', when: 'Use for explicit user actions.' }],
              agentGuidance: ['Prefer for primary actions.'],
              keywords: ['action', 'button'],
              whenToUse: ['Use for explicit user actions.'],
              whenNotToUse: ['Do not use as navigation text.'],
              variantGuidance: [
                {
                  prop: 'variant',
                  values: [
                    { value: 'primary', meaning: 'Primary action.' },
                    { value: 'secondary', meaning: 'Secondary action.' },
                  ],
                },
              ],
            },
          }
        : {}),
    })),
  };
}

function componentRecord(index: number, shortName: string): IndexedComponentRecord {
  return {
    id: `component-${String(index).padStart(2, '0')}`,
    title: `Atoms/${shortName}`,
    shortName,
    filePath: `src/components/${shortName}.tsx`,
    source: 'react-index',
    storyCount: 0,
    stories: [],
    tags: index === 0 ? ['action', 'button'] : ['fixture'],
    groupIds: index === 0 ? ['actions'] : [],
    noteCount: 0,
    confidence: 'high',
  };
}

function usageCard(input: {
  componentId: string;
  publicName: string;
  purpose: string;
}): ComponentUsageCard {
  return {
    componentId: input.componentId,
    publicImport: { name: input.publicName, module: '@/components' },
    purpose: input.purpose,
    whenToUse: ['Use for explicit user actions.'],
    whenNotToUse: ['Do not use as navigation text.'],
    variantGuidance: [
      {
        prop: 'variant',
        values: [
          { value: 'primary', meaning: 'Primary action.' },
          { value: 'secondary', meaning: 'Secondary action.' },
        ],
      },
    ],
    propsThatMatter: [{ name: 'onClick', note: 'required prop' }],
    snippets: [
      {
        code: '<Button variant="primary" />',
        sourcePath: 'src/screens/Fixture.tsx',
        label: 'fixture',
        source: 'mined-usage',
      },
    ],
    pairsWith: [],
    usageCount: 1,
    visualRefs: [],
    facts: [],
  };
}
