import { copyFile, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { Hono } from 'hono';
import { resolveDefaultKitRoot } from '@sber-designer/agent-kit';

import { loadAgentKit, resetAgentKitCache } from '../agent-kit/loader';
import { filterAgentSkills } from '../agent-kit/permissions';
import { getState } from '../state-store';

const DEFAULT_AGENTS_ROOT = resolveDefaultKitRoot();

export const agentKitRouter = new Hono()
  .get('/', async (c) => {
    const state = getState();
    const workspaceRoot = state.workspacePath ? resolve(state.workspacePath, '.agents') : null;
    const kit = await loadAgentKit(
      state.workspacePath === undefined ? {} : { workspacePath: state.workspacePath },
    );
    const visibleSkills = filterAgentSkills(kit.skills, {
      policy: kit.defaultAgent.permissionPolicy,
    });
    return c.json({
      defaultAgent: withoutBody(kit.defaultAgent),
      agents: kit.agents.map(withoutBody),
      instructions: kit.instructions.map((instruction) => ({
        path: instruction.path,
        source: instruction.source,
        sizeBytes: instruction.contents.length,
      })),
      skills: visibleSkills,
      knowledge: kit.knowledge,
      scripts: kit.scripts,
      diagnostics: kit.diagnostics,
      defaultRoot: DEFAULT_AGENTS_ROOT,
      workspaceRoot,
      workspaceKitExists: workspaceRoot ? await pathExists(workspaceRoot) : false,
    });
  })
  .post('/reload', (c) => {
    resetAgentKitCache();
    return c.json({ ok: true });
  })
  .post('/bootstrap', async (c) => {
    const state = getState();
    if (!state.workspacePath) {
      return c.json(
        { error: 'no_workspace', detail: 'No active workspace. Connect a project first.' },
        400,
      );
    }

    const workspaceRoot = resolve(state.workspacePath, '.agents');
    if (await pathExists(workspaceRoot)) {
      return c.json(
        {
          error: 'workspace_agent_kit_exists',
          detail: 'Workspace .agents already exists.',
          workspaceRoot,
        },
        409,
      );
    }

    try {
      const createdPaths = await copyDirectory(DEFAULT_AGENTS_ROOT, workspaceRoot);
      const gitIgnored = await isAgentsIgnoredByGitignore(state.workspacePath);
      resetAgentKitCache();
      return c.json({
        ok: true,
        workspaceRoot,
        createdPaths,
        gitIgnored,
        ...(gitIgnored
          ? {
              warning:
                'Workspace .gitignore ignores .agents, so the created kit may not be committed.',
            }
          : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'bootstrap_failed', detail: message, workspaceRoot }, 422);
    }
  });

function withoutBody<T extends { body?: string }>(agent: T): Omit<T, 'body'> {
  const { body: _body, ...rest } = agent;
  return rest;
}

async function copyDirectory(from: string, to: string, rootTo = to): Promise<string[]> {
  const createdPaths: string[] = [];
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) {
      createdPaths.push(...(await copyDirectory(source, target, rootTo)));
      continue;
    }
    if (!entry.isFile()) continue;
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    createdPaths.push(relative(rootTo, target).split('\\').join('/'));
  }
  return createdPaths.sort();
}

async function isAgentsIgnoredByGitignore(workspacePath: string): Promise<boolean> {
  const gitignorePath = resolve(workspacePath, '.gitignore');
  const contents = await readFile(gitignorePath, 'utf8').catch(() => '');
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
    .some((line) =>
      ['.agents', '.agents/', '/.agents', '/.agents/', '**/.agents', '**/.agents/'].includes(line),
    );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
