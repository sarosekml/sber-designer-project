import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'bun:test';

import { resolveDefaultKitRoot } from '../packages/agent-kit/src/paths';
import { loadAgentKit, resetAgentKitCache } from '../services/api/src/agent-kit/loader';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

test('0140 resolveDefaultKitRoot points at a packaged kit with config.json', async () => {
  const root = resolveDefaultKitRoot();
  expect(root).toContain(join('packages', 'agent-kit', 'kit'));
  const entries = await readdir(root, { withFileTypes: true });
  for (const required of [
    'config.json',
    'agents',
    'instructions',
    'skills',
    'knowledge',
    'scripts',
    'screen-templates',
  ]) {
    expect(entries.some((entry) => entry.name === required)).toBe(true);
  }
  await readFile(join(root, 'config.json'), 'utf8');
});

test('0140 SBER_DESIGNER_AGENT_KIT_DIR overrides the default kit root', async () => {
  const previous = process.env.SBER_DESIGNER_AGENT_KIT_DIR;
  try {
    process.env.SBER_DESIGNER_AGENT_KIT_DIR = '/tmp/custom-agent-kit-dir';
    expect(resolveDefaultKitRoot()).toBe('/tmp/custom-agent-kit-dir');
    process.env.SBER_DESIGNER_AGENT_KIT_DIR = '  ';
    expect(resolveDefaultKitRoot()).toContain(join('packages', 'agent-kit', 'kit'));
  } finally {
    if (previous === undefined) {
      delete process.env.SBER_DESIGNER_AGENT_KIT_DIR;
    } else {
      process.env.SBER_DESIGNER_AGENT_KIT_DIR = previous;
    }
  }
});

test('0140 the packaged kit loads complete: 9 agents, 19 skills, no error diagnostics', async () => {
  resetAgentKitCache();
  const kit = await loadAgentKit();
  const defaultAgents = kit.agents.filter((agent) => agent.source === 'default');
  const defaultSkills = kit.skills.filter((skill) => skill.source === 'default');
  // Counts mirror the tracked kit at migration time (the task file said 13
  // skills; the real tree has 19 — this test protects the actual number).
  expect(defaultAgents).toHaveLength(9);
  expect(defaultSkills).toHaveLength(19);
  expect(kit.diagnostics.filter((diagnostic) => diagnostic.level === 'error')).toEqual([]);
  resetAgentKitCache();
});

test('0140 no resolve(REPO_ROOT_GUESS, ".agents") duplicates remain in kit code', async () => {
  const offenders: string[] = [];
  for (const dir of [
    join(REPO_ROOT, 'services'),
    join(REPO_ROOT, 'packages'),
    join(REPO_ROOT, 'apps'),
  ]) {
    offenders.push(...(await grepRecursive(dir, /REPO_ROOT_GUESS/u)));
  }
  // The two allowed survivors are about sber-designer.json / .sber-designer/,
  // not the agent kit (0140 §4.1).
  const allowed = offenders.filter(
    (line) =>
      line.startsWith('services/api/src/config-store.ts:') ||
      line.startsWith('services/api/src/project-paths.ts:'),
  );
  expect(offenders).toEqual(allowed);
  expect(allowed.length).toBeGreaterThan(0);
});

async function grepRecursive(dir: string, pattern: RegExp): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await grepRecursive(path, pattern)));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    const text = await readFile(path, 'utf8');
    const relative = path.replace(`${REPO_ROOT.replace(/\/$/u, '')}/`, '');
    for (const [index, line] of text.split('\n').entries()) {
      if (pattern.test(line)) out.push(`${relative}:${index + 1}`);
    }
  }
  return out;
}

test('0140 C4: SBER_DESIGNER_AGENT_KIT_DIR drives the full consumer chain in a subprocess', async () => {
  const kitDir = await mkdtemp(join(tmpdir(), 'sd-0140-env-kit-'));
  await mkdir(join(kitDir, 'agents'), { recursive: true });
  await mkdir(join(kitDir, 'skills', 'fixture-skill'), { recursive: true });
  await mkdir(join(kitDir, 'screen-templates'), { recursive: true });
  await writeFile(
    join(kitDir, 'config.json'),
    JSON.stringify({
      defaultAgent: 'fixture-agent',
      instructions: ['agents/fixture-agent.md'],
      knowledge: [],
    }),
    'utf8',
  );
  await writeFile(
    join(kitDir, 'agents', 'fixture-agent.md'),
    [
      '---',
      'name: fixture-agent',
      'description: Fixture agent for the env-override integration test.',
      '---',
      '',
      'Fixture agent body.',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(kitDir, 'skills', 'fixture-skill', 'SKILL.md'),
    [
      '---',
      'name: fixture-skill',
      'description: Fixture skill for the env-override integration test.',
      '---',
      '',
      'Fixture skill body.',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(kitDir, 'screen-templates', 'fixture.screen.md'),
    [
      '---',
      'name: fixture',
      'description: Fixture template.',
      'surface: page',
      '---',
      '',
      '# Fixture',
      '',
      'Body',
      '',
    ].join('\n'),
    'utf8',
  );

  // A fresh process exercises the import-time constants too (screen-template
  // dirs and route roots are computed at module load), not just the resolver
  // function in isolation.
  const script = `
import { resolveDefaultKitRoot } from ${JSON.stringify(pathToFileURL(join(REPO_ROOT, 'packages/agent-kit/src/paths.ts')).href)};
import { loadAgentKit, resetAgentKitCache } from ${JSON.stringify(pathToFileURL(join(REPO_ROOT, 'services/api/src/agent-kit/loader.ts')).href)};
import { resetScreenTemplatesCache, resolveScreenTemplates } from ${JSON.stringify(pathToFileURL(join(REPO_ROOT, 'services/api/src/screen-templates/index.ts')).href)};
resetAgentKitCache();
const kit = await loadAgentKit();
resetScreenTemplatesCache();
const templates = await resolveScreenTemplates();
console.log(JSON.stringify({
  root: resolveDefaultKitRoot(),
  agents: kit.agents.map((a) => a.name),
  skills: kit.skills.map((s) => s.name),
  templates: templates.templates.map((t) => t.name),
  errors: kit.diagnostics.filter((d) => d.level === 'error').map((d) => d.message),
}));
`;
  const spawned = spawnSync('bun', ['-e', script], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, SBER_DESIGNER_AGENT_KIT_DIR: kitDir },
  });
  expect(spawned.status).toBe(0);
  const parsed = JSON.parse(spawned.stdout.trim().split('\n').at(-1)!) as {
    root: string;
    agents: string[];
    skills: string[];
    templates: string[];
    errors: number;
  };
  expect(parsed.root).toBe(kitDir);
  expect(parsed.agents).toEqual(['fixture-agent']);
  expect(parsed.skills).toEqual(['fixture-skill']);
  expect(parsed.templates).toEqual(['fixture']);
  expect(parsed.errors).toEqual([]);

  await rm(kitDir, { recursive: true, force: true });
}, 60_000);
