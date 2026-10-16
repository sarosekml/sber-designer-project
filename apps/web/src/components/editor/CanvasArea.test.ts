import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

import { buildCanvasAreaChromeModel } from './CanvasArea';

test('html-first canvas exposes Design system and rejects persisted Storybook view', () => {
  expect(
    buildCanvasAreaChromeModel({
      projectKind: 'html-first',
      canvasView: 'storybook',
      canOpenStorybook: true,
      storybookReloadPending: true,
      activeStoryMissing: true,
      canRestart: true,
    }),
  ).toEqual({
    effectiveCanvasView: 'screen',
    showCanvasViewToggle: true,
    storybookTabEnabled: false,
    designSystemTabEnabled: true,
    shouldOfferStorybookReload: false,
    canRestartStorybook: false,
    viewportDisabled: false,
  });
});

test('react canvas keeps Storybook controls when preview is available', () => {
  expect(
    buildCanvasAreaChromeModel({
      projectKind: 'react-vite',
      canvasView: 'screen',
      canOpenStorybook: true,
      storybookReloadPending: true,
      activeStoryMissing: false,
      canRestart: true,
    }),
  ).toMatchObject({
    effectiveCanvasView: 'screen',
    showCanvasViewToggle: true,
    storybookTabEnabled: true,
    shouldOfferStorybookReload: true,
    canRestartStorybook: true,
  });
});

test('react canvas without Storybook keeps the previous single-view chrome', () => {
  expect(
    buildCanvasAreaChromeModel({
      projectKind: 'react-vite',
      canvasView: 'screen',
      canOpenStorybook: false,
      storybookReloadPending: false,
      activeStoryMissing: false,
      canRestart: false,
    }),
  ).toMatchObject({
    effectiveCanvasView: 'screen',
    showCanvasViewToggle: false,
    storybookTabEnabled: false,
    designSystemTabEnabled: false,
  });
});

test('screen and Storybook share a palette-specific canvas frame border', async () => {
  const [source, styles] = await Promise.all([
    readFile('apps/web/src/components/editor/CanvasArea.tsx', 'utf8'),
    readFile('apps/web/src/styles.css', 'utf8'),
  ]);

  expect(source).toContain('border-[var(--canvas-frame-border)]');
  expect(styles).toContain(":root[data-surface='gray']");
  expect(styles).toContain(":root[data-surface='graphite']");
  expect(styles.match(/--canvas-frame-border:/gu)?.length).toBe(6);
});

test('canvas preview uses the full workspace without outer padding', async () => {
  const source = await readFile('apps/web/src/components/editor/CanvasArea.tsx', 'utf8');

  expect(source).toContain('relative min-h-0 flex-1 overflow-auto bg-muted/60 p-0');
  expect(source).not.toContain('relative min-h-0 flex-1 overflow-auto bg-muted/60 p-6');
});

test('0129 keeps Screen info before Annotate and scopes it to the effective screen view', async () => {
  const source = await readFile('apps/web/src/components/editor/CanvasArea.tsx', 'utf8');
  const infoIndex = source.indexOf('setScreenInfoOpen(true)');
  const annotateIndex = source.indexOf('setMarkActive(!markActive)');

  expect(source).toContain("canvasChrome.effectiveCanvasView === 'screen' && activeScreen");
  expect(source).toContain('Screen info: creation date, generation runs, tokens, artifacts');
  expect(infoIndex).toBeGreaterThan(-1);
  expect(annotateIndex).toBeGreaterThan(infoIndex);
});

test('screen picker keeps a fixed width while active labels change', async () => {
  const source = await readFile('apps/web/src/components/editor/CanvasNavigationStrip.tsx', 'utf8');

  expect(source).toContain('h-7 w-[220px] shrink-0');
  expect(source).toContain('shrink-0 justify-start gap-1.5');
  expect(source).toContain('min-w-0 flex-1 truncate text-left');
  expect(source).toContain('ml-auto size-3.5 shrink-0 opacity-60');
  expect(source).not.toContain('h-7 max-w-[220px] shrink-0');
});

test('screen picker and Screens panel share folder expansion state', async () => {
  const [picker, panel, row] = await Promise.all([
    readFile('apps/web/src/components/editor/CanvasNavigationStrip.tsx', 'utf8'),
    readFile('apps/web/src/components/editor/ScreensPanel.tsx', 'utf8'),
    readFile('apps/web/src/components/editor/screens/ScreenRow.tsx', 'utf8'),
  ]);

  expect(picker).toContain('normalizeScreensPanelSettings(project?.screensPanel)');
  expect(picker).toContain('toggleCollapsedScreenFolder(project.screensPanel, folderName)');
  expect(picker).toContain('aria-expanded={!collapsedFolderNames.has(group.id)}');
  expect(picker).toContain(
    'max-h-[var(--radix-dropdown-menu-content-available-height)] w-72 flex-col overflow-hidden',
  );
  expect(picker).toContain('className="min-h-0 flex-1 overflow-y-auto p-1"');
  expect(picker).not.toContain('max-h-[min(70vh,480px)]');
  expect(picker).toContain('aria-label="Sync screens from Storybook"');
  expect(picker).toContain('aria-label="Add a screen"');
  expect(picker).toContain('aria-label="Show screens panel"');
  expect(picker).toContain('<NewScreenDialog open={newScreenOpen}');
  expect(picker).toContain('await screenActions.syncScreens()');
  expect(panel).toContain('toggleCollapsedScreenFolder(project.screensPanel, folder)');
  expect(panel).toContain('querySelector<HTMLElement>(\'[data-active-screen="true"]\')');
  expect(row).toContain('data-active-screen={active || undefined}');
});

test('Storybook component selection toggles off in the dropdown and panel', async () => {
  const [picker, panel, contextStrip] = await Promise.all([
    readFile('apps/web/src/components/editor/CanvasNavigationStrip.tsx', 'utf8'),
    readFile('apps/web/src/components/editor/ComponentsPanel.tsx', 'utf8'),
    readFile('apps/web/src/components/editor/chat/ContextStrip.tsx', 'utf8'),
  ]);
  const toggleSelection =
    'setActiveComponentId(component.id === activeComponentId ? null : component.id)';

  expect(picker).toContain(toggleSelection);
  expect(panel).toContain(toggleSelection);
  expect(contextStrip).toContain('onClick={() => setActiveComponentId(null)}');
});

test('collapsed Components dropdown mirrors the full panel header actions', async () => {
  const picker = await readFile('apps/web/src/components/editor/CanvasNavigationStrip.tsx', 'utf8');

  expect(picker).toContain('aria-label="Refresh component catalog"');
  expect(picker).toContain('aria-label="Create component"');
  expect(picker).toContain('aria-label="Show components panel"');
  expect(picker).toContain('<NewComponentDialog');
  expect(picker).toContain('className="min-h-0 flex-1 overflow-y-auto p-1"');
});
