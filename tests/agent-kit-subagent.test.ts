import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { expect, test } from 'bun:test';

import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import {
  resolvePrimaryAgent,
  resolveRequestedAgent,
} from '../services/api/src/agent-kit/active-agent';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';

test('loader exposes primary agents and subagents with modes', async () => {
  const root = await createSubagentRoot();

  resetAgentKitCache();
  const kit = await loadAgentKit({ defaultAgentsDir: root });

  expect(kit.defaultAgent.name).toBe('ai-product-designer');
  expect(kit.defaultAgent.mode).toBe('primary');
  expect(kit.agents).toContainEqual(
    expect.objectContaining({
      name: 'ai-design-system-scout',
      mode: 'subagent',
      permission: expect.objectContaining({ edit: 'deny', read: 'allow' }),
    }),
  );
});

test('requested chat agent must be an invokable subagent', async () => {
  const root = await createSubagentRoot();

  resetAgentKitCache();
  const kit = await loadAgentKit({ defaultAgentsDir: root });

  expect(resolveRequestedAgent(kit, undefined)).toEqual({ ok: true, agent: kit.defaultAgent });
  expect(resolveRequestedAgent(kit, 'ai-design-system-scout')).toEqual({
    ok: true,
    agent: expect.objectContaining({ name: 'ai-design-system-scout', mode: 'subagent' }),
  });
  expect(resolveRequestedAgent(kit, 'ai-flex-agent')).toEqual({
    ok: true,
    agent: expect.objectContaining({ name: 'ai-flex-agent', mode: 'all' }),
  });
  expect(resolveRequestedAgent(kit, 'missing-agent')).toEqual({
    ok: false,
    code: 'agent_not_found',
    detail: 'Agent "missing-agent" was not found.',
  });
  expect(resolveRequestedAgent(kit, 'ai-hidden-scout')).toEqual({
    ok: false,
    code: 'agent_hidden',
    detail: 'Agent "ai-hidden-scout" is hidden.',
  });
  expect(resolveRequestedAgent(kit, 'ai-product-designer')).toEqual({
    ok: false,
    code: 'agent_not_invokable',
    detail: 'Agent "ai-product-designer" is not a subagent.',
  });
});

test('primary agent selection accepts only visible primary-capable agents', async () => {
  const root = await createSubagentRoot();

  resetAgentKitCache();
  const kit = await loadAgentKit({ defaultAgentsDir: root });

  expect(resolvePrimaryAgent(kit, undefined)).toEqual({ ok: true, agent: kit.defaultAgent });
  expect(resolvePrimaryAgent(kit, 'ai-product-designer')).toEqual({
    ok: true,
    agent: expect.objectContaining({ name: 'ai-product-designer', mode: 'primary' }),
  });
  expect(resolvePrimaryAgent(kit, 'ai-flex-agent')).toEqual({
    ok: true,
    agent: expect.objectContaining({ name: 'ai-flex-agent', mode: 'all' }),
  });
  expect(resolvePrimaryAgent(kit, 'ai-design-system-scout')).toEqual({
    ok: false,
    code: 'agent_not_invokable',
    detail: 'Agent "ai-design-system-scout" is not a primary agent.',
  });
  expect(resolvePrimaryAgent(kit, 'ai-hidden-scout')).toEqual({
    ok: false,
    code: 'agent_hidden',
    detail: 'Agent "ai-hidden-scout" is hidden.',
  });
});

test('system prompt can be built for a requested subagent session', async () => {
  resetAgentKitCache();
  const prompt = await buildSystemPrompt({ agentName: 'ai-design-system-scout' });

  expect(prompt.text).toContain('activeAgent: `ai-design-system-scout`');
  expect(prompt.text).toContain('read-only design-system scout');
  expect(prompt.text).not.toContain('activeAgent: `ai-product-designer`');
  expect(prompt.text).not.toContain('# ai-product-designer');
});

async function createSubagentRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-agent-subagent-'));
  await mkdir(join(root, 'agents'), { recursive: true });
  await mkdir(join(root, 'skills', 'design-system-context'), { recursive: true });
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
      'description: Primary product designer.',
      'mode: primary',
      '---',
      '',
      'Primary prompt.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'agents', 'ai-design-system-scout.md'),
    [
      '---',
      'name: ai-design-system-scout',
      'description: Read-only design system research subagent.',
      'mode: subagent',
      'tools:',
      '  allow:',
      '    - read_file',
      '    - list_agent_knowledge',
      '    - read_agent_knowledge',
      '  deny: []',
      'permission:',
      '  read: allow',
      '  edit: deny',
      '  run_script: deny',
      '  send_pr: deny',
      '---',
      '',
      'Scout prompt.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'agents', 'ai-flex-agent.md'),
    [
      '---',
      'name: ai-flex-agent',
      'description: Visible primary-capable and directly invokable agent.',
      'mode: all',
      '---',
      '',
      'Flexible prompt.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'agents', 'ai-hidden-scout.md'),
    [
      '---',
      'name: ai-hidden-scout',
      'description: Hidden system helper.',
      'mode: subagent',
      'hidden: true',
      '---',
      '',
      'Hidden prompt.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'skills', 'design-system-context', 'SKILL.md'),
    [
      '---',
      'name: design-system-context',
      'description: Read project design system context.',
      '---',
      '',
      '# Design System Context',
    ].join('\n'),
    'utf8',
  );
  return root;
}
