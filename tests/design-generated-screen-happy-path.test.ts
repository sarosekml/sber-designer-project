import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { resolveCodeModeFilePath } from '../apps/web/src/lib/screen-source';
import { applyDesignChanges } from '../services/api/src/design-apply';
import { validateDesignScreenCompatibility } from '../services/api/src/design-compatibility';
import { inspectDesignTarget } from '../services/api/src/design-inspector';
import type {
  DesignInspectResult,
  DesignSelection,
  DesignTarget,
  ProjectScreen,
} from '../packages/shared-types/src';

test('generated screen can be inspected, edited, opened in Code, and re-inspected', async () => {
  const workspace = await createGeneratedScreenWorkspace();
  const activeScreen: ProjectScreen = {
    id: 'agent-generated-payments',
    name: 'Agent Generated Payments',
    kind: 'story',
    storyId: 'screens-payments-agent-generated--default',
    filePath: workspace.storyPath,
    implementationFilePath: workspace.screenPath,
  };

  const compatibility = await validateDesignScreenCompatibility({
    workspaceRoot: workspace.root,
    screen: { screenId: activeScreen.id },
  });
  expect(compatibility.status).toBe('compatible');
  expect(compatibility.projectSupport).toBe('design-readable');
  expect(compatibility.target.filePath).toBe(workspace.screenPath);

  const originalSource = await readFile(join(workspace.root, workspace.screenPath), 'utf8');
  const ctaInspect = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    activeScreen,
    selection: selectionAt(workspace.screenPath, originalSource, '<Button', {
      tagName: 'Button',
      text: 'Approve',
      attributes: { 'aria-label': 'Approve payment' },
    }),
  });
  expect(ctaInspect.projectSupport).toBe('design-readable');
  expect(ctaInspect.sourceScope).toBe('screen-instance');
  expect(ctaInspect.capabilities.text.status).toBe('editable');
  expect(ctaInspect.capabilities.props.status).toBe('editable');
  expect(ctaInspect.jsx.childrenText).toBe('Approve');

  const headingInspect = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    activeScreen,
    selection: selectionAt(workspace.screenPath, originalSource, '<h1', {
      tagName: 'H1',
      text: 'Payment operations',
    }),
  });
  expect(headingInspect.capabilities.text.status).toBe('editable');
  expect(headingInspect.jsx.childrenText).toBe('Payment operations');

  const ctaApply = await applyDesignChanges({
    workspaceRoot: workspace.root,
    target: ctaInspect.target,
    baseline: requireBaseline(ctaInspect),
    changes: [
      {
        kind: 'set-children-text',
        targetId: ctaInspect.target.id,
        filePath: workspace.screenPath,
        loc: requireTargetLoc(ctaInspect.target),
        text: 'Approve payment',
        label: 'CTA text',
      },
      {
        kind: 'set-prop',
        targetId: ctaInspect.target.id,
        filePath: workspace.screenPath,
        loc: requireTargetLoc(ctaInspect.target),
        name: 'aria-label',
        value: JSON.stringify('Approve selected payment'),
        label: 'CTA aria-label',
      },
    ],
  });
  expect(ctaApply.changedFiles).toEqual([workspace.screenPath]);
  expect(ctaApply.diffs[0]?.after).toContain('Approve payment');
  expect(ctaApply.diffs[0]?.after).toContain('aria-label="Approve selected payment"');

  const afterCtaSource = await readFile(join(workspace.root, workspace.screenPath), 'utf8');
  const cardInspect = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    activeScreen,
    selection: selectionAt(workspace.screenPath, afterCtaSource, '<MetricCard', {
      tagName: 'MetricCard',
      attributes: { 'data-testid': 'payment-summary-card' },
    }),
  });
  expect(cardInspect.capabilities.style.status).toBe('editable');
  expect(cardInspect.styles?.styleObject).toEqual(
    expect.objectContaining({
      backgroundColor: '#ffffff',
      borderRadius: '12px',
    }),
  );

  const cardApply = await applyDesignChanges({
    workspaceRoot: workspace.root,
    target: cardInspect.target,
    baseline: requireBaseline(cardInspect),
    changes: [
      {
        kind: 'set-style',
        targetId: cardInspect.target.id,
        filePath: workspace.screenPath,
        loc: requireTargetLoc(cardInspect.target),
        property: 'backgroundColor',
        value: '#f8fafc',
        label: 'Card background',
      },
      {
        kind: 'set-style',
        targetId: cardInspect.target.id,
        filePath: workspace.screenPath,
        loc: requireTargetLoc(cardInspect.target),
        property: 'borderRadius',
        value: '16px',
        label: 'Card radius',
      },
    ],
  });
  expect(cardApply.changedFiles).toEqual([workspace.screenPath]);

  const changedSource = await readFile(join(workspace.root, workspace.screenPath), 'utf8');
  expect(changedSource).toContain('Approve payment');
  expect(changedSource).toContain('aria-label="Approve selected payment"');
  expect(changedSource).toContain('backgroundColor: "#f8fafc"');
  expect(changedSource).toContain('borderRadius: "16px"');
  expect(sha256(changedSource)).not.toBe(sha256(originalSource));

  expect(
    resolveCodeModeFilePath({
      activeScreen,
      storySourceFilePath: workspace.storyPath,
      selectedSourceLoc: null,
      selectedComponentLoc: null,
      workspacePath: workspace.root,
      derivedImplementationFilePath: null,
      screenSourceTarget: 'implementation',
    }),
  ).toBe(workspace.screenPath);
  expect(
    resolveCodeModeFilePath({
      activeScreen,
      storySourceFilePath: workspace.storyPath,
      selectedSourceLoc: null,
      selectedComponentLoc: null,
      workspacePath: workspace.root,
      derivedImplementationFilePath: null,
      screenSourceTarget: 'story',
    }),
  ).toBe(workspace.storyPath);

  const reopenedCta = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    activeScreen,
    selection: selectionAt(workspace.screenPath, changedSource, '<Button', {
      tagName: 'Button',
      text: 'Approve payment',
      attributes: { 'aria-label': 'Approve selected payment' },
    }),
  });
  expect(reopenedCta.capabilities.text.status).toBe('editable');
  expect(reopenedCta.capabilities.props.status).toBe('editable');
  expect(reopenedCta.jsx.childrenText).toBe('Approve payment');
  expect(reopenedCta.jsx.props).toContainEqual({
    name: 'aria-label',
    value: 'Approve selected payment',
    kind: 'string',
    editable: true,
  });

  const reopenedCard = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    activeScreen,
    selection: selectionAt(workspace.screenPath, changedSource, '<MetricCard', {
      tagName: 'MetricCard',
      attributes: { 'data-testid': 'payment-summary-card' },
    }),
  });
  expect(reopenedCard.styles?.styleObject).toEqual(
    expect.objectContaining({
      backgroundColor: '#f8fafc',
      borderRadius: '16px',
    }),
  );
});

test('generated screen recovers a unique source target from a weak DOM button selection', async () => {
  const workspace = await createGeneratedScreenWorkspace();
  const activeScreen: ProjectScreen = {
    id: 'agent-generated-payments',
    name: 'Agent Generated Payments',
    kind: 'story',
    storyId: 'screens-payments-agent-generated--default',
    filePath: workspace.storyPath,
    implementationFilePath: workspace.screenPath,
  };

  const result = await inspectDesignTarget({
    workspaceRoot: workspace.root,
    activeScreen,
    selection: {
      loc: 'dom://main > section > button',
      sourceKind: 'dom-fallback',
      tagName: 'BUTTON',
      text: 'Approve',
      selector: '[data-testid="undefined_Button"]',
      componentName: 'Button',
      componentPath: ['MuiButtonBaseRoot', 'Button', 'AgentGeneratedScreen'],
      attributes: {
        'data-testid': 'undefined_Button',
        'aria-label': 'Approve payment',
      },
      rect: { x: 40, y: 48, width: 180, height: 44 },
    },
  });

  expect(result.editable).toBe(true);
  expect(result.projectSupport).toBe('design-readable');
  expect(result.sourceScope).toBe('screen-instance');
  expect(result.target.sourceKind).toBe('react-source');
  expect(result.target.filePath).toBe(workspace.screenPath);
  expect(result.target.selector).toBeUndefined();
  expect(result.target.attributes?.['data-testid']).toBeUndefined();
  expect(result.jsx?.tagName).toBe('Button');
  expect(result.jsx?.childrenText).toBe('Approve');
  expect(result.capabilities.style.status).toBe('editable');
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: 'design.generated-screen.source-recovered' }),
  );
});

async function createGeneratedScreenWorkspace(): Promise<{
  root: string;
  screenPath: string;
  storyPath: string;
}> {
  const root = await mkdtemp(join(tmpdir(), 'sd-generated-screen-'));
  const screenPath = 'src/screens/payments/AgentGeneratedScreen.tsx';
  const storyPath = 'src/stories/screens/payments/AgentGeneratedScreen.stories.tsx';

  await mkdir(join(root, 'src', 'screens', 'payments'), { recursive: true });
  await mkdir(join(root, 'src', 'stories', 'screens', 'payments'), { recursive: true });
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await mkdir(join(root, 'src', 'styles'), { recursive: true });
  await mkdir(join(root, '.sber-designer', 'design-index'), { recursive: true });

  await writeFile(
    join(root, screenPath),
    [
      "import { Button } from '../../components/Button';",
      "import { MetricCard } from '../../components/MetricCard';",
      '',
      'export function AgentGeneratedScreen() {',
      '  return (',
      '    <main className="min-h-screen bg-surface-default p-6">',
      '      <MetricCard',
      '        data-testid="payment-summary-card"',
      '        style={{ backgroundColor: "#ffffff", borderRadius: "12px" }}',
      '      >',
      '        <h1>Payment operations</h1>',
      '        <p>Review queued approvals before release.</p>',
      '        <Button',
      '          aria-label="Approve payment"',
      '          style={{ backgroundColor: "#0f766e", borderRadius: "8px" }}',
      '        >',
      '          Approve',
      '        </Button>',
      '      </MetricCard>',
      '    </main>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, storyPath),
    [
      "import type { Meta, StoryObj } from '@storybook/react';",
      "import { AgentGeneratedScreen } from '../../../screens/payments/AgentGeneratedScreen';",
      '',
      'const meta = {',
      "  title: 'Screens/Payments/AgentGenerated',",
      '  component: AgentGeneratedScreen,',
      '} satisfies Meta<typeof AgentGeneratedScreen>;',
      '',
      'export default meta;',
      'type Story = StoryObj<typeof meta>;',
      '',
      'export const Default: Story = {',
      '  render: () => <AgentGeneratedScreen />,',
      '};',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'Button.tsx'),
    ['export function Button(props: any) {', '  return <button {...props} />;', '}', ''].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'MetricCard.tsx'),
    ['export function MetricCard(props: any) {', '  return <section {...props} />;', '}', ''].join(
      '\n',
    ),
    'utf8',
  );
  await writeFile(join(root, 'src', 'styles', 'tokens.css'), ':root {}\n', 'utf8');
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.screens),
    [
      JSON.stringify({
        id: 'agent-generated-payments',
        name: 'Agent Generated Payments',
        implementationPath: screenPath,
        storyPath,
        routePath: '/payments/generated',
        designReadableStatus: 'candidate',
        source: 'agent',
      }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    [
      JSON.stringify(
        indexedComponent(
          'components-button',
          'Components/Button',
          'Button',
          'src/components/Button.tsx',
        ),
      ),
      JSON.stringify(
        indexedComponent(
          'components-metric-card',
          'Components/MetricCard',
          'MetricCard',
          'src/components/MetricCard.tsx',
        ),
      ),
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

  return { root, screenPath, storyPath };
}

function indexedComponent(id: string, title: string, shortName: string, filePath: string) {
  return {
    id,
    title,
    shortName,
    filePath,
    storyCount: 1,
    stories: [{ id: `${id}--default`, name: 'Default' }],
    tags: [],
    groupIds: [],
    noteCount: 0,
    confidence: 'high',
  };
}

function selectionAt(
  filePath: string,
  source: string,
  needle: string,
  input: {
    tagName: string;
    text?: string;
    attributes?: Record<string, string>;
  },
): DesignSelection {
  const loc = locOf(source, needle);
  return {
    loc: `${filePath}:${loc.line}:${loc.column}`,
    sourceKind: 'react-source',
    tagName: input.tagName,
    rect: { x: 40, y: 48, width: 180, height: 44 },
    ...(input.text ? { text: input.text } : {}),
    ...(input.attributes ? { attributes: input.attributes } : {}),
  };
}

function locOf(source: string, needle: string): { line: number; column: number } {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`Missing ${needle}`);
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1]!.length + 1 };
}

function requireBaseline(result: DesignInspectResult): { filePath: string; hash: string } {
  if (!result.baseline) throw new Error('Expected editable design baseline');
  return result.baseline;
}

function requireTargetLoc(target: DesignTarget): { line: number; column: number } {
  if (!target.line) throw new Error('Expected target line');
  return { line: target.line, column: target.column ?? 0 };
}

function sha256(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}
