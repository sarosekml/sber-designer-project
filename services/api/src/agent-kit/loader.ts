import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { resolveDefaultKitRoot } from '@sber-designer/agent-kit';
import type {
  AgentKitAgent,
  AgentKitDiagnostic,
  AgentKitPermission,
  AgentKitKnowledgeResource,
  AgentKitScript,
  AgentKitSkill,
  AgentKitSource,
} from '@sber-designer/shared-types';

import {
  AgentKitConfigSchema,
  AgentKitScriptManifestSchema,
  parseInstructionFrontmatter,
  parseAgentFrontmatter,
  parseSkillFrontmatter,
  type AgentKitConfig,
} from './schema';
import {
  DEFAULT_AGENT_PERMISSION_POLICY,
  resolveAgentKitPermission,
  resolveAgentPermissionPolicy,
} from './permissions';
import { resolveInsideAgentsRoot } from './safe-path';

const DEFAULT_AGENT_NAME = 'ai-product-designer';
const MAX_INSTRUCTION_CHARS = 20_000;

export interface AgentKitInstruction {
  path: string;
  contents: string;
  source: AgentKitSource;
  permission?: AgentKitPermission;
}

export interface LoadedAgentKit {
  defaultAgent: AgentKitAgent;
  agents: AgentKitAgent[];
  skills: AgentKitSkill[];
  knowledge: AgentKitKnowledgeResource[];
  scripts: AgentKitScript[];
  instructions: AgentKitInstruction[];
  diagnostics: AgentKitDiagnostic[];
}

export interface LoadAgentKitOptions {
  workspacePath?: string | null;
  defaultAgentsDir?: string;
  personalAgentsDir?: string;
}

interface RootSpec {
  root: string;
  source: AgentKitSource;
}

interface RootLoadResult {
  root: string;
  source: AgentKitSource;
  config: AgentKitConfig;
  agents: AgentKitAgent[];
  skills: AgentKitSkill[];
  knowledge: AgentKitKnowledgeResource[];
  scripts: AgentKitScript[];
  instructions: AgentKitInstruction[];
  diagnostics: AgentKitDiagnostic[];
}

let cacheKey: string | null = null;
let cacheValue: LoadedAgentKit | null = null;

export function resetAgentKitCache(): void {
  cacheKey = null;
  cacheValue = null;
}

export async function loadAgentKit(options: LoadAgentKitOptions = {}): Promise<LoadedAgentKit> {
  const defaultRoot = resolve(options.defaultAgentsDir ?? resolveDefaultKitRoot());
  const personalRoot = isPersonalAgentKitEnabled()
    ? resolve(options.personalAgentsDir ?? resolve(homedir(), '.sber-designer', 'agents'))
    : null;
  const workspaceRoot = options.workspacePath ? resolve(options.workspacePath, '.agents') : null;
  const roots: RootSpec[] = [{ root: defaultRoot, source: 'default' }];
  if (personalRoot && personalRoot !== defaultRoot) {
    roots.push({ root: personalRoot, source: 'personal' });
  }
  if (workspaceRoot && workspaceRoot !== defaultRoot && workspaceRoot !== personalRoot) {
    roots.push({ root: workspaceRoot, source: 'workspace' });
  }
  const key = JSON.stringify(roots);
  if (cacheKey === key && cacheValue) return cacheValue;

  const diagnostics: AgentKitDiagnostic[] = [];
  const loadedRoots: RootLoadResult[] = [];
  for (const root of roots) {
    const exists = await pathExists(root.root);
    if (!exists) {
      if (root.source === 'default') {
        diagnostics.push({
          level: 'error',
          code: 'missing_default_root',
          message: `Default agent kit root is missing: ${root.root}`,
          path: root.root,
        });
      } else if (root.source === 'personal') {
        diagnostics.push({
          level: 'info',
          code: 'missing_personal_root',
          message: `Personal agent kit is enabled but missing: ${root.root}`,
          path: root.root,
        });
      }
      continue;
    }
    loadedRoots.push(await loadRoot(root));
    diagnostics.push({
      level: 'info',
      code: 'agent_root_loaded',
      message: `Loaded ${root.source} agent root: ${root.root}`,
      path: root.root,
    });
  }

  const agents = mergeByName(
    loadedRoots.flatMap((root) => root.agents),
    diagnostics,
  );
  const skills = mergeByName(
    loadedRoots.flatMap((root) => root.skills),
    diagnostics,
  );
  const knowledge = mergeByName(
    loadedRoots.flatMap((root) => root.knowledge),
    diagnostics,
  );
  const scripts = mergeByName(
    loadedRoots.flatMap((root) => root.scripts),
    diagnostics,
  );
  const instructions = loadedRoots.flatMap((root) => root.instructions);
  diagnostics.push(...loadedRoots.flatMap((root) => root.diagnostics));

  const defaultName =
    [...loadedRoots].reverse().find((root) => root.config.defaultAgent)?.config.defaultAgent ??
    DEFAULT_AGENT_NAME;
  const defaultAgent =
    agents.find((agent) => agent.name === defaultName) ??
    agents.find((agent) => agent.name === DEFAULT_AGENT_NAME) ??
    fallbackAgent(diagnostics);

  const kit = {
    defaultAgent,
    agents,
    skills,
    knowledge,
    scripts,
    instructions,
    diagnostics,
  };
  cacheKey = key;
  cacheValue = kit;
  return kit;
}

async function loadRoot(spec: RootSpec): Promise<RootLoadResult> {
  const diagnostics: AgentKitDiagnostic[] = [];
  const config = await readConfig(spec.root, spec.source, diagnostics);
  const instructions = await discoverInstructions(spec.root, spec.source, config, diagnostics);
  const agents = await discoverAgents(spec.root, spec.source, config, instructions, diagnostics);
  const skills = await discoverSkills(spec.root, spec.source, diagnostics);
  const knowledge = await discoverKnowledge(spec.root, spec.source, config, diagnostics);
  const scripts = await discoverScripts(spec.root, spec.source, config, diagnostics);
  return {
    root: spec.root,
    source: spec.source,
    config,
    agents,
    skills,
    knowledge,
    scripts,
    instructions,
    diagnostics,
  };
}

async function readConfig(
  root: string,
  source: AgentKitSource,
  diagnostics: AgentKitDiagnostic[],
): Promise<AgentKitConfig> {
  const path = join(root, 'config.json');
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    return AgentKitConfigSchema.parse(parsed);
  } catch (err) {
    if (await pathExists(path)) {
      diagnostics.push({
        level: 'error',
        code: 'invalid_config',
        message: err instanceof Error ? err.message : String(err),
        path: publicPath(root, path),
      });
    }
    return AgentKitConfigSchema.parse({
      defaultAgent: DEFAULT_AGENT_NAME,
      instructions: [`agents/${DEFAULT_AGENT_NAME}.md`],
    });
  }
}

async function discoverAgents(
  root: string,
  source: AgentKitSource,
  config: AgentKitConfig,
  instructions: AgentKitInstruction[],
  diagnostics: AgentKitDiagnostic[],
): Promise<AgentKitAgent[]> {
  const dir = join(root, 'agents');
  const entries = await safeReadDir(dir);
  const agents: AgentKitAgent[] = [];
  const instructionPermissions = instructions
    .map((instruction) => instruction.permission)
    .filter((permission): permission is AgentKitPermission => Boolean(permission));
  for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith('.md'))) {
    const abs = join(dir, entry.name);
    try {
      const markdown = await readFile(abs, 'utf8');
      const parsed = parseAgentFrontmatter(markdown);
      const frontmatterPolicy = {
        ...(parsed.frontmatter.tools ? { tools: parsed.frontmatter.tools } : {}),
        ...(parsed.frontmatter.skills ? { skills: parsed.frontmatter.skills } : {}),
      };
      agents.push({
        name: parsed.frontmatter.name,
        description: parsed.frontmatter.description,
        mode: parsed.frontmatter.mode,
        hidden: parsed.frontmatter.hidden,
        path: publicPath(root, abs),
        source,
        body: parsed.body.trim(),
        permissionPolicy: resolveAgentPermissionPolicy(frontmatterPolicy, {
          tools: DEFAULT_AGENT_PERMISSION_POLICY.tools,
          skills: config.skills,
        }),
        permission: resolveAgentKitPermission(
          config.permission,
          ...instructionPermissions,
          parsed.frontmatter.permission,
        ),
        ...(parsed.frontmatter.temperature !== undefined
          ? { temperature: parsed.frontmatter.temperature }
          : {}),
        ...(parsed.frontmatter.maxIterations !== undefined
          ? { maxIterations: parsed.frontmatter.maxIterations }
          : {}),
      });
    } catch (err) {
      diagnostics.push({
        level: 'error',
        code: 'invalid_agent',
        message: err instanceof Error ? err.message : String(err),
        path: publicPath(root, abs),
      });
    }
  }
  return agents;
}

async function discoverSkills(
  root: string,
  source: AgentKitSource,
  diagnostics: AgentKitDiagnostic[],
): Promise<AgentKitSkill[]> {
  const dir = join(root, 'skills');
  const entries = await safeReadDir(dir);
  const skills: AgentKitSkill[] = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const abs = join(dir, entry.name, 'SKILL.md');
    if (!(await pathExists(abs))) continue;
    try {
      const parsed = parseSkillFrontmatter(await readFile(abs, 'utf8'));
      if (parsed.frontmatter.name !== entry.name) {
        diagnostics.push({
          level: 'warning',
          code: 'skill_name_mismatch',
          message: `Skill folder "${entry.name}" differs from frontmatter name "${parsed.frontmatter.name}".`,
          path: publicPath(root, abs),
        });
      }
      skills.push({
        name: parsed.frontmatter.name,
        description: parsed.frontmatter.description,
        path: publicPath(root, abs),
        source,
        body: parsed.body.trim(),
        ...(parsed.frontmatter.license ? { license: parsed.frontmatter.license } : {}),
        ...(parsed.frontmatter.compatibility
          ? { compatibility: parsed.frontmatter.compatibility }
          : {}),
        ...skillSberDesignerMetadata(parsed.frontmatter),
      });
    } catch (err) {
      diagnostics.push({
        level: 'error',
        code: 'invalid_skill',
        message: err instanceof Error ? err.message : String(err),
        path: publicPath(root, abs),
      });
    }
  }
  return skills;
}

function skillSberDesignerMetadata(frontmatter: {
  sd?:
    | {
        profile?: unknown;
        craft?:
          | {
              requires?: unknown;
            }
          | undefined;
        critique?:
          | {
              policy?: unknown;
            }
          | undefined;
      }
    | undefined;
}): Pick<AgentKitSkill, 'profiles' | 'craftRequires' | 'critiquePolicy'> {
  const profiles = normalizeStringList(frontmatter.sd?.profile);
  const craftRequires = normalizeStringList(frontmatter.sd?.craft?.requires);
  const critiquePolicy = normalizeCritiquePolicy(frontmatter.sd?.critique?.policy);
  return {
    ...(profiles.length > 0 ? { profiles } : {}),
    ...(craftRequires.length > 0 ? { craftRequires } : {}),
    ...(critiquePolicy ? { critiquePolicy } : {}),
  };
}

function normalizeCritiquePolicy(value: unknown): AgentKitSkill['critiquePolicy'] | undefined {
  return value === 'required' || value === 'opt-in' || value === 'opt-out' ? value : undefined;
}

function normalizeStringList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
}

async function discoverKnowledge(
  root: string,
  source: AgentKitSource,
  config: AgentKitConfig,
  diagnostics: AgentKitDiagnostic[],
): Promise<AgentKitKnowledgeResource[]> {
  const byId = new Map<string, AgentKitKnowledgeResource>();
  for (const item of config.knowledge) {
    try {
      const abs = resolveInsideAgentsRoot(root, item.path);
      const stats = await stat(abs);
      byId.set(item.id, {
        id: item.id,
        path: publicPath(root, abs),
        description: item.description,
        source,
        sizeBytes: stats.size,
      });
    } catch (err) {
      diagnostics.push({
        level: 'warning',
        code: 'missing_knowledge',
        message: err instanceof Error ? err.message : String(err),
        path: item.path,
      });
    }
  }
  const implicit = await walkMarkdown(join(root, 'knowledge'));
  for (const abs of implicit) {
    const id = slugify(relative(join(root, 'knowledge'), abs).replace(/\.md$/i, ''));
    if (byId.has(id)) continue;
    const stats = await stat(abs);
    byId.set(id, {
      id,
      path: publicPath(root, abs),
      description: titleFromPath(abs),
      source,
      sizeBytes: stats.size,
    });
  }
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

async function discoverScripts(
  root: string,
  source: AgentKitSource,
  config: AgentKitConfig,
  diagnostics: AgentKitDiagnostic[],
): Promise<AgentKitScript[]> {
  const scripts = new Map<string, AgentKitScript>();
  for (const [name, script] of Object.entries(config.scripts ?? {})) {
    scripts.set(name, {
      name,
      description: script.description,
      command: script.command,
      args: script.args,
      cwd: script.cwd,
      permission: script.permission,
      timeoutMs: script.timeoutMs,
      source,
    });
  }
  const dir = join(root, 'scripts');
  const entries = await safeReadDir(dir);
  for (const entry of entries.filter(
    (item) => item.isFile() && item.name.endsWith('.agent-script.json'),
  )) {
    const abs = join(dir, entry.name);
    try {
      const parsed = AgentKitScriptManifestSchema.parse(JSON.parse(await readFile(abs, 'utf8')));
      scripts.set(parsed.name, { ...parsed, source });
    } catch (err) {
      diagnostics.push({
        level: 'error',
        code: 'invalid_script',
        message: err instanceof Error ? err.message : String(err),
        path: publicPath(root, abs),
      });
    }
  }
  return Array.from(scripts.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function discoverInstructions(
  root: string,
  source: AgentKitSource,
  config: AgentKitConfig,
  diagnostics: AgentKitDiagnostic[],
): Promise<AgentKitInstruction[]> {
  const instructions: AgentKitInstruction[] = [];
  const patterns =
    config.instructions.length > 0 ? config.instructions : [`agents/${config.defaultAgent}.md`];
  for (const pattern of patterns) {
    for (const abs of await expandPattern(root, pattern)) {
      try {
        const contents = await readFile(abs, 'utf8');
        const parsed = parseInstructionFrontmatter(contents);
        instructions.push({
          path: publicPath(root, abs),
          contents:
            contents.length > MAX_INSTRUCTION_CHARS
              ? `${contents.slice(0, MAX_INSTRUCTION_CHARS).trim()}\n\n[instruction truncated]`
              : contents,
          source,
          ...(parsed.frontmatter.permission ? { permission: parsed.frontmatter.permission } : {}),
        });
      } catch (err) {
        diagnostics.push({
          level: 'warning',
          code: 'missing_instruction',
          message: err instanceof Error ? err.message : String(err),
          path: pattern,
        });
      }
    }
  }
  return instructions;
}

async function expandPattern(root: string, pattern: string): Promise<string[]> {
  if (!pattern.includes('*')) {
    return [resolveInsideAgentsRoot(root, pattern)];
  }
  const slash = pattern.lastIndexOf('/');
  const dirPattern = slash === -1 ? '' : pattern.slice(0, slash);
  const filePattern = slash === -1 ? pattern : pattern.slice(slash + 1);
  const dir = resolveInsideAgentsRoot(root, dirPattern || '.');
  const regexp = new RegExp(`^${filePattern.split('*').map(escapeRegExp).join('.*')}$`);
  const entries = await safeReadDir(dir);
  return entries
    .filter((entry) => entry.isFile() && regexp.test(entry.name))
    .map((entry) => join(dir, entry.name))
    .sort();
}

function mergeByName<
  T extends { name?: string; id?: string; source: AgentKitSource; path?: string },
>(items: T[], diagnostics: AgentKitDiagnostic[]): T[] {
  const byName = new Map<string, T>();
  for (const item of items) {
    const key = item.name ?? item.id;
    if (!key) continue;
    const existing = byName.get(key);
    if (existing) {
      diagnostics.push({
        level: 'info',
        code: 'overridden',
        message: `${key} from ${existing.source} was overridden by ${item.source}.`,
        ...(item.path ? { path: item.path } : {}),
      });
    }
    byName.set(key, item);
  }
  return Array.from(byName.values()).sort((a, b) =>
    (a.name ?? a.id ?? '').localeCompare(b.name ?? b.id ?? ''),
  );
}

function fallbackAgent(diagnostics: AgentKitDiagnostic[]): AgentKitAgent {
  diagnostics.push({
    level: 'error',
    code: 'missing_default_agent',
    message: 'No ai-product-designer agent prompt was found. Using emergency fallback.',
  });
  return {
    name: DEFAULT_AGENT_NAME,
    description: 'Emergency fallback built-in product designer agent.',
    mode: 'primary',
    hidden: false,
    path: 'fallback',
    source: 'default',
    body: 'You are the built-in ai-product-designer agent. Prefer existing project components, inspect files before edits, and keep changes scoped to the active project context.',
    permissionPolicy: DEFAULT_AGENT_PERMISSION_POLICY,
    permission: resolveAgentKitPermission(),
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function safeReadDir(path: string): Promise<import('node:fs').Dirent[]> {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function walkMarkdown(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await safeReadDir(root)) {
    const abs = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkMarkdown(abs)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(abs);
    }
  }
  return out.sort();
}

function publicPath(root: string, abs: string): string {
  return relative(root, abs).split('\\').join('/');
}

function slugify(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function titleFromPath(path: string): string {
  const name = path.split(/[\\/]/).pop()?.replace(/\.md$/i, '') ?? 'knowledge';
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isPersonalAgentKitEnabled(): boolean {
  return process.env.SBER_DESIGNER_USER_KIT === 'enabled';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
