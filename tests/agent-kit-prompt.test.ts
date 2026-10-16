import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { expect, test } from 'bun:test';

import { resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { patchState, resetState } from '../services/api/src/state-store';

test('system prompt uses workspace ai-product-designer override and skill inventory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-agent-prompt-'));
  await mkdir(join(root, '.agents', 'agents'), { recursive: true });
  await mkdir(join(root, '.agents', 'skills', 'project-specific-skill'), { recursive: true });
  await writeFile(
    join(root, '.agents', 'config.json'),
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
    join(root, '.agents', 'agents', 'ai-product-designer.md'),
    [
      '---',
      'name: ai-product-designer',
      'description: Workspace product designer.',
      '---',
      '',
      'WORKSPACE_AGENT_PROMPT_MARKER: obey local product rules.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, '.agents', 'skills', 'project-specific-skill', 'SKILL.md'),
    [
      '---',
      'name: project-specific-skill',
      'description: Use local product-specific workflow.',
      '---',
      '',
      'FULL_SKILL_BODY_SHOULD_NOT_BE_IN_SYSTEM_PROMPT',
    ].join('\n'),
    'utf8',
  );

  resetState();
  resetAgentKitCache();
  patchState({ workspacePath: root, projectName: 'Agent Prompt Project' });
  const prompt = await buildSystemPrompt();
  resetState();
  resetAgentKitCache();

  expect(prompt.text).toContain('WORKSPACE_AGENT_PROMPT_MARKER');
  expect(prompt.text).toContain('project-specific-skill');
  expect(prompt.text).toContain('Use local product-specific workflow.');
  expect(prompt.text).not.toContain('FULL_SKILL_BODY_SHOULD_NOT_BE_IN_SYSTEM_PROMPT');
  expect(prompt.text.indexOf('WORKSPACE_AGENT_PROMPT_MARKER')).toBeLessThan(
    prompt.text.indexOf('## Editor state'),
  );
});

test('system prompt injects manual project instructions before editor state', async () => {
  resetState();
  resetAgentKitCache();
  patchState({
    projectName: 'Instruction Project',
    projectInstructions:
      'Prefer compact enterprise screens. Use realistic operational data and avoid marketing hero layouts.',
  });

  const prompt = await buildSystemPrompt();
  resetState();
  resetAgentKitCache();

  expect(prompt.text).toContain('## Project Instructions');
  expect(prompt.text).toContain('Prefer compact enterprise screens');
  expect(prompt.text.indexOf('## Project Instructions')).toBeGreaterThan(
    prompt.text.indexOf('## Agent'),
  );
  expect(prompt.text.indexOf('## Project Instructions')).toBeLessThan(
    prompt.text.indexOf('## Editor state'),
  );
});

test('system prompt preserves brief language and business facts for screen generation', async () => {
  resetState();
  resetAgentKitCache();
  patchState({ projectName: 'Fidelity Contract Project' });

  const prompt = await buildSystemPrompt();
  resetState();
  resetAgentKitCache();

  expect(prompt.text).toContain('contentFidelityLanguage');
  expect(prompt.text).toContain('language of the user brief or specification');
  expect(prompt.text).toContain('contentFidelityFacts');
  expect(prompt.text).toContain('names, amounts, dates, identifiers, and status labels verbatim');
});

test('system prompt injects the structured design brief before project evidence', async () => {
  resetState();
  resetAgentKitCache();
  patchState({ projectName: 'Structured Brief Project' });

  const prompt = await buildSystemPrompt({
    taskKind: 'screen-generation',
    generation: {
      designBrief: {
        version: 1,
        source: 'mini-form',
        axes: { layout: 'Primary work area with a narrow context rail', density: 'compact' },
      },
    },
  });
  resetState();
  resetAgentKitCache();

  expect(prompt.text).toContain('## Design brief');
  expect(prompt.text).toContain('- Layout: Primary work area with a narrow context rail');
  expect(prompt.text).toContain('- Density: compact');
  expect(prompt.text.indexOf('## Design brief')).toBeLessThan(
    prompt.text.indexOf('## Editor state'),
  );
});

test('system prompt removes generic existing-screen advice when the brief forbids references', async () => {
  resetState();
  resetAgentKitCache();
  patchState({ projectName: 'Independent Brief Project' });

  const prompt = await buildSystemPrompt({
    taskKind: 'screen-generation',
    generation: {
      designBrief: {
        version: 1,
        source: 'mini-form',
        axes: { constraints: ['Do not use existing screens as references'] },
      },
    },
  });
  resetState();
  resetAgentKitCache();

  expect(prompt.text).toContain('Existing-screen reference policy');
  expect(prompt.text).not.toContain('catalog components, and existing screens');
});
