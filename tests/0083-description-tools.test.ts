/**
 * 0083 Phase 2 — component description interview tools:
 * list_undescribed_components, write_component_description (sidecar-first),
 * get_component_description_source. Uses a minimal hand-written index.
 */
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  CANONICAL_DESIGN_INDEX_PATHS,
  type ComponentUsageCard,
  type IndexedComponentRecord,
} from '../packages/design-indexer/src';
import { readComponentSidecarLayer } from '../packages/storybook-indexer/src';
import { ALL_TOOLS } from '../services/api/src/agent/toolset';
import type { ToolContext } from '../services/api/src/agent/types';

function toolContext(workspacePath: string): ToolContext {
  return {
    user: 'test-user',
    projectName: '0083 Description Tools',
    activeScreen: null,
    workspacePath,
    canvasUrl: null,
  } as ToolContext;
}

function findTool(name: string) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Tool not registered: ${name}`);
  return tool;
}

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
  const root = await mkdtemp(join(tmpdir(), 'sd-0083-tools-'));
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });
  const components: IndexedComponentRecord[] = [
    record({
      id: 'atoms-authored',
      shortName: 'Authored',
      filePath: 'src/Authored.tsx',
      tags: ['atoms', 'authored'],
      confidence: 'high',
      descriptionLayer: {
        purpose: 'Already described.',
        anatomy: [],
        usage: [],
        agentGuidance: [],
      },
    }),
    record({
      id: 'atoms-badge',
      shortName: 'Badge',
      filePath: 'src/Badge.tsx',
      tags: ['atoms', 'badge'],
    }),
    record({
      id: 'atoms-divider',
      shortName: 'Divider',
      filePath: 'src/Divider.tsx',
      tags: ['atoms', 'divider'],
    }),
  ];
  const cards: ComponentUsageCard[] = [
    card({ componentId: 'atoms-badge', usageCount: 9 }),
    card({ componentId: 'atoms-authored', usageCount: 3 }),
  ];
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    `${components.map((c) => JSON.stringify(c)).join('\n')}\n`,
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.usageCards),
    `${cards.map((c) => JSON.stringify(c)).join('\n')}\n`,
  );
  return root;
}

test('list_undescribed_components ranks used-but-undescribed first and excludes authored', async () => {
  const ctx = toolContext(await createWorkspace());
  const result = (await findTool('list_undescribed_components').handler({}, ctx)) as {
    queue: { componentId: string; status: string; usageCount: number }[];
    remaining: number;
    describedCount: number;
    totalComponents: number;
  };

  expect(result.totalComponents).toBe(3);
  expect(result.describedCount).toBe(1);
  expect(result.remaining).toBe(2);
  expect(result.queue.map((entry) => entry.componentId)).toEqual(['atoms-badge', 'atoms-divider']);
  expect(result.queue[0]).toMatchObject({ status: 'mined-draft', usageCount: 9 });
  expect(result.queue[1]).toMatchObject({ status: 'missing', usageCount: 0 });
  expect(result.queue.some((entry) => entry.componentId === 'atoms-authored')).toBe(false);
});

test('list_undescribed_components uses component confidence as a tie-breaker', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-0083-confidence-'));
  const ctx = toolContext(root);
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });
  const components: IndexedComponentRecord[] = [
    record({
      id: 'atoms-divider',
      shortName: 'Divider',
      filePath: 'src/Divider.tsx',
      confidence: 'low',
    }),
    record({
      id: 'atoms-empty-state',
      shortName: 'EmptyState',
      filePath: 'src/EmptyState.tsx',
      confidence: 'medium',
    }),
    record({
      id: 'css-catalog-card',
      shortName: 'Card',
      filePath: 'design-system/index.html',
      source: 'css-catalog',
      confidence: 'high',
    }),
  ];
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    `${components.map((c) => JSON.stringify(c)).join('\n')}\n`,
  );
  await writeFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.usageCards), '');

  const result = (await findTool('list_undescribed_components').handler({}, ctx)) as {
    queue: { componentId: string; usageCount: number }[];
  };

  expect(result.queue.map((entry) => entry.componentId)).toEqual([
    'css-catalog-card',
    'atoms-empty-state',
    'atoms-divider',
  ]);
  expect(result.queue.every((entry) => entry.usageCount === 0)).toBe(true);
});

async function writeSidecar(root: string, id: string, body: string): Promise<void> {
  await mkdir(join(root, '.sber-designer', 'components'), { recursive: true });
  await writeFile(join(root, '.sber-designer', 'components', `${id}.md`), body);
}

const VALID_SIDECAR = [
  '# Badge',
  '',
  '```sberDesigner',
  JSON.stringify({ descriptionLayer: { purpose: 'Status badge.', status: 'confirmed' } }),
  '```',
  '',
].join('\n');

test('list_undescribed_components treats a VALID sidecar on disk as described (H2)', async () => {
  const root = await createWorkspace();
  const ctx = toolContext(root);
  // Described in a previous pass: valid sidecar on disk, index not yet recompiled.
  await writeSidecar(root, 'atoms-badge', VALID_SIDECAR);

  const result = (await findTool('list_undescribed_components').handler({}, ctx)) as {
    queue: { componentId: string }[];
    remaining: number;
    describedCount: number;
    progress: { index: number; total: number };
  };
  expect(result.queue.map((entry) => entry.componentId)).toEqual(['atoms-divider']);
  expect(result.describedCount).toBe(2); // authored + valid sidecar-on-disk
  expect(result.remaining).toBe(1);
  expect(result.progress).toEqual({ index: 3, total: 3 }); // H4: derived, not guessed
});

test('list_undescribed_components does NOT hide a component by a bare/invalid sidecar (R4)', async () => {
  const root = await createWorkspace();
  const ctx = toolContext(root);
  // A placeholder `.md` with no Description for AI layer must not count as described.
  await writeSidecar(root, 'atoms-badge', '# Badge\n\njust a stub\n');

  const result = (await findTool('list_undescribed_components').handler({}, ctx)) as {
    queue: { componentId: string }[];
    describedCount: number;
  };
  expect(result.queue.map((entry) => entry.componentId)).toEqual(['atoms-badge', 'atoms-divider']);
  expect(result.describedCount).toBe(1); // only the index-authored one
});

test('list_undescribed_components hides identity artifacts (id lacks the component name, H5)', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-0083-h5-'));
  const ctx = toolContext(root);
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });
  const components: IndexedComponentRecord[] = [
    // story title "Atoms" collapsed to id "atoms" while the real name is DictionaryBadge.
    record({
      id: 'atoms',
      shortName: 'DictionaryBadge',
      filePath: 'src/components/atoms/DictionaryBadge/DictionaryBadge.stories.tsx',
    }),
    record({ id: 'atoms-badge', shortName: 'Badge' }),
  ];
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    `${components.map((c) => JSON.stringify(c)).join('\n')}\n`,
  );
  await writeFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.usageCards), '');

  const result = (await findTool('list_undescribed_components').handler({}, ctx)) as {
    queue: { componentId: string }[];
    totalComponents: number;
  };
  expect(result.queue.map((entry) => entry.componentId)).toEqual(['atoms-badge']);
  expect(result.queue.some((entry) => entry.componentId === 'atoms')).toBe(false);
  expect(result.totalComponents).toBe(1); // the artifact is not a describable component
});

test('write_component_description writes a round-trippable sidecar (status confirmed)', async () => {
  const root = await createWorkspace();
  const ctx = toolContext(root);

  const result = (await findTool('write_component_description').handler(
    {
      componentId: 'atoms-badge',
      layer: {
        purpose: 'Status indicator for dictionary values.',
        keywords: ['status chip', 'dictionary badge'],
        requiredProps: ['code', 'name'],
        variantGuidance: [
          { prop: 'variant', values: [{ value: 'outlined', meaning: 'secondary chips' }] },
        ],
      },
    },
    ctx,
  )) as { ok: boolean; sidecarPath: string; status: string };

  expect(result.ok).toBe(true);
  expect(result.status).toBe('confirmed');
  expect(result.sidecarPath).toBe('.sber-designer/components/atoms-badge.md');

  const raw = await readFile(join(root, result.sidecarPath), 'utf8');
  expect(raw).toContain('## Description for AI');
  expect(raw).toContain('**Keywords:** status chip, dictionary badge');
  expect(raw).toContain('```sberDesigner');

  // Round-trip through the Phase 1 reader: structured block wins, status kept.
  const back = await readComponentSidecarLayer(root, {
    id: 'atoms-badge',
    title: 'Atoms/Badge',
    shortName: 'Badge',
    filePath: 'src/Badge.tsx',
  });
  expect(back?.descriptionLayer?.purpose).toBe('Status indicator for dictionary values.');
  expect(back?.descriptionLayer?.requiredProps).toEqual(['code', 'name']);
  expect(back?.descriptionLayer?.status).toBe('confirmed');
});

test('write_component_description tolerates a JSON-string layer and extra keys (D1)', async () => {
  const root = await createWorkspace();
  const ctx = toolContext(root);
  const tool = findTool('write_component_description');

  // Weak models (deepseek-flash floor) sometimes send the whole layer as a JSON
  // string and tack on unknown keys. The input schema must coerce + strip, not throw.
  const parsed = tool.inputSchema.parse({
    componentId: 'atoms-badge',
    layer: JSON.stringify({
      purpose: 'Status indicator for dictionary values.',
      keywords: ['status chip'],
      unknownField: 'ignore me',
    }),
  });
  const result = (await tool.handler(parsed, ctx)) as { ok: boolean; status: string };
  expect(result.ok).toBe(true);

  const back = await readComponentSidecarLayer(root, {
    id: 'atoms-badge',
    title: 'Atoms/Badge',
    shortName: 'Badge',
    filePath: 'src/Badge.tsx',
  });
  expect(back?.descriptionLayer?.purpose).toBe('Status indicator for dictionary values.');
  expect(back?.descriptionLayer?.keywords).toEqual(['status chip']);
});

async function htmlDesignSystemWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0112-html-ds-tool-'));
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });
  await mkdir(join(root, 'design-system'), { recursive: true });
  await writeFile(
    join(root, 'design-system/index.html'),
    [
      '<!doctype html>',
      '<main>',
      '  <button class="primary-action primary-action--danger" type="button">Delete item</button>',
      '</main>',
      '',
    ].join('\n'),
    'utf8',
  );
  const component = record({
    id: 'css-catalog-primary-action',
    title: 'CSS/PrimaryAction',
    shortName: 'PrimaryAction',
    source: 'css-catalog',
    filePath: 'site/styles.css',
    requiredClasses: ['primary-action'],
    modifiers: ['primary-action--danger'],
    canonicalHtml:
      '<button class="primary-action primary-action--danger" type="button">Delete item</button>',
    docsAnchor: 'primary-action',
  });
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    `${JSON.stringify(component)}\n`,
  );
  await writeFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.usageCards), '');
  return root;
}

test('write_component_description default stays sidecar-only for html-first components', async () => {
  const root = await htmlDesignSystemWorkspace();
  const ctx = toolContext(root);

  const result = (await findTool('write_component_description').handler(
    {
      componentId: 'css-catalog-primary-action',
      layer: {
        purpose: 'Primary call-to-action button for static HTML pages.',
        keywords: ['action', 'button'],
      },
    },
    ctx,
  )) as { ok: boolean; designSystem?: { written: boolean } };

  expect(result.ok).toBe(true);
  expect(result.designSystem).toBeUndefined();
  const html = await readFile(join(root, 'design-system/index.html'), 'utf8');
  expect(html).not.toContain('data-sd-description-for');
  expect(
    await readFile(join(root, '.sber-designer/components/css-catalog-primary-action.md'), 'utf8'),
  ).toContain('Primary call-to-action button for static HTML pages.');
});

test('write_component_description target:design-system writes section plus sidecar', async () => {
  const root = await htmlDesignSystemWorkspace();
  const ctx = toolContext(root);

  const result = (await findTool('write_component_description').handler(
    {
      componentId: 'css-catalog-primary-action',
      target: 'design-system',
      layer: {
        purpose: 'Primary call-to-action button for static HTML pages.',
        whenToUse: ['destructive action'],
        variantGuidance: [
          {
            prop: 'modifier',
            values: [{ value: 'primary-action--danger', meaning: 'destructive action state' }],
          },
        ],
        requiredProps: ['primary-action'],
        canonicalSnippets: [
          {
            code: '<button class="primary-action primary-action--danger" type="button">Delete item</button>',
          },
        ],
        keywords: ['action', 'button'],
      },
    },
    ctx,
  )) as { ok: boolean; designSystem?: { written: boolean; filePath?: string } };

  expect(result.ok).toBe(true);
  expect(result.designSystem).toMatchObject({
    written: true,
    filePath: 'design-system/index.html',
  });
  const html = await readFile(join(root, 'design-system/index.html'), 'utf8');
  expect(html).toContain('<section data-sd-description-for="primary-action">');
  expect(html).toContain('Primary call-to-action button for static HTML pages.');
  expect(
    await readFile(join(root, '.sber-designer/components/css-catalog-primary-action.md'), 'utf8'),
  ).toContain('Primary call-to-action button for static HTML pages.');
});

test('write_component_description target:auto resolves css-catalog to design-system', async () => {
  const root = await htmlDesignSystemWorkspace();
  const ctx = toolContext(root);

  const result = (await findTool('write_component_description').handler(
    {
      componentId: 'css-catalog-primary-action',
      target: 'auto',
      layer: {
        purpose: 'Primary call-to-action button for static HTML pages.',
        keywords: ['action', 'button'],
      },
    },
    ctx,
  )) as { designSystem?: { written: boolean } };

  expect(result.designSystem?.written).toBe(true);
});

async function storybookWorkspace(story: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0083-sbw-'));
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src', 'Button.stories.tsx'), story);
  const component = record({
    id: 'atoms-button',
    shortName: 'Button',
    title: 'Atoms/Button',
    filePath: 'src/Button.stories.tsx',
  });
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    `${JSON.stringify(component)}\n`,
  );
  await writeFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.usageCards), '');
  return root;
}

test('write_component_description target:storybook merges into the CSF story + sidecar (Phase 3.1)', async () => {
  const root = await storybookWorkspace(
    [
      "import { Button } from './Button';",
      "export default { title: 'Atoms/Button', component: Button } as Meta<typeof Button>;",
    ].join('\n'),
  );
  const ctx = toolContext(root);

  const result = (await findTool('write_component_description').handler(
    {
      componentId: 'atoms-button',
      target: 'storybook',
      layer: { purpose: 'Primary action trigger.', keywords: ['button'] },
    },
    ctx,
  )) as { ok: boolean; storybook?: { written: boolean; filePath?: string } };

  expect(result.storybook?.written).toBe(true);
  expect(result.storybook?.filePath).toBe('src/Button.stories.tsx');
  const story = await readFile(join(root, 'src', 'Button.stories.tsx'), 'utf8');
  expect(story).toContain('Description for AI');
  expect(story).toContain('Primary action trigger.');
  // sidecar is always written too (backup / machine cache)
  const sidecar = await readFile(join(root, '.sber-designer/components/atoms-button.md'), 'utf8');
  expect(sidecar).toContain('Primary action trigger.');
});

test('write_component_description target:storybook falls back to sidecar on project prose', async () => {
  const literal = JSON.stringify('A plain hand-written component description.');
  const root = await storybookWorkspace(
    [
      "import { Button } from './Button';",
      'export default {',
      "  title: 'Atoms/Button',",
      '  component: Button,',
      `  parameters: { docs: { description: { component: ${literal} } } },`,
      '} as Meta<typeof Button>;',
    ].join('\n'),
  );
  const ctx = toolContext(root);

  const result = (await findTool('write_component_description').handler(
    {
      componentId: 'atoms-button',
      target: 'storybook',
      layer: { purpose: 'Primary action trigger.' },
    },
    ctx,
  )) as {
    ok: boolean;
    storybook?: { written: boolean; reason?: string; fellBackToSidecar?: boolean };
  };

  expect(result.storybook?.written).toBe(false);
  expect(result.storybook?.reason).toBe('component_has_project_prose');
  expect(result.storybook?.fellBackToSidecar).toBe(true);
  // story untouched, sidecar still written
  const story = await readFile(join(root, 'src', 'Button.stories.tsx'), 'utf8');
  expect(story).not.toContain('Description for AI');
  const sidecar = await readFile(join(root, '.sber-designer/components/atoms-button.md'), 'utf8');
  expect(sidecar).toContain('Primary action trigger.');
});

test('R5: storybook round-trip verifies authored fields beyond purpose', async () => {
  const root = await storybookWorkspace(
    [
      "import { Button } from './Button';",
      "export default { title: 'Atoms/Button', component: Button } as Meta<typeof Button>;",
    ].join('\n'),
  );
  const ctx = toolContext(root);

  const result = (await findTool('write_component_description').handler(
    {
      componentId: 'atoms-button',
      target: 'storybook',
      layer: {
        purpose: 'Primary action trigger.',
        keywords: ['button', 'action'],
        requiredProps: ['children'],
        variantGuidance: [{ prop: 'variant', values: [{ value: 'primary', meaning: 'emphasis' }] }],
        canonicalSnippets: [{ code: '<Button variant="primary">Save</Button>' }],
      },
    },
    ctx,
  )) as { storybook?: { written: boolean; verified?: string[] } };

  expect(result.storybook?.written).toBe(true);
  for (const field of [
    'purpose',
    'keywords',
    'requiredProps',
    'variantGuidance',
    'canonicalSnippets',
  ]) {
    expect(result.storybook?.verified).toContain(field);
  }
});

test('get_component_description_source reads back the authored sidecar', async () => {
  const root = await createWorkspace();
  const ctx = toolContext(root);

  const before = (await findTool('get_component_description_source').handler(
    { componentId: 'atoms-badge' },
    ctx,
  )) as { source: string };
  expect(before.source).toBe('none');

  await findTool('write_component_description').handler(
    { componentId: 'atoms-badge', layer: { purpose: 'Status indicator.', keywords: ['status'] } },
    ctx,
  );

  const after = (await findTool('get_component_description_source').handler(
    { componentId: 'atoms-badge' },
    ctx,
  )) as { source: string; descriptionLayer: { purpose: string } | null };
  expect(after.source).toBe('sidecar');
  expect(after.descriptionLayer?.purpose).toBe('Status indicator.');
});

test('get_component_description_source reports canonical sidecar without projections', async () => {
  const root = await createWorkspace();
  const ctx = toolContext(root);
  await writeSidecar(
    root,
    'atoms-badge',
    [
      '# Badge',
      '',
      '```sberDesigner',
      JSON.stringify({
        descriptionLayer: {
          purpose: 'Canonical status indicator.',
          status: 'confirmed',
          updatedAt: '2026-07-08T10:00:00.000Z',
        },
      }),
      '```',
      '',
    ].join('\n'),
  );

  const source = (await findTool('get_component_description_source').handler(
    { componentId: 'atoms-badge' },
    ctx,
  )) as {
    canonical: {
      source: string;
      path: string;
      status: string | null;
      updatedAt: string | null;
      fresh: boolean;
    } | null;
    indexed: unknown;
    projections: unknown[];
    diagnostics: string[];
  };

  expect(source.canonical).toMatchObject({
    source: 'sidecar',
    path: '.sber-designer/components/atoms-badge.md',
    status: 'confirmed',
    updatedAt: '2026-07-08T10:00:00.000Z',
    fresh: true,
  });
  expect(source.indexed).toBeNull();
  expect(source.projections).toEqual([]);
  expect(source.diagnostics).toEqual([]);
});

test('get_component_description_source reports diverged Storybook projection', async () => {
  const root = await storybookWorkspace(
    [
      "import { Button } from './Button';",
      'export default {',
      "  title: 'Atoms/Button',",
      '  component: Button,',
      '  parameters: {',
      '    sberDesigner: {',
      '      descriptionLayer: {',
      "        purpose: 'Storybook projection purpose.',",
      "        keywords: ['button'],",
      '        anatomy: [],',
      '        usage: [],',
      '        agentGuidance: [],',
      "        status: 'confirmed',",
      "        updatedAt: '2026-07-08T10:10:00.000Z',",
      '      },',
      '    },',
      '  },',
      '};',
    ].join('\n'),
  );
  const ctx = toolContext(root);
  await writeSidecar(
    root,
    'atoms-button',
    [
      '# Button',
      '',
      '```sberDesigner',
      JSON.stringify({
        descriptionLayer: {
          purpose: 'Canonical button purpose.',
          keywords: ['button'],
          status: 'confirmed',
          updatedAt: '2026-07-08T10:00:00.000Z',
        },
      }),
      '```',
      '',
    ].join('\n'),
  );

  const source = (await findTool('get_component_description_source').handler(
    { componentId: 'atoms-button' },
    ctx,
  )) as {
    projections: {
      source: string;
      path: string;
      fresh: boolean;
      status: string | null;
      updatedAt: string | null;
      descriptionLayer: { purpose: string } | null;
      diagnostics: string[];
    }[];
    diagnostics: string[];
  };

  expect(source.projections).toHaveLength(1);
  expect(source.projections[0]).toMatchObject({
    source: 'storybook',
    path: 'src/Button.stories.tsx',
    fresh: false,
    status: 'confirmed',
    updatedAt: '2026-07-08T10:10:00.000Z',
    descriptionLayer: { purpose: 'Storybook projection purpose.' },
  });
  expect(source.projections[0]?.diagnostics[0]).toStartWith('sources diverge:');
  expect(source.diagnostics[0]).toStartWith('sources diverge:');
});

test('get_component_description_source reports diverged html design-system projection', async () => {
  const root = await htmlDesignSystemWorkspace();
  const ctx = toolContext(root);
  await findTool('write_component_description').handler(
    {
      componentId: 'css-catalog-primary-action',
      target: 'design-system',
      layer: {
        purpose: 'Projection action button purpose.',
        keywords: ['action', 'button'],
      },
    },
    ctx,
  );
  await writeSidecar(
    root,
    'css-catalog-primary-action',
    [
      '# PrimaryAction',
      '',
      '```sberDesigner',
      JSON.stringify({
        descriptionLayer: {
          purpose: 'Canonical action button purpose.',
          keywords: ['action', 'button'],
          status: 'confirmed',
          updatedAt: '2026-07-08T10:00:00.000Z',
        },
      }),
      '```',
      '',
    ].join('\n'),
  );

  const source = (await findTool('get_component_description_source').handler(
    { componentId: 'css-catalog-primary-action' },
    ctx,
  )) as {
    projections: {
      source: string;
      path: string;
      fresh: boolean;
      descriptionLayer: { purpose: string } | null;
      diagnostics: string[];
    }[];
    diagnostics: string[];
  };

  expect(source.projections).toHaveLength(1);
  expect(source.projections[0]).toMatchObject({
    source: 'design-system',
    path: 'design-system/index.html',
    fresh: false,
    descriptionLayer: { purpose: 'Projection action button purpose.' },
  });
  expect(source.projections[0]?.diagnostics[0]).toStartWith('sources diverge:');
  expect(source.diagnostics[0]).toStartWith('sources diverge:');
});
