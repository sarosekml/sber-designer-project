import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'bun:test';

import { AGENT_KIT_TOOLS } from '../services/api/src/agent-kit/tools';
import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';
import type { ToolContext } from '../services/api/src/agent/types';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const CRAFT_ROOT = join(REPO_ROOT, 'packages', 'agent-kit', 'kit', 'knowledge', 'craft');

test('D9 craft docs declare the same enforced rule ids as screen-craft', async () => {
  const screenCraft = (await import('../services/api/src/screen-craft')) as {
    SCREEN_CRAFT_RULE_IDS?: readonly string[];
  };
  const docs = await readCraftReferenceDocs();
  const enforcedIds = extractEnforcedRuleIds(docs);

  expect(screenCraft.SCREEN_CRAFT_RULE_IDS).toBeDefined();
  expect(enforcedIds.length).toBeGreaterThan(0);
  expect(screenCraft.SCREEN_CRAFT_RULE_IDS ?? []).toEqual(enforcedIds);
  expect(docs.join('\n')).not.toMatch(/\bibp-ui-kit\b|\bTile\b|\bMUI\b/u);
});

test('D9 sd.craft.requires injects craft references before the skill runbook', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const skill = kit.skills.find((candidate) => candidate.name === 'product-screen-generation');
  const polishSkill = kit.skills.find((candidate) => candidate.name === 'screen-polish');
  const loadSkill = AGENT_KIT_TOOLS.find((candidate) => candidate.name === 'load_agent_skill');
  if (!loadSkill) throw new Error('missing load_agent_skill');

  expect(skill?.craftRequires).toEqual([
    'craft-anti-slop',
    'craft-state-coverage',
    'craft-layout-spacing',
    'craft-data-density',
  ]);
  expect(polishSkill?.craftRequires).toEqual([
    'craft-typography',
    'craft-color',
    'craft-a11y-baseline',
    'craft-laws-of-ux',
  ]);
  expect(kit.knowledge.map((item) => item.id)).toEqual(
    expect.arrayContaining([
      'craft-layout-spacing',
      'craft-laws-of-ux',
      'craft-form-validation',
      'craft-data-density',
      'craft-motion-discipline',
    ]),
  );

  const loaded = (await loadSkill.handler(
    { name: 'product-screen-generation' },
    toolContext(),
  )) as { contents: string };

  const craftIndex = loaded.contents.indexOf('## Required Craft References');
  const runbookIndex = loaded.contents.indexOf('## Runbook');
  expect(craftIndex).toBeGreaterThan(0);
  expect(runbookIndex).toBeGreaterThan(craftIndex);
  expect(loaded.contents).toContain('craft.fake-metric');
  expect(loaded.contents).toContain('craft.language-fact-fidelity');
  expect(loaded.contents).toContain('craft.missing-state');
  expect(loaded.contents).toContain('craft.data-table.numeric-alignment');
});

async function readCraftReferenceDocs(): Promise<string[]> {
  const entries = await readdir(CRAFT_ROOT).catch(() => []);
  const docs = await Promise.all(
    entries
      .filter((entry) => entry.endsWith('.md'))
      .sort((a, b) => a.localeCompare(b))
      .map((entry) => readFile(join(CRAFT_ROOT, entry), 'utf8')),
  );
  return docs;
}

function extractEnforcedRuleIds(docs: string[]): string[] {
  return docs
    .flatMap((doc) => {
      const matches = Array.from(
        doc.matchAll(/^- id:\s*(craft(?:\.[a-z0-9-]+)+)[\s\S]*?^- mode:\s*enforced/gmu),
      );
      return matches.map((match) => match[1]!);
    })
    .sort((a, b) => a.localeCompare(b));
}

function toolContext(): ToolContext {
  return {
    user: 'test-user',
    projectName: 'Craft Contract Project',
    activeScreen: null,
    workspacePath: null,
    canvasUrl: null,
  };
}
