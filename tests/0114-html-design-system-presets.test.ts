import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID,
  HTML_DESIGN_SYSTEM_PRESETS,
} from '@sber-designer/shared-types';
import {
  parseProjectStyleContract,
  projectStyleContractCoverage,
} from '../packages/design-indexer/src';
import {
  materializeHtmlDesignSystemPreset,
  resolveHtmlDesignSystemPresetId,
} from '../services/api/src/html-design-system-presets';
import { designIndexRouter } from '../services/api/src/routes/design-index';
import { bootstrapProject } from '../services/api/src/scaffolder';

test('B3 exposes three stable neutral HTML-first preset choices', () => {
  expect(HTML_DESIGN_SYSTEM_PRESETS.map((preset) => preset.id)).toEqual([
    'dense-enterprise',
    'calm-document',
    'dashboard-first',
  ]);
  expect(DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID).toBe('dense-enterprise');
  expect(new Set(HTML_DESIGN_SYSTEM_PRESETS.map((preset) => preset.id)).size).toBe(3);
  expect(resolveHtmlDesignSystemPresetId('dashboard-first')).toBe('dashboard-first');
  expect(resolveHtmlDesignSystemPresetId('unknown')).toBeNull();
});

for (const preset of HTML_DESIGN_SYSTEM_PRESETS) {
  test(`B3 ${preset.id} bundle has a complete style contract and semantic CSS`, () => {
    const bundle = materializeHtmlDesignSystemPreset(preset.id, 'Operations workspace');
    const contract = parseProjectStyleContract(bundle.designMd, 'Design.md');

    expect(contract).not.toBeNull();
    expect(projectStyleContractCoverage(contract)).toEqual({ present: 9, total: 9, score: 1 });
    expect(contract?.sectionOrderValid).toBe(true);
    expect(contract?.diagnostics).toEqual([]);
    expect(bundle.designMd).toContain('## 9. Agent Prompt Guide');
    expect(bundle.tokensCss).toContain('--color-surface:');
    expect(bundle.tokensCss).toContain('--color-accent:');
    expect(bundle.tokensCss).toContain('--space-page:');
    expect(bundle.componentsCss).toContain('var(--color-accent)');
    expect(bundle.componentsCss).toContain('.data-table');
  });
}

test('HTML-first scaffold materializes the selected B3 preset into project-owned files', async () => {
  const parentDir = await mkdtemp(join(tmpdir(), 'sd-0114-preset-scaffold-'));
  const result = await bootstrapProject({
    parentDir,
    name: 'Review dashboard',
    projectKind: 'html-first',
    createStarterFiles: true,
    htmlDesignSystemPresetId: 'dashboard-first',
  });

  const designMd = await readFile(join(result.workspacePath, 'design-system', 'Design.md'), 'utf8');
  const tokensCss = await readFile(
    join(result.workspacePath, 'design-system', 'tokens.css'),
    'utf8',
  );
  const componentsCss = await readFile(
    join(result.workspacePath, 'design-system', 'components.css'),
    'utf8',
  );

  expect(designMd).toContain('# Review Dashboard Design System — Dashboard First');
  expect(designMd).toContain('Create an analytical dashboard');
  expect(tokensCss).toContain('--color-chart-1: #2563eb');
  expect(componentsCss).toContain('.numeric');
  expect(result.steps).toContainEqual(
    expect.objectContaining({ detail: 'preset=dashboard-first' }),
  );
});

test('Add design system endpoint materializes a preset without browser-owned source copies', async () => {
  const workspace = await createHtmlFirstWorkspace();
  const response = await designIndexRouter.request(
    `http://localhost/html-design-system-sources?workspacePath=${encodeURIComponent(workspace)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presetId: 'calm-document' }),
    },
  );

  expect(response.status).toBe(200);
  const body = (await response.json()) as { changedFiles: string[] };
  expect(body.changedFiles).toEqual(
    expect.arrayContaining([
      'design-system/Design.md',
      'design-system/tokens.css',
      'design-system/components.css',
      'design-system/index.html',
    ]),
  );
  expect(await readFile(join(workspace, 'design-system', 'Design.md'), 'utf8')).toContain(
    'Calm Document',
  );
  expect(await readFile(join(workspace, 'design-system', 'tokens.css'), 'utf8')).toContain(
    '--space-page: 56px',
  );
});

test('Add design system endpoint rejects an unknown preset without writing sources', async () => {
  const workspace = await createHtmlFirstWorkspace();
  const response = await designIndexRouter.request(
    `http://localhost/html-design-system-sources?workspacePath=${encodeURIComponent(workspace)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presetId: 'not-a-preset' }),
    },
  );

  expect(response.status).toBe(400);
  expect(await Bun.file(join(workspace, 'design-system', 'Design.md')).exists()).toBe(false);
});

async function createHtmlFirstWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0114-html-preset-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  await writeFile(
    join(workspace, '.sber-designer', 'project.sdproj'),
    `${JSON.stringify(
      {
        version: 1,
        name: 'Preset workspace',
        workspacePath: workspace,
        projectKind: 'html-first',
        screens: [],
        flow: [],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return workspace;
}
