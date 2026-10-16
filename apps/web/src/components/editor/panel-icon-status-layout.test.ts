import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const screensPanelPath = 'apps/web/src/components/editor/ScreensPanel.tsx';
const screenRowPath = 'apps/web/src/components/editor/screens/ScreenRow.tsx';
const componentsPanelPath = 'apps/web/src/components/editor/ComponentsPanel.tsx';

test('screen and component rows keep panel headers without a permanent screen icon', async () => {
  const screensPanel = await readFile(screensPanelPath, 'utf8');
  const screenRow = await readFile(screenRowPath, 'utf8');
  const componentsPanel = await readFile(componentsPanelPath, 'utf8');

  expect(screensPanel).toContain('<Layers className="size-3.5 text-primary" />');
  expect(screensPanel).toContain('<Folder className="size-3 shrink-0 text-primary" />');
  // 0138 A1: screen names start on the shared 28px child axis with no
  // permanent decorative icon before them; the same constants drive the
  // dropdown so the two axes cannot drift apart again.
  expect(screenRow).not.toContain('<Frame');
  expect(screenRow).toContain('SCREEN_TREE_CHILD_INDENT_IN_ROW');
  expect(screenRow).toContain('SCREEN_TREE_NAME_SLOT');

  expect(componentsPanel).toContain('<BookOpen className="size-3.5 shrink-0 text-primary" />');
  expect(componentsPanel).toContain('Component,');
  expect(componentsPanel).toContain(
    '<Component className="size-3.5 shrink-0 text-muted-foreground" />',
  );
});

test('dropdown screen rows share the panel indent and keep metadata off the leading axis', async () => {
  const dropdown = await readFile(
    'apps/web/src/components/editor/CanvasNavigationStrip.tsx',
    'utf8',
  );

  expect(dropdown).toContain('SCREEN_TREE_CHILD_INDENT');
  expect(dropdown).toContain('SCREEN_TREE_NAME_SLOT');
  // The name slot comes before conditional metadata (run indicator, modal
  // marker), so rows with and without status start on the same axis.
  const screenItem = dropdown.slice(
    dropdown.indexOf('onSelect={() => activate(screen.id)}'),
    dropdown.indexOf('function StorybookComponentPicker'),
  );
  const nameSlotIndex = screenItem.indexOf('<span className={SCREEN_TREE_NAME_SLOT}');
  const runIndicatorIndex = screenItem.indexOf('<RunIndicator');
  expect(nameSlotIndex).toBeGreaterThan(-1);
  expect(runIndicatorIndex).toBeGreaterThan(nameSlotIndex);
});

test('screen row menu labels the status section and calls ok screens ready', async () => {
  const screenRow = await readFile(screenRowPath, 'utf8');

  expect(screenRow).toContain('DropdownMenuLabel');
  expect(screenRow).toContain('Status');
  expect(screenRow).toContain('<DropdownMenuRadioItem value="ok" className="text-xs">');
  expect(screenRow).toContain('Ready');
  expect(screenRow).not.toContain('Healthy');
});

test('flow visibility controls keep screen rows hover-only but folders visible', async () => {
  const screensPanel = await readFile(screensPanelPath, 'utf8');
  const screenRow = await readFile(screenRowPath, 'utf8');

  expect(screenRow).toContain('function FlowVisibilityButton');
  expect(screenRow).toContain('{showVisibilityControl && (');
  expect(screenRow).toContain(
    '<FlowVisibilityButton hidden={hiddenInFlow} onToggle={onToggleHidden} />',
  );
  expect(screenRow).toContain(
    'opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100',
  );

  const folderIconIndex = screensPanel.indexOf(
    '<Folder className="size-3 shrink-0 text-primary" />',
  );
  const folderVisibilityIndex = screensPanel.indexOf(
    "title={folderHidden ? 'Show folder in Flow' : 'Hide folder in Flow'}",
  );
  const renameFolderIndex = screensPanel.indexOf('title="Rename folder"');

  expect(folderIconIndex).toBeGreaterThan(-1);
  expect(folderVisibilityIndex).toBeGreaterThan(folderIconIndex);
  expect(folderVisibilityIndex).toBeLessThan(renameFolderIndex);

  const folderVisibilityButton = screensPanel.slice(folderVisibilityIndex, renameFolderIndex);
  expect(folderVisibilityButton).not.toContain('opacity-0');
  expect(folderVisibilityButton).not.toContain('group-hover:opacity-100');
  expect(folderVisibilityButton).not.toContain('group-focus-within:opacity-100');
});

test('screen rows use path tooltips without inline path subtitles or blue borders', async () => {
  const screenRow = await readFile(screenRowPath, 'utf8');

  expect(screenRow).toContain("import { screenDisplayPath } from '@/lib/editor-location';");
  expect(screenRow).toContain('const screenPath = screenDisplayPath(screen);');
  expect(screenRow).toContain('items-center gap-2 overflow-visible rounded-md px-2 py-1.5');
  expect(screenRow).toContain('flex min-w-0 w-full items-center gap-1.5 overflow-hidden');
  expect(screenRow).toContain(
    'className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"',
  );
  expect(screenRow).toContain('title={screenPath}');
  expect(screenRow).toContain('bg-secondary text-secondary-foreground');
  expect(screenRow).toContain('hover:bg-accent hover:text-accent-foreground');
  expect(screenRow).not.toContain('const subtitle =');
  expect(screenRow).not.toContain('text-[10px] text-muted-foreground');
  expect(screenRow).not.toContain('border-primary/40 bg-primary/10');
  expect(screenRow).not.toContain('hover:border-primary/30');
});

test('component rows mirror screen row selection and keep source paths in tooltips only', async () => {
  const componentsPanel = await readFile(componentsPanelPath, 'utf8');
  const componentRow = componentsPanel.slice(
    componentsPanel.indexOf('function ComponentRow'),
    componentsPanel.indexOf('function NewComponentDialog'),
  );

  expect(componentsPanel).toContain(
    "import { componentDisplayPath } from '@/lib/editor-location';",
  );
  expect(componentRow).toContain('const componentPath = componentDisplayPath(component);');
  expect(componentRow).toContain('items-center gap-2 overflow-visible rounded-md px-2.5 py-2');
  expect(componentRow).toContain('className="flex min-w-0 items-center gap-1.5"');
  expect(componentRow).toContain('title={componentPath}');
  expect(componentRow).toContain('bg-secondary text-secondary-foreground');
  expect(componentRow).toContain('hover:bg-accent hover:text-accent-foreground');
  expect(componentRow).not.toContain('border-primary/60 bg-primary/10');
  expect(componentRow).not.toContain('hover:border-primary/30');
  expect(componentRow).not.toContain('{component.title}');
  expect(componentRow).not.toContain('{component.filePath}');
});
