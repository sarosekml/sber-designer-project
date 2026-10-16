import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { ALL_TOOLS } from '../services/api/src/agent/toolset';
import type { ToolContext } from '../services/api/src/agent/types';
import { validateDesignScreenCompatibility } from '../services/api/src/design-compatibility';
import { inspectDesignTarget } from '../services/api/src/design-inspector';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { patchState, resetState } from '../services/api/src/state-store';
import type { DesignSelection } from '../packages/shared-types/src';

test('legacy DOM fallback selection is locked but handed to the agent with repair context', async () => {
  const workspace = await createLegacyWorkspace();
  const activeScreen = {
    id: 'legacy-checkout',
    name: 'Legacy Checkout',
    kind: 'page' as const,
    filePath: workspace.screenPath,
    implementationFilePath: workspace.screenPath,
  };
  const selection: DesignSelection = {
    loc: 'dom://main.legacy-checkout button[data-action="approve"]',
    sourceKind: 'dom-fallback',
    domPath: 'html > body > main.legacy-checkout > div.actions > button:nth-of-type(1)',
    componentPath: ['LegacyCheckout', 'RawHtmlIsland', 'button'],
    tagName: 'BUTTON',
    text: 'Approve legacy payment',
    selector: 'button[data-action="approve"]',
    attributes: {
      'data-action': 'approve',
      class: 'legacy primary',
      'aria-label': 'Approve legacy payment',
    },
    rect: { x: 320, y: 240, width: 188, height: 44 },
  };

  const legacyCompatibility = await validateDesignScreenCompatibility({
    workspaceRoot: workspace.root,
    screen: { screenId: activeScreen.id },
  });
  expect(legacyCompatibility.status).toBe('needs-review');
  expect(legacyCompatibility.projectSupport).toBe('baseline-selection');
  expect(legacyCompatibility.diagnostics).toContainEqual(
    expect.objectContaining({ code: 'design.raw-html', level: 'error' }),
  );

  const inspected = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    activeScreen,
    selection,
  });
  expect(inspected.editable).toBe(false);
  expect(inspected.projectSupport).toBe('baseline-selection');
  expect(inspected.sourceScope).toBe('unknown');
  expect(inspected.capabilities.text.status).toBe('unmapped');
  expect(inspected.target).toEqual(
    expect.objectContaining({
      sourceKind: 'dom-fallback',
      filePath: null,
      selector: selection.selector,
      text: selection.text,
      rect: selection.rect,
      domPath: selection.domPath,
      componentPath: selection.componentPath,
    }),
  );

  resetState();
  patchState({
    mode: 'design',
    canvasView: 'screen',
    projectName: 'Legacy Project',
    workspacePath: workspace.root,
    activeScreen,
    selection,
  });

  const prompt = await buildSystemPrompt();
  expect(prompt.text).toContain('selectedSourceKind: `dom-fallback`');
  expect(prompt.text).toContain('selectedBaselineRule: DOM fallback selection is still valid');
  expect(prompt.text).toContain('selectedSelector: `button[data-action="approve"]`');
  expect(prompt.text).toContain(
    'selectedDomPath: `html > body > main.legacy-checkout > div.actions > button:nth-of-type(1)`',
  );
  expect(prompt.text).toContain('selectionBounds: 188×44');

  const selectionToolResult = (await findTool('get_selection').handler(
    {},
    toolContext(workspace.root),
  )) as {
    selection: {
      sourceKind?: string;
      domPath?: string;
      componentPath?: string[];
      selector?: string;
      text?: string;
      attributes?: Record<string, string>;
      rect?: { width: number; height: number };
    } | null;
  };
  expect(selectionToolResult.selection).toEqual(
    expect.objectContaining({
      sourceKind: 'dom-fallback',
      domPath: selection.domPath,
      componentPath: selection.componentPath,
      selector: selection.selector,
      text: selection.text,
      attributes: selection.attributes,
      rect: selection.rect,
    }),
  );

  await writeFile(
    join(workspace.root, workspace.screenPath),
    [
      'export function LegacyCheckout() {',
      '  return (',
      '    <main className="min-h-screen bg-surface-default p-6">',
      '      <section data-testid="approval-card" style={{ backgroundColor: "#ffffff", borderRadius: "16px" }}>',
      '        <h1>Payment approvals</h1>',
      '        <p>Review the migrated payment queue before release.</p>',
      '        <button aria-label="Approve legacy payment" data-action="approve" style={{ backgroundColor: "#0f766e", borderRadius: "8px" }}>',
      '          Approve legacy payment',
      '        </button>',
      '      </section>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );

  const repairedCompatibility = await validateDesignScreenCompatibility({
    workspaceRoot: workspace.root,
    screen: { screenId: activeScreen.id },
  });
  expect(repairedCompatibility.status).toBe('compatible');
  expect(repairedCompatibility.projectSupport).toBe('design-readable');
  expect(repairedCompatibility.summary.inspectableElements).toBeGreaterThan(3);
});

async function createLegacyWorkspace(): Promise<{ root: string; screenPath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'sd-legacy-baseline-'));
  const screenPath = 'src/screens/LegacyCheckout.tsx';
  await mkdir(join(root, 'src', 'screens'), { recursive: true });
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await mkdir(join(root, 'src', 'styles'), { recursive: true });
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });

  await writeFile(
    join(root, screenPath),
    [
      'export function LegacyCheckout({ active }: { active: boolean }) {',
      '  const raw = \'<div class="actions"><button data-action="approve">Approve legacy payment</button></div>\';',
      '  return (',
      '    <main',
      '      className={active ? "legacy-checkout active" : "legacy-checkout"}',
      '      dangerouslySetInnerHTML={{ __html: raw }}',
      '    />',
      '  );',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'Button.tsx'),
    'export function Button(props: any) { return <button {...props} />; }\n',
    'utf8',
  );
  await writeFile(join(root, 'src', 'styles', 'tokens.css'), ':root {}\n', 'utf8');
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.screens),
    [
      JSON.stringify({
        id: 'legacy-checkout',
        name: 'Legacy Checkout',
        implementationPath: screenPath,
        routePath: '/legacy-checkout',
        designReadableStatus: 'unknown',
        source: 'route',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    [
      JSON.stringify({
        id: 'components-button',
        title: 'Components/Button',
        shortName: 'Button',
        filePath: 'src/components/Button.tsx',
        storyCount: 1,
        stories: [{ id: 'components-button--default', name: 'Default' }],
        tags: [],
        groupIds: [],
        noteCount: 0,
        confidence: 'high',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.tokens),
    JSON.stringify(
      {
        tokens: [
          {
            id: 'css:src/styles/tokens.css:surface-default',
            name: 'surface-default',
            value: '#ffffff',
            source: 'css',
            filePath: 'src/styles/tokens.css',
            kind: 'color',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.projectProfile),
    JSON.stringify(
      {
        packageManager: 'bun',
        frameworks: ['react'],
        sourceRoots: ['src'],
        styling: ['tailwind'],
        aliases: {},
        packageScripts: {},
      },
      null,
      2,
    ),
    'utf8',
  );

  return { root, screenPath };
}

function findTool(name: string) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

function toolContext(workspacePath: string): ToolContext {
  return {
    user: 'test-user',
    projectName: 'Legacy Project',
    activeScreen: null,
    workspacePath,
    canvasUrl: null,
  };
}
