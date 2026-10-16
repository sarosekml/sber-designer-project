import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  inferCapabilities,
  unmappedCapabilities,
} from '../services/api/src/design-inspector-capabilities';
import {
  parseLoc,
  resolveTarget,
  toWorkspaceRelativePath,
} from '../services/api/src/design-inspector-source';

test('design inspector capability module infers operation-level editability', () => {
  const capabilities = inferCapabilities({
    children: { text: 'Save', editable: true },
    props: [{ name: 'aria-label', value: 'Save', kind: 'string', editable: true }],
    styles: {
      className: 'primary',
      classNameEditable: true,
      styleEditable: false,
      styleReason: 'Complex style expression is read-only.',
    },
    selfClosing: false,
  });

  expect(capabilities.text).toMatchObject({
    status: 'editable',
    operations: ['set-children-text'],
  });
  expect(capabilities.props.operations).toContain('set-prop');
  expect(capabilities.className.operations).toContain('set-class-token');
  expect(capabilities.style).toMatchObject({
    status: 'assistant-only',
    reason: 'Complex style expression is read-only.',
  });

  const unmapped = unmappedCapabilities('No source location.');
  expect(unmapped.text.status).toBe('unmapped');
  expect(unmapped.className.reason).toBe('No source location.');
});

test('design inspector source module resolves safe workspace targets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-design-source-module-'));
  const absoluteFile = join(root, 'src/App.tsx');

  expect(parseLoc('src/App.tsx:12:7')).toEqual({
    file: 'src/App.tsx',
    line: 12,
    column: 7,
  });
  expect(parseLoc('dom://main > button')).toBeNull();
  expect(toWorkspaceRelativePath(root, absoluteFile)).toBe('src/App.tsx');

  const target = resolveTarget(root, {
    loc: `${absoluteFile}:12:7`,
    sourceKind: 'react-source',
    tagName: 'BUTTON',
    selector: 'button.primary',
    text: 'Save',
    rect: { x: 1, y: 2, width: 120, height: 32 },
  });

  expect(target.filePath).toBe('src/App.tsx');
  expect(target.line).toBe(12);
  expect(target.column).toBe(7);
  expect(target.selector).toBe('button.primary');
});
