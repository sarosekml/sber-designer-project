import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DesignBriefSchema,
  designBriefPromptSection,
  generationModePromptSection,
  instructionHierarchyPromptSection,
} from '../services/api/src/generation-mode';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';

test('explicit run instructions outrank generic harness design advice', () => {
  const section = instructionHierarchyPromptSection();

  expect(section).toContain('1. The current explicit user request for this run.');
  expect(section).toContain('4. Generic harness defaults');
  expect(section).toContain(
    'never overrides an explicit user instruction not to use existing screens',
  );
});

test('wireframe generation mode asks for an apply visual style follow-up', () => {
  const section = generationModePromptSection({ wireframe: true });

  expect(section).toContain('Wireframe mode is enabled');
  expect(section).toContain('apply visual style');
});

test('wireframe and Jury choices are persisted in the run manifest before generation', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-generation-mode-'));
  try {
    const run = await createAgentRun({
      route: 'chat-stream',
      user: 'test-user',
      workspacePath,
      generationMode: 'wireframe',
      designJuryRequested: true,
    });
    const persisted = JSON.parse(
      await readFile(
        join(workspacePath, '.sber-designer', 'runs', run.runId, 'run-manifest.json'),
        'utf8',
      ),
    ) as { generationMode?: string; designJuryRequested?: boolean };

    expect(persisted.generationMode).toBe('wireframe');
    expect(persisted.designJuryRequested).toBe(true);
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
});

test('structured design brief is validated, trimmed, and marks unresolved axes', () => {
  const designBrief = DesignBriefSchema.parse({
    version: 1,
    source: 'mini-form',
    axes: {
      palette: '  Muted neutrals with a blue accent  ',
      density: 'compact',
      constraints: [' Keep existing navigation ', 'Show empty state'],
    },
  });
  const section = designBriefPromptSection({ designBrief });

  expect(designBrief.axes.palette).toBe('Muted neutrals with a blue accent');
  expect(section).toContain('## Design brief');
  expect(section).toContain('- Palette: Muted neutrals with a blue accent');
  expect(section).toContain('- Density: compact');
  expect(section).toContain('- Typography: not specified');
  expect(section).toContain('ask one concise question before editing');
  expect(section).toContain('disclose it in the final response as an assumed default');
  expect(() => DesignBriefSchema.parse({ version: 1, source: 'request', axes: {} })).toThrow(
    'at least one axis',
  );
});

test('screen-reference constraint overrides generic nearby-screen guidance', () => {
  const designBrief = DesignBriefSchema.parse({
    version: 1,
    source: 'mini-form',
    axes: { constraints: ['Не используй текущие экраны проекта'] },
  });
  const section = designBriefPromptSection({ designBrief });

  expect(section).toContain('do not inspect or derive layout');
  expect(section).not.toContain('prefer evidence from the project index, nearby screens');
});
