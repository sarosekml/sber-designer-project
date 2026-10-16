import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ProjectDesignSystemBrowser } from '@/lib/api/project-index';

import { DesignSystemBrowser } from './DesignSystemBrowser';

test('DesignSystemBrowser renders component description layer provenance and divergence', () => {
  const html = renderToStaticMarkup(
    <DesignSystemBrowser
      browser={browserFixture()}
      loading={false}
      running={false}
      onRefresh={() => undefined}
      onRunProfiler={() => undefined}
      onChanged={() => undefined}
    />,
  );

  expect(html).toContain('Customer lookup table for dense operational screens.');
  expect(html).toContain('sidecar');
  expect(html).toContain('diverged');
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
          componentGroups: 0,
          tokens: 0,
          icons: 0,
          assets: 0,
          illustrations: 0,
          routes: 0,
          screens: 0,
          examples: 0,
          notes: 0,
          agentNotes: 0,
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
    storybook: null,
    setupQuestions: [],
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
        noteCount: 0,
        confidence: 'high',
      },
    ],
    componentGroups: [],
    tokens: [],
    icons: null,
    iconCandidates: [],
    assets: [],
    screens: [],
    routes: [],
    usageExamples: [],
    agentNotes: [],
  };
}
