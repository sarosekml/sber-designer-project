import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { materializeHtmlDesignSystemPreset } from '../services/api/src/html-design-system-presets';
import { designIndexRouter } from '../services/api/src/routes/design-index';

interface StyleProposalSummary {
  id: string;
  ready: boolean;
  styleContract: {
    required: boolean;
    recognized: boolean;
    complete: boolean;
    presentSections: number;
    totalSections: number;
    diagnostics: string[];
  };
}

test('B3 scout proposal stays draft until the nine-section contract is complete', async () => {
  const workspace = await createWorkspace();
  const proposalId = 'style-scout-20260718t101112z';
  const proposalRoot = join(workspace, 'design', 'proposals', proposalId);
  await mkdir(proposalRoot, { recursive: true });
  await writeFile(join(proposalRoot, 'Design.md'), '# Unstructured visual notes\n', 'utf8');
  await writeFile(
    join(proposalRoot, 'extraction-report.md'),
    '# Extraction report\n\n- Evidence: attached screenshot.\n',
    'utf8',
  );

  const draft = await listProposals(workspace);
  expect(draft).toContainEqual(
    expect.objectContaining({
      id: proposalId,
      ready: false,
      styleContract: expect.objectContaining({
        required: true,
        recognized: false,
        complete: false,
        presentSections: 0,
        totalSections: 9,
      }),
    }),
  );

  const prematureAccept = await acceptProposal(workspace, proposalId);
  expect(prematureAccept.status).toBe(400);
  expect(await prematureAccept.text()).toContain('0/9 complete sections');
  expect(existsSync(join(workspace, 'design-system', 'Design.md'))).toBe(false);

  const completeContract = materializeHtmlDesignSystemPreset(
    'dashboard-first',
    'Reference workspace',
  ).designMd;
  await writeFile(join(proposalRoot, 'Design.md'), completeContract, 'utf8');

  const ready = await listProposals(workspace);
  expect(ready).toContainEqual(
    expect.objectContaining({
      id: proposalId,
      ready: true,
      styleContract: expect.objectContaining({
        required: true,
        recognized: true,
        complete: true,
        presentSections: 9,
        totalSections: 9,
        diagnostics: [],
      }),
    }),
  );

  const accepted = await acceptProposal(workspace, proposalId);
  expect(accepted.status).toBe(200);
  expect(await readFile(join(workspace, 'design-system', 'Design.md'), 'utf8')).toContain(
    '## 9. Agent Prompt Guide',
  );
  expect(existsSync(proposalRoot)).toBe(false);
});

test('B3 confirm preserves an existing React DESIGN.md path instead of creating a case variant', async () => {
  const workspace = await createWorkspace('react-vite');
  const proposalId = 'style-scout-react-path';
  const proposalRoot = join(workspace, 'design', 'proposals', proposalId);
  await writeFile(join(workspace, 'DESIGN.md'), '# Existing contract\n', 'utf8');
  await mkdir(proposalRoot, { recursive: true });
  await writeFile(
    join(proposalRoot, 'Design.md'),
    materializeHtmlDesignSystemPreset('dense-enterprise', 'React workspace').designMd,
    'utf8',
  );
  await writeFile(
    join(proposalRoot, 'extraction-report.md'),
    '# Extraction report\n\n- Evidence: attached screenshot.\n',
    'utf8',
  );

  const accepted = await acceptProposal(workspace, proposalId);
  expect(accepted.status).toBe(200);
  expect(await readFile(join(workspace, 'DESIGN.md'), 'utf8')).toContain(
    '## 9. Agent Prompt Guide',
  );
  const rootDesignFiles = (await readdir(workspace)).filter(
    (name) => name.toLowerCase() === 'design.md',
  );
  expect(rootDesignFiles).toHaveLength(1);
  expect(rootDesignFiles[0]).toBe('DESIGN.md');
});

async function listProposals(workspace: string): Promise<StyleProposalSummary[]> {
  const response = await designIndexRouter.request(
    `http://localhost/html-design-system-proposals?workspacePath=${encodeURIComponent(workspace)}`,
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { proposals: StyleProposalSummary[] };
  return body.proposals;
}

async function acceptProposal(workspace: string, proposalId: string): Promise<Response> {
  return designIndexRouter.request(
    `http://localhost/html-design-system-proposals/${proposalId}/accept?workspacePath=${encodeURIComponent(workspace)}`,
    { method: 'POST' },
  );
}

async function createWorkspace(
  projectKind: 'html-first' | 'react-vite' = 'html-first',
): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0114-style-scout-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  await writeFile(
    join(workspace, '.sber-designer', 'project.sdproj'),
    `${JSON.stringify(
      {
        version: 1,
        name: 'Reference workspace',
        workspacePath: workspace,
        projectKind,
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
