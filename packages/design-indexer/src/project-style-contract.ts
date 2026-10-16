import type { DesignIndexDiagnostic } from './types';

export const PROJECT_STYLE_CONTRACT_SCHEMA_VERSION = 'sber-designer/style-contract/v1';

export type ProjectStyleContractSectionId =
  | 'visual-theme-atmosphere'
  | 'color-palette-roles'
  | 'typography-rules'
  | 'component-stylings'
  | 'layout-principles'
  | 'depth-elevation'
  | 'dos-donts'
  | 'responsive-behavior'
  | 'agent-prompt-guide';

export interface ProjectStyleContractSectionDefinition {
  id: ProjectStyleContractSectionId;
  label: string;
  normalizedTitles: readonly string[];
}

export interface ProjectStyleContractSection {
  id: ProjectStyleContractSectionId;
  label: string;
  title: string;
  body: string;
}

export interface ParsedProjectStyleContract {
  schemaVersion: typeof PROJECT_STYLE_CONTRACT_SCHEMA_VERSION;
  filePath: string;
  title: string | null;
  category: string | null;
  sections: ProjectStyleContractSection[];
  missingSectionIds: ProjectStyleContractSectionId[];
  duplicateSectionIds: ProjectStyleContractSectionId[];
  sectionOrderValid: boolean;
  diagnostics: DesignIndexDiagnostic[];
}

export const PROJECT_STYLE_CONTRACT_SECTION_DEFS: readonly ProjectStyleContractSectionDefinition[] =
  [
    {
      id: 'visual-theme-atmosphere',
      label: 'Visual Theme & Atmosphere',
      normalizedTitles: ['visual theme and atmosphere', 'visual theme atmosphere'],
    },
    {
      id: 'color-palette-roles',
      label: 'Color Palette & Roles',
      normalizedTitles: [
        'color palette and roles',
        'colour palette and roles',
        'color palette roles',
        'colour palette roles',
      ],
    },
    {
      id: 'typography-rules',
      label: 'Typography Rules',
      normalizedTitles: ['typography rules'],
    },
    {
      id: 'component-stylings',
      label: 'Component Stylings',
      normalizedTitles: ['component stylings', 'component styling'],
    },
    {
      id: 'layout-principles',
      label: 'Layout Principles',
      normalizedTitles: ['layout principles'],
    },
    {
      id: 'depth-elevation',
      label: 'Depth & Elevation',
      normalizedTitles: ['depth and elevation', 'elevation and depth'],
    },
    {
      id: 'dos-donts',
      label: "Do's and Don'ts",
      normalizedTitles: ['dos and donts', 'do s and don ts', 'do and dont', 'do and don t'],
    },
    {
      id: 'responsive-behavior',
      label: 'Responsive Behavior',
      normalizedTitles: ['responsive behavior', 'responsive behaviour'],
    },
    {
      id: 'agent-prompt-guide',
      label: 'Agent Prompt Guide',
      normalizedTitles: ['agent prompt guide'],
    },
  ];

/**
 * Parse the portable B3 style contract without treating every DESIGN.md as
 * one. Google DESIGN.md and the legacy HTML-first contract keep their own
 * validators; this parser activates only after a distinctive B3 heading is
 * present.
 */
export function parseProjectStyleContract(
  contents: string | null | undefined,
  filePath = 'DESIGN.md',
): ParsedProjectStyleContract | null {
  if (!contents?.trim()) return null;

  const headings = collectSecondLevelHeadings(contents);
  const matched = headings
    .map((heading) => ({ heading, definition: resolveSectionDefinition(heading.title) }))
    .filter(
      (
        entry,
      ): entry is {
        heading: (typeof headings)[number];
        definition: ProjectStyleContractSectionDefinition;
      } => Boolean(entry.definition),
    );

  if (!looksLikeProjectStyleContract(matched.map((entry) => entry.definition.id))) return null;

  const sectionsById = new Map<ProjectStyleContractSectionId, ProjectStyleContractSection>();
  const duplicateSectionIds = new Set<ProjectStyleContractSectionId>();
  const encounteredOrder: number[] = [];

  for (const { heading, definition } of matched) {
    encounteredOrder.push(sectionIndex(definition.id));
    if (sectionsById.has(definition.id)) {
      duplicateSectionIds.add(definition.id);
      continue;
    }
    sectionsById.set(definition.id, {
      id: definition.id,
      label: definition.label,
      title: heading.title,
      body: normalizeSectionBody(heading.body),
    });
  }

  const sections = PROJECT_STYLE_CONTRACT_SECTION_DEFS.map((definition) =>
    sectionsById.get(definition.id),
  ).filter((section): section is ProjectStyleContractSection => Boolean(section));
  const missingSectionIds = PROJECT_STYLE_CONTRACT_SECTION_DEFS.filter((definition) => {
    const section = sectionsById.get(definition.id);
    return !section || section.body.length === 0;
  }).map((definition) => definition.id);
  const sectionOrderValid = encounteredOrder.every(
    (value, index) => index === 0 || value >= (encounteredOrder[index - 1] ?? value),
  );
  const duplicateIds = [...duplicateSectionIds];
  const diagnostics: DesignIndexDiagnostic[] = [];

  if (missingSectionIds.length > 0) {
    diagnostics.push({
      level: 'warning',
      filePath,
      message: `Project style contract is missing or has empty sections: ${missingSectionIds
        .map(sectionLabel)
        .join(', ')}.`,
    });
  }
  if (!sectionOrderValid) {
    diagnostics.push({
      level: 'warning',
      filePath,
      message: 'Project style contract sections are out of canonical order.',
    });
  }
  if (duplicateIds.length > 0) {
    diagnostics.push({
      level: 'warning',
      filePath,
      message: `Project style contract contains duplicate sections: ${duplicateIds
        .map(sectionLabel)
        .join(', ')}.`,
    });
  }

  return {
    schemaVersion: PROJECT_STYLE_CONTRACT_SCHEMA_VERSION,
    filePath,
    title: extractTitle(contents),
    category: extractCategory(contents),
    sections,
    missingSectionIds,
    duplicateSectionIds: duplicateIds,
    sectionOrderValid,
    diagnostics,
  };
}

export function summarizeProjectStyleContractForPrompt(
  parsed: ParsedProjectStyleContract | null,
): string[] {
  if (!parsed) return [];
  const sectionsWithBody = parsed.sections.filter((section) => section.body.length > 0);
  if (sectionsWithBody.length === 0) return [];

  return [
    '## Project style contract',
    '',
    `Source: ${parsed.filePath}. Apply this project-owned style contract before inventing visual language.`,
    ...(parsed.category ? [`Category: ${parsed.category}.`] : []),
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

export function projectStyleContractCoverage(parsed: ParsedProjectStyleContract | null): {
  present: number;
  total: number;
  score: number;
} {
  const total = PROJECT_STYLE_CONTRACT_SECTION_DEFS.length;
  if (!parsed) return { present: 0, total, score: 0 };
  const present = total - parsed.missingSectionIds.length;
  return { present, total, score: present / total };
}

export function renderProjectStyleContractOutline(input: {
  title: string;
  category?: string | null;
}): string {
  const lines = [
    `# ${input.title}`,
    '',
    ...(input.category ? [`> Category: ${input.category}`, ''] : []),
    ...PROJECT_STYLE_CONTRACT_SECTION_DEFS.flatMap((definition, index) => [
      `## ${index + 1}. ${definition.label}`,
      '',
    ]),
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}

function collectSecondLevelHeadings(contents: string): Array<{
  title: string;
  body: string;
}> {
  const matches = Array.from(contents.matchAll(/^##\s+(?:\d{1,2}\s*[).:-]?\s*)?(.+?)\s*#*\s*$/gmu));
  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? contents.length;
    return {
      title: match[1]?.trim() ?? '',
      body: contents.slice(start, end),
    };
  });
}

function resolveSectionDefinition(title: string): ProjectStyleContractSectionDefinition | null {
  const normalized = normalizeTitle(title);
  return (
    PROJECT_STYLE_CONTRACT_SECTION_DEFS.find((definition) =>
      definition.normalizedTitles.includes(normalized),
    ) ?? null
  );
}

function looksLikeProjectStyleContract(ids: ProjectStyleContractSectionId[]): boolean {
  if (ids.length >= 3) return true;
  return ids.some(
    (id) =>
      id === 'visual-theme-atmosphere' ||
      id === 'color-palette-roles' ||
      id === 'component-stylings' ||
      id === 'layout-principles' ||
      id === 'responsive-behavior' ||
      id === 'agent-prompt-guide',
  );
}

function normalizeTitle(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/gu, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
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

function extractTitle(contents: string): string | null {
  return contents.match(/^#\s+(.+?)\s*#*\s*$/mu)?.[1]?.trim() ?? null;
}

function extractCategory(contents: string): string | null {
  const beforeFirstSection = contents.split(/^##\s+/mu, 1)[0] ?? '';
  return beforeFirstSection.match(/^>\s*Category:\s*(.+?)\s*$/imu)?.[1]?.trim() ?? null;
}

function sectionIndex(id: ProjectStyleContractSectionId): number {
  return PROJECT_STYLE_CONTRACT_SECTION_DEFS.findIndex((definition) => definition.id === id);
}

function sectionLabel(id: ProjectStyleContractSectionId): string {
  return (
    PROJECT_STYLE_CONTRACT_SECTION_DEFS.find((definition) => definition.id === id)?.label ?? id
  );
}
