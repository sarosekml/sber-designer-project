import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { CANONICAL_DESIGN_INDEX_PATHS, scanProjectProfile } from '../packages/design-indexer/src';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';
import { designIndexRouter } from '../services/api/src/routes/design-index';
import { loadExternalRuntimeProjectIndexContext } from '../services/api/src/routes/chat-stream/run-context';
import { loadProjectDesignSystemBrowser } from '../services/api/src/design-system-browser';

test('html design-system source detection separates canonical files from legacy evidence', async () => {
  const workspace = await createHtmlFirstWorkspace();
  await mkdir(join(workspace, 'design'), { recursive: true });
  await writeFile(join(workspace, 'design', 'DESIGN.md'), '# Design\n\n## Components\n', 'utf8');
  await writeFile(
    join(workspace, 'design', 'tokens.css'),
    ':root { --color-brand: #14532d; }',
    'utf8',
  );
  await writeFile(
    join(workspace, 'components.css'),
    '.button { color: var(--color-brand); }',
    'utf8',
  );

  const profile = await scanProjectProfile(workspace);

  expect(profile.htmlDesignSystem).toMatchObject({
    status: 'non-canonical',
    missingRequired: [],
    foundRequired: ['design-md', 'tokens-css', 'components-css'],
  });
  const designMd = profile.htmlDesignSystem?.sources.find((source) => source.id === 'design-md');
  expect(designMd).toMatchObject({ id: 'design-md', status: 'found' });
  expect(designMd?.foundPath?.toLowerCase()).toBe('design/design.md');
  expect(designMd?.aliases).toEqual(expect.arrayContaining(['design.md', 'design/design.md']));
  expect(profile.htmlDesignSystem?.sources).toContainEqual(
    expect.objectContaining({ id: 'tokens-css', status: 'found', foundPath: 'design/tokens.css' }),
  );

  await mkdir(join(workspace, 'design-system'), { recursive: true });
  await writeFile(join(workspace, 'design-system', 'Design.md'), '# Canonical design\n', 'utf8');
  await writeFile(
    join(workspace, 'design-system', 'tokens.css'),
    ':root { --color-brand: #14532d; }',
    'utf8',
  );
  await writeFile(
    join(workspace, 'design-system', 'components.css'),
    '.button { color: var(--color-brand); }',
    'utf8',
  );
  expect((await scanProjectProfile(workspace)).htmlDesignSystem).toMatchObject({
    status: 'canonical',
    folderPath: 'design-system',
    missingRequired: [],
  });
});

test('html design-system source status reaches browser and runtime context as missing', async () => {
  const workspace = await createHtmlFirstWorkspace();

  await generateProjectDesignIndexFiles(workspace, {
    projectName: 'Bootstrap HTML',
    catalog: null,
  });

  const browser = await loadProjectDesignSystemBrowser(workspace);
  expect(browser.projectProfile?.htmlDesignSystem).toMatchObject({
    status: 'missing',
    missingRequired: ['design-md', 'tokens-css', 'components-css'],
  });
  expect(browser.setupQuestions).toContainEqual(
    expect.objectContaining({
      id: 'html.design-system',
      status: 'missing',
    }),
  );

  const runtimeContext = await loadExternalRuntimeProjectIndexContext(workspace);
  expect(runtimeContext?.htmlDesignSystem).toMatchObject({
    status: 'missing',
    missingRequired: ['design-md', 'tokens-css', 'components-css'],
  });
});

test('html design-system source status is written into manifest profile snapshot', async () => {
  const workspace = await createHtmlFirstWorkspace();
  await mkdir(join(workspace, 'design-system'), { recursive: true });
  await writeFile(join(workspace, 'design-system', 'Design.md'), '# Design\n', 'utf8');
  await writeFile(
    join(workspace, 'design-system', 'tokens.css'),
    ':root { --color-brand: #14532d; }',
    'utf8',
  );
  await writeFile(
    join(workspace, 'design-system', 'components.css'),
    '.card { border: 1px solid #ddd; }',
    'utf8',
  );

  await generateProjectDesignIndexFiles(workspace, {
    projectName: 'Connected HTML',
    catalog: null,
  });

  const manifest = JSON.parse(
    await Bun.file(join(workspace, CANONICAL_DESIGN_INDEX_PATHS.manifest)).text(),
  );

  expect(manifest.projectProfile.htmlDesignSystem).toMatchObject({
    status: 'canonical',
    foundRequired: ['design-md', 'tokens-css', 'components-css'],
  });
});

test('html design-system sources can be pasted, written, indexed, and confirmed', async () => {
  const workspace = await createHtmlFirstWorkspace();

  const res = await designIndexRouter.request(
    `http://localhost/html-design-system-sources?workspacePath=${encodeURIComponent(workspace)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sources: {
          designMd: '# Design\n\nUse the brand system.\n',
          tokensCss: ':root { --color-brand: #14532d; --space-4: 16px; }\n',
          componentsCss: '.button { color: var(--color-brand); padding: var(--space-4); }\n',
        },
      }),
    },
  );

  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    changedFiles: string[];
    browser: Awaited<ReturnType<typeof loadProjectDesignSystemBrowser>>;
  };

  expect(body.changedFiles).toEqual(
    expect.arrayContaining([
      'design-system/Design.md',
      'design-system/tokens.css',
      'design-system/components.css',
      'design-system/index.html',
    ]),
  );
  expect(await Bun.file(join(workspace, 'design-system', 'tokens.css')).text()).toContain(
    '--color-brand',
  );
  expect(body.browser.projectProfile?.htmlDesignSystem).toMatchObject({
    status: 'canonical',
    foundRequired: ['design-md', 'tokens-css', 'components-css'],
  });
  expect(
    body.browser.setupQuestions.find((question) => question.id === 'html.design-system'),
  ).toMatchObject({
    status: 'detected',
  });
});

test('html design-system proposal can be accepted into project sources', async () => {
  const workspace = await createHtmlFirstWorkspace();
  const proposalDir = join(workspace, 'design', 'proposals', '2026-07-05-1015');
  await mkdir(proposalDir, { recursive: true });
  await writeFile(
    join(proposalDir, 'Design.md'),
    '# Proposal Design\n\nUse extracted values.\n',
    'utf8',
  );
  await writeFile(
    join(proposalDir, 'tokens.css'),
    ':root { --color-brand: #14532d; --space-4: 16px; }\n',
    'utf8',
  );
  await writeFile(
    join(proposalDir, 'components.css'),
    '.button { color: var(--color-brand); padding: var(--space-4); }\n',
    'utf8',
  );
  await writeFile(
    join(proposalDir, 'design-system.html'),
    '<!doctype html><html><body><main data-sd-screen-root>Preview catalog</main></body></html>\n',
    'utf8',
  );
  await writeFile(
    join(proposalDir, 'extraction-report.md'),
    '# Extraction report\n\n- #14532d appeared 4 times.\n',
    'utf8',
  );

  const listRes = await designIndexRouter.request(
    `http://localhost/html-design-system-proposals?workspacePath=${encodeURIComponent(workspace)}`,
  );
  expect(listRes.status).toBe(200);
  const listBody = (await listRes.json()) as {
    proposals: Array<{ id: string; ready: boolean; filePath: string }>;
  };
  expect(listBody.proposals).toContainEqual(
    expect.objectContaining({
      id: '2026-07-05-1015',
      filePath: 'design/proposals/2026-07-05-1015',
      ready: true,
    }),
  );

  const acceptRes = await designIndexRouter.request(
    `http://localhost/html-design-system-proposals/2026-07-05-1015/accept?workspacePath=${encodeURIComponent(workspace)}`,
    { method: 'POST' },
  );

  expect(acceptRes.status).toBe(200);
  const acceptBody = (await acceptRes.json()) as {
    changedFiles: string[];
    deletedProposalPath: string;
    browser: Awaited<ReturnType<typeof loadProjectDesignSystemBrowser>>;
  };
  expect(acceptBody.changedFiles).toEqual(
    expect.arrayContaining([
      'design-system/Design.md',
      'design-system/tokens.css',
      'design-system/components.css',
      'design-system/index.html',
      'design/extraction-report.md',
    ]),
  );
  expect(acceptBody.deletedProposalPath).toBe('design/proposals/2026-07-05-1015');
  expect(await Bun.file(join(workspace, 'design-system', 'Design.md')).text()).toContain(
    'Proposal Design',
  );
  expect(await Bun.file(join(workspace, 'design-system', 'tokens.css')).text()).toContain(
    '--color-brand',
  );
  expect(await Bun.file(join(workspace, 'design-system', 'index.html')).text()).toContain(
    'data-sd-managed-design-system-preview',
  );
  expect(await Bun.file(join(workspace, 'design', 'extraction-report.md')).text()).toContain(
    '#14532d appeared 4 times',
  );
  expect(existsSync(proposalDir)).toBe(false);
  expect(acceptBody.browser.projectProfile?.htmlDesignSystem).toMatchObject({
    status: 'canonical',
    foundRequired: ['design-md', 'tokens-css', 'components-css'],
  });
});

test('html design-system proposal can be accepted with only required review files', async () => {
  const workspace = await createHtmlFirstWorkspace();
  const proposalDir = join(workspace, 'design', 'proposals', 'minimal-review');
  await mkdir(proposalDir, { recursive: true });
  await writeFile(
    join(proposalDir, 'Design.md'),
    '# Minimal Proposal Design\n\nUse the documented visual rules.\n',
    'utf8',
  );
  await writeFile(
    join(proposalDir, 'extraction-report.md'),
    '# Extraction report\n\n- Source: attached screenshot.\n- Confidence: medium.\n',
    'utf8',
  );

  const listRes = await designIndexRouter.request(
    `http://localhost/html-design-system-proposals?workspacePath=${encodeURIComponent(workspace)}`,
  );
  expect(listRes.status).toBe(200);
  const listBody = (await listRes.json()) as {
    proposals: Array<{
      id: string;
      ready: boolean;
      files: Array<{ label: string; required: boolean; exists: boolean }>;
    }>;
  };
  expect(listBody.proposals).toContainEqual(
    expect.objectContaining({
      id: 'minimal-review',
      ready: true,
    }),
  );
  const proposal = listBody.proposals.find((item) => item.id === 'minimal-review');
  expect(proposal?.files).toContainEqual(
    expect.objectContaining({ label: 'tokens.css', required: false, exists: false }),
  );
  expect(proposal?.files).toContainEqual(
    expect.objectContaining({ label: 'components.css', required: false, exists: false }),
  );

  const acceptRes = await designIndexRouter.request(
    `http://localhost/html-design-system-proposals/minimal-review/accept?workspacePath=${encodeURIComponent(workspace)}`,
    { method: 'POST' },
  );

  expect(acceptRes.status).toBe(200);
  const acceptBody = (await acceptRes.json()) as {
    changedFiles: string[];
    deletedProposalPath: string;
  };
  expect(acceptBody.changedFiles).toEqual(
    expect.arrayContaining([
      'design-system/Design.md',
      'design-system/index.html',
      'design/extraction-report.md',
    ]),
  );
  expect(acceptBody.changedFiles).not.toContain('design-system/tokens.css');
  expect(acceptBody.changedFiles).not.toContain('design-system/components.css');
  expect(await Bun.file(join(workspace, 'design-system', 'Design.md')).text()).toContain(
    'Minimal Proposal Design',
  );
  expect(await Bun.file(join(workspace, 'design', 'extraction-report.md')).text()).toContain(
    'attached screenshot',
  );
  expect(existsSync(join(workspace, 'design-system', 'tokens.css'))).toBe(false);
  expect(existsSync(join(workspace, 'design-system', 'components.css'))).toBe(false);
  expect(existsSync(proposalDir)).toBe(false);
});

test('html design-system proposal can be rejected without creating sources', async () => {
  const workspace = await createHtmlFirstWorkspace();
  const proposalDir = join(workspace, 'design', 'proposals', 'reject-me');
  await mkdir(proposalDir, { recursive: true });
  await writeFile(join(proposalDir, 'Design.md'), '# Reject me\n', 'utf8');
  await writeFile(join(proposalDir, 'tokens.css'), ':root { --color-brand: #14532d; }\n', 'utf8');
  await writeFile(join(proposalDir, 'components.css'), '.button { color: red; }\n', 'utf8');

  const res = await designIndexRouter.request(
    `http://localhost/html-design-system-proposals/reject-me?workspacePath=${encodeURIComponent(workspace)}`,
    { method: 'DELETE' },
  );

  expect(res.status).toBe(200);
  const body = (await res.json()) as { deletedProposalPath: string };
  expect(body.deletedProposalPath).toBe('design/proposals/reject-me');
  expect(existsSync(proposalDir)).toBe(false);
  expect(existsSync(join(workspace, 'Design.md'))).toBe(false);
});

async function createHtmlFirstWorkspace() {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0108-html-ds-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  await writeFile(
    join(workspace, '.sber-designer', 'project.sdproj'),
    JSON.stringify(
      {
        version: 1,
        name: 'HTML first',
        workspacePath: workspace,
        projectKind: 'html-first',
        screens: [],
        flow: [],
      },
      null,
      2,
    ),
    'utf8',
  );
  return workspace;
}
