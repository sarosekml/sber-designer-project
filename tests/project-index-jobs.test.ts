import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import type { ComponentCatalog } from '@sber-designer/shared-types';
import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import {
  clearProjectIndexJobs,
  getProjectIndexJob,
} from '../services/api/src/project-index/job-store';
import {
  runProjectIndexJobNow,
  startProjectIndexJob,
} from '../services/api/src/project-index/indexing-runner';
import { designIndexRouter } from '../services/api/src/routes/design-index';
import { patchState } from '../services/api/src/state-store';

test('project index job records lifecycle and writes unified artifacts', async () => {
  clearProjectIndexJobs();
  const root = await createIndexableWorkspace();

  const job = await runProjectIndexJobNow({
    workspaceRoot: root,
    projectName: 'Job CRM',
    catalog: catalogFixture(),
    enrich: false,
  });

  expect(job.stage).toBe('complete');
  expect(job.status).toBe('complete');
  expect(job.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.manifest);
  expect(job.context?.manifest?.projectName).toBe('Job CRM');
  expect(job.progress.map((event) => event.stage)).toEqual([
    'queued',
    'scanning',
    'writing',
    'validating',
    'complete',
  ]);
  expect(await exists(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest))).toBe(true);
});

test('project index jobs can be started and polled through routes', async () => {
  clearProjectIndexJobs();
  const root = await createIndexableWorkspace();
  patchState({ workspacePath: root, projectName: 'Route CRM', canvasUrl: null });

  const started = await designIndexRouter.request('http://localhost/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enrich: false }),
  });
  const startedBody = (await started.json()) as { job: { id: string; stage: string } };

  expect(started.status).toBe(202);
  expect(startedBody.job.id).toMatch(/^idxjob-/);

  const job = await waitForJob(startedBody.job.id);
  expect(job.stage).toBe('complete');
  expect(job.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.manifest);
});

test('starting a project index job is non-blocking before completion', async () => {
  clearProjectIndexJobs();
  const root = await createIndexableWorkspace();

  const job = startProjectIndexJob({
    workspaceRoot: root,
    projectName: 'Async CRM',
    catalog: catalogFixture(),
    enrich: false,
  });

  expect(job.stage).toBe('queued');
  expect(getProjectIndexJob(job.id)?.stage).toBe('queued');

  const completed = await waitForJob(job.id);
  expect(completed.stage).toBe('complete');
});

test('project index keeps importable AST components when a live Storybook canvas exists', async () => {
  clearProjectIndexJobs();
  const root = await createIndexableWorkspace();
  const calls: Array<{ canvasUrl?: string | null; workspacePath?: string | null }> = [];
  const storybookCatalog: ComponentCatalog = {
    source: 'storybook',
    generatedAt: Date.now(),
    components: [
      {
        id: 'components-patterns',
        title: 'Components/Patterns',
        shortName: 'Patterns',
        filePath: 'src/stories/Patterns.stories.tsx',
        stories: [{ id: 'components-patterns--overview', name: 'Overview' }],
      },
    ],
  };

  const job = await runProjectIndexJobNow(
    {
      workspaceRoot: root,
      projectName: 'Live Job CRM',
      canvasUrl: 'http://127.0.0.1:6006/',
      enrich: false,
    },
    {
      resolveCatalog: async (input) => {
        calls.push(input);
        return input.canvasUrl ? { catalog: storybookCatalog } : { catalog: catalogFixture() };
      },
    },
  );

  expect(job.status).toBe('complete');
  expect(calls).toEqual([{ workspacePath: root, bypass: true }]);
  const componentIndex = await readFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.components),
    'utf8',
  );
  expect(componentIndex).toContain('"shortName":"DataTable"');
  expect(componentIndex).not.toContain('"shortName":"Patterns"');
});

async function waitForJob(id: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const job = getProjectIndexJob(id);
    if (job?.stage === 'complete' || job?.stage === 'failed') return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for job ${id}`);
}

async function createIndexableWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-project-index-job-'));
  await mkdir(join(root, 'src', 'app', 'dashboard'), { recursive: true });
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await mkdir(join(root, 'src', 'styles'), { recursive: true });
  await writeFile(join(root, 'bun.lock'), '', 'utf8');
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify(
      {
        scripts: { dev: 'vite --host 0.0.0.0' },
        dependencies: { '@vitejs/plugin-react': '^latest', react: '^19.0.0', vite: '^latest' },
        devDependencies: { tailwindcss: '^4.0.0' },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, 'DESIGN.md'),
    [
      '---',
      'version: alpha',
      'name: Job CRM',
      '---',
      '',
      '# Job CRM',
      '',
      '## Overview',
      'Dense operational CRM.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'app', 'dashboard', 'page.tsx'),
    'export default function DashboardPage() { return <main><h1>Dashboard</h1></main>; }',
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'DataTable.tsx'),
    'export function DataTable() { return <table />; }',
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'styles', 'tokens.css'),
    ':root { --surface-default: #ffffff; }',
    'utf8',
  );
  return root;
}

function catalogFixture(): ComponentCatalog {
  return {
    source: 'static',
    generatedAt: Date.now(),
    components: [
      {
        id: 'components-data-table',
        title: 'Components/DataTable',
        shortName: 'DataTable',
        filePath: 'src/components/DataTable.tsx',
        stories: [{ id: 'components-data-table--default', name: 'Default' }],
      },
    ],
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
