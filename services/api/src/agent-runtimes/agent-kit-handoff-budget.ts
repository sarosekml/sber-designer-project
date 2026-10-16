/**
 * Prompt budget (0136 R12 — extracted from agent-kit-handoff.ts).
 *
 * A handoff prompt has a byte ceiling. This module decides what to drop when
 * it is exceeded: sections are labelled, ranked, and either protected, capped
 * or removed with an explicit omission marker, so the runtime is told what it
 * is not seeing rather than silently receiving less.
 */
import { Buffer } from 'node:buffer';
import { RuntimePromptBudgetError } from './prompt-delivery';
import {
  MAX_SECTION_CHARS,
  PROMPT_SECTION_DELIMITER,
  PROTECTED_PROMPT_SECTION_LABELS,
} from './agent-kit-handoff-types';

export function applyPromptBudget(
  prompt: string,
  maxBytes: number,
  omitted: { section: string; reason: string }[],
): string {
  const bytes = Buffer.byteLength(prompt, 'utf8');
  if (bytes <= maxBytes) return prompt;

  const sections = prompt.split(PROMPT_SECTION_DELIMITER);
  const entries = sections.map((section, index) => {
    const label = promptSectionLabel(section);
    return {
      section,
      index,
      label,
      protected: isProtectedPromptSection(label, section),
      dropRank: promptSectionDropRank(label),
      keep: true,
    };
  });
  const droppable = entries
    .filter((entry) => !entry.protected)
    .sort((a, b) => a.dropRank - b.dropRank || a.index - b.index);
  const omittedLabels: string[] = [];

  for (const entry of droppable) {
    entry.keep = false;
    omittedLabels.push(entry.label);
    omitted.push({
      section: entry.label,
      reason: `Prompt capped at ${maxBytes} bytes; protected task sections were preserved.`,
    });
    const candidate = promptWithOmissionMarker(entries, omittedLabels.length);
    if (Buffer.byteLength(candidate, 'utf8') <= maxBytes) return candidate;
  }

  const protectedPrompt = promptWithOmissionMarker(entries, omittedLabels.length);
  const protectedBytes = Buffer.byteLength(protectedPrompt, 'utf8');
  throw new RuntimePromptBudgetError({
    ok: false,
    code: 'prompt_too_large',
    runtime: 'Agent kit handoff',
    bytes: protectedBytes,
    maxBytes,
    mode: 'stdin',
    detail: `Agent kit handoff prompt is ${protectedBytes} bytes after omitting all droppable context and exceeds the ${maxBytes} byte protected-section budget. User Request, allowed targets, runtime identity/contract, editor context, and output contract were not truncated.`,
  });
}

export function joinPromptSections(sections: string[]): string {
  return sections.filter(Boolean).join(PROMPT_SECTION_DELIMITER);
}

function omissionMarker(count: number): string {
  return count > 0 ? `[Omitted due to context budget: ${count} middle prompt section(s).]` : '';
}

function promptWithOmissionMarker(
  entries: Array<{ section: string; keep: boolean }>,
  omittedCount: number,
): string {
  const kept = entries.filter((entry) => entry.keep).map((entry) => entry.section);
  const marker = omissionMarker(omittedCount);
  if (!marker) return joinPromptSections(kept);
  const outputIndex = kept.findIndex(
    (section) => promptSectionLabel(section) === 'Output Contract',
  );
  const insertAt = outputIndex >= 0 ? outputIndex : kept.length;
  return joinPromptSections([...kept.slice(0, insertAt), marker, ...kept.slice(insertAt)]);
}

function isProtectedPromptSection(label: string, section: string): boolean {
  if (PROTECTED_PROMPT_SECTION_LABELS.has(normalizePromptSectionLabel(label))) return true;
  return /^##\s+Priority Contract\b/mu.test(section);
}

function promptSectionDropRank(label: string): number {
  const normalized = normalizePromptSectionLabel(label);
  if (normalized === 'task variant context') return 10;
  if (normalized === 'knowledge inventory') return 20;
  if (normalized === 'agent kit inventory') return 30;
  if (normalized === 'project system context') return 35;
  if (normalized === 'task history summary') return 40;
  if (normalized === 'design source context') return 50;
  if (normalized === 'stable context digest' || normalized === 'stable context reuse') return 60;
  if (normalized === 'always-on instructions' || normalized === 'active product agent delegation') {
    return 70;
  }
  return 90;
}

function promptSectionLabel(section: string): string {
  const header = section.match(/^#{1,3}\s+(.+)$/mu)?.[1]?.trim();
  return header || 'prompt-section';
}

function normalizePromptSectionLabel(label: string): string {
  return label.trim().toLowerCase();
}

export function capSection(label: string, value: string): string {
  const compact = value.trim();
  if (compact.length <= MAX_SECTION_CHARS) return compact;
  return `${compact.slice(0, MAX_SECTION_CHARS - 120)}\n\n[Omitted due to context budget: ${label} exceeded ${MAX_SECTION_CHARS} characters.]`;
}

export function stripFrontmatter(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return markdown;
  const end = normalized.indexOf('\n---', 4);
  if (end === -1) return markdown;
  const body = normalized.slice(end + '\n---'.length);
  return body.startsWith('\n') ? body.slice(1) : body;
}

export function compactText(value: string, maxChars: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  return compact.length <= maxChars ? compact : `${compact.slice(0, maxChars - 3)}...`;
}
