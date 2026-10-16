import type { DesignIndexDiagnostic } from './types';

export type HtmlDesignSystemSectionId =
  | 'theme'
  | 'color'
  | 'typography'
  | 'spacing'
  | 'layout'
  | 'components'
  | 'motion'
  | 'voice'
  | 'anti-patterns';

interface SectionDefinition {
  id: HtmlDesignSystemSectionId;
  label: string;
  keywords: RegExp;
}

export interface HtmlDesignSystemDesignMdSection {
  id: HtmlDesignSystemSectionId;
  label: string;
  title: string;
  body: string;
}

export interface ParsedHtmlDesignSystemDesignMd {
  filePath: string;
  sections: HtmlDesignSystemDesignMdSection[];
  missingSectionIds: HtmlDesignSystemSectionId[];
  diagnostics: DesignIndexDiagnostic[];
}

export const HTML_DESIGN_SYSTEM_SECTION_DEFS: SectionDefinition[] = [
  { id: 'theme', label: 'Theme', keywords: /\b(theme|overview|principles?)\b/u },
  { id: 'color', label: 'Color', keywords: /\b(colou?rs?|palette|brand)\b/u },
  { id: 'typography', label: 'Typography', keywords: /\b(type|typography|fonts?)\b/u },
  { id: 'spacing', label: 'Spacing', keywords: /\b(spacing|space|grid|rhythm)\b/u },
  { id: 'layout', label: 'Layout', keywords: /\b(layout|structure|shell|page)\b/u },
  { id: 'components', label: 'Components', keywords: /\b(components?|patterns?)\b/u },
  { id: 'motion', label: 'Motion', keywords: /\b(motion|animation|transitions?)\b/u },
  { id: 'voice', label: 'Voice', keywords: /\b(voice|tone|content|copy)\b/u },
  {
    id: 'anti-patterns',
    label: 'Anti-patterns',
    keywords: /\b(anti[-\s]?patterns?|avoid|do'?s|don'?ts?|forbidden)\b/u,
  },
];

export function parseHtmlDesignSystemDesignMd(
  contents: string | null | undefined,
  filePath = 'Design.md',
): ParsedHtmlDesignSystemDesignMd | null {
  if (!contents?.trim()) return null;

  const headings = collectSecondLevelHeadings(contents);
  const sectionsById = new Map<HtmlDesignSystemSectionId, HtmlDesignSystemDesignMdSection>();

  for (const heading of headings) {
    const definition = resolveSectionDefinition(heading.ordinal, heading.title);
    if (!definition || sectionsById.has(definition.id)) continue;
    sectionsById.set(definition.id, {
      id: definition.id,
      label: definition.label,
      title: heading.title,
      body: normalizeSectionBody(heading.body),
    });
  }

  const sections = HTML_DESIGN_SYSTEM_SECTION_DEFS.map((definition) =>
    sectionsById.get(definition.id),
  ).filter((section): section is HtmlDesignSystemDesignMdSection => Boolean(section));
  const missingSectionIds = HTML_DESIGN_SYSTEM_SECTION_DEFS.filter((definition) => {
    const section = sectionsById.get(definition.id);
    return !section || section.body.length === 0;
  }).map((definition) => definition.id);

  return {
    filePath,
    sections,
    missingSectionIds,
    diagnostics:
      missingSectionIds.length > 0
        ? [
            {
              level: 'warning',
              filePath,
              message: `Design.md is missing HTML-first sections: ${missingSectionIds
                .map(sectionLabel)
                .join(', ')}.`,
            },
          ]
        : [],
  };
}

export function summarizeHtmlDesignSystemDesignMdForPrompt(
  parsed: ParsedHtmlDesignSystemDesignMd | null,
): string[] {
  if (!parsed) return [];
  const sectionsWithBody = parsed.sections.filter((section) => section.body.length > 0);
  if (sectionsWithBody.length === 0) return [];

  return [
    '## HTML design system',
    '',
    `Source: ${parsed.filePath}. Follow these project-owned design-system sections before inventing new visual language.`,
    '',
    ...sectionsWithBody.flatMap((section) => [
      `### ${section.label}`,
      compactMarkdownBlock(section.body, 900),
      '',
    ]),
    ...(parsed.missingSectionIds.length > 0
      ? [`Missing or empty sections: ${parsed.missingSectionIds.map(sectionLabel).join(', ')}.`, '']
      : []),
  ];
}

export function htmlDesignSystemSectionCoverage(parsed: ParsedHtmlDesignSystemDesignMd | null): {
  present: number;
  total: number;
  score: number;
} {
  const total = HTML_DESIGN_SYSTEM_SECTION_DEFS.length;
  if (!parsed) return { present: 0, total, score: 0 };
  const present = total - parsed.missingSectionIds.length;
  return { present, total, score: present / total };
}

function collectSecondLevelHeadings(contents: string): Array<{
  ordinal: number | null;
  title: string;
  body: string;
}> {
  const matches = Array.from(
    contents.matchAll(/^##\s+(?:(\d{1,2})\s*[).:-]?\s*)?(.+?)\s*#*\s*$/gmu),
  );
  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? contents.length;
    return {
      ordinal: match[1] ? Number(match[1]) : null,
      title: match[2]?.trim() ?? '',
      body: contents.slice(start, end),
    };
  });
}

function resolveSectionDefinition(ordinal: number | null, title: string): SectionDefinition | null {
  if (ordinal && ordinal >= 1 && ordinal <= HTML_DESIGN_SYSTEM_SECTION_DEFS.length) {
    return HTML_DESIGN_SYSTEM_SECTION_DEFS[ordinal - 1] ?? null;
  }
  const normalized = title.toLowerCase().replace(/[^\p{L}\p{N}\s'-]+/gu, ' ');
  const matches = HTML_DESIGN_SYSTEM_SECTION_DEFS.filter((definition) =>
    definition.keywords.test(normalized),
  );
  return matches.find((definition) => definition.id === 'anti-patterns') ?? matches[0] ?? null;
}

function normalizeSectionBody(body: string): string {
  return body
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function compactMarkdownBlock(value: string, maxLength: number): string {
  const compacted = value
    .replace(/\n{3,}/gu, '\n\n')
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, maxLength - 1).trimEnd()}...`;
}

function sectionLabel(id: HtmlDesignSystemSectionId): string {
  return HTML_DESIGN_SYSTEM_SECTION_DEFS.find((definition) => definition.id === id)?.label ?? id;
}
