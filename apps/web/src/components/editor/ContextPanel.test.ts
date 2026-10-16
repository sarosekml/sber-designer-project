import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const sourcePath = 'apps/web/src/components/editor/ContextPanel.tsx';

test('context panel constrains screen component cards to the resized right panel', async () => {
  const source = await readFile(sourcePath, 'utf8');

  expect(source).toContain(
    '<aside className="flex min-h-0 min-w-0 flex-col border-l border-border bg-sidebar">',
  );
  expect(source).toContain(
    '<div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3">',
  );
  expect(source).toContain('<ul className="grid min-w-0 gap-1.5">');
  expect(source).toContain(
    '<li className="min-w-0 overflow-hidden rounded-md border border-border bg-card px-3 py-2 text-xs">',
  );
  expect(source).toContain('<div className="flex min-w-0 items-baseline justify-between gap-2">');
  expect(source).toContain('<span className="min-w-0 truncate font-medium">');
  expect(source).toContain(
    '<span className="min-w-0 truncate text-right text-[10px] text-muted-foreground">',
  );
});
