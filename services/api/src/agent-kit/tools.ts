import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { z } from 'zod';
import { resolveDefaultKitRoot } from '@sber-designer/agent-kit';

import type {
  AgentKitKnowledgeResource,
  AgentKitScript,
  AgentKitSource,
  AgentKitSkill,
} from '@sber-designer/shared-types';
import type { ServerTool, ToolContext } from '../agent/types';
import { loadAgentKit } from './loader';
import { filterAgentSkills, isAgentSkillAllowed } from './permissions';
import { resolveInsideAgentsRoot } from './safe-path';
import { runAgentScriptManifest, type AgentScriptRunResult } from './script-runner';

const MAX_AGENT_RESOURCE_BYTES = 40_000;
const MAX_SKILL_PACKAGE_FILES = 10;
const MAX_SKILL_PACKAGE_BYTES = 64_000;

const EmptyInput = z.object({}).strict();

const listAgentSkills: ServerTool<
  z.infer<typeof EmptyInput>,
  { skills: AgentKitSkill[]; diagnostics: Awaited<ReturnType<typeof loadAgentKit>>['diagnostics'] }
> = {
  name: 'list_agent_skills',
  description:
    'List project-local .agents skills available to the built-in agent. Use before choosing a skill by name.',
  inputSchema: EmptyInput,
  handler: async (_input, ctx) => {
    const kit = await loadAgentKit({ workspacePath: ctx.workspacePath });
    return {
      // Strip skill bodies — this is a lean inventory; bodies are fetched via
      // load_agent_skill (or inlined into external-runtime handoffs).
      skills: filterAgentSkills(kit.skills, { policy: kit.defaultAgent.permissionPolicy }).map(
        ({ body: _body, ...skill }) => skill,
      ),
      diagnostics: kit.diagnostics,
    };
  },
};

const LoadAgentSkillInput = z
  .object({
    name: z.string().min(1).describe('Skill name from list_agent_skills.'),
  })
  .strict();

const loadAgentSkill: ServerTool<
  z.infer<typeof LoadAgentSkillInput>,
  {
    name: string;
    path: string;
    contents: string;
    truncated: boolean;
    package: {
      baseDirectory: string;
      files: { path: string; sizeBytes: number }[];
      totalBytes: number;
      truncated: boolean;
    };
  }
> = {
  name: 'load_agent_skill',
  description:
    'Read one .agents/skills/<name>/SKILL.md body and a capped sample of package files. Use this before following any project skill.',
  inputSchema: LoadAgentSkillInput,
  handler: async (input, ctx) => {
    const kit = await loadAgentKit({ workspacePath: ctx.workspacePath });
    const skill = kit.skills.find((candidate) => candidate.name === input.name);
    if (!skill) throw new Error(`Unknown agent skill: ${input.name}`);
    if (!isAgentSkillAllowed(skill.name, { policy: kit.defaultAgent.permissionPolicy })) {
      throw new Error(`agent_skill_denied: Agent skill "${input.name}" is denied by policy.`);
    }
    const contents = await readAgentResource(ctx, skill);
    const craftReferences = await readRequiredCraftReferences(ctx, skill, kit.knowledge);
    const packageInfo = await readSkillPackageListing(ctx, skill);
    return {
      name: skill.name,
      path: skill.path,
      contents: injectCraftReferences(contents.contents, craftReferences),
      truncated: contents.truncated,
      package: packageInfo,
    };
  },
};

const listAgentKnowledge: ServerTool<
  z.infer<typeof EmptyInput>,
  {
    knowledge: AgentKitKnowledgeResource[];
    diagnostics: Awaited<ReturnType<typeof loadAgentKit>>['diagnostics'];
  }
> = {
  name: 'list_agent_knowledge',
  description:
    'List project-local .agents knowledge markdown resources. Use before reading a specific reference file.',
  inputSchema: EmptyInput,
  handler: async (_input, ctx) => {
    const kit = await loadAgentKit({ workspacePath: ctx.workspacePath });
    return { knowledge: kit.knowledge, diagnostics: kit.diagnostics };
  },
};

const ReadAgentKnowledgeInput = z
  .object({
    id: z.string().min(1).describe('Knowledge id from list_agent_knowledge.'),
    maxBytes: z.number().int().positive().max(MAX_AGENT_RESOURCE_BYTES).optional(),
  })
  .strict();

const readAgentKnowledge: ServerTool<
  z.infer<typeof ReadAgentKnowledgeInput>,
  { id: string; path: string; contents: string; truncated: boolean }
> = {
  name: 'read_agent_knowledge',
  description:
    'Read one .agents/knowledge markdown resource by id. Use only when the task needs that reference.',
  inputSchema: ReadAgentKnowledgeInput,
  handler: async (input, ctx) => {
    const kit = await loadAgentKit({ workspacePath: ctx.workspacePath });
    const resource = kit.knowledge.find((candidate) => candidate.id === input.id);
    if (!resource) throw new Error(`Unknown agent knowledge resource: ${input.id}`);
    const contents = await readAgentResource(ctx, resource, input.maxBytes);
    return { id: resource.id, path: resource.path, ...contents };
  },
};

const listAgentScripts: ServerTool<
  z.infer<typeof EmptyInput>,
  {
    scripts: AgentKitScript[];
    diagnostics: Awaited<ReturnType<typeof loadAgentKit>>['diagnostics'];
  }
> = {
  name: 'list_agent_scripts',
  description:
    'List safe .agents script manifests. Script execution is permissioned and never uses arbitrary shell.',
  inputSchema: EmptyInput,
  handler: async (_input, ctx) => {
    const kit = await loadAgentKit({ workspacePath: ctx.workspacePath });
    return { scripts: kit.scripts, diagnostics: kit.diagnostics };
  },
};

const RunAgentScriptInput = z
  .object({
    name: z.string().min(1).describe('Script manifest name from list_agent_scripts.'),
  })
  .strict();

const runAgentScript: ServerTool<
  z.infer<typeof RunAgentScriptInput>,
  | {
      status: 'permission_required' | 'denied';
      name: string;
      command: string;
      args: string[];
      cwd: 'workspace' | 'agents';
      detail: string;
    }
  | AgentScriptRunResult
> = {
  name: 'run_agent_script',
  description:
    'Request execution of an approved .agents script manifest. For ask/deny manifests, returns a permission status without running anything.',
  inputSchema: RunAgentScriptInput,
  handler: async (input, ctx) => {
    const kit = await loadAgentKit({ workspacePath: ctx.workspacePath });
    const script = kit.scripts.find((candidate) => candidate.name === input.name);
    if (!script) throw new Error(`Unknown agent script: ${input.name}`);
    if (script.permission === 'deny') {
      return {
        status: 'denied',
        name: script.name,
        command: script.command,
        args: script.args,
        cwd: script.cwd,
        detail: 'This script manifest is denied by policy.',
      };
    }
    if (script.permission === 'ask') {
      return {
        status: 'permission_required',
        name: script.name,
        command: script.command,
        args: script.args,
        cwd: script.cwd,
        detail: 'Ask the user to approve this script before execution.',
      };
    }
    const agentsRoot = sourceRoot(script.source, ctx.workspacePath) ?? resolveDefaultKitRoot();
    return runAgentScriptManifest(script, {
      workspacePath: ctx.workspacePath,
      agentsRoot,
    });
  },
};

export const AGENT_KIT_TOOLS = [
  listAgentSkills,
  loadAgentSkill,
  listAgentKnowledge,
  readAgentKnowledge,
  listAgentScripts,
  runAgentScript,
] as ServerTool[];

async function readAgentResource(
  ctx: ToolContext,
  resource: { source: AgentKitSource; path: string },
  maxBytes = MAX_AGENT_RESOURCE_BYTES,
): Promise<{ contents: string; truncated: boolean }> {
  const root = sourceRoot(resource.source, ctx.workspacePath) ?? resolveDefaultKitRoot();
  const abs = resolveInsideAgentsRoot(root, resource.path);
  const raw = await readFile(abs, 'utf8');
  if (raw.length <= maxBytes) return { contents: raw, truncated: false };
  return { contents: `${raw.slice(0, maxBytes).trim()}\n\n[resource truncated]`, truncated: true };
}

async function readRequiredCraftReferences(
  ctx: ToolContext,
  skill: AgentKitSkill,
  knowledge: AgentKitKnowledgeResource[],
): Promise<{ id: string; path: string; contents: string }[]> {
  const required = skill.craftRequires ?? [];
  if (required.length === 0) return [];
  const references: { id: string; path: string; contents: string }[] = [];
  for (const id of required) {
    const resource = knowledge.find((candidate) => candidate.id === id);
    if (!resource) {
      references.push({
        id,
        path: '(missing)',
        contents: `Required craft reference "${id}" is not registered in .agents/config.json.`,
      });
      continue;
    }
    const contents = await readAgentResource(ctx, resource, 16_000);
    references.push({ id: resource.id, path: resource.path, contents: contents.contents });
  }
  return references;
}

function injectCraftReferences(
  skillContents: string,
  references: { id: string; path: string; contents: string }[],
): string {
  if (references.length === 0) return skillContents;
  const section = [
    '## Required Craft References',
    '',
    'Loaded from `sd.craft.requires`; apply enforced rules as checks and guidance rules as review heuristics.',
    '',
    ...references.flatMap((reference) => [
      `### ${reference.id}`,
      '',
      `Path: ${reference.path}`,
      '',
      reference.contents.trim(),
      '',
    ]),
  ].join('\n');
  const markers = ['\n## When to use vs when to defer', '\n## Runbook'];
  const marker = markers.find((candidate) => skillContents.includes(candidate));
  if (!marker) return `${skillContents.trim()}\n\n${section}\n`;
  return skillContents.replace(marker, `\n${section}\n${marker}`);
}

async function readSkillPackageListing(
  ctx: ToolContext,
  skill: AgentKitSkill,
): Promise<{
  baseDirectory: string;
  files: { path: string; sizeBytes: number }[];
  totalBytes: number;
  truncated: boolean;
}> {
  const root = sourceRoot(skill.source, ctx.workspacePath) ?? resolveDefaultKitRoot();
  const skillFile = resolveInsideAgentsRoot(root, skill.path);
  const skillDir = dirname(skillFile);
  const files: { path: string; sizeBytes: number }[] = [];
  let totalBytes = 0;
  let truncated = false;

  for (const abs of await walkFiles(skillDir)) {
    const rel = relative(skillDir, abs).split('\\').join('/');
    if (rel === 'SKILL.md') continue;
    const stats = await stat(abs).catch(() => null);
    if (!stats?.isFile()) continue;
    if (
      files.length >= MAX_SKILL_PACKAGE_FILES ||
      totalBytes + stats.size > MAX_SKILL_PACKAGE_BYTES
    ) {
      truncated = true;
      continue;
    }
    files.push({ path: rel, sizeBytes: stats.size });
    totalBytes += stats.size;
  }

  return {
    baseDirectory: dirname(skill.path).split('\\').join('/'),
    files,
    totalBytes,
    truncated,
  };
}

async function walkFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const abs = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(abs)));
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out.sort();
}

function sourceRoot(source: AgentKitSource, workspacePath: string | null): string | null {
  if (source === 'workspace') {
    return workspacePath ? resolve(workspacePath, '.agents') : null;
  }
  if (source === 'personal') {
    return resolve(homedir(), '.sber-designer', 'agents');
  }
  return resolveDefaultKitRoot();
}
