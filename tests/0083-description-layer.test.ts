/**
 * 0083 Phase 1 (pre-interview foundation): the `Description for AI` format
 * parser, the structured sidecar reader, CSF `docs.description` enrichment, and
 * the thin description-map compiler. Reading-first — no writing/interview here.
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  coerceComponentLayer,
  descriptionLayerFromMarkdown,
  extractStructuredLayerBlock,
  hasDescriptionForAiSection,
  indexFromStaticAst,
  indexFromStorybook,
  parseDescriptionForAi,
  readComponentSidecarLayer,
} from '../packages/storybook-indexer/src';
import {
  buildDescriptionMap,
  countDescribedComponents,
} from '../packages/design-indexer/src/description-map';
import type {
  ComponentUsageCard,
  IndexedComponentRecord,
} from '../packages/design-indexer/src/types';

const DESCRIPTION_LINES = [
  '## Description for AI',
  '',
  '**Purpose:** Status indicator for dictionary values.',
  '**Use when:** registry status cell; dictionary value',
  '**Use instead:** `<Text>` for free-form labels',
  '**Variants:**',
  '- `variant`: `outlined` — secondary chips; `filled` — emphasis',
  '**Required props:** `code`, `name`',
  '**Canonical usage:**',
  '```tsx',
  '<Badge code={status} name={label} variant="outlined" />',
  '```',
  "**Do / Don't:** prefer for dictionary statuses; don't render statuses as colored text",
  '**Keywords:** status chip, dictionary badge, state indicator',
];
const DESCRIPTION_MD = DESCRIPTION_LINES.join('\n');

// --- format parser --------------------------------------------------------

test('parseDescriptionForAi extracts every labelled field', () => {
  const parsed = parseDescriptionForAi(DESCRIPTION_MD);
  expect(parsed).not.toBeNull();
  expect(parsed?.purpose).toBe('Status indicator for dictionary values.');
  expect(parsed?.whenToUse).toEqual(['registry status cell', 'dictionary value']);
  expect(parsed?.whenNotToUse).toEqual(['`<Text>` for free-form labels']);
  expect(parsed?.requiredProps).toEqual(['code', 'name']);
  expect(parsed?.keywords).toEqual(['status chip', 'dictionary badge', 'state indicator']);
  expect(parsed?.variantGuidance).toEqual([
    {
      prop: 'variant',
      values: [
        { value: 'outlined', meaning: 'secondary chips' },
        { value: 'filled', meaning: 'emphasis' },
      ],
    },
  ]);
  expect(parsed?.canonicalSnippets?.[0]?.code).toBe(
    '<Badge code={status} name={label} variant="outlined" />',
  );
  expect(parsed?.guidance?.length).toBeGreaterThan(0);
});

test('parseDescriptionForAi returns null for prose without the section/labels', () => {
  expect(parseDescriptionForAi('Just an ordinary component description.')).toBeNull();
  expect(hasDescriptionForAiSection('Just an ordinary component description.')).toBe(false);
  expect(hasDescriptionForAiSection(DESCRIPTION_MD)).toBe(true);
});

test('descriptionLayerFromMarkdown normalises to a full layer with defaults', () => {
  const layer = descriptionLayerFromMarkdown(DESCRIPTION_MD);
  expect(layer).not.toBeNull();
  expect(layer?.purpose).toBe('Status indicator for dictionary values.');
  expect(layer?.anatomy).toEqual([]); // pre-0083 required arrays default to empty
  expect(layer?.usage).toEqual([]);
  expect(layer?.schemaVersion).toBe(1);
  expect(layer?.status).toBe('draft');
  expect(layer?.keywords).toEqual(['status chip', 'dictionary badge', 'state indicator']);
  expect(layer?.requiredProps).toEqual(['code', 'name']);
});

// --- structured block + coercion -----------------------------------------

test('extractStructuredLayerBlock parses a fenced sberDesigner JSON block', () => {
  const md = [
    '# Badge',
    '',
    '```json sberDesigner.descriptionLayer',
    JSON.stringify({
      descriptionLayer: {
        purpose: 'Structured purpose.',
        keywords: ['badge'],
        requiredProps: ['code'],
        status: 'confirmed',
      },
    }),
    '```',
  ].join('\n');
  const layer = extractStructuredLayerBlock(md);
  expect(layer?.purpose).toBe('Structured purpose.');
  expect(layer?.keywords).toEqual(['badge']);
  expect(layer?.requiredProps).toEqual(['code']);
  expect(layer?.status).toBe('confirmed');
  // coercion fills the pre-0083 required arrays.
  expect(layer?.anatomy).toEqual([]);
});

test('coerceComponentLayer rejects non-layers and keeps known fields', () => {
  expect(coerceComponentLayer(null)).toBeNull();
  expect(coerceComponentLayer({ keywords: ['x'] })).toBeNull(); // no purpose
  const layer = coerceComponentLayer({
    purpose: 'p',
    variantGuidance: [{ prop: 'variant', values: [{ value: 'a', meaning: 'b' }] }],
    junk: 'dropped',
  });
  expect(layer?.purpose).toBe('p');
  expect(layer?.variantGuidance?.[0]?.prop).toBe('variant');
  expect(layer && 'junk' in layer).toBe(false);
});

// --- no-Storybook sidecar reading ----------------------------------------

async function workspace(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function write(root: string, filePath: string, contents: string): Promise<void> {
  await mkdir(join(root, filePath, '..'), { recursive: true });
  await writeFile(join(root, filePath), contents);
}

test('readComponentSidecarLayer derives a layer from a markdown sidecar section', async () => {
  const root = await workspace('sd-0083-sidecar-md-');
  await write(root, '.sber-designer/components/Badge.md', `# Badge\n\n${DESCRIPTION_MD}\n`);
  const result = await readComponentSidecarLayer(root, {
    id: 'badge',
    title: 'Atoms/Badge',
    shortName: 'Badge',
    filePath: 'src/Badge.tsx',
  });
  expect(result?.descriptionLayer?.purpose).toBe('Status indicator for dictionary values.');
  expect(result?.descriptionLayer?.requiredProps).toEqual(['code', 'name']);
  expect(result?.description).toContain('Description for AI');
});

test('readComponentSidecarLayer prefers a fenced structured block over markdown', async () => {
  const root = await workspace('sd-0083-sidecar-json-');
  const md = [
    '```sberDesigner',
    JSON.stringify({ purpose: 'From structured block.', keywords: ['badge'], status: 'confirmed' }),
    '```',
    '',
    DESCRIPTION_MD,
  ].join('\n');
  await write(root, '.sber-designer/components/Badge.md', md);
  const result = await readComponentSidecarLayer(root, {
    id: 'badge',
    title: 'Atoms/Badge',
    shortName: 'Badge',
    filePath: 'src/Badge.tsx',
  });
  expect(result?.descriptionLayer?.purpose).toBe('From structured block.');
  expect(result?.descriptionLayer?.status).toBe('confirmed');
});

// --- Storybook CSF docs.description enrichment ----------------------------

function badgeStory(): string {
  const literal = JSON.stringify(`${DESCRIPTION_MD}\n`);
  return [
    "import { Badge } from './Badge';",
    `const description = ${literal};`,
    'export default {',
    "  title: 'Atoms/Badge',",
    '  component: Badge,',
    '  parameters: { docs: { description: { component: description } } },',
    '};',
    'export const Default = {};',
  ].join('\n');
}

function indexJson(): Response {
  return new Response(
    JSON.stringify({
      v: 5,
      entries: {
        'atoms-badge--default': {
          id: 'atoms-badge--default',
          type: 'story',
          name: 'Default',
          title: 'Atoms/Badge',
          importPath: './src/Badge.stories.tsx',
        },
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

test('indexFromStorybook derives descriptionLayer from a docs.description "Description for AI" section', async () => {
  const root = await workspace('sd-0083-storybook-');
  await write(root, 'src/Badge.stories.tsx', badgeStory());
  const catalog = await indexFromStorybook('http://localhost:6006', {
    fetchImpl: async () => indexJson(),
    workspaceRoot: root,
  });
  const badge = catalog.components.find((component) => component.shortName === 'Badge');
  expect(badge?.descriptionLayer?.purpose).toBe('Status indicator for dictionary values.');
  expect(badge?.descriptionLayer?.requiredProps).toEqual(['code', 'name']);
  expect(badge?.descriptionLayer?.keywords).toEqual([
    'status chip',
    'dictionary badge',
    'state indicator',
  ]);
});

test('Storybook docs.description and no-Storybook sidecar yield the same authored layer (parity)', async () => {
  // Storybook surface
  const sbRoot = await workspace('sd-0083-parity-sb-');
  await write(sbRoot, 'src/Badge.stories.tsx', badgeStory());
  const sbCatalog = await indexFromStorybook('http://localhost:6006', {
    fetchImpl: async () => indexJson(),
    workspaceRoot: sbRoot,
  });
  const sbLayer = sbCatalog.components.find((c) => c.shortName === 'Badge')?.descriptionLayer;

  // No-Storybook surface: a real component file + a markdown sidecar.
  const staticRoot = await workspace('sd-0083-parity-static-');
  await write(staticRoot, 'src/Badge.tsx', 'export function Badge() {\n  return null;\n}\n');
  await write(staticRoot, '.sber-designer/components/Badge.md', `# Badge\n\n${DESCRIPTION_MD}\n`);
  const staticCatalog = await indexFromStaticAst(staticRoot);
  const staticLayer = staticCatalog.components.find(
    (c) => c.shortName === 'Badge',
  )?.descriptionLayer;

  expect(sbLayer).toBeDefined();
  expect(staticLayer).toBeDefined();
  expect(staticLayer?.purpose).toBe(sbLayer?.purpose);
  expect(staticLayer?.whenToUse).toEqual(sbLayer?.whenToUse);
  expect(staticLayer?.variantGuidance).toEqual(sbLayer?.variantGuidance);
  expect(staticLayer?.requiredProps).toEqual(sbLayer?.requiredProps);
  expect(staticLayer?.keywords).toEqual(sbLayer?.keywords);
});

// --- E1: confirmed sidecar wins over a draft CSF-derived layer ------------

function draftButtonStory(): string {
  // A CSF docs.description that derives a *draft* layer (a `## Description for AI`
  // section). Pre-fix, this draft layer blocked a confirmed sidecar from attaching
  // during catalog rebuild, so newly-authored sidecars never raised coverage.
  const description = '## Description for AI\n\n**Purpose:** Old draft purpose.\n';
  const literal = JSON.stringify(description);
  return [
    "import { Button } from './Button';",
    `const description = ${literal};`,
    'export default {',
    "  title: 'Atoms/Buttons/Button',",
    '  component: Button,',
    '  parameters: { docs: { description: { component: description } } },',
    '};',
    'export const Default = {};',
  ].join('\n');
}

function buttonIndexJson(): Response {
  return new Response(
    JSON.stringify({
      v: 5,
      entries: {
        'atoms-buttons-button--default': {
          id: 'atoms-buttons-button--default',
          type: 'story',
          name: 'Default',
          title: 'Atoms/Buttons/Button',
          importPath: './src/Button.stories.tsx',
        },
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

test('a confirmed sidecar wins over a draft CSF-derived layer during catalog build (E1)', async () => {
  const root = await workspace('sd-0083-e1-');
  await write(root, 'src/Button.stories.tsx', draftButtonStory());
  await write(
    root,
    '.sber-designer/components/Button.md',
    [
      '# Button',
      '',
      '```sberDesigner',
      JSON.stringify({
        descriptionLayer: {
          purpose: 'Confirmed button purpose.',
          keywords: ['button', 'action'],
          requiredProps: ['children'],
          status: 'confirmed',
        },
      }),
      '```',
      '',
    ].join('\n'),
  );

  const catalog = await indexFromStorybook('http://localhost:6006', {
    fetchImpl: async () => buttonIndexJson(),
    workspaceRoot: root,
  });
  const button = catalog.components.find((component) => component.shortName === 'Button');

  // The confirmed sidecar replaced the draft CSF-derived layer (would stay draft pre-fix).
  expect(button?.descriptionLayer?.purpose).toBe('Confirmed button purpose.');
  expect(button?.descriptionLayer?.status).toBe('confirmed');
  expect(button?.descriptionLayer?.requiredProps).toEqual(['children']);

  // And it counts toward coverage in the thin map.
  const map = buildDescriptionMap({ components: catalog.components, usageCards: [] });
  expect(countDescribedComponents(map)).toBe(1);
});

// --- thin description-map compiler ---------------------------------------

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

test('buildDescriptionMap is a thin projection with no thick card fields', () => {
  const components = [
    record({
      id: 'atoms-badge',
      shortName: 'Badge',
      filePath: 'src/components/Badge.tsx',
      descriptionLayer: descriptionLayerFromMarkdown(DESCRIPTION_MD) ?? undefined,
    }),
    record({ id: 'atoms-spinner', shortName: 'Spinner', tags: ['spinner', 'loading'] }),
    record({ id: 'atoms-divider', shortName: 'Divider' }),
  ];
  const usageCards = [card({ componentId: 'atoms-spinner', usageCount: 9 })];

  const map = buildDescriptionMap({
    components,
    usageCards,
    catalogSource: 'storybook',
    previewUrl: 'http://localhost:6006/',
  });

  const badge = map.find((entry) => entry.componentId === 'atoms-badge');
  const spinner = map.find((entry) => entry.componentId === 'atoms-spinner');
  const divider = map.find((entry) => entry.componentId === 'atoms-divider');

  expect(badge?.status).toBe('authored');
  expect(badge?.keywords).toEqual(['status chip', 'dictionary badge', 'state indicator']);
  expect(badge?.docsRef.storybookUrl).toBe('http://localhost:6006/?path=/docs/atoms-badge--docs');
  expect(badge?.docsRef.sourcePath).toBe('src/components/Badge.tsx');
  expect(typeof badge?.coverageScore).toBe('number');

  expect(spinner?.status).toBe('mined-draft'); // used, but no authored layer
  expect(spinner?.keywords).toEqual(['spinner', 'loading']); // derived from tags
  expect(divider?.status).toBe('missing');

  // Projection guarantee: no thick card payload leaks into the map entry.
  for (const entry of map) {
    expect('purpose' in entry).toBe(false);
    expect('variantGuidance' in entry).toBe(false);
    expect('requiredProps' in entry).toBe(false);
    expect('canonicalSnippet' in entry).toBe(false);
  }
  expect(countDescribedComponents(map)).toBe(1);
});
