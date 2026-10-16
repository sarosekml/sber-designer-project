import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

import {
  buildBlankScreenPrompt,
  buildNewScreenDesignBrief,
  buildNewScreenDialogOpeningState,
  generationOptionsForNewScreen,
  resolveNewScreenGenerationDispatch,
  resolveNewScreenGenerationRunDefaults,
} from './NewScreenDialog';

test('new screen dialog blank entry starts empty without assistant mode', () => {
  const state = buildNewScreenDialogOpeningState({
    entry: 'blank',
    screenName: 'New screen 2',
  });

  expect(state).toEqual({
    tab: 'blank',
    name: 'New screen 2',
    brief: '',
    startWithWireframe: false,
  });
});

test('new screen dialog prototype entry primes assistant generation', () => {
  const state = buildNewScreenDialogOpeningState({
    entry: 'prototype',
    screenName: 'Prototype',
  });

  expect(state.tab).toBe('blank');
  expect(state.name).toBe('Prototype');
  expect(state.brief).toContain('first product prototype page');
  expect(state.brief).toContain('Design.md');
  expect(state.startWithWireframe).toBe(true);
});

test('new screen dialog greybox entry primes wireframe without prototype brief', () => {
  const state = buildNewScreenDialogOpeningState({
    entry: 'greybox',
    screenName: 'Greybox',
  });

  expect(state).toEqual({
    tab: 'blank',
    name: 'Greybox',
    brief: '',
    startWithWireframe: true,
  });
});

test('new screen dialog sends Design Jury as an explicit per-run generation choice', () => {
  expect(generationOptionsForNewScreen(false, false)).toEqual({});
  expect(generationOptionsForNewScreen(true, false)).toEqual({
    generation: { wireframe: true },
  });
  expect(generationOptionsForNewScreen(false, true)).toEqual({
    generation: { critique: true },
  });
  expect(generationOptionsForNewScreen(true, true)).toEqual({
    generation: { wireframe: true, critique: true },
  });
});

test('new screen generation snapshots direct wireframe options before async screen creation', () => {
  expect(
    resolveNewScreenGenerationDispatch({
      directionPicker: false,
      wireframe: true,
      critique: false,
      designBrief: null,
    }),
  ).toEqual({
    kind: 'send',
    requestOptions: { generation: { wireframe: true } },
  });

  expect(
    resolveNewScreenGenerationDispatch({
      directionPicker: true,
      wireframe: true,
      critique: true,
      designBrief: null,
    }),
  ).toEqual(
    expect.objectContaining({
      kind: 'direction-picker',
      payload: expect.objectContaining({
        baseGeneration: { wireframe: true, critique: true },
      }),
    }),
  );
});

test('new modal generation carries its surface and resolved size through direct and picker runs', () => {
  const modal = { width: '560px', height: '80vh', longContent: 'grow' as const };
  expect(
    generationOptionsForNewScreen(false, false, null, {
      surface: 'modal',
      modal,
    }),
  ).toEqual({ generation: { surface: 'modal', modal } });

  expect(
    resolveNewScreenGenerationDispatch({
      directionPicker: true,
      wireframe: false,
      critique: false,
      designBrief: null,
      surface: 'modal',
      modal,
    }),
  ).toEqual(
    expect.objectContaining({
      kind: 'direction-picker',
      payload: expect.objectContaining({
        baseGeneration: { surface: 'modal', modal },
      }),
    }),
  );
});

test('new screen run options inherit global defaults and preserve explicit greybox entry', () => {
  const defaults = {
    directionPicker: true,
    wireframe: false,
    designJury: true,
  };

  expect(resolveNewScreenGenerationRunDefaults('blank', defaults)).toEqual(defaults);
  expect(resolveNewScreenGenerationRunDefaults('greybox', defaults)).toEqual({
    ...defaults,
    wireframe: true,
  });
});

test('new screen dialog exposes one-off Harness controls with global-default guidance', async () => {
  const source = await readFile(
    'apps/web/src/components/editor/screens/GenerationRunOptions.tsx',
    'utf8',
  );

  expect(source).toContain('<legend className="sr-only">Harness</legend>');
  expect(source).toContain('aria-label="About one-off harness options"');
  expect(source).toContain(
    'One-off harness options for this run only. Defaults come from Settings → Harness setup; changing them here does not update the global settings.',
  );
  expect(source).toContain('<CircleHelp');
  expect(source).toContain('<TooltipContent');
  expect(source).toContain('Choose a design direction');
  expect(source).toContain('Start with wireframe');
  expect(source).toContain('Run Design Jury');
});

test('new screen dialog builds a normalized structured design brief', () => {
  const designBrief = buildNewScreenDesignBrief({
    palette: '  Project neutrals  ',
    layout: 'Two-column review',
    density: 'compact',
    constraints: 'Keep current navigation\nShow empty state\nKeep current navigation',
  });

  expect(designBrief).toEqual({
    version: 1,
    source: 'mini-form',
    axes: {
      palette: 'Project neutrals',
      layout: 'Two-column review',
      density: 'compact',
      constraints: ['Keep current navigation', 'Show empty state'],
    },
  });
  expect(generationOptionsForNewScreen(false, false, designBrief)).toEqual({
    generation: { designBrief },
  });
  expect(buildNewScreenDesignBrief({ palette: '  ', constraints: '\n' })).toBeNull();
});

test('new screen prompt removes existing-screen guidance when the brief forbids it', () => {
  const designBrief = buildNewScreenDesignBrief({
    constraints: 'Не используй текущие экраны проекта',
  });
  const prompt = buildBlankScreenPrompt({
    name: 'Independent screen',
    storyFilePath: 'src/stories/screens/IndependentScreen.stories.tsx',
    implementationFilePath: 'src/screens/IndependentScreen.tsx',
    folder: 'Ungrouped',
    storyId: 'screens-independent-screen--default',
    storyTitle: 'Screens/Independent screen',
    instruction: 'Create a deal screen.',
    components: [],
    template: null,
    designBrief,
  });

  expect(prompt).toContain('Do not inspect or copy existing screen/page implementations');
  expect(prompt).not.toContain('catalog components, existing screens');
});

test('new modal prompt describes a modal rather than a full page', () => {
  const prompt = buildBlankScreenPrompt({
    name: 'Delete confirmation',
    storyFilePath: 'src/stories/screens/DeleteConfirmation.stories.tsx',
    implementationFilePath: 'src/screens/DeleteConfirmation.tsx',
    folder: 'Dialogs',
    storyId: 'screens-delete-confirmation--default',
    storyTitle: 'Screens/Dialogs/Delete confirmation',
    instruction: 'Confirm deletion.',
    components: [],
    template: null,
    designBrief: null,
    surface: 'modal',
    modalDefaults: { width: '420px', height: 'auto', longContent: 'scroll' },
  });

  expect(prompt).toContain('production-quality modal screen');
  expect(prompt).toContain('## Modal layout contract');
  expect(prompt).toContain('--sd-modal-width: 420px');
});

test('new screen instruction grows to ten lines and then scrolls internally', async () => {
  const source = await readFile(
    'apps/web/src/components/editor/screens/NewScreenBlankFields.tsx',
    'utf8',
  );
  const start = source.indexOf('<Field label="Assistant instruction (optional)">');
  const end = source.indexOf('<details', start);
  const instructionField = source.slice(start, end);

  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  expect(instructionField).toContain('rows={4}');
  expect(instructionField).toContain('max-h-[calc(10lh+1rem+2px)]');
  expect(instructionField).toContain('overflow-y-auto');
});

test('new screen dialog keeps its header and footer fixed around an 80 percent scroll body', async () => {
  const [source, sectionsSource] = await Promise.all([
    readFile('apps/web/src/components/editor/screens/NewScreenDialog.tsx', 'utf8'),
    readFile('apps/web/src/components/editor/screens/NewScreenDialogSections.tsx', 'utf8'),
  ]);
  const start = source.indexOf('<DialogContent');
  const end = source.indexOf('>', start);
  const dialogContent = source.slice(start, end + 1);

  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  expect(dialogContent).toContain('max-h-[80vh]');
  expect(dialogContent).toContain('grid-rows-[auto_minmax(0,1fr)_auto]');
  expect(dialogContent).toContain('overflow-hidden');
  expect(dialogContent).not.toContain('overflow-y-auto');
  expect(dialogContent).not.toContain(' h-[80vh]');

  expect(source).toContain('data-slot="new-screen-dialog-header"');
  expect(source).toContain('data-slot="new-screen-dialog-body"');
  expect(sectionsSource).toContain('data-slot="new-screen-dialog-footer"');
  expect(source).toContain('className="min-h-0 overflow-y-auto px-6 py-4"');
  expect(sectionsSource).toContain('className="shrink-0 border-t border-border px-6 py-4"');
});

test('new screen template field explains where built-in and project templates live', async () => {
  const source = await readFile(
    'apps/web/src/components/editor/screens/NewScreenBlankFields.tsx',
    'utf8',
  );

  expect(source).toContain('<CircleHelp');
  expect(source).toContain('aria-label="Where to find and add screen templates"');
  expect(source).toContain('packages/agent-kit/kit/screen-templates/*.screen.md');
  expect(source).toContain('.sber-designer/screen-templates/');
  expect(source).toContain('Required frontmatter:');
  expect(source).toContain('<TooltipContent');
  expect(source).toContain('labelHint={<ScreenTemplateHelp />}');
});
