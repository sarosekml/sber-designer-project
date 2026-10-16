import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const demoCanvasPath = 'apps/web/src/components/editor/DemoCanvas.tsx';
const editorShellPath = 'apps/web/src/components/editor/EditorShell.tsx';

test('demo canvas no longer owns back or exit chrome', async () => {
  const demoCanvas = await readFile(demoCanvasPath, 'utf8');

  expect(demoCanvas).not.toContain('ArrowLeft');
  expect(demoCanvas).not.toContain('Back</');
  expect(demoCanvas).not.toContain('Exit</');
});

test('demo shell keeps chrome pinned until fullscreen is enabled', async () => {
  const editorShell = await readFile(editorShellPath, 'utf8');

  expect(editorShell).toContain("if (view === 'demo')");
  expect(editorShell).toContain('<DemoChrome');
  expect(editorShell).toContain(
    'const demoScreensPanelHidden = demoFullscreen || screensPanelHidden',
  );
  expect(editorShell).toContain(
    '<ScreensPanel onRequestClose={() => setScreensPanelHidden(true)} />',
  );
  expect(editorShell).toContain('<DemoCanvas />');
  expect(editorShell).toContain('if (!fullscreen) return <div className="shrink-0">{chrome}</div>');
  expect(editorShell).toContain('<CanvasNavigationStrip');
  expect(editorShell).toContain('resourceKind="screens"');
  expect(editorShell).toContain('showResourcePanelDisabled={fullscreen}');
});

test('fullscreen demo auto-hides the top bar and screen dropdown together', async () => {
  const editorShell = await readFile(editorShellPath, 'utf8');

  expect(editorShell).toContain('if (!hoveredRef.current && !pickerOpenRef.current)');
  expect(editorShell).toContain("visible ? 'translate-y-0' : '-translate-y-full'");
  expect(editorShell).toContain(
    "'pointer-events-auto absolute inset-x-0 top-0 shadow-lg transition-transform duration-300 ease-out'",
  );
  expect(editorShell).toContain('screensPanelToggleDisabled: fullscreen');
  expect(editorShell).not.toContain('pointer-events-auto h-2');
});
