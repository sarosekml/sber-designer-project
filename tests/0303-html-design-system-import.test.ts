import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  HTML_DESIGN_SYSTEM_IMPORT_MAX_FILE_BYTES,
  classifyHtmlDesignSystemImportFileName,
} from '@sber-designer/shared-types';
import { importHtmlDesignSystemFiles } from '../services/api/src/html-design-system-import';

test('0303 import classifier routes canonical sources, references, and assets', () => {
  expect(classifyHtmlDesignSystemImportFileName('Design.md')).toEqual({
    kind: 'source',
    canonicalPath: 'design-system/Design.md',
  });
  expect(classifyHtmlDesignSystemImportFileName('tokens.css')).toEqual({
    kind: 'source',
    canonicalPath: 'design-system/tokens.css',
  });
  expect(classifyHtmlDesignSystemImportFileName('example.html')).toEqual({ kind: 'reference' });
  expect(classifyHtmlDesignSystemImportFileName('logo.svg')).toEqual({ kind: 'asset' });
  expect(classifyHtmlDesignSystemImportFileName('notes.txt')).toBeNull();
});

test('0303 file import preserves collisions, refreshes preview, and reindexes once', async () => {
  const workspace = await createImportWorkspace('success');
  await mkdir(join(workspace, 'design-system', 'refs'), { recursive: true });
  await writeFile(
    join(workspace, 'design-system', 'refs', 'card.html'),
    '<article>Existing</article>',
    'utf8',
  );

  const result = await importHtmlDesignSystemFiles({
    workspacePath: workspace,
    projectName: 'Import project',
    files: [
      textCandidate('tokens.css', ':root { --brand: #2563eb; }'),
      textCandidate('card.html', '<article class="card">Imported</article>'),
      binaryCandidate('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      textCandidate('notes.txt', 'not supported'),
      textCandidate('TOKENS.CSS', ':root { --duplicate: true; }'),
    ],
  });

  expect(result.imported).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ targetPath: 'design-system/tokens.css', kind: 'source' }),
      expect.objectContaining({ targetPath: 'design-system/refs/card-2.html', renamed: true }),
      expect.objectContaining({ targetPath: 'design-system/assets/logo.svg', kind: 'asset' }),
    ]),
  );
  expect(result.skipped).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'notes.txt', reason: 'unsupported' }),
      expect.objectContaining({ name: 'TOKENS.CSS', reason: 'source-exists' }),
    ]),
  );
  expect(result.reindexJobId).toBeString();
  expect(await readFile(join(workspace, 'design-system', 'refs', 'card.html'), 'utf8')).toContain(
    'Existing',
  );
  expect(await readFile(join(workspace, 'design-system', 'refs', 'card-2.html'), 'utf8')).toContain(
    'Imported',
  );
  expect(await readFile(join(workspace, 'design-system', 'index.html'), 'utf8')).toContain(
    'data-sd-managed-design-system-preview',
  );
});

test('0303 import rejects unsafe batches and a user-owned preview before writes', async () => {
  const workspace = await createImportWorkspace('guard');
  await mkdir(join(workspace, 'design-system'), { recursive: true });
  await writeFile(
    join(workspace, 'design-system', 'index.html'),
    '<!doctype html><main>User preview</main>',
    'utf8',
  );

  await expect(
    importHtmlDesignSystemFiles({
      workspacePath: workspace,
      projectName: 'Guard project',
      files: [textCandidate('tokens.css', ':root {}')],
    }),
  ).rejects.toThrow(/user-owned/u);
  expect(await readFile(join(workspace, 'design-system', 'index.html'), 'utf8')).toContain(
    'User preview',
  );

  const oversizedWorkspace = await createImportWorkspace('oversized');
  await expect(
    importHtmlDesignSystemFiles({
      workspacePath: oversizedWorkspace,
      projectName: 'Oversized project',
      files: [
        {
          name: 'hero.png',
          mimeType: 'image/png',
          bytes: new Uint8Array(HTML_DESIGN_SYSTEM_IMPORT_MAX_FILE_BYTES + 1),
        },
      ],
    }),
  ).resolves.toMatchObject({
    imported: [],
    skipped: [expect.objectContaining({ name: 'hero.png', reason: 'too-large' })],
    reindexJobId: null,
  });
});

test('0303 import treats canonical source names case-insensitively on every filesystem', async () => {
  const workspace = await createImportWorkspace('source-case');
  await mkdir(join(workspace, 'design-system'), { recursive: true });
  await writeFile(join(workspace, 'design-system', 'TOKENS.CSS'), ':root { --existing: 1; }');

  const result = await importHtmlDesignSystemFiles({
    workspacePath: workspace,
    projectName: 'Case project',
    files: [textCandidate('tokens.css', ':root { --new: 1; }')],
  });

  expect(result).toMatchObject({
    imported: [],
    skipped: [expect.objectContaining({ reason: 'source-exists' })],
    reindexJobId: null,
  });
});

test('0303 import rolls back copied files when managed preview finalization fails', async () => {
  const workspace = await createImportWorkspace('rollback');
  await mkdir(join(workspace, 'design-system', 'index.html'), { recursive: true });

  await expect(
    importHtmlDesignSystemFiles({
      workspacePath: workspace,
      projectName: 'Rollback project',
      files: [textCandidate('tokens.css', ':root { --temporary: 1; }')],
    }),
  ).rejects.toThrow();
  await expect(readFile(join(workspace, 'design-system', 'tokens.css'), 'utf8')).rejects.toThrow();
});

async function createImportWorkspace(label: string): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), `sd-0303-import-${label}-`));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  await writeFile(
    join(workspace, '.sber-designer', 'project.sdproj'),
    JSON.stringify({
      version: 1,
      name: label,
      workspacePath: workspace,
      projectKind: 'html-first',
      screens: [],
      flow: [],
    }),
    'utf8',
  );
  return workspace;
}

function textCandidate(name: string, contents: string) {
  return { name, mimeType: 'text/plain', bytes: new TextEncoder().encode(contents) };
}

function binaryCandidate(name: string, contents: string) {
  return { name, mimeType: 'application/octet-stream', bytes: new TextEncoder().encode(contents) };
}
