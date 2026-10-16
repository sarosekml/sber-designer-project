import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { AGENT_KIT_TOOLS } from '../services/api/src/agent-kit/tools';
import { resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import { runAgentScriptManifest } from '../services/api/src/agent-kit/script-runner';
import type { ToolContext } from '../services/api/src/agent/types';
import type { AgentKitScript } from '../packages/shared-types/src';

test('run_agent_script executes allow manifests without shell and redacts env-like output', async () => {
  const workspace = await createWorkspaceKit({
    name: 'project-check',
    description: 'Run project check.',
    command: 'bun',
    args: ['-e', 'console.log("ok TOKEN=super-secret")'],
    cwd: 'workspace',
    permission: 'allow',
    timeoutMs: 120000,
  });
  const listScripts = findTool('list_agent_scripts');
  const runScript = findTool('run_agent_script');

  resetAgentKitCache();
  const scripts = (await listScripts.handler({}, toolContext(workspace))) as {
    scripts: { name: string }[];
    diagnostics: { code: string; message: string; path?: string }[];
  };
  expect(scripts.diagnostics).not.toContainEqual(
    expect.objectContaining({ code: 'invalid_script' }),
  );
  expect(scripts.scripts).toContainEqual(expect.objectContaining({ name: 'project-check' }));
  const result = (await runScript.handler({ name: 'project-check' }, toolContext(workspace))) as {
    status: string;
    exitCode: number | null;
    stdout: string;
    stderr: string;
  };

  expect(result.status).toBe('completed');
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('ok TOKEN=[redacted]');
  expect(result.stdout).not.toContain('super-secret');
  expect(result.stderr).toBe('');
});

test('script runner resolves agents cwd against the manifest source root', async () => {
  const agentsRoot = await mkdtemp(join(tmpdir(), 'sd-agent-script-agents-root-'));
  await writeFile(join(agentsRoot, 'marker.txt'), 'from agents root', 'utf8');

  const result = await runAgentScriptManifest(scriptFixture({ cwd: 'agents' }), {
    workspacePath: null,
    agentsRoot,
    env: {},
  });

  expect(result.status).toBe('completed');
  expect(result.stdout.trim()).toBe('from agents root');
});

test('script runner blocks disabled execution and non-allowlisted commands', async () => {
  const disabled = await runAgentScriptManifest(scriptFixture({ command: process.execPath }), {
    workspacePath: await mkdtemp(join(tmpdir(), 'sd-agent-script-disabled-')),
    agentsRoot: await mkdtemp(join(tmpdir(), 'sd-agent-script-disabled-agents-')),
    env: { SBER_DESIGNER_AGENT_SCRIPTS: 'disabled' },
  });
  expect(disabled.status).toBe('denied');
  expect(disabled.detail).toContain('disabled');

  const notAllowed = await runAgentScriptManifest(scriptFixture({ command: 'node' }), {
    workspacePath: await mkdtemp(join(tmpdir(), 'sd-agent-script-allowlist-')),
    agentsRoot: await mkdtemp(join(tmpdir(), 'sd-agent-script-allowlist-agents-')),
    env: { SBER_DESIGNER_AGENT_SCRIPT_ALLOWLIST: 'bun,git' },
  });
  expect(notAllowed.status).toBe('denied');
  expect(notAllowed.detail).toContain('not in the allowlist');
});

test('script runner denies workspace scripts without a connected workspace', async () => {
  const result = await runAgentScriptManifest(scriptFixture({ cwd: 'workspace' }), {
    workspacePath: null,
    agentsRoot: await mkdtemp(join(tmpdir(), 'sd-agent-script-no-workspace-agents-')),
    env: {},
  });

  expect(result.status).toBe('denied');
  expect(result.detail).toContain('requires a connected workspace');
  expect(result.cwdPath).toBeNull();
});

test('script runner truncates combined output and reports timeouts', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-script-output-'));
  const agentsRoot = await mkdtemp(join(tmpdir(), 'sd-agent-script-output-agents-'));
  const truncated = await runAgentScriptManifest(
    scriptFixture({
      args: ['-e', 'console.log("1234567890"); console.error("SECRET=value")'],
      command: process.execPath,
      cwd: 'workspace',
      timeoutMs: 120000,
    }),
    {
      workspacePath: workspace,
      agentsRoot,
      env: {},
      outputLimitBytes: 8,
    },
  );

  expect(truncated.status).toBe('completed');
  expect(truncated.truncated).toBe(true);
  expect(truncated.detail).toContain('Output was truncated');
  expect(`${truncated.stdout}${truncated.stderr}`).toHaveLength(8);

  const timedOut = await runAgentScriptManifest(
    scriptFixture({
      args: ['-e', 'setTimeout(() => {}, 1000)'],
      command: process.execPath,
      cwd: 'workspace',
      timeoutMs: 25,
    }),
    {
      workspacePath: workspace,
      agentsRoot,
      env: {},
    },
  );

  expect(timedOut.status).toBe('timed_out');
  expect(timedOut.detail).toContain('timed out');
});

function findTool(name: string) {
  const tool = AGENT_KIT_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

function toolContext(workspacePath: string): ToolContext {
  return {
    user: 'test-user',
    projectName: 'Agent Script Project',
    activeScreen: null,
    workspacePath,
    canvasUrl: null,
  };
}

async function createWorkspaceKit(script: Omit<AgentKitScript, 'source'>): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-script-tool-'));
  const root = join(workspace, '.agents');
  await mkdir(join(root, 'agents'), { recursive: true });
  await mkdir(join(root, 'scripts'), { recursive: true });
  await writeFile(
    join(root, 'config.json'),
    JSON.stringify(
      {
        defaultAgent: 'ai-product-designer',
        instructions: ['agents/ai-product-designer.md'],
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, 'agents', 'ai-product-designer.md'),
    [
      '---',
      'name: ai-product-designer',
      'description: Workspace product designer.',
      '---',
      '',
      'Workspace prompt.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'scripts', `${script.name}.agent-script.json`),
    JSON.stringify(script, null, 2),
    'utf8',
  );
  return workspace;
}

function scriptFixture(overrides: Partial<AgentKitScript> = {}): AgentKitScript {
  return {
    name: 'fixture-script',
    description: 'Fixture script.',
    command: process.execPath,
    args: ['-e', 'console.log(require("node:fs").readFileSync("marker.txt", "utf8"))'],
    cwd: 'agents',
    permission: 'allow',
    timeoutMs: 120000,
    source: 'default',
    ...overrides,
  };
}
