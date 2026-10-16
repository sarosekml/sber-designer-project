import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import { agentKitRouter } from '../services/api/src/routes/agent-kit';
import { patchState, resetState } from '../services/api/src/state-store';

test('agent kit route returns frontend-safe inventory for active workspace', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-kit-route-'));
  await mkdir(join(workspace, '.agents', 'agents'), { recursive: true });
  await mkdir(join(workspace, '.agents', 'skills', 'route-skill'), { recursive: true });
  await writeFile(
    join(workspace, '.agents', 'config.json'),
    JSON.stringify({ defaultAgent: 'ai-product-designer' }, null, 2),
    'utf8',
  );
  await writeFile(
    join(workspace, '.agents', 'agents', 'ai-product-designer.md'),
    [
      '---',
      'name: ai-product-designer',
      'description: Route agent.',
      '---',
      '',
      'Route prompt.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(workspace, '.agents', 'skills', 'route-skill', 'SKILL.md'),
    ['---', 'name: route-skill', 'description: Route skill.', '---', '', 'body'].join('\n'),
    'utf8',
  );

  resetState();
  resetAgentKitCache();
  patchState({ workspacePath: workspace });
  const response = await agentKitRouter.request('http://localhost/');
  const body = (await response.json()) as {
    defaultAgent: { name: string; body?: string };
    skills: { name: string }[];
    diagnostics: { level: string; code: string }[];
    workspaceRoot: string | null;
    workspaceKitExists: boolean;
    defaultRoot: string;
  };
  resetState();
  resetAgentKitCache();

  expect(response.status).toBe(200);
  expect(body.defaultAgent.name).toBe('ai-product-designer');
  expect(body.defaultAgent.body).toBeUndefined();
  expect(body.workspaceRoot).toBe(join(workspace, '.agents'));
  expect(body.workspaceKitExists).toBe(true);
  // 0140: the default root resolves inside packages/agent-kit, not repo .agents.
  expect(body.defaultRoot).toContain(join('packages', 'agent-kit', 'kit'));
  expect(body.skills).toContainEqual(expect.objectContaining({ name: 'route-skill' }));
  expect(body.diagnostics.some((diagnostic) => diagnostic.level === 'error')).toBe(false);
});

test('agent kit reload route clears cache and returns ok', async () => {
  const response = await agentKitRouter.request('http://localhost/reload', { method: 'POST' });
  const body = (await response.json()) as { ok: boolean };

  expect(response.status).toBe(200);
  expect(body.ok).toBe(true);
});

test('agent kit bootstrap requires an active workspace', async () => {
  resetState();
  resetAgentKitCache();
  const response = await agentKitRouter.request('http://localhost/bootstrap', { method: 'POST' });
  const body = (await response.json()) as { error: string };

  expect(response.status).toBe(400);
  expect(body.error).toBe('no_workspace');
});

test('agent kit bootstrap creates workspace .agents from the default skeleton', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-kit-bootstrap-'));

  resetState();
  resetAgentKitCache();
  patchState({ workspacePath: workspace });
  const response = await agentKitRouter.request('http://localhost/bootstrap', { method: 'POST' });
  const body = (await response.json()) as {
    ok: boolean;
    workspaceRoot: string;
    createdPaths: string[];
    gitIgnored: boolean;
  };
  resetAgentKitCache();
  const inventory = await agentKitRouter.request('http://localhost/');
  const inventoryBody = (await inventory.json()) as {
    workspaceKitExists: boolean;
    skills: { name: string; source: string }[];
  };
  resetState();
  resetAgentKitCache();

  expect(response.status).toBe(200);
  expect(body.ok).toBe(true);
  expect(body.workspaceRoot).toBe(join(workspace, '.agents'));
  expect(body.createdPaths).toContain('config.json');
  expect(body.createdPaths).toContain('README.md');
  expect(body.createdPaths).toContain('agents/ai-product-designer.md');
  expect(body.gitIgnored).toBe(false);
  expect(await readFile(join(workspace, '.agents', 'README.md'), 'utf8')).toContain(
    'sber-designer `.agents`',
  );
  await expect(
    stat(join(workspace, '.agents', 'agents', 'ai-product-designer.md')),
  ).resolves.toBeTruthy();
  expect(inventoryBody.workspaceKitExists).toBe(true);
  expect(inventoryBody.skills.some((skill) => skill.source === 'workspace')).toBe(true);
});

test('agent kit bootstrap refuses to overwrite an existing workspace kit', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-kit-bootstrap-existing-'));
  await mkdir(join(workspace, '.agents'), { recursive: true });

  resetState();
  resetAgentKitCache();
  patchState({ workspacePath: workspace });
  const response = await agentKitRouter.request('http://localhost/bootstrap', { method: 'POST' });
  const body = (await response.json()) as { error: string };
  resetState();
  resetAgentKitCache();

  expect(response.status).toBe(409);
  expect(body.error).toBe('workspace_agent_kit_exists');
});

test('agent kit bootstrap reports when workspace gitignore ignores .agents', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-kit-bootstrap-ignored-'));
  await writeFile(join(workspace, '.gitignore'), '.agents/\n', 'utf8');

  resetState();
  resetAgentKitCache();
  patchState({ workspacePath: workspace });
  const response = await agentKitRouter.request('http://localhost/bootstrap', { method: 'POST' });
  const body = (await response.json()) as { gitIgnored: boolean; warning?: string };
  const gitignore = await readFile(join(workspace, '.gitignore'), 'utf8');
  resetState();
  resetAgentKitCache();

  expect(response.status).toBe(200);
  expect(body.gitIgnored).toBe(true);
  expect(body.warning).toContain('.agents');
  expect(gitignore).toBe('.agents/\n');
});
