import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { expect, test } from 'bun:test';

import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';

test('loads default agent kit with skills knowledge scripts and instructions', async () => {
  const defaultRoot = await createAgentRoot('default-agent body', {
    skillDescription: 'Default screen generation.',
    knowledgeText: '# Default Patterns\n\nUse dense SaaS layouts.',
  });

  const kit = await loadAgentKit({ defaultAgentsDir: defaultRoot });

  expect(kit.defaultAgent.name).toBe('ai-product-designer');
  expect(kit.defaultAgent.body).toContain('default-agent body');
  expect(kit.skills).toContainEqual(
    expect.objectContaining({
      name: 'product-screen-generation',
      description: 'Default screen generation.',
      source: 'default',
      critiquePolicy: 'opt-in',
    }),
  );
  expect(kit.knowledge).toContainEqual(
    expect.objectContaining({
      id: 'product-ui-patterns',
      source: 'default',
    }),
  );
  expect(kit.scripts).toContainEqual(
    expect.objectContaining({
      name: 'validate-design-context',
      source: 'default',
    }),
  );
  expect(kit.instructions.map((instruction) => instruction.path)).toContain(
    'agents/ai-product-designer.md',
  );
});

test('workspace .agents overrides default agent and skill with same name', async () => {
  const defaultRoot = await createAgentRoot('default-agent body', {
    skillDescription: 'Default screen generation.',
    knowledgeText: '# Default Patterns',
  });
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-workspace-'));
  const workspaceRoot = join(workspace, '.agents');
  await createAgentRoot('workspace-agent body', {
    root: workspaceRoot,
    skillDescription: 'Workspace screen generation.',
    knowledgeText: '# Workspace Patterns',
  });

  resetAgentKitCache();
  const kit = await loadAgentKit({ defaultAgentsDir: defaultRoot, workspacePath: workspace });

  expect(kit.defaultAgent.body).toContain('workspace-agent body');
  expect(kit.skills.find((skill) => skill.name === 'product-screen-generation')?.description).toBe(
    'Workspace screen generation.',
  );
  expect(kit.diagnostics.some((diagnostic) => diagnostic.code === 'overridden')).toBe(true);
});

test('personal agent kit is opt-in and sits between default and workspace roots', async () => {
  const defaultRoot = await createAgentRoot('default-agent body', {
    skillDescription: 'Default screen generation.',
    knowledgeText: '# Default Patterns',
  });
  const personalRoot = await createAgentRoot('personal-agent body', {
    skillDescription: 'Personal screen generation.',
    knowledgeText: '# Personal Patterns',
  });
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-personal-workspace-'));
  const workspaceRoot = join(workspace, '.agents');
  await createAgentRoot('workspace-agent body', {
    root: workspaceRoot,
    skillDescription: 'Workspace screen generation.',
    knowledgeText: '# Workspace Patterns',
  });

  const previous = process.env.SBER_DESIGNER_USER_KIT;
  process.env.SBER_DESIGNER_USER_KIT = 'enabled';
  try {
    resetAgentKitCache();
    const personalOnly = await loadAgentKit({
      defaultAgentsDir: defaultRoot,
      personalAgentsDir: personalRoot,
    });
    expect(personalOnly.defaultAgent.source).toBe('personal');
    expect(personalOnly.defaultAgent.body).toContain('personal-agent body');
    expect(
      personalOnly.diagnostics.some(
        (diagnostic) => diagnostic.code === 'agent_root_loaded' && diagnostic.path === personalRoot,
      ),
    ).toBe(true);

    resetAgentKitCache();
    const withWorkspace = await loadAgentKit({
      defaultAgentsDir: defaultRoot,
      personalAgentsDir: personalRoot,
      workspacePath: workspace,
    });
    expect(withWorkspace.defaultAgent.source).toBe('workspace');
    expect(withWorkspace.defaultAgent.body).toContain('workspace-agent body');
    expect(
      withWorkspace.skills.find((skill) => skill.name === 'product-screen-generation')?.source,
    ).toBe('workspace');
  } finally {
    if (previous === undefined) delete process.env.SBER_DESIGNER_USER_KIT;
    else process.env.SBER_DESIGNER_USER_KIT = previous;
    resetAgentKitCache();
  }
});

test('personal agent kit stays disabled unless the env flag is enabled', async () => {
  const defaultRoot = await createAgentRoot('default-agent body', {
    skillDescription: 'Default screen generation.',
    knowledgeText: '# Default Patterns',
  });
  const personalRoot = await createAgentRoot('personal-agent body', {
    skillDescription: 'Personal screen generation.',
    knowledgeText: '# Personal Patterns',
  });
  const previous = process.env.SBER_DESIGNER_USER_KIT;
  delete process.env.SBER_DESIGNER_USER_KIT;
  try {
    resetAgentKitCache();
    const kit = await loadAgentKit({
      defaultAgentsDir: defaultRoot,
      personalAgentsDir: personalRoot,
    });
    expect(kit.defaultAgent.source).toBe('default');
    expect(kit.defaultAgent.body).toContain('default-agent body');
    expect(kit.agents.some((agent) => agent.source === 'personal')).toBe(false);
  } finally {
    if (previous === undefined) delete process.env.SBER_DESIGNER_USER_KIT;
    else process.env.SBER_DESIGNER_USER_KIT = previous;
    resetAgentKitCache();
  }
});

test('missing workspace .agents falls back to default kit without diagnostics errors', async () => {
  const defaultRoot = await createAgentRoot('default-agent body', {
    skillDescription: 'Default screen generation.',
    knowledgeText: '# Default Patterns',
  });
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-no-workspace-kit-'));

  resetAgentKitCache();
  const kit = await loadAgentKit({ defaultAgentsDir: defaultRoot, workspacePath: workspace });

  expect(kit.defaultAgent.source).toBe('default');
  expect(kit.diagnostics.some((diagnostic) => diagnostic.level === 'error')).toBe(false);
});

test('loader falls back to convention discovery when config is missing', async () => {
  const defaultRoot = await mkdtemp(join(tmpdir(), 'sd-agent-convention-default-'));
  await mkdir(join(defaultRoot, 'agents'), { recursive: true });
  await mkdir(join(defaultRoot, 'skills', 'product-screen-generation'), { recursive: true });
  await mkdir(join(defaultRoot, 'knowledge'), { recursive: true });
  await mkdir(join(defaultRoot, 'scripts'), { recursive: true });
  await writeFile(
    join(defaultRoot, 'agents', 'ai-product-designer.md'),
    [
      '---',
      'name: ai-product-designer',
      'description: Convention agent.',
      '---',
      '',
      'Convention prompt.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(defaultRoot, 'skills', 'product-screen-generation', 'SKILL.md'),
    [
      '---',
      'name: product-screen-generation',
      'description: Convention skill.',
      '---',
      '',
      '# Product Screen Generation',
    ].join('\n'),
    'utf8',
  );
  await writeFile(join(defaultRoot, 'knowledge', 'project-notes.md'), '# Project Notes', 'utf8');
  await writeFile(
    join(defaultRoot, 'scripts', 'validate-design-context.agent-script.json'),
    JSON.stringify({
      name: 'validate-design-context',
      description: 'Validate design context.',
      command: 'bun',
      args: ['run', 'validate:design'],
      cwd: 'workspace',
      permission: 'ask',
      timeoutMs: 120000,
    }),
    'utf8',
  );

  resetAgentKitCache();
  const kit = await loadAgentKit({ defaultAgentsDir: defaultRoot });

  expect(kit.defaultAgent.body).toContain('Convention prompt.');
  expect(kit.skills).toContainEqual(
    expect.objectContaining({
      name: 'product-screen-generation',
      description: 'Convention skill.',
    }),
  );
  expect(kit.knowledge).toContainEqual(
    expect.objectContaining({ id: 'project-notes', description: 'Project Notes' }),
  );
  expect(kit.scripts).toContainEqual(expect.objectContaining({ name: 'validate-design-context' }));
});

async function createAgentRoot(
  body: string,
  options: {
    root?: string;
    skillDescription: string;
    knowledgeText: string;
  },
): Promise<string> {
  const root = options.root ?? (await mkdtemp(join(tmpdir(), 'sd-agent-default-')));
  await mkdir(join(root, 'agents'), { recursive: true });
  await mkdir(join(root, 'skills', 'product-screen-generation'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });
  await mkdir(join(root, 'scripts'), { recursive: true });
  await writeFile(
    join(root, 'config.json'),
    JSON.stringify(
      {
        defaultAgent: 'ai-product-designer',
        instructions: ['agents/ai-product-designer.md'],
        knowledge: [
          {
            id: 'product-ui-patterns',
            path: 'knowledge/product-ui-patterns.md',
            description: 'Product UI patterns.',
          },
        ],
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
      'description: Product-aware code designer.',
      'mode: primary',
      '---',
      '',
      body,
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'skills', 'product-screen-generation', 'SKILL.md'),
    [
      '---',
      'name: product-screen-generation',
      `description: ${options.skillDescription}`,
      'sd:',
      '  critique:',
      '    policy: opt-in',
      '---',
      '',
      '# Product Screen Generation',
    ].join('\n'),
    'utf8',
  );
  await writeFile(join(root, 'knowledge', 'product-ui-patterns.md'), options.knowledgeText, 'utf8');
  await writeFile(
    join(root, 'scripts', 'validate-design-context.agent-script.json'),
    JSON.stringify(
      {
        name: 'validate-design-context',
        description: 'Validate DESIGN.md and design-index artifacts.',
        command: 'bun',
        args: ['run', 'validate:design'],
        cwd: 'workspace',
        permission: 'ask',
        timeoutMs: 120000,
      },
      null,
      2,
    ),
    'utf8',
  );
  return root;
}
