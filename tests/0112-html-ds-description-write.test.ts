import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import type {
  ComponentDescriptionLayer,
  IndexedComponentRecord,
} from '../packages/design-indexer/src';
import {
  restoreHtmlDesignSystemDescriptionSections,
  writeHtmlDesignSystemDescription,
} from '../services/api/src/html-design-system-description-write';

test('writeHtmlDesignSystemDescription merges a round-trippable section after the component demo', async () => {
  const root = await createHtmlDesignSystemWorkspace();
  const result = await writeHtmlDesignSystemDescription({
    workspacePath: root,
    component: cssComponent(),
    layer: layer(),
  });

  expect(result).toMatchObject({
    written: true,
    filePath: 'design-system/index.html',
    block: 'primary-action',
  });
  expect(result.roundTripFields).toContain('purpose');
  expect(result.roundTripFields).toContain('variantGuidance');

  const html = await readFile(join(root, 'design-system/index.html'), 'utf8');
  expect(html).toContain('<button class="primary-action primary-action--danger"');
  expect(html).toContain('<section data-sd-description-for="primary-action">');
  expect(html.indexOf('<button class="primary-action')).toBeLessThan(
    html.indexOf('<section data-sd-description-for="primary-action">'),
  );
  expect(html).toContain('Primary call-to-action button for static HTML pages.');
  expect(html).toContain('primary-action--danger');
});

test('writeHtmlDesignSystemDescription updates existing sections that contain JS replacement tokens', async () => {
  const root = await createHtmlDesignSystemWorkspace();
  const first = layer({
    purpose: 'Primary action costs $& and keeps $1 literal tokens.',
    keywords: ['money', '$&', '$1'],
  });
  const inserted = await writeHtmlDesignSystemDescription({
    workspacePath: root,
    component: cssComponent(),
    layer: first,
  });
  expect(inserted.written).toBe(true);

  const second = layer({
    purpose: 'Updated copy still says $& and $1 literally.',
    keywords: ['updated', '$&', '$1'],
  });
  const updated = await writeHtmlDesignSystemDescription({
    workspacePath: root,
    component: cssComponent(),
    layer: second,
  });

  expect(updated.written).toBe(true);
  expect(updated).not.toHaveProperty('reason');
  const html = await readFile(join(root, 'design-system/index.html'), 'utf8');
  expect(html).toContain('Updated copy still says $&amp; and $1 literally.');
  expect(html).not.toContain('Primary action costs');
});

test('restoreHtmlDesignSystemDescriptionSections restores sections from canonical layers', async () => {
  const root = await createHtmlDesignSystemWorkspace();
  await writeHtmlDesignSystemDescription({
    workspacePath: root,
    component: cssComponent(),
    layer: layer(),
  });
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

  const result = await restoreHtmlDesignSystemDescriptionSections({
    workspacePath: root,
    components: [cssComponent()],
    layers: { 'css-catalog-primary-action': layer() },
  });

  expect(result.restored).toBe(1);
  expect(result.changedFiles).toEqual(['design-system/index.html']);
  const html = await readFile(join(root, 'design-system/index.html'), 'utf8');
  expect(html).toContain('<section data-sd-description-for="primary-action">');
  expect(html).toContain('Primary call-to-action button for static HTML pages.');
});

test('restoreHtmlDesignSystemDescriptionSections counts only sections that changed', async () => {
  const root = await createTwoComponentHtmlDesignSystemWorkspace();
  const primary = cssComponent();
  const secondary = cssComponent({
    id: 'css-catalog-secondary-action',
    title: 'CSS/SecondaryAction',
    shortName: 'SecondaryAction',
    requiredClasses: ['secondary-action'],
    docsAnchor: 'secondary-action',
  });
  await writeHtmlDesignSystemDescription({
    workspacePath: root,
    component: primary,
    layer: layer({ purpose: 'Old primary description.' }),
  });
  const secondaryLayer = layer({ purpose: 'Secondary description stays current.' });
  await writeHtmlDesignSystemDescription({
    workspacePath: root,
    component: secondary,
    layer: secondaryLayer,
  });

  const result = await restoreHtmlDesignSystemDescriptionSections({
    workspacePath: root,
    components: [primary, secondary],
    layers: {
      [primary.id]: layer({ purpose: 'New primary description.' }),
      [secondary.id]: secondaryLayer,
    },
  });

  expect(result.restored).toBe(1);
  expect(result.changedFiles).toEqual(['design-system/index.html']);
});

test('writeHtmlDesignSystemDescription anchors by exact class token, not class substring', async () => {
  const root = await createCardHtmlDesignSystemWorkspace();
  const result = await writeHtmlDesignSystemDescription({
    workspacePath: root,
    component: cssComponent({
      id: 'css-catalog-card',
      title: 'CSS/Card',
      shortName: 'Card',
      requiredClasses: ['card'],
      docsAnchor: 'card',
    }),
    layer: layer({ purpose: 'Reusable content card.' }),
  });

  expect(result.written).toBe(true);
  const html = await readFile(join(root, 'design-system/index.html'), 'utf8');
  expect(html.indexOf('<article class="card"')).toBeLessThan(
    html.indexOf('<section data-sd-description-for="card">'),
  );
  expect(html.indexOf('<div class="card-header"')).toBeLessThan(
    html.indexOf('<article class="card"'),
  );
});

async function createHtmlDesignSystemWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0112-html-ds-write-'));
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
  return root;
}

async function createTwoComponentHtmlDesignSystemWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0112-html-ds-restore-'));
  await mkdir(join(root, 'design-system'), { recursive: true });
  await writeFile(
    join(root, 'design-system/index.html'),
    [
      '<!doctype html>',
      '<main>',
      '  <button class="primary-action primary-action--danger" type="button">Delete item</button>',
      '  <button class="secondary-action" type="button">Cancel</button>',
      '</main>',
      '',
    ].join('\n'),
    'utf8',
  );
  return root;
}

async function createCardHtmlDesignSystemWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0112-html-ds-card-'));
  await mkdir(join(root, 'design-system'), { recursive: true });
  await writeFile(
    join(root, 'design-system/index.html'),
    [
      '<!doctype html>',
      '<main>',
      '  <div class="card-header">Header should not be the anchor</div>',
      '  <article class="card">Card body</article>',
      '</main>',
      '',
    ].join('\n'),
    'utf8',
  );
  return root;
}

function cssComponent(overrides: Partial<IndexedComponentRecord> = {}): IndexedComponentRecord {
  return {
    id: 'css-catalog-primary-action',
    title: 'CSS/PrimaryAction',
    shortName: 'PrimaryAction',
    filePath: 'site/styles.css',
    source: 'css-catalog',
    storyCount: 0,
    stories: [],
    requiredClasses: ['primary-action'],
    modifiers: ['primary-action--danger'],
    canonicalHtml:
      '<button class="primary-action primary-action--danger" type="button">Delete item</button>',
    docsAnchor: 'primary-action',
    tags: ['css-catalog', 'primary-action'],
    groupIds: [],
    noteCount: 0,
    confidence: 'high',
    ...overrides,
  };
}

function layer(overrides: Partial<ComponentDescriptionLayer> = {}): ComponentDescriptionLayer {
  return {
    purpose: 'Primary call-to-action button for static HTML pages.',
    whenToUse: ['destructive action', 'form submit'],
    variantGuidance: [
      {
        prop: 'modifier',
        values: [{ value: 'primary-action--danger', meaning: 'destructive action state' }],
      },
    ],
    requiredProps: ['primary-action'],
    canonicalSnippets: [
      {
        label: 'Primary action button',
        code: '<button class="primary-action primary-action--danger" type="button">Delete item</button>',
      },
    ],
    keywords: ['action', 'button', 'destructive'],
    anatomy: [],
    usage: [],
    agentGuidance: [],
    schemaVersion: 1,
    status: 'confirmed',
    updatedAt: '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}
