/**
 * 0083 — parser for the human- and machine-readable `Description for AI` block.
 *
 * This is the single canonical format used in two surfaces (task 0083):
 *   - Storybook: `parameters.docs.description.component` markdown (the visible
 *     section), or the structured `parameters.sberDesigner.descriptionLayer`.
 *   - No-Storybook: a `.sber-designer/components/<id>.md` sidecar, either as a
 *     fenced structured block or the same markdown section.
 *
 * Reading-first (Phase 1): these functions only parse/normalize. Writing the
 * block is Phase 2/3 (the interview + codegen), explicitly out of scope here.
 *
 * Recognised markdown shape (subheadings are case-insensitive, dashes/colons
 * tolerant):
 *
 *   ## Description for AI
 *
 *   **Purpose:** one sentence.
 *   **Use when:** trigger a; trigger b
 *   **Use instead:** `<Other>` for <case>.
 *   **Variants:**
 *   - `variant`: `outlined` — meaning; `filled` — meaning.
 *   **Required props:** `code`, `name`.
 *   **Canonical usage:**
 *   ```tsx
 *   <Component code={x} />
 *   ```
 *   **Do / Don't:** prefer X; avoid Y.
 *   **Keywords:** status chip, dictionary badge
 */
import type {
  ComponentDescriptionLayer,
  ComponentUsageExample,
  ComponentVariantGuidance,
} from '@sber-designer/shared-types';

export interface ParsedDescriptionForAi {
  purpose?: string;
  whenToUse?: string[];
  whenNotToUse?: string[];
  variantGuidance?: ComponentVariantGuidance[];
  requiredProps?: string[];
  canonicalSnippets?: { code: string }[];
  keywords?: string[];
  guidance?: string[];
}

const SECTION_HEADING = /^(#{1,6})\s*description\s+for\s+ai\s*$/i;
const ANY_HEADING = /^(#{1,6})\s+/;
const LABEL_LINE = /^\s*\*\*\s*([^*:]+?)\s*:?\s*\*\*\s*:?\s*(.*)$/;

/** True when the markdown carries a recognisable `Description for AI` block. */
export function hasDescriptionForAiSection(markdown: string): boolean {
  return parseDescriptionForAi(markdown) !== null;
}

/** Slice out the `## Description for AI` section body, or null when absent. */
export function extractDescriptionForAiSection(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const match = SECTION_HEADING.exec(lines[i] ?? '');
    if (match) {
      start = i + 1;
      level = match[1]?.length ?? 2;
      break;
    }
  }
  if (start === -1) return null;
  const body: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const heading = ANY_HEADING.exec(line);
    if (heading && (heading[1]?.length ?? 6) <= level) break;
    body.push(line);
  }
  return body.join('\n').trim();
}

/**
 * Parse the labelled fields out of a `Description for AI` block. Returns null
 * when no section heading and no recognised label is present (so arbitrary
 * prose descriptions are not misread as structured layers).
 */
export function parseDescriptionForAi(markdown: string): ParsedDescriptionForAi | null {
  if (!markdown.trim()) return null;
  const section = extractDescriptionForAiSection(markdown);
  const content = section ?? markdown;
  const blocks = collectLabelBlocks(content);
  if (!section && blocks.size === 0) return null;

  const result: ParsedDescriptionForAi = {};
  const purpose = firstNonEmpty(blocks.get('purpose'));
  if (purpose) result.purpose = purpose;

  const whenToUse = listFrom(blocks.get('use when') ?? blocks.get('when to use'));
  if (whenToUse.length > 0) result.whenToUse = whenToUse;

  const whenNotToUse = listFrom(
    blocks.get('use instead') ??
      blocks.get('use not when') ??
      blocks.get('avoid') ??
      blocks.get("don't use when") ??
      blocks.get('do not use when'),
  );
  if (whenNotToUse.length > 0) result.whenNotToUse = whenNotToUse;

  const variantGuidance = parseVariants(blocks.get('variants') ?? blocks.get('variant'));
  if (variantGuidance.length > 0) result.variantGuidance = variantGuidance;

  const requiredProps = parseTokens(
    blocks.get('required props') ?? blocks.get('props that matter') ?? blocks.get('required'),
  );
  if (requiredProps.length > 0) result.requiredProps = requiredProps;

  const code = firstFencedCode(blocks.get('canonical usage') ?? blocks.get('canonical'));
  if (code) result.canonicalSnippets = [{ code }];

  const guidance = listFrom(
    blocks.get("do / don't") ?? blocks.get("do/don't") ?? blocks.get('guidance'),
  );
  if (guidance.length > 0) result.guidance = guidance;

  const keywords = splitList(blocks.get('keywords')?.join(' ') ?? '', /[,•]/);
  if (keywords.length > 0) result.keywords = keywords;

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Normalise a parsed block into a full `ComponentDescriptionLayer`, filling the
 * pre-0083 required arrays with empty defaults. Returns null when nothing
 * recognisable was parsed.
 */
export function descriptionLayerFromMarkdown(
  markdown: string,
  opts: { status?: 'draft' | 'confirmed'; updatedAt?: string } = {},
): ComponentDescriptionLayer | null {
  const parsed = parseDescriptionForAi(markdown);
  if (!parsed) return null;
  return {
    purpose: parsed.purpose ?? '',
    anatomy: [],
    usage: [],
    agentGuidance: parsed.guidance ?? [],
    schemaVersion: 1,
    ...(parsed.keywords?.length ? { keywords: parsed.keywords } : {}),
    ...(parsed.whenToUse?.length ? { whenToUse: parsed.whenToUse } : {}),
    ...(parsed.whenNotToUse?.length ? { whenNotToUse: parsed.whenNotToUse } : {}),
    ...(parsed.variantGuidance?.length ? { variantGuidance: parsed.variantGuidance } : {}),
    ...(parsed.requiredProps?.length ? { requiredProps: parsed.requiredProps } : {}),
    ...(parsed.canonicalSnippets?.length ? { canonicalSnippets: parsed.canonicalSnippets } : {}),
    status: opts.status ?? 'draft',
    ...(opts.updatedAt ? { updatedAt: opts.updatedAt } : {}),
  };
}

/**
 * Render a layer back into the canonical `## Description for AI` markdown block.
 * Inverse of `parseDescriptionForAi` for the fields it carries (round-trips).
 */
export function descriptionLayerToMarkdown(layer: ComponentDescriptionLayer): string {
  const lines: string[] = ['## Description for AI', ''];
  if (layer.purpose?.trim()) lines.push(`**Purpose:** ${layer.purpose.trim()}`);
  pushLabelledList(lines, 'Use when', layer.whenToUse);
  pushLabelledList(lines, 'Use instead', layer.whenNotToUse);
  if (layer.variantGuidance?.length) {
    lines.push('**Variants:**');
    for (const guidance of layer.variantGuidance) {
      const values = guidance.values
        .map((value) => `\`${value.value}\` — ${value.meaning}`)
        .join('; ');
      lines.push(`- \`${guidance.prop}\`: ${values}`);
    }
  }
  if (layer.requiredProps?.length) {
    lines.push(
      `**Required props:** ${layer.requiredProps.map((prop) => `\`${prop}\``).join(', ')}`,
    );
  }
  const snippets = (layer.canonicalSnippets ?? []).filter((entry) => entry.code?.trim());
  if (snippets.length > 0) {
    lines.push('**Canonical usage:**');
    for (const entry of snippets) {
      if (entry.label) lines.push(`_${entry.label}_`);
      lines.push('```tsx', entry.code, '```');
    }
  }
  if (layer.keywords?.length) lines.push(`**Keywords:** ${layer.keywords.join(', ')}`);
  pushLabelledList(lines, "Do / Don't", layer.agentGuidance);
  return lines.join('\n');
}

/** Render a labelled field: inline for one item, a bullet list for several. */
function pushLabelledList(lines: string[], label: string, items: string[] | undefined): void {
  const clean = (items ?? []).map((item) => item.trim()).filter(Boolean);
  if (clean.length === 0) return;
  if (clean.length === 1) {
    lines.push(`**${label}:** ${clean[0]}`);
    return;
  }
  lines.push(`**${label}:**`);
  for (const item of clean) lines.push(`- ${item}`);
}

/**
 * Extract a structured `descriptionLayer` from a fenced block whose info string
 * mentions `sberDesigner` or `sd-ai` and whose body is JSON. Supports both a
 * bare layer object and `{ "descriptionLayer": { ... } }`.
 */
export function extractStructuredLayerBlock(markdown: string): ComponentDescriptionLayer | null {
  const fence = /```([^\n]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(markdown)) !== null) {
    const info = (match[1] ?? '').toLowerCase();
    if (!/sberdesigner|sd-ai/.test(info)) continue;
    try {
      const json: unknown = JSON.parse(match[2] ?? '');
      const candidate =
        json && typeof json === 'object' && !Array.isArray(json) && 'descriptionLayer' in json
          ? (json as { descriptionLayer: unknown }).descriptionLayer
          : json;
      const layer = coerceComponentLayer(candidate);
      if (layer) return layer;
    } catch {
      // Malformed JSON block — ignore and keep scanning.
    }
  }
  return null;
}

/** Validate + fill defaults for a structured layer object from JSON/parameters. */
export function coerceComponentLayer(value: unknown): ComponentDescriptionLayer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.purpose !== 'string') return null;
  const usage = Array.isArray(v.usage)
    ? (v.usage.filter(isUsageExample) as ComponentUsageExample[])
    : [];
  return {
    purpose: v.purpose,
    anatomy: asStringArray(v.anatomy),
    usage,
    agentGuidance: asStringArray(v.agentGuidance),
    ...(typeof v.sourceHtml === 'string' ? { sourceHtml: v.sourceHtml } : {}),
    ...(typeof v.schemaVersion === 'number' ? { schemaVersion: v.schemaVersion } : {}),
    ...(asStringArray(v.keywords).length ? { keywords: asStringArray(v.keywords) } : {}),
    ...(asStringArray(v.whenToUse).length ? { whenToUse: asStringArray(v.whenToUse) } : {}),
    ...(asStringArray(v.whenNotToUse).length
      ? { whenNotToUse: asStringArray(v.whenNotToUse) }
      : {}),
    ...(coerceVariants(v.variantGuidance).length
      ? { variantGuidance: coerceVariants(v.variantGuidance) }
      : {}),
    ...(asStringArray(v.requiredProps).length
      ? { requiredProps: asStringArray(v.requiredProps) }
      : {}),
    ...(coerceSnippets(v.canonicalSnippets).length
      ? { canonicalSnippets: coerceSnippets(v.canonicalSnippets) }
      : {}),
    ...(asStringArray(v.pairsWith).length ? { pairsWith: asStringArray(v.pairsWith) } : {}),
    ...(asStringArray(v.a11yNotes).length ? { a11yNotes: asStringArray(v.a11yNotes) } : {}),
    ...(asStringArray(v.interactionNotes).length
      ? { interactionNotes: asStringArray(v.interactionNotes) }
      : {}),
    ...(v.status === 'draft' || v.status === 'confirmed' ? { status: v.status } : {}),
    ...(typeof v.updatedAt === 'string' ? { updatedAt: v.updatedAt } : {}),
  };
}

// --- block collection -----------------------------------------------------

/** Group content lines under their `**Label:**` headers (label -> lines). */
function collectLabelBlocks(content: string): Map<string, string[]> {
  const blocks = new Map<string, string[]>();
  const lines = content.split(/\r?\n/);
  let current: string[] | null = null;
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const label = !inFence ? LABEL_LINE.exec(line) : null;
    if (label) {
      const key = (label[1] ?? '').trim().toLowerCase();
      const rest = (label[2] ?? '').trim();
      current = rest ? [rest] : [];
      blocks.set(key, current);
      continue;
    }
    if (current) current.push(line);
  }
  return blocks;
}

function firstNonEmpty(lines: string[] | undefined): string | undefined {
  if (!lines) return undefined;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/** Turn a block into a list: prefer bullet lines, else split inline on `;`. */
function listFrom(lines: string[] | undefined): string[] {
  if (!lines) return [];
  const bullets = lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ') || line.startsWith('* '))
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  if (bullets.length > 0) return bullets;
  return splitList(lines.join(' '), /;/);
}

function splitList(value: string, sep: RegExp): string[] {
  return value
    .split(sep)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Extract backtick tokens; fall back to comma split. */
function parseTokens(lines: string[] | undefined): string[] {
  if (!lines) return [];
  const text = lines.join(' ');
  const ticks = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]?.trim()).filter(Boolean);
  if (ticks.length > 0) return ticks as string[];
  return splitList(text, /[,;]/);
}

function firstFencedCode(lines: string[] | undefined): string | null {
  if (!lines) return null;
  const text = lines.join('\n');
  const fence = /```[^\n]*\n([\s\S]*?)```/.exec(text);
  if (fence) return (fence[1] ?? '').trim() || null;
  const code = lines.map((line) => line.trim()).filter(Boolean);
  return code.length > 0 ? code.join('\n') : null;
}

/** Parse `- `prop`: `value` — meaning; `value2` — meaning2` bullets. */
function parseVariants(lines: string[] | undefined): ComponentVariantGuidance[] {
  if (!lines) return [];
  const out: ComponentVariantGuidance[] = [];
  for (const raw of lines) {
    const line = raw.replace(/^[-*]\s+/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const propMatch = /`([^`]+)`/.exec(line.slice(0, colon));
    const prop = propMatch ? propMatch[1]!.trim() : line.slice(0, colon).trim();
    if (!prop) continue;
    const values: { value: string; meaning: string }[] = [];
    for (const piece of line.slice(colon + 1).split(';')) {
      const valueMatch = /`([^`]+)`/.exec(piece);
      if (!valueMatch) continue;
      const value = valueMatch[1]!.trim();
      const meaning = piece
        .slice((valueMatch.index ?? 0) + valueMatch[0].length)
        .replace(/^\s*[—–:-]\s*/, '')
        .replace(/\.$/, '')
        .trim();
      values.push({ value, meaning });
    }
    if (values.length > 0) out.push({ prop, values });
  }
  return out;
}

// --- coercion helpers -----------------------------------------------------

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isUsageExample(value: unknown): value is ComponentUsageExample {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as { title?: unknown }).title === 'string' &&
    typeof (value as { when?: unknown }).when === 'string',
  );
}

function coerceVariants(value: unknown): ComponentVariantGuidance[] {
  if (!Array.isArray(value)) return [];
  const out: ComponentVariantGuidance[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const prop = (entry as { prop?: unknown }).prop;
    const values = (entry as { values?: unknown }).values;
    if (typeof prop !== 'string' || !Array.isArray(values)) continue;
    const cleaned = values
      .filter(
        (v): v is { value: string; meaning: string } =>
          Boolean(v) &&
          typeof (v as { value?: unknown }).value === 'string' &&
          typeof (v as { meaning?: unknown }).meaning === 'string',
      )
      .map((v) => ({ value: v.value, meaning: v.meaning }));
    if (cleaned.length > 0) out.push({ prop, values: cleaned });
  }
  return out;
}

function coerceSnippets(value: unknown): { code: string; label?: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { code: string; label?: string }[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const code = (entry as { code?: unknown }).code;
    if (typeof code !== 'string') continue;
    const label = (entry as { label?: unknown }).label;
    out.push(typeof label === 'string' ? { code, label } : { code });
  }
  return out;
}
