/**
 * 0083 Phase 3.1 — the CSF description writer: AST-merge the `Description for AI`
 * markdown into `meta.parameters.docs.description.component`, preserving the rest
 * of `parameters`, and decline (so the caller falls back to the sidecar) when the
 * meta/parameters are not a safe static object or hold project prose.
 *
 * The ok-cases round-trip through the real indexer reader to prove the written
 * source parses back to the authored description.
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { extractStorybookUsageMetadata } from '../packages/storybook-indexer/src';
import {
  applyDescriptionToCsfSource,
  type ApplyDescriptionReason,
} from '../services/api/src/storybook/description-source-write';

const PURPOSE = 'Primary action trigger.';
const MARKDOWN = [
  '## Description for AI',
  '',
  `**Purpose:** ${PURPOSE}`,
  '**Keywords:** button, action, cta',
].join('\n');

function apply(source: string) {
  return applyDescriptionToCsfSource({
    source,
    filePath: 'src/Button.stories.tsx',
    markdown: MARKDOWN,
  });
}

/** Write the new source to a temp workspace and read the layer back via the indexer. */
async function roundTripPurpose(newSource: string): Promise<string | undefined> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0083-write-'));
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src', 'Button.stories.tsx'), newSource);
  const meta = await extractStorybookUsageMetadata({
    workspaceRoot: root,
    importPath: 'src/Button.stories.tsx',
  });
  return meta.component?.descriptionLayer?.purpose;
}

// --- ok cases (write + round-trip) -----------------------------------------

test('inline `export default {} as Meta` with no parameters: creates the path', async () => {
  const source = [
    "import { Button } from './Button';",
    'export default {',
    "  title: 'Atoms/Button',",
    '  component: Button,',
    '} as Meta<typeof Button>;',
    'export const Default = {};',
  ].join('\n');

  const result = apply(source);
  expect(result.ok).toBe(true);
  expect(result.newSource).toContain('Description for AI');
  expect(await roundTripPurpose(result.newSource!)).toBe(PURPOSE);
});

test('named `const meta = {} satisfies Meta; export default meta`: creates the path', async () => {
  const source = [
    "import { Button } from './Button';",
    'const meta = {',
    "  title: 'Atoms/Button',",
    '  component: Button,',
    '} satisfies Meta<typeof Button>;',
    'export default meta;',
  ].join('\n');

  const result = apply(source);
  expect(result.ok).toBe(true);
  expect(await roundTripPurpose(result.newSource!)).toBe(PURPOSE);
});

test('existing parameters (controls/backgrounds) are preserved on merge', async () => {
  const source = [
    "import { Button } from './Button';",
    'export default {',
    "  title: 'Atoms/Button',",
    '  component: Button,',
    '  parameters: {',
    '    controls: { expanded: true },',
    "    backgrounds: { default: 'light' },",
    '  },',
    '} as Meta<typeof Button>;',
  ].join('\n');

  const result = apply(source);
  expect(result.ok).toBe(true);
  // siblings kept
  expect(result.newSource).toContain('controls');
  expect(result.newSource).toContain('backgrounds');
  expect(result.newSource).toContain('Description for AI');
  expect(await roundTripPurpose(result.newSource!)).toBe(PURPOSE);
});

test('existing docs.toc is preserved, description.component added', async () => {
  const source = [
    'export default {',
    "  title: 'Atoms/Button',",
    '  parameters: { docs: { toc: true } },',
    '} as Meta;',
  ].join('\n');

  const result = apply(source);
  expect(result.ok).toBe(true);
  expect(result.newSource).toContain('toc');
  expect(await roundTripPurpose(result.newSource!)).toBe(PURPOSE);
});

test('an existing Description-for-AI component is overwritten (re-authoring)', async () => {
  const literal = JSON.stringify('## Description for AI\n\n**Purpose:** Old purpose.');
  const source = [
    'export default {',
    "  title: 'Atoms/Button',",
    `  parameters: { docs: { description: { component: ${literal} } } },`,
    '} as Meta;',
  ].join('\n');

  const result = apply(source);
  expect(result.ok).toBe(true);
  expect(result.newSource).not.toContain('Old purpose.');
  expect(await roundTripPurpose(result.newSource!)).toBe(PURPOSE);
});

test('R2: preserves human prose before/after the section, replaces only the AI section', async () => {
  const literal = JSON.stringify(
    [
      'Human-facing overview written by the design-system team.',
      '',
      '## Description for AI',
      '',
      '**Purpose:** Old purpose.',
      '',
      '## Accessibility',
      '',
      'Keyboard notes from the team.',
    ].join('\n'),
  );
  const source = [
    'export default {',
    "  title: 'Atoms/Button',",
    `  parameters: { docs: { description: { component: ${literal} } } },`,
    '} as Meta;',
  ].join('\n');

  const result = apply(source);
  expect(result.ok).toBe(true);
  expect(result.newSource).toContain('Human-facing overview written by the design-system team.');
  expect(result.newSource).toContain('## Accessibility');
  expect(result.newSource).toContain('Keyboard notes from the team.');
  expect(result.newSource).not.toContain('Old purpose.'); // AI section replaced
  expect(await roundTripPurpose(result.newSource!)).toBe(PURPOSE);
});

// --- fallback cases (decline, caller writes the sidecar) --------------------

function expectFallback(source: string, reason: ApplyDescriptionReason) {
  const result = apply(source);
  expect(result.ok).toBe(false);
  expect(result.reason).toBe(reason);
  expect(result.newSource).toBeUndefined();
}

test('declines when component holds project prose (no Description for AI section)', () => {
  const literal = JSON.stringify('A plain hand-written component description.');
  expectFallback(
    [
      'export default {',
      "  title: 'Atoms/Button',",
      `  parameters: { docs: { description: { component: ${literal} } } },`,
      '} as Meta;',
    ].join('\n'),
    'component_has_project_prose',
  );
});

test('R2: declines when the section is followed by un-headed free prose (cannot isolate)', () => {
  const literal = JSON.stringify(
    ['## Description for AI', '', '**Purpose:** Old.', '', 'Free trailing human note.'].join('\n'),
  );
  expectFallback(
    [
      'export default {',
      "  title: 'Atoms/Button',",
      `  parameters: { docs: { description: { component: ${literal} } } },`,
      '} as Meta;',
    ].join('\n'),
    'component_has_project_prose',
  );
});

test('declines when parameters is a spread/helper call, not a plain object', () => {
  expectFallback(
    [
      "import { describeComponent, buttonDescription } from '../storybook/descriptions';",
      'export default {',
      "  title: 'Atoms/Button',",
      '  parameters: describeComponent(buttonDescription),',
      '} as Meta;',
    ].join('\n'),
    'parameters_not_object',
  );
});

test('declines when component value is a non-literal expression', () => {
  expectFallback(
    [
      "import { description } from './desc';",
      'export default {',
      "  title: 'Atoms/Button',",
      '  parameters: { docs: { description: { component: description } } },',
      '} as Meta;',
    ].join('\n'),
    'component_dynamic',
  );
});

test('declines when the default export is not a static object (dynamic meta)', () => {
  expectFallback(
    ["import { makeMeta } from './meta';", 'export default makeMeta();'].join('\n'),
    'meta_not_static_object',
  );
});
