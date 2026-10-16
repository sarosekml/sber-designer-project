import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

test('generation pipeline settings combine global defaults and readiness checks', async () => {
  const source = await readFile(
    'apps/web/src/components/editor/settings/GenerationPipelineSettings.tsx',
    'utf8',
  );

  expect(source).toContain('Global defaults');
  expect(source).toContain('Choose a design direction');
  expect(source).toContain('Start with wireframe');
  expect(source).toContain('Run Design Jury');
  expect(source).toContain('Screen readiness DoR');
  expect(source).toContain('<ScreenReadinessChecks />');
  expect(source).toContain('Saved in sber-designer');
  expect(source).toContain('updateGenerationPipelinePreferences');
});

test('global Jury default applies to ordinary Design-session screen prompts', async () => {
  const source = await readFile('apps/web/src/components/editor/ChatPanel.tsx', 'utf8');

  expect(source).toContain('useEditorStore((s) => s.generationDefaults)');
  expect(source).toContain(
    "sessionMode === 'design' && canvasView === 'screen' && generationDefaults.designJury",
  );
  expect(source).toContain('{ generation: { critique: true } }');
});
