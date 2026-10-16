import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import {
  CANONICAL_DESIGN_INDEX_PATHS,
  type IndexedComponentRecord,
} from '../packages/design-indexer/src';

import {
  buildHtmlDesignSystemPreview,
  parseComponentClassNames,
  parsePreviewTokens,
  regenerateHtmlDesignSystemPreview,
  DESIGN_SYSTEM_PREVIEW_PATH,
} from '../services/api/src/html-design-system-preview';

const TOKENS_CSS = `:root {
  --color-brand: #14532d;
  --color-surface: #ffffff;
  --space-4: 16px;
  --radius-control: 8px;
  --font-sans: Inter, system-ui, sans-serif;
}

[data-theme="dark"] {
  --color-brand: #bbf7d0;
}
`;

const COMPONENTS_CSS = `.button {
  color: var(--color-brand);
  padding: var(--space-4);
}

.card {
  background: var(--color-surface);
}
`;

const DESIGN_MD = `# Acme Design System

## 1. Theme
Quiet enterprise dashboard.

## 2. Color
Use the brand tokens for primary actions.
`;

test('parsePreviewTokens extracts names, values, themes, and kinds', () => {
  const tokens = parsePreviewTokens(TOKENS_CSS);
  expect(tokens).toContainEqual({
    name: 'color-brand',
    value: '#14532d',
    theme: 'default',
    kind: 'color',
  });
  expect(tokens).toContainEqual({
    name: 'color-brand',
    value: '#bbf7d0',
    theme: 'dark',
    kind: 'color',
  });
  expect(tokens).toContainEqual({
    name: 'space-4',
    value: '16px',
    theme: 'default',
    kind: 'spacing',
  });
  expect(tokens).toContainEqual({
    name: 'radius-control',
    value: '8px',
    theme: 'default',
    kind: 'radius',
  });
  expect(tokens.find((token) => token.name === 'font-sans')?.kind).toBe('typography');
});

test('parseComponentClassNames returns declared classes', () => {
  expect(parseComponentClassNames(COMPONENTS_CSS).sort()).toEqual(['button', 'card']);
});

test('buildHtmlDesignSystemPreview is deterministic and lists real values', () => {
  const input = {
    projectName: 'acme-app',
    tokens: parsePreviewTokens(TOKENS_CSS),
    componentClasses: parseComponentClassNames(COMPONENTS_CSS),
    designMdSections: [{ label: 'Theme', body: 'Quiet enterprise dashboard.' }],
    usageExamples: [
      {
        className: 'button',
        snippet: '<button class="button">Go</button>',
        sourcePath: 'pages/deal.html',
      },
    ],
  };
  const first = buildHtmlDesignSystemPreview(input);
  const second = buildHtmlDesignSystemPreview(input);
  expect(first).toBe(second);
  expect(first).not.toMatch(/\d{4}-\d{2}-\d{2}T/u); // no timestamp
  expect(first).toContain('data-sd-screen-root');
  expect(first).toContain('data-sd-managed-design-system-preview');
  expect(first).toContain('Acme App Design System');
  expect(first).toContain('--color-brand');
  expect(first).toContain('#14532d');
  expect(first).toContain('.button');
  expect(first).toContain('pages/deal.html');
});

test('regenerateHtmlDesignSystemPreview rebuilds a stable file from sources', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-ds-preview-'));
  await mkdir(join(root, 'pages'), { recursive: true });
  await writeCanonicalSources(root);
  await writeFile(
    join(root, 'pages', 'deal.html'),
    '<main data-sd-screen-root><button class="button">Open deal</button></main>\n',
    'utf8',
  );

  const first = await regenerateHtmlDesignSystemPreview(root, 'Acme App');
  expect(first.changedFile).toBe(DESIGN_SYSTEM_PREVIEW_PATH);
  expect(first.tokenCount).toBeGreaterThan(0);
  expect(first.componentClassCount).toBe(2);

  const written = await readFile(join(root, DESIGN_SYSTEM_PREVIEW_PATH), 'utf8');
  expect(written).toContain('Acme App Design System');
  expect(written).toContain('Use the brand tokens for primary actions.');
  // Usage example from the page is captured (opening tag, HTML-escaped) with its source path.
  expect(written).toContain('&lt;button class=&quot;button&quot;&gt;');
  expect(written).toContain('pages/deal.html');

  // Deterministic: rebuilding without source changes yields an identical file.
  await regenerateHtmlDesignSystemPreview(root, 'Acme App');
  const second = await readFile(join(root, DESIGN_SYSTEM_PREVIEW_PATH), 'utf8');
  expect(second).toBe(written);
});

test('regenerateHtmlDesignSystemPreview restores Description for AI sections from sidecars by default', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-ds-preview-description-'));
  await writeCanonicalSources(root);
  await writeIndexedComponent(root, {
    id: 'css-catalog-button',
    title: 'Button',
    shortName: 'Button',
    filePath: 'design-system/components.css',
    source: 'css-catalog',
    storyCount: 0,
    stories: [],
    requiredClasses: ['button'],
    docsAnchor: 'button',
    tags: [],
    groupIds: [],
    noteCount: 0,
    confidence: 'high',
  });
  await mkdir(join(root, '.sber-designer', 'components'), { recursive: true });
  await writeFile(
    join(root, '.sber-designer', 'components', 'css-catalog-button.md'),
    [
      '# Button',
      '',
      '## Description for AI',
      '',
      '**Purpose:** Primary action trigger.',
      '**Use when:** submitting the main form',
      '**Required props:** `button`',
      '**Canonical usage:**',
      '```html',
      '<button class="button">Continue</button>',
      '```',
      '**Keywords:** button, action',
    ].join('\n'),
    'utf8',
  );

  const result = await regenerateHtmlDesignSystemPreview(root, 'Acme App');
  const written = await readFile(join(root, DESIGN_SYSTEM_PREVIEW_PATH), 'utf8');

  expect(result.descriptionSections).toMatchObject({
    keepDescriptions: true,
    restored: 1,
    changedFiles: [DESIGN_SYSTEM_PREVIEW_PATH],
  });
  expect(written).toContain('data-sd-description-for="button"');
  expect(written).toContain('Primary action trigger.');
  expect(written).toContain('&lt;button class=&quot;button&quot;&gt;Continue&lt;/button&gt;');
});

test('regenerateHtmlDesignSystemPreview can rebuild a clean preview without description sections', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-ds-preview-clean-'));
  await writeCanonicalSources(root);
  await writeIndexedComponent(root, {
    id: 'css-catalog-button',
    title: 'Button',
    shortName: 'Button',
    filePath: 'design-system/components.css',
    source: 'css-catalog',
    storyCount: 0,
    stories: [],
    requiredClasses: ['button'],
    docsAnchor: 'button',
    tags: [],
    groupIds: [],
    noteCount: 0,
    confidence: 'high',
  });
  await mkdir(join(root, '.sber-designer', 'components'), { recursive: true });
  await writeFile(
    join(root, '.sber-designer', 'components', 'css-catalog-button.md'),
    [
      '## Description for AI',
      '',
      '**Purpose:** Primary action trigger.',
      '**Canonical usage:**',
      '```html',
      '<button class="button">Continue</button>',
      '```',
    ].join('\n'),
    'utf8',
  );

  const result = await regenerateHtmlDesignSystemPreview(root, 'Acme App', {
    keepDescriptions: false,
  });
  const written = await readFile(join(root, DESIGN_SYSTEM_PREVIEW_PATH), 'utf8');

  expect(result.descriptionSections).toMatchObject({
    keepDescriptions: false,
    restored: 0,
    changedFiles: [],
  });
  expect(written).not.toContain('data-sd-description-for="button"');
  expect(written).not.toContain('Primary action trigger.');
});

test('regenerateHtmlDesignSystemPreview escapes source content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-ds-preview-escape-'));
  await mkdir(join(root, 'design-system'), { recursive: true });
  await writeFile(
    join(root, 'design-system', 'tokens.css'),
    ':root { --color-brand: #14532d; }\n',
    'utf8',
  );
  await writeFile(
    join(root, 'design-system', 'components.css'),
    '.button { color: var(--color-brand); }\n',
    'utf8',
  );
  await writeFile(
    join(root, 'design-system', 'Design.md'),
    '# DS\n\n## 1. Theme\nAvoid <script> tags & "quotes".\n',
    'utf8',
  );

  await regenerateHtmlDesignSystemPreview(root, 'Escape Test');
  const written = await readFile(join(root, DESIGN_SYSTEM_PREVIEW_PATH), 'utf8');
  expect(written).toContain('&lt;script&gt;');
  expect(written).not.toContain('<script>');
});

test('managed preview lists user reference pages without treating them as managed output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-ds-preview-refs-'));
  await writeCanonicalSources(root);
  await mkdir(join(root, 'design-system', 'refs'), { recursive: true });
  await writeFile(
    join(root, 'design-system', 'refs', 'buttons.html'),
    '<!doctype html><title>Button states</title><button class="button">Save</button>',
    'utf8',
  );

  const result = await regenerateHtmlDesignSystemPreview(root, 'Reference App');
  const written = await readFile(join(root, DESIGN_SYSTEM_PREVIEW_PATH), 'utf8');

  expect(result.referencePageCount).toBe(1);
  expect(written).toContain('Reference pages');
  expect(written).toContain('Button states');
  expect(written).toContain('./refs/buttons.html');
});

async function writeCanonicalSources(root: string): Promise<void> {
  await mkdir(join(root, 'design-system'), { recursive: true });
  await writeFile(join(root, 'design-system', 'tokens.css'), TOKENS_CSS, 'utf8');
  await writeFile(join(root, 'design-system', 'components.css'), COMPONENTS_CSS, 'utf8');
  await writeFile(join(root, 'design-system', 'Design.md'), DESIGN_MD, 'utf8');
}

async function writeIndexedComponent(
  root: string,
  component: IndexedComponentRecord,
): Promise<void> {
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    `${JSON.stringify(component)}\n`,
    'utf8',
  );
}
