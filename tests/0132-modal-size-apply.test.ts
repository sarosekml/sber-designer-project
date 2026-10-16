/**
 * 0132.3 — managed modal-size apply across profiles (Р-17). Deterministic HTML
 * rewrite + JSX ops (ast-bridge unwrapping the `as React.CSSProperties` cast),
 * baseline conflict, and the unmanaged/ambiguous guards.
 */
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { locateJsxAttributeElements } from '@sber-designer/ast-bridge';

import {
  buildBlankModalHtml,
  buildBlankModalReactImplementation,
} from '../apps/web/src/lib/modal-scaffold';
import { applyModalSize, readModalSizeBaseline } from '../services/api/src/modal-size-apply';

async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-modal-apply-'));
  await mkdir(join(root, 'pages'), { recursive: true });
  await mkdir(join(root, 'src'), { recursive: true });
  return root;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

test('locateJsxAttributeElements finds the single modal window element', () => {
  const tsx = buildBlankModalReactImplementation({
    name: 'Confirm',
    componentName: 'Confirm',
    defaults: { width: '560px', height: 'auto', longContent: 'scroll' },
  });
  const locs = locateJsxAttributeElements(tsx, 'data-sd-modal-window');
  expect(locs).toHaveLength(1);
  expect(locs[0]?.line).toBeGreaterThan(0);
  expect(locateJsxAttributeElements('<div>no marker</div>', 'data-sd-modal-window')).toHaveLength(
    0,
  );
});

test('applyModalSize rewrites an HTML modal deterministically', async () => {
  const root = await workspace();
  const html = buildBlankModalHtml({
    name: 'Confirm',
    defaults: { width: '640px', height: 'auto', longContent: 'scroll' },
  });
  await writeFile(join(root, 'pages', 'confirm.html'), html, 'utf8');

  const result = await applyModalSize({
    workspaceRoot: root,
    filePath: 'pages/confirm.html',
    patch: { width: '300px', longContent: 'grow' },
  });
  expect(result.ok).toBe(true);

  const after = await readFile(join(root, 'pages', 'confirm.html'), 'utf8');
  expect(after).toContain('--sd-modal-width: 300px');
  expect(after).toContain('data-sd-modal-content="grow"');
});

test('applyModalSize edits a React modal through the as-cast style object (риск №16)', async () => {
  const root = await workspace();
  const tsx = buildBlankModalReactImplementation({
    name: 'Confirm',
    componentName: 'Confirm',
    defaults: { width: '560px', height: 'auto', longContent: 'scroll' },
  });
  await writeFile(join(root, 'src', 'Confirm.tsx'), tsx, 'utf8');

  const result = await applyModalSize({
    workspaceRoot: root,
    filePath: 'src/Confirm.tsx',
    patch: { width: '300px', longContent: 'grow' },
  });
  expect(result.ok).toBe(true);

  const after = await readFile(join(root, 'src', 'Confirm.tsx'), 'utf8');
  expect(after).toContain('"--sd-modal-width": "300px"');
  expect(after).toContain('data-sd-modal-content="grow"');
  // The cast survived — the edit went into the object, not around it.
  expect(after).toContain('as React.CSSProperties');
});

test('applyModalSize enforces the baseline hash (409)', async () => {
  const root = await workspace();
  const html = buildBlankModalHtml({ name: 'Confirm' });
  await writeFile(join(root, 'pages', 'confirm.html'), html, 'utf8');

  await expect(
    applyModalSize({
      workspaceRoot: root,
      filePath: 'pages/confirm.html',
      patch: { width: '300px' },
      baseline: { hash: sha256('stale contents') },
    }),
  ).rejects.toMatchObject({ status: 409, code: 'modal_size_conflict' });
});

test('managed modal draft reads the source hash used by apply conflict detection', async () => {
  const root = await workspace();
  const html = buildBlankModalHtml({ name: 'Confirm' });
  await writeFile(join(root, 'pages', 'confirm.html'), html, 'utf8');

  expect(
    await readModalSizeBaseline({
      workspaceRoot: root,
      filePath: 'pages/confirm.html',
    }),
  ).toEqual({
    filePath: 'pages/confirm.html',
    hash: sha256(html),
  });
});

test('applyModalSize reports an unmanaged screen with no window marker', async () => {
  const root = await workspace();
  await writeFile(
    join(root, 'pages', 'plain.html'),
    '<!doctype html><body data-sd-screen-root><main>plain</main></body>',
    'utf8',
  );
  await expect(
    applyModalSize({
      workspaceRoot: root,
      filePath: 'pages/plain.html',
      patch: { width: '300px' },
    }),
  ).rejects.toMatchObject({ status: 422, code: 'modal_size_unmanaged' });
});

test('applyModalSize rejects an invalid value', async () => {
  const root = await workspace();
  await writeFile(join(root, 'pages', 'confirm.html'), buildBlankModalHtml({ name: 'C' }), 'utf8');
  await expect(
    applyModalSize({
      workspaceRoot: root,
      filePath: 'pages/confirm.html',
      patch: { width: 'calc(100%)' },
    }),
  ).rejects.toMatchObject({ status: 422, code: 'modal_size_invalid' });
});
