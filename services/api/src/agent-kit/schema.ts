import { z } from 'zod';

export const AgentKitSkillNameSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected lowercase kebab-case name');

export const AgentToolNameSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, 'Expected lowercase snake_case tool name');

const AgentToolMatcherSchema = z.union([AgentToolNameSchema, z.literal('*')]);
const AgentSkillMatcherSchema = z.union([AgentKitSkillNameSchema, z.literal('*')]);
const AgentKitPermissionActionSchema = z.enum(['allow', 'ask', 'deny']);
const AgentKitPermissionRuleSchema = z.union([
  AgentKitPermissionActionSchema,
  z.record(z.string().min(1), AgentKitPermissionActionSchema),
]);

export const AgentKitPermissionSchema = z
  .object({
    read: AgentKitPermissionRuleSchema.optional(),
    edit: AgentKitPermissionRuleSchema.optional(),
    run_script: AgentKitPermissionRuleSchema.optional(),
    load_skill: AgentKitPermissionRuleSchema.optional(),
    send_pr: AgentKitPermissionActionSchema.optional(),
    set_mode: AgentKitPermissionActionSchema.optional(),
    '*': AgentKitPermissionActionSchema.optional(),
  })
  .strict();

export const AgentToolPermissionSetSchema = z
  .object({
    allow: z.array(AgentToolMatcherSchema).default(['*']),
    deny: z.array(AgentToolNameSchema).default([]),
  })
  .strict();

export const AgentSkillPermissionSetSchema = z
  .object({
    allow: z.array(AgentSkillMatcherSchema).default(['*']),
    deny: z.array(AgentKitSkillNameSchema).default([]),
  })
  .strict();

export const AgentPermissionPolicySchema = z
  .object({
    tools: AgentToolPermissionSetSchema.default({ allow: ['*'], deny: [] }),
    skills: AgentSkillPermissionSetSchema.default({ allow: ['*'], deny: [] }),
  })
  .strict();

const RelativeAgentPathSchema = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith('/') && !value.includes('\0'), {
    message: 'Path must be relative',
  })
  .refine((value) => !value.split(/[\\/]+/).includes('..'), {
    message: 'Path must stay inside .agents',
  });

export const AgentKitScriptManifestSchema = z
  .object({
    name: AgentKitSkillNameSchema,
    description: z.string().min(1),
    command: z
      .string()
      .min(1)
      .refine((value) => !/[;&|<>`$]/.test(value) && !/\s/.test(value), {
        message: 'Command must be an executable name/path, not a shell string',
      }),
    args: z.array(z.string()).default([]),
    cwd: z.enum(['workspace', 'agents']).default('workspace'),
    permission: z.enum(['allow', 'ask', 'deny']).default('ask'),
    timeoutMs: z.number().int().positive().max(600_000).default(120_000),
  })
  .strict();

const ConfigScriptEntrySchema = AgentKitScriptManifestSchema.omit({ name: true });

export const AgentKitConfigSchema = z
  .object({
    $schema: z.string().optional(),
    defaultAgent: AgentKitSkillNameSchema.default('ai-product-designer'),
    instructions: z.array(RelativeAgentPathSchema).default([]),
    knowledge: z
      .array(
        z
          .object({
            id: AgentKitSkillNameSchema,
            path: RelativeAgentPathSchema,
            description: z.string().min(1),
          })
          .strict(),
      )
      .default([]),
    permission: AgentKitPermissionSchema.optional(),
    skills: AgentSkillPermissionSetSchema.default({ allow: ['*'], deny: [] }),
    scripts: z.record(AgentKitSkillNameSchema, ConfigScriptEntrySchema).optional(),
  })
  .strict();

export const AgentFrontmatterSchema = z
  .object({
    name: AgentKitSkillNameSchema,
    description: z.string().min(1),
    mode: z.enum(['primary', 'subagent', 'all']).default('primary'),
    hidden: z.boolean().default(false),
    temperature: z.number().min(0).max(2).optional(),
    maxIterations: z.number().int().positive().max(50).optional(),
    tools: AgentToolPermissionSetSchema.optional(),
    skills: AgentSkillPermissionSetSchema.optional(),
    permission: AgentKitPermissionSchema.optional(),
  })
  .passthrough();

export const InstructionFrontmatterSchema = z
  .object({
    permission: AgentKitPermissionSchema.optional(),
  })
  .passthrough();

const StringOrStringArraySchema = z.union([z.string(), z.array(z.string())]);

const SkillSberDesignerFrontmatterSchema = z
  .object({
    profile: StringOrStringArraySchema.optional(),
    critique: z
      .object({
        policy: z.enum(['required', 'opt-in', 'opt-out']),
      })
      .passthrough()
      .optional(),
    craft: z
      .object({
        requires: StringOrStringArraySchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const SkillFrontmatterSchema = z
  .object({
    name: AgentKitSkillNameSchema,
    description: z.string().min(1),
    license: z.string().optional(),
    compatibility: z.string().optional(),
    sd: SkillSberDesignerFrontmatterSchema.optional(),
  })
  .passthrough();

export type AgentKitConfig = z.infer<typeof AgentKitConfigSchema>;
export type AgentKitScriptManifest = z.infer<typeof AgentKitScriptManifestSchema>;
export type AgentFrontmatter = z.infer<typeof AgentFrontmatterSchema>;
export type AgentPermissionPolicy = z.infer<typeof AgentPermissionPolicySchema>;
export type InstructionFrontmatter = z.infer<typeof InstructionFrontmatterSchema>;
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export interface ParsedMarkdownFrontmatter<T> {
  frontmatter: T;
  body: string;
}

export function parseAgentFrontmatter(
  markdown: string,
): ParsedMarkdownFrontmatter<AgentFrontmatter> {
  const parsed = parseMarkdownFrontmatter(markdown);
  return {
    frontmatter: AgentFrontmatterSchema.parse(parsed.frontmatter),
    body: parsed.body,
  };
}

export function parseSkillFrontmatter(
  markdown: string,
): ParsedMarkdownFrontmatter<SkillFrontmatter> {
  const parsed = parseMarkdownFrontmatter(markdown);
  return {
    frontmatter: SkillFrontmatterSchema.parse(parsed.frontmatter),
    body: parsed.body,
  };
}

export function parseInstructionFrontmatter(
  markdown: string,
): ParsedMarkdownFrontmatter<InstructionFrontmatter> {
  const parsed = parseMarkdownFrontmatter(markdown);
  return {
    frontmatter: InstructionFrontmatterSchema.parse(parsed.frontmatter),
    body: parsed.body,
  };
}

export function parseMarkdownFrontmatter(markdown: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const normalized = markdown.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { frontmatter: {}, body: markdown };
  }
  const end = normalized.indexOf('\n---', 4);
  if (end === -1) {
    return { frontmatter: {}, body: markdown };
  }
  const raw = normalized.slice(4, end);
  const afterFence = normalized.slice(end + '\n---'.length);
  const body = afterFence.startsWith('\n') ? afterFence.slice(1) : afterFence;
  return { frontmatter: parseSimpleYamlMap(raw), body };
}

function parseSimpleYamlMap(raw: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lines = raw.split('\n');
  for (let index = 0; index < lines.length; ) {
    const line = lines[index]!;
    const trimmed = line.trim();
    if (line.startsWith(' ') || line.startsWith('\t')) {
      index += 1;
      continue;
    }
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('- ')) {
      index += 1;
      continue;
    }
    const match = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(trimmed);
    if (!match) {
      index += 1;
      continue;
    }
    const key = match[1]!;
    const value = match[2] ?? '';
    if (value === '') {
      const nested = parseNestedYamlValue(lines, index + 1);
      if (nested.consumed > 0) out[key] = nested.value;
      index += nested.consumed + 1;
      continue;
    }
    out[key] = parseScalar(value);
    index += 1;
  }
  return out;
}

function parseNestedYamlValue(
  lines: string[],
  startIndex: number,
): { value: unknown; consumed: number } {
  const first = nextMeaningfulNestedLine(lines, startIndex);
  if (!first) return { value: undefined, consumed: 0 };
  if (first.indent === 0) return { value: undefined, consumed: 0 };
  if (first.trimmed.startsWith('- ')) return parseNestedYamlArray(lines, startIndex, first.indent);
  return parseNestedYamlObject(lines, startIndex, first.indent);
}

function parseNestedYamlObject(
  lines: string[],
  startIndex: number,
  baseIndent: number,
): { value: Record<string, unknown>; consumed: number } {
  const out: Record<string, unknown> = {};
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index]!;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      index += 1;
      continue;
    }
    const indent = leadingSpaces(line);
    if (indent < baseIndent) break;
    if (indent > baseIndent) {
      index += 1;
      continue;
    }
    const match = /^(.+?):(?:\s*(.*))?$/.exec(trimmed);
    if (!match) break;
    const key = parseYamlKey(match[1]!);
    const value = match[2] ?? '';
    if (value === '') {
      const nested = parseNestedYamlValue(lines, index + 1);
      out[key] = nested.value;
      index += nested.consumed + 1;
      continue;
    }
    out[key] = parseScalar(value);
    index += 1;
  }
  return { value: out, consumed: index - startIndex };
}

function parseYamlKey(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseNestedYamlArray(
  lines: string[],
  startIndex: number,
  baseIndent: number,
): { value: unknown[]; consumed: number } {
  const out: unknown[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index]!;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      index += 1;
      continue;
    }
    const indent = leadingSpaces(line);
    if (indent < baseIndent || !trimmed.startsWith('- ')) break;
    const itemContent = trimmed.slice(2).trim();
    // Object item: "- key: value" starts a mapping whose remaining keys live on
    // following more-indented lines. Plain scalars ("- foo") fall through.
    const itemMatch = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(itemContent);
    if (itemMatch) {
      const obj: Record<string, unknown> = {};
      assignYamlEntry(obj, itemMatch[1]!, itemMatch[2] ?? '', () => {
        const nested = parseNestedYamlValue(lines, index + 1);
        index += nested.consumed;
        return nested.value;
      });
      index += 1;
      // Continuation keys of this object: indented past the list marker and not
      // a new list item.
      while (index < lines.length) {
        const contLine = lines[index]!;
        const contTrimmed = contLine.trim();
        if (!contTrimmed || contTrimmed.startsWith('#')) {
          index += 1;
          continue;
        }
        const contIndent = leadingSpaces(contLine);
        if (contIndent <= baseIndent || contTrimmed.startsWith('- ')) break;
        const contMatch = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(contTrimmed);
        if (!contMatch) break;
        assignYamlEntry(obj, contMatch[1]!, contMatch[2] ?? '', () => {
          const nested = parseNestedYamlValue(lines, index + 1);
          index += nested.consumed;
          return nested.value;
        });
        index += 1;
      }
      out.push(obj);
      continue;
    }
    out.push(parseScalar(itemContent));
    index += 1;
  }
  return { value: out, consumed: index - startIndex };
}

/** Assign one `key: value` mapping entry, recursing for block values. */
function assignYamlEntry(
  target: Record<string, unknown>,
  key: string,
  rawValue: string,
  readNested: () => unknown,
): void {
  target[parseYamlKey(key)] = rawValue === '' ? readNested() : parseScalar(rawValue);
}

function nextMeaningfulNestedLine(
  lines: string[],
  startIndex: number,
): { indent: number; trimmed: string } | null {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]!;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    return { indent: leadingSpaces(line), trimmed };
  }
  return null;
}

function leadingSpaces(line: string): number {
  const match = /^ */.exec(line);
  return match ? match[0].length : 0;
}

function parseScalar(value: string): unknown {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => String(parseScalar(item.trim())))
      .filter(Boolean);
  }
  return trimmed;
}
