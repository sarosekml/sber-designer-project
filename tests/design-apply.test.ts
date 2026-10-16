import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { applyDesignChanges, findDesignApplyRunConflict } from '../services/api/src/design-apply';
import { resolveTarget } from '../services/api/src/design-inspector';

test('applies visual text and style changes as one AST batch with diffs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-apply-'));
  const source = [
    'export function Demo() {',
    '  return <button style={{ backgroundColor: "green" }}>Add note</button>;',
    '}',
    '',
  ].join('\n');
  await writeFile(join(root, 'Demo.tsx'), source, 'utf8');
  const loc = locOf(source, '<button');
  const target = resolveTarget(root, {
    loc: `Demo.tsx:${loc.line}:${loc.column}`,
    sourceKind: 'react-source',
    tagName: 'BUTTON',
    rect: { x: 0, y: 0, width: 100, height: 32 },
  });

  const result = await applyDesignChanges({
    workspaceRoot: root,
    target,
    changes: [
      {
        kind: 'set-children-text',
        targetId: target.id,
        filePath: 'Demo.tsx',
        loc,
        text: 'Create note',
        label: 'Text content',
      },
      {
        kind: 'set-style',
        targetId: target.id,
        filePath: 'Demo.tsx',
        loc,
        property: 'borderRadius',
        value: '12px',
        label: 'Radius',
      },
    ],
    baseline: { filePath: 'Demo.tsx', hash: sha256(source) },
  });

  expect(result.changedFiles).toEqual(['Demo.tsx']);
  expect(result.diffs[0]?.before).toBe(source);
  expect(result.diffs[0]?.after).toContain('Create note');
  expect(result.diffs[0]?.after).toContain('borderRadius: "12px"');
  expect(result.baselines).toEqual([
    { filePath: 'Demo.tsx', hash: sha256(result.diffs[0]!.after) },
  ]);
});

test('setting component label expands a self-closing usage', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-apply-children-'));
  const source = 'export function Demo() { return <ActionButton size="sm" />; }\n';
  await writeFile(join(root, 'Demo.tsx'), source, 'utf8');
  const loc = locOf(source, '<ActionButton');
  const target = resolveTarget(root, {
    loc: `Demo.tsx:${loc.line}:${loc.column}`,
    sourceKind: 'react-source',
    tagName: 'ActionButton',
    rect: { x: 0, y: 0, width: 100, height: 32 },
  });

  const result = await applyDesignChanges({
    workspaceRoot: root,
    target,
    changes: [
      {
        kind: 'set-children-text',
        targetId: target.id,
        filePath: 'Demo.tsx',
        loc,
        text: 'Send',
        label: 'ActionButton.children',
      },
    ],
  });

  expect(result.diffs[0]?.after).toContain('<ActionButton size="sm">Send</ActionButton>');
});

test('blocks a visual write reserved by an active assistant run', () => {
  const conflict = findDesignApplyRunConflict({
    activeRuns: [
      {
        clientRunId: 'client-run',
        sessionId: 'session',
        screenId: 'screen-a',
        provider: 'mock',
        model: 'mock',
        status: 'running',
        startedAt: 1,
        updatedAt: 1,
        targetPaths: ['src/screens/**'],
      },
    ],
    screenId: 'screen-b',
    changedFiles: ['src/screens/Demo.tsx'],
  });

  expect(conflict?.clientRunId).toBe('client-run');
});

test('detects stale visual draft baseline before writing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-apply-conflict-'));
  const source = ['export function Demo() {', '  return <button>Add note</button>;', '}', ''].join(
    '\n',
  );
  await writeFile(join(root, 'Demo.tsx'), source, 'utf8');
  const loc = locOf(source, '<button');
  const target = resolveTarget(root, {
    loc: `Demo.tsx:${loc.line}:${loc.column}`,
    sourceKind: 'react-source',
    tagName: 'BUTTON',
    rect: { x: 0, y: 0, width: 100, height: 32 },
  });
  await writeFile(join(root, 'Demo.tsx'), source.replace('Add note', 'Changed elsewhere'), 'utf8');

  await expect(
    applyDesignChanges({
      workspaceRoot: root,
      target,
      changes: [
        {
          kind: 'set-children-text',
          targetId: target.id,
          filePath: 'Demo.tsx',
          loc,
          text: 'Create note',
          label: 'Text content',
        },
      ],
      baseline: { filePath: 'Demo.tsx', hash: sha256(source) },
    }),
  ).rejects.toThrow('Source changed');

  const next = await readFile(join(root, 'Demo.tsx'), 'utf8');
  expect(next).toContain('Changed elsewhere');
});

test('rejects a baseline from a different file than the visual changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-apply-baseline-scope-'));
  const source = 'export function Demo() { return <button>Save</button>; }\n';
  await writeFile(join(root, 'Demo.tsx'), source, 'utf8');
  await writeFile(join(root, 'Other.tsx'), source, 'utf8');
  const loc = locOf(source, '<button');
  const target = resolveTarget(root, {
    loc: `Demo.tsx:${loc.line}:${loc.column}`,
    sourceKind: 'react-source',
    tagName: 'BUTTON',
    rect: { x: 0, y: 0, width: 100, height: 32 },
  });

  await expect(
    applyDesignChanges({
      workspaceRoot: root,
      target,
      changes: [
        {
          kind: 'set-children-text',
          targetId: target.id,
          filePath: 'Demo.tsx',
          loc,
          text: 'Send',
          label: 'Text content',
        },
      ],
      baseline: { filePath: 'Other.tsx', hash: sha256(source) },
    }),
  ).rejects.toThrow('must guard every changed source file');
});

function locOf(source: string, needle: string): { line: number; column: number } {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`Missing ${needle}`);
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1]!.length + 1 };
}

function sha256(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}
