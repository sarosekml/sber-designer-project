import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { applyOps } from '@sber-designer/ast-bridge';

test('set-style-prop creates and merges simple style object values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-ast-style-'));
  const source = [
    'export function Demo() {',
    '  return <button style={{ color: "red" }}>Save</button>;',
    '}',
    '',
  ].join('\n');
  await writeFile(join(root, 'Demo.tsx'), source, 'utf8');

  await applyOps({
    workspaceRoot: root,
    ops: [
      {
        kind: 'set-style-prop',
        file: 'Demo.tsx',
        loc: locOf(source, '<button'),
        name: 'backgroundColor',
        value: '"blue"',
      },
      {
        kind: 'set-style-prop',
        file: 'Demo.tsx',
        loc: locOf(source, '<button'),
        name: 'color',
        value: '"white"',
      },
    ],
  });

  const next = await readFile(join(root, 'Demo.tsx'), 'utf8');
  expect(next).toContain('backgroundColor: "blue"');
  expect(next).toContain('color: "white"');
});

test('remove-style-prop removes empty style prop', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-ast-style-remove-'));
  const source = [
    'export function Demo() {',
    '  return <button style={{ borderRadius: "8px" }}>Save</button>;',
    '}',
    '',
  ].join('\n');
  await writeFile(join(root, 'Demo.tsx'), source, 'utf8');

  await applyOps({
    workspaceRoot: root,
    ops: [
      {
        kind: 'remove-style-prop',
        file: 'Demo.tsx',
        loc: locOf(source, '<button'),
        name: 'borderRadius',
      },
    ],
  });

  const next = await readFile(join(root, 'Demo.tsx'), 'utf8');
  expect(next).not.toContain('style=');
});

test('set-class-name refuses expression className', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-ast-class-'));
  const source = [
    'export function Demo() {',
    '  return <button className={cn("a")}>Save</button>;',
    '}',
    '',
  ].join('\n');
  await writeFile(join(root, 'Demo.tsx'), source, 'utf8');

  await expect(
    applyOps({
      workspaceRoot: root,
      ops: [
        {
          kind: 'set-class-name',
          file: 'Demo.tsx',
          loc: locOf(source, '<button'),
          value: 'a b',
        },
      ],
    }),
  ).rejects.toThrow('expression-based className');
});

function locOf(source: string, needle: string): { line: number; column: number } {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`Missing ${needle}`);
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1]!.length + 1 };
}
