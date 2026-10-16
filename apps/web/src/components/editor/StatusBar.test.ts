import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const statusBarPath = 'apps/web/src/components/editor/StatusBar.tsx';

test('status bar resolves the active screen or component path for the footer location', async () => {
  const statusBar = await readFile(statusBarPath, 'utf8');

  expect(statusBar).toContain("import { editorFooterLocation } from '@/lib/editor-location';");
  expect(statusBar).toContain("import { useCatalogStore } from '@/stores/catalog-store';");
  expect(statusBar).toContain("import { useEditorStore } from '@/stores/editor-store';");
  expect(statusBar).toContain("import { useProjectStore } from '@/stores/project-store';");
  expect(statusBar).toContain('const canvasView = useEditorStore((s) => s.canvasView);');
  expect(statusBar).toContain('const activeScreenId = useEditorStore((s) => s.activeScreenId);');
  expect(statusBar).toContain(
    'const activeComponentId = useEditorStore((s) => s.activeComponentId);',
  );
  expect(statusBar).toContain('const activeScreen =');
  expect(statusBar).toContain('const activeComponent =');
  expect(statusBar).toContain('const locationPath = editorFooterLocation({');
  expect(statusBar).toContain(
    '<ProjectLocation locationPath={locationPath} status={session.status} />',
  );
  expect(statusBar).not.toContain('<ProjectLocation workspacePath={session.workspacePath}');
});
