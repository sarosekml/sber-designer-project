import { expect, test } from 'bun:test';

import {
  buildProjectSystemOverview,
  type DesignIndexContext,
} from '../packages/design-indexer/src';

test('project system overview marks a generated index as ready context', () => {
  const overview = buildProjectSystemOverview({
    status: 'valid',
    stale: false,
    manifest: {
      version: 2,
      generatedAt: 1779290000000,
      projectName: 'Approval CRM',
      sources: {
        storybookCatalog: true,
        staticScan: true,
        designMd: true,
        componentNotes: true,
        legacyComponentSelectionMap: false,
        lucideFallback: true,
      },
      counts: {
        components: 12,
        componentGroups: 4,
        tokens: 18,
        icons: 144,
        assets: 0,
        illustrations: 0,
        routes: 3,
        screens: 5,
        examples: 9,
        notes: 2,
        agentNotes: 2,
        diagnostics: 0,
      },
      fingerprint: 'abc123',
      artifacts: {},
    },
    artifacts: [],
    diagnostics: [],
    fingerprint: 'abc123',
    trackedFiles: 27,
    promptSummary: 'Use indexed forms and tables before custom markup.',
  });

  expect(overview).toMatchObject({
    projectName: 'Approval CRM',
    freshness: 'ready',
    nextAction: 'ready',
    generatedAt: 1779290000000,
    summary: 'Use indexed forms and tables before custom markup.',
    counts: {
      components: 12,
      tokens: 18,
      screens: 5,
      routes: 3,
      examples: 9,
      agentNotes: 2,
    },
  });
  expect(overview.contextItems).toContainEqual(
    expect.objectContaining({
      id: 'components',
      label: 'Components',
      count: 12,
      status: 'ready',
    }),
  );
  expect(overview.contextItems).toContainEqual(
    expect.objectContaining({
      id: 'tokens',
      label: 'Tokens',
      count: 18,
      status: 'ready',
    }),
  );
});

test('project system overview asks for indexing when the index is missing', () => {
  const overview = buildProjectSystemOverview({
    status: 'missing',
    stale: false,
    manifest: null,
    artifacts: [],
    diagnostics: [],
    fingerprint: 'empty',
    trackedFiles: 0,
    promptSummary: '',
  });

  expect(overview).toMatchObject({
    projectName: null,
    freshness: 'missing',
    nextAction: 'index-project',
    generatedAt: null,
  });
  expect(overview.summary).toContain('Index the project');
  expect(overview.contextItems.every((item) => item.status === 'missing')).toBe(true);
});

test('project system overview separates stale indexes from diagnostics warnings', () => {
  const context = withMinimalManifest({
    status: 'stale',
    stale: true,
    diagnostics: [
      {
        level: 'warning',
        filePath: '.sber-designer/design-index/fingerprints.json',
        message: 'Tracked design-system files changed since generation.',
      },
    ],
  });

  const overview = buildProjectSystemOverview(context);

  expect(overview.freshness).toBe('stale');
  expect(overview.nextAction).toBe('reindex-project');
  expect(overview.warnings).toEqual(context.diagnostics);
});

test('project system overview normalizes legacy manifests with missing new counts', () => {
  const base = withMinimalManifest();
  const context = withMinimalManifest({
    manifest: {
      ...base.manifest!,
      counts: {
        components: 2,
        componentGroups: 1,
        tokens: 3,
        icons: 4,
        examples: 0,
        notes: 0,
        agentNotes: 0,
        diagnostics: 0,
      } as never,
    },
  });

  const overview = buildProjectSystemOverview(context);

  expect(overview.counts.assets).toBe(0);
  expect(overview.counts.illustrations).toBe(0);
  expect(overview.counts.routes).toBe(0);
  expect(overview.counts.screens).toBe(0);
  expect(overview.contextItems.find((item) => item.id === 'assets')).toMatchObject({
    count: 0,
    status: 'empty',
  });
});

test('project system overview treats connected html design-system sources as the primary context', () => {
  const context = withMinimalManifest({
    manifest: {
      ...withMinimalManifest().manifest!,
      projectProfile: {
        kind: 'html-css',
        componentModel: 'css-catalog',
        renderProbe: 'static-html',
        screenUnit: {
          sourceGlob: '**/*.html',
          storyRequired: false,
          rootMarker: 'data-sd-screen-root',
        },
        htmlDesignSystem: {
          status: 'canonical',
          foundRequired: ['design-md', 'tokens-css', 'components-css'],
          missingRequired: [],
          sources: [],
        },
      },
      counts: {
        ...withMinimalManifest().manifest!.counts,
        components: 0,
        componentGroups: 0,
        tokens: 6,
        describedComponents: 0,
      },
    },
    promptSummary: '',
  });

  const overview = buildProjectSystemOverview(context);

  expect(overview.summary).toContain('canonical design-system package is indexed');
  expect(overview.contextItems).toContainEqual(
    expect.objectContaining({
      id: 'components',
      label: 'Design system',
      count: 0,
      status: 'ready',
      description: expect.stringContaining('Design.md'),
    }),
  );
});

function withMinimalManifest(patch: Partial<DesignIndexContext> = {}): DesignIndexContext {
  return {
    status: 'valid',
    stale: false,
    manifest: {
      version: 2,
      generatedAt: 1779290000000,
      projectName: 'Indexed Project',
      sources: {
        storybookCatalog: false,
        staticScan: true,
        designMd: false,
        componentNotes: false,
        legacyComponentSelectionMap: false,
        lucideFallback: true,
      },
      counts: {
        components: 1,
        componentGroups: 1,
        tokens: 0,
        icons: 120,
        assets: 0,
        illustrations: 0,
        routes: 0,
        screens: 0,
        examples: 0,
        notes: 0,
        agentNotes: 0,
        diagnostics: 1,
      },
      fingerprint: 'fingerprint',
      artifacts: {},
    },
    artifacts: [],
    diagnostics: [],
    fingerprint: 'fingerprint',
    trackedFiles: 4,
    promptSummary: '',
    ...patch,
  };
}
