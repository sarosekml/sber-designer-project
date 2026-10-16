import { expect, test } from 'bun:test';

import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import {
  EditorStateSchema,
  getState,
  patchState,
  resetState,
} from '../services/api/src/state-store';

const selection = {
  loc: 'dom://div.demo-shell > button:nth-of-type(1)',
  sourceKind: 'dom-fallback' as const,
  domPath: 'html > body > div.demo-shell > button:nth-of-type(1)',
  componentPath: ['AiAnalysisScreen', 'Toolbar', 'Button'],
  tagName: 'BUTTON',
  text: 'Generate memo',
  selector: 'button:has-text("Generate memo")',
  componentName: 'Button',
  componentLoc: 'src/stories/screens/AiAnalysisScreen.tsx:42:8',
  attributes: {
    class: 'demo-button demo-button-primary',
    'aria-label': 'Generate memo',
  },
  inspectId: 'sd-inspect-1',
  selectionNotice:
    'Selected nearest source-backed ancestor DIV because the clicked SPAN has no direct source target.',
  computedStyles: {
    color: 'rgb(17, 24, 39)',
    backgroundColor: 'rgb(255, 255, 255)',
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: '20px',
    padding: '10px 14px',
    borderRadius: '8px',
  },
  rect: { x: 120, y: 80, width: 160, height: 44 },
};

const activeScreen = {
  id: 'screen-ai-analysis',
  name: 'AI Analysis',
  kind: 'story' as const,
  storyId: 'screens-demo--ai-analysis-screen',
  folder: 'Demo',
  description: 'AI analysis workspace.',
};

test('editor state accepts the full selected node shape from the canvas', () => {
  const parsed = EditorStateSchema.safeParse({
    mode: 'design',
    projectName: 'demo-project-experiments',
    projectInstructions: 'Prefer compact operational UI and reuse data-table components.',
    activeScreen,
    selection,
    canvasUrl: 'http://localhost:6006',
    workspacePath: '/Users/dev/Work Dev/sber-desinger/projects/demo-project',
  });

  expect(parsed.success).toBe(true);
  if (parsed.success) {
    expect(parsed.data.projectInstructions).toContain('compact operational UI');
  }
});

test('editor state stores selection metadata used by the agent', () => {
  resetState();
  patchState({ selection });

  expect(getState().selection).toMatchObject({
    loc: selection.loc,
    tagName: selection.tagName,
    text: selection.text,
    selector: selection.selector,
    componentName: selection.componentName,
    componentLoc: selection.componentLoc,
    attributes: selection.attributes,
    inspectId: selection.inspectId,
    selectionNotice: selection.selectionNotice,
    computedStyles: selection.computedStyles,
  });
});

test('system prompt includes selected element metadata', async () => {
  resetState();
  patchState({ mode: 'design', projectName: 'demo-project-experiments', activeScreen, selection });

  const prompt = await buildSystemPrompt();

  expect(prompt.text).toContain('- project: `demo-project-experiments`');
  expect(prompt.text).toContain('- activeScreen: `AI Analysis` (screen-ai-analysis)');
  expect(prompt.text).toContain('- activeScreenStoryId: `screens-demo--ai-analysis-screen`');
  expect(prompt.text).toContain('- selection: `button`');
  expect(prompt.text).toContain('selectionText: Generate memo');
  expect(prompt.text).toContain('selectionSelector: `button:has-text("Generate memo")`');
  expect(prompt.text).toContain('selectionComponent: `Button`');
  expect(prompt.text).toContain('selectedSourceKind: `dom-fallback`');
  expect(prompt.text).toContain(
    'selectedDomPath: `html > body > div.demo-shell > button:nth-of-type(1)`',
  );
  expect(prompt.text).toContain('selectedComponentPath: AiAnalysisScreen > Toolbar > Button');
  expect(prompt.text).toContain(
    'selectedResolution: Selected nearest source-backed ancestor DIV because the clicked SPAN has no direct source target.',
  );
  expect(prompt.text).toContain('aria-label="Generate memo"');
});
