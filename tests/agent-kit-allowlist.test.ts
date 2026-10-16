import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { AGENT_KIT_TOOLS } from '../services/api/src/agent-kit/tools';
import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import { filterAgentTools } from '../services/api/src/agent-kit/permissions';
import { loadAgentToolsForContext } from '../services/api/src/agent/toolset';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { patchState, resetState } from '../services/api/src/state-store';
import type { ServerTool, ToolContext } from '../services/api/src/agent/types';

test('agent frontmatter resolves tools and skills permission policy', async () => {
  const workspace = await createWorkspaceKit({
    frontmatter: [
      'name: ai-product-designer',
      'description: Restricted product designer.',
      'tools:',
      '  allow:',
      '    - read_file',
      '    - list_agent_skills',
      '    - load_agent_skill',
      '  deny:',
      '    - write_file',
      'skills:',
      '  allow:',
      '    - project-specific-skill',
      '  deny:',
      '    - denied-skill',
    ],
  });

  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });

  expect(kit.defaultAgent.permissionPolicy).toEqual({
    tools: {
      allow: ['read_file', 'list_agent_skills', 'load_agent_skill'],
      deny: ['write_file'],
    },
    skills: {
      allow: ['project-specific-skill'],
      deny: ['denied-skill'],
    },
  });
});

test('tool filtering applies allow and deny lists from the active agent', async () => {
  const workspace = await createWorkspaceKit({
    frontmatter: [
      'name: ai-product-designer',
      'description: Tool-restricted product designer.',
      'tools:',
      '  allow:',
      '    - read_file',
      '    - write_file',
      '    - list_agent_skills',
      '  deny:',
      '    - write_file',
    ],
  });

  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });
  const tools = filterAgentTools(fakeTools(['read_file', 'write_file', 'list_agent_skills']), {
    policy: kit.defaultAgent.permissionPolicy,
  });

  expect(tools.map((tool) => tool.name)).toEqual(['read_file', 'list_agent_skills']);
});

test('request toolset is filtered from the active agent policy', async () => {
  const workspace = await createWorkspaceKit({
    frontmatter: [
      'name: ai-product-designer',
      'description: Request-filtered product designer.',
      'tools:',
      '  allow:',
      '    - read_file',
      '    - list_agent_skills',
      '  deny:',
      '    - apply_patch',
    ],
  });

  resetAgentKitCache();
  const tools = await loadAgentToolsForContext(toolContext(workspace));

  expect(tools.map((tool) => tool.name)).toEqual(['read_file', 'list_agent_skills']);
});

test('skill tools hide and reject skills denied by the active agent', async () => {
  const workspace = await createWorkspaceKit({
    frontmatter: [
      'name: ai-product-designer',
      'description: Skill-restricted product designer.',
      'skills:',
      '  allow:',
      '    - project-specific-skill',
      '  deny:',
      '    - denied-skill',
    ],
  });
  const ctx = toolContext(workspace);
  const listSkills = findAgentKitTool('list_agent_skills');
  const loadSkill = findAgentKitTool('load_agent_skill');

  resetAgentKitCache();
  const listed = (await listSkills.handler({}, ctx)) as { skills: { name: string }[] };

  expect(listed.skills.map((skill) => skill.name)).toContain('project-specific-skill');
  expect(listed.skills.map((skill) => skill.name)).not.toContain('denied-skill');

  const loaded = (await loadSkill.handler({ name: 'project-specific-skill' }, ctx)) as {
    contents: string;
  };
  expect(loaded.contents).toContain('FULL SKILL BODY');

  await expect(loadSkill.handler({ name: 'denied-skill' }, ctx)).rejects.toThrow(
    'agent_skill_denied',
  );
});

test('system prompt inventory hides denied skills', async () => {
  const workspace = await createWorkspaceKit({
    frontmatter: [
      'name: ai-product-designer',
      'description: Prompt-restricted product designer.',
      'skills:',
      '  allow:',
      '    - project-specific-skill',
      '  deny:',
      '    - denied-skill',
    ],
  });

  resetState();
  resetAgentKitCache();
  patchState({ workspacePath: workspace, projectName: 'Agent Allowlist Project' });
  const prompt = await buildSystemPrompt();
  resetState();
  resetAgentKitCache();

  expect(prompt.text).toContain('project-specific-skill');
  expect(prompt.text).not.toContain('denied-skill');
  expect(prompt.text).not.toContain('Forbidden workflow');
});

test('omitted agent policy defaults to all tools and config skill defaults', async () => {
  const workspace = await createWorkspaceKit({
    frontmatter: ['name: ai-product-designer', 'description: Open product designer.'],
  });
  const ctx = toolContext(workspace);
  const listSkills = findAgentKitTool('list_agent_skills');

  resetAgentKitCache();
  const kit = await loadAgentKit({ workspacePath: workspace });
  const tools = filterAgentTools(fakeTools(['read_file', 'write_file']), {
    policy: kit.defaultAgent.permissionPolicy,
  });
  const listed = (await listSkills.handler({}, ctx)) as { skills: { name: string }[] };

  expect(tools.map((tool) => tool.name)).toEqual(['read_file', 'write_file']);
  expect(listed.skills.map((skill) => skill.name)).toEqual(
    expect.arrayContaining(['project-specific-skill', 'denied-skill']),
  );
});

function findAgentKitTool(name: string) {
  const tool = AGENT_KIT_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

function toolContext(workspacePath: string): ToolContext {
  return {
    user: 'test-user',
    projectName: 'Agent Allowlist Project',
    activeScreen: null,
    workspacePath,
    canvasUrl: null,
  };
}

function fakeTools(names: string[]): ServerTool[] {
  return names.map((name) => ({
    name,
    description: `${name} description`,
    inputSchema: { safeParse: (value: unknown) => ({ success: true, data: value }) } as never,
    handler: async () => ({}),
  }));
}

async function createWorkspaceKit(options: { frontmatter: string[] }): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-allowlist-'));
  const root = join(workspace, '.agents');
  await mkdir(join(root, 'agents'), { recursive: true });
  await mkdir(join(root, 'skills', 'project-specific-skill'), { recursive: true });
  await mkdir(join(root, 'skills', 'denied-skill'), { recursive: true });
  await writeFile(
    join(root, 'config.json'),
    JSON.stringify(
      {
        defaultAgent: 'ai-product-designer',
        instructions: ['agents/ai-product-designer.md'],
        skills: {
          allow: ['*'],
          deny: [],
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, 'agents', 'ai-product-designer.md'),
    ['---', ...options.frontmatter, '---', '', 'Workspace prompt.'].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'skills', 'project-specific-skill', 'SKILL.md'),
    [
      '---',
      'name: project-specific-skill',
      'description: Use local workflow.',
      '---',
      '',
      'FULL SKILL BODY',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'skills', 'denied-skill', 'SKILL.md'),
    [
      '---',
      'name: denied-skill',
      'description: Forbidden workflow.',
      '---',
      '',
      'DENIED SKILL BODY',
    ].join('\n'),
    'utf8',
  );
  return workspace;
}
