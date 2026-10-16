import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const handoffPath = 'apps/web/src/components/editor/HandoffMenu.tsx';

test('handoff menu exposes open, path-copy and CLI-copy surfaces', async () => {
  const source = await readFile(handoffPath, 'utf8');

  expect(source).toContain('fetchHostApps(controller.signal)');
  expect(source).toContain('openProjectInHostApp(app.id)');
  expect(source).toContain('writePreferredHostApp(app.id)');
  expect(source).toContain('Open with editor');
  expect(source).toContain('Copy for CLI');
  expect(source).toContain("copyText('path', workspacePath)");
  expect(source).toContain('buildCliHandoffPrompt({');
  expect(source).toContain('Any coding agent');
});

test('unavailable applications stay visible and clickable for probe false-negatives', async () => {
  const source = await readFile(handoffPath, 'utf8');

  expect(source).toContain('label="Not installed"');
  expect(source).toContain("className={dimmed ? 'opacity-60' : undefined}");
  expect(source).toContain('void onLaunch(app);');
  expect(source).not.toContain('disabled={dimmed}');
});

test('handoff control matches the panel visibility control dimensions', async () => {
  const source = await readFile(handoffPath, 'utf8');

  expect(source).toContain(
    'className="inline-flex rounded-md border border-border bg-background p-0.5"',
  );
  expect(source.match(/size="icon-sm"/gu)).toHaveLength(3);
  expect(
    source.match(
      /className="h-6 w-6 rounded-\[5px\] text-muted-foreground hover:text-accent-foreground"/gu,
    ),
  ).toHaveLength(2);
  expect(source).not.toContain('className="rounded-l-none px-1.5"');
  expect(source).not.toContain('className="rounded-r-none border-r-0 px-2"');
});
