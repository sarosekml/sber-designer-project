import { expect, test } from 'bun:test';

import {
  buildDesignSystemBrowserItems,
  filterDesignSystemBrowserItems,
} from './design-system-browser';
import type { ProjectDesignSystemBrowser } from './api/project-index';

test('buildDesignSystemBrowserItems normalizes indexed records for browser categories', () => {
  const items = buildDesignSystemBrowserItems(browserFixture());

  expect(items.map((item) => `${item.kind}:${item.title}`)).toEqual([
    'health:Project profile',
    'health:Setup questions',
    'component:DataTable',
    'token:--color-primary',
    'icon:RiskAlert',
    'icon:RiskIcon',
    'asset:Empty state',
    'screen:Payments',
    'route:/payments',
    'note:Prefer DataTable for dense financial list screens.',
  ]);
  expect(items.find((item) => item.id === 'component:component-data-table')).toMatchObject({
    kind: 'component',
    noteCount: 1,
    status: 'warning',
    preview: { kind: 'component', label: 'DataTable' },
  });
  expect(items.find((item) => item.id === 'token:color-primary')).toMatchObject({
    preview: { kind: 'color', value: '#1473e6' },
  });
  expect(
    items.find((item) => item.id === 'component:component-data-table')?.actions,
  ).toContainEqual(
    expect.objectContaining({ id: 'copy-source', value: 'src/components/DataTable.tsx' }),
  );
  expect(items.find((item) => item.id === 'component:component-data-table')).toMatchObject({
    descriptionView: {
      purpose: 'Customer lookup table for dense operational screens.',
      provenance: 'sidecar',
      diverged: true,
      diagnostics: ['sources diverge: Storybook projection differs from canonical sidecar'],
    },
  });
});

test('filterDesignSystemBrowserItems supports category and text search', () => {
  const items = buildDesignSystemBrowserItems(browserFixture());

  expect(filterDesignSystemBrowserItems(items, { category: 'components', query: '' })).toEqual([
    expect.objectContaining({ id: 'component:component-data-table' }),
  ]);
  expect(filterDesignSystemBrowserItems(items, { category: 'all', query: 'risk' })).toEqual([
    expect.objectContaining({ id: 'icon-candidate:icon-candidate-project-icon-prop-riskalert' }),
    expect.objectContaining({ id: 'icon:icon-risk' }),
  ]);
  expect(filterDesignSystemBrowserItems(items, { category: 'notes', query: 'financial' })).toEqual([
    expect.objectContaining({ id: 'note:note-1' }),
  ]);
});

function browserFixture(): ProjectDesignSystemBrowser {
  return {
    context: {
      status: 'valid',
      stale: false,
      manifest: null,
      artifacts: [],
      diagnostics: [],
      fingerprint: 'abc',
      trackedFiles: 4,
      promptSummary: 'Ready.',
      projectSystem: {
        projectName: 'Fixture',
        status: 'valid',
        freshness: 'ready',
        nextAction: 'ready',
        generatedAt: 1,
        summary: 'Ready.',
        counts: {
          components: 1,
          componentGroups: 1,
          tokens: 1,
          icons: 1,
          assets: 1,
          illustrations: 1,
          routes: 1,
          screens: 1,
          examples: 0,
          notes: 1,
          agentNotes: 1,
          diagnostics: 0,
        },
        sources: null,
        contextItems: [],
        warnings: [],
      },
    },
    projectProfile: {
      kind: 'react',
      screenUnit: {
        sourceGlob: 'src/**/*.{tsx,jsx}',
        storyRequired: false,
        rootMarker: 'data-sd-screen-root',
      },
      componentModel: 'react-index',
      renderProbe: 'static-html',
      packageManager: 'bun',
      frameworks: ['react', 'vite'],
      sourceRoots: ['src'],
      styling: ['tailwind'],
      aliases: {},
      packageScripts: { dev: 'vite' },
    },
    storybook: {
      exists: true,
      configPaths: ['.storybook/main.ts'],
      storiesGlobs: [],
      source: 'detected',
    },
    setupQuestions: [
      {
        id: 'commands.typecheck',
        label: 'Typecheck command',
        answer: null,
        detectedAnswer: null,
        confirmedAnswer: null,
        status: 'missing',
        reason: 'Used before handoff.',
      },
    ],
    components: [
      {
        id: 'component-data-table',
        title: 'Data/Table',
        shortName: 'DataTable',
        filePath: 'src/components/DataTable.tsx',
        storyCount: 1,
        stories: [{ id: 'data-table--default', name: 'Default' }],
        descriptionLayer: {
          purpose: 'Customer lookup table for dense operational screens.',
          anatomy: ['toolbar', 'rows'],
          usage: [],
          agentGuidance: ['Prefer compact rows.'],
          keywords: ['table', 'customer'],
          status: 'confirmed',
          updatedAt: '2026-07-08T10:00:00.000Z',
        },
        descriptionSource: {
          provenance: 'sidecar',
          fresh: false,
          diagnostics: ['sources diverge: Storybook projection differs from canonical sidecar'],
        },
        tags: ['table'],
        groupIds: ['tables'],
        noteCount: 1,
        confidence: 'high',
      },
    ],
    componentGroups: [
      { id: 'tables', name: 'Tables', guidance: 'Use for tabular data.', componentIds: [] },
    ],
    tokens: [
      {
        id: 'color-primary',
        name: '--color-primary',
        value: '#1473e6',
        source: 'css',
        filePath: 'src/styles/tokens.css',
        kind: 'color',
      },
    ],
    icons: {
      projectIcons: [
        { id: 'icon-risk', name: 'RiskIcon', importName: 'RiskIcon', filePath: 'src/icons.tsx' },
      ],
      fallback: {
        provider: 'lucide',
        packageName: 'lucide-react',
        packageVersion: '0.0.0',
        count: 0,
        icons: [],
      },
    },
    iconCandidates: [
      {
        id: 'icon-candidate-project-icon-prop-riskalert',
        name: 'RiskAlert',
        source: 'project-icon-prop',
        validFor: ['project-icon-prop'],
        componentName: 'Icon',
        propName: 'iconName',
        confidence: 'high',
        filePath: 'src/components/Icon/Icon.const.ts',
        tags: ['risk', 'alert'],
      },
    ],
    assets: [
      {
        id: 'asset-empty',
        kind: 'illustration',
        name: 'Empty state',
        filePath: 'src/assets/empty.svg',
        usageMode: 'asset-url',
        tags: ['empty'],
      },
    ],
    screens: [
      {
        id: 'screen-payments',
        name: 'Payments',
        implementationPath: 'src/screens/Payments.tsx',
        designReadableStatus: 'compatible',
        source: 'project-file',
      },
    ],
    routes: [
      {
        id: 'route-payments',
        routePath: '/payments',
        filePath: 'src/routes/payments.tsx',
        source: 'file-system',
      },
    ],
    usageExamples: [],
    agentNotes: [
      {
        id: 'note-1',
        targetType: 'component',
        targetId: 'component-data-table',
        note: 'Prefer DataTable for dense financial list screens.',
        intent: 'prefer',
        source: 'component-note',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  };
}
