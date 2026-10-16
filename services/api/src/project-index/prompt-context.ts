import type { ComponentDescriptionMapEntry } from '@sber-designer/design-indexer';

const MAX_PROJECT_INDEX_SUMMARY_CHARS = 2_500;

export interface ProjectIndexPromptContextInput {
  promptSummary?: string | null | undefined;
  descriptionMap?: ComponentDescriptionMapEntry[] | null | undefined;
  userRequest?: string | null | undefined;
  activeScreenName?: string | null | undefined;
  activeScreenDescription?: string | null | undefined;
  taskKind?: string | null | undefined;
  assistantTaskIntentKind?: string | null | undefined;
}

export function renderTaskRelevantProjectIndexSummary(
  input: ProjectIndexPromptContextInput,
): string {
  const summary = input.promptSummary?.trim();
  if (!summary) return '';
  const sections = selectTaskRelevantProjectIndexSections(summary, input);
  if (sections.length === 0) {
    return [
      '### Project Index Summary',
      '',
      compactText(summary, MAX_PROJECT_INDEX_SUMMARY_CHARS),
    ].join('\n');
  }
  return [
    '### Project Index Summary (Task-Relevant Sections)',
    '',
    compactMarkdown(
      sections.map((section) => section.text).join('\n\n'),
      MAX_PROJECT_INDEX_SUMMARY_CHARS,
    ),
  ].join('\n');
}

export function renderTaskRelevantDescriptionMap(input: ProjectIndexPromptContextInput): string {
  const entries = selectTaskRelevantDescriptionMapEntries(input);
  if (entries.length === 0) return '';
  const lines = [
    '### Component Description Map (Task-Relevant)',
    '',
    'Thin catalog map for discovery only. Use docsRef/usage-cards before guessing prop values.',
  ];
  for (const entry of entries.slice(0, 16)) {
    lines.push(
      `- \`${entry.shortName}\` (${entry.componentId})`,
      `  - status: ${entry.status}${typeof entry.coverageScore === 'number' ? `; coverage: ${entry.coverageScore}` : ''}`,
      `  - keywords: ${entry.keywords.join(', ') || 'none'}`,
      `  - docsRef: ${descriptionMapDocsRef(entry)}`,
    );
  }
  if (entries.length > 16) {
    lines.push(`- ${entries.length - 16} more matching description-map entries omitted.`);
  }
  return lines.join('\n');
}

interface MarkdownSection {
  heading: string;
  body: string;
  text: string;
}

function selectTaskRelevantProjectIndexSections(
  markdown: string,
  input: ProjectIndexPromptContextInput,
): MarkdownSection[] {
  const sections = splitMarkdownSections(markdown);
  if (sections.length === 0) return [];
  const terms = projectIndexTaskTerms(input);
  return sections.filter((section) => projectIndexSectionMatchesTask(section, terms));
}

function splitMarkdownSections(markdown: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (const line of markdown.split('\n')) {
    const heading = line.match(/^#{3,6}\s+(.+?)\s*$/u)?.[1]?.trim();
    if (heading) {
      if (current) sections.push(toMarkdownSection(current));
      current = { heading, lines: [line] };
      continue;
    }
    current?.lines.push(line);
  }
  if (current) sections.push(toMarkdownSection(current));
  return sections;
}

function toMarkdownSection(section: { heading: string; lines: string[] }): MarkdownSection {
  const text = section.lines.join('\n').trim();
  const body = section.lines.slice(1).join('\n').trim();
  return { heading: section.heading, body, text };
}

function projectIndexSectionMatchesTask(section: MarkdownSection, terms: Set<string>): boolean {
  const heading = normalizePromptTerms(section.heading);
  if (/\b(typography|color|colour|tokens?|spacing|radius|layout|density)\b/u.test(heading)) {
    return true;
  }
  const haystack = normalizePromptTerms(`${section.heading} ${section.body}`);
  for (const term of terms) {
    if (term.length > 2 && haystack.includes(term)) return true;
  }
  return false;
}

function selectTaskRelevantDescriptionMapEntries(
  input: ProjectIndexPromptContextInput,
): ComponentDescriptionMapEntry[] {
  const entries = input.descriptionMap ?? [];
  if (entries.length === 0) return [];
  const terms = projectIndexTaskTerms(input);
  return entries.filter((entry) => descriptionMapEntryMatchesTask(entry, terms));
}

function descriptionMapEntryMatchesTask(
  entry: ComponentDescriptionMapEntry,
  terms: Set<string>,
): boolean {
  const haystack = normalizePromptTerms(
    [
      entry.componentId,
      entry.shortName,
      entry.keywords.join(' '),
      entry.docsRef.sourcePath,
      entry.docsRef.storybookUrl ?? '',
      entry.docsRef.anchor ?? '',
    ].join(' '),
  );
  for (const term of terms) {
    if (term.length > 2 && haystack.includes(term)) return true;
  }
  return false;
}

function descriptionMapDocsRef(entry: ComponentDescriptionMapEntry): string {
  return [
    entry.docsRef.sourcePath,
    entry.docsRef.anchor ? `#${entry.docsRef.anchor}` : '',
    entry.docsRef.storybookUrl ? ` (${entry.docsRef.storybookUrl})` : '',
  ].join('');
}

function projectIndexTaskTerms(input: ProjectIndexPromptContextInput): Set<string> {
  const source = [
    input.userRequest ?? '',
    input.activeScreenName ?? '',
    input.activeScreenDescription ?? '',
    input.taskKind ?? '',
    input.assistantTaskIntentKind ?? '',
  ].join(' ');
  const stopwords = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'this',
    'that',
    'screen',
    'create',
    'generate',
    'сделай',
    'создай',
    'сгенерируй',
    'экран',
    'страницу',
    'страница',
    'новый',
    'новую',
    'для',
    'про',
    'по',
    'из',
    'на',
    'со',
    'с',
    'и',
    'или',
    'это',
    'тот',
    'эта',
    'этот',
  ]);
  const terms = normalizePromptTerms(source)
    .split(/\s+/u)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !stopwords.has(term));
  return new Set(terms.flatMap(expandPromptTaskTerm));
}

const RU_PROMPT_TERM_SYNONYMS: Array<{ stem: string; terms: string[] }> = [
  { stem: 'таблиц', terms: ['table', 'tables', 'datatable', 'data table', 'grid'] },
  { stem: 'фильтр', terms: ['filter', 'filters', 'search'] },
  { stem: 'поиск', terms: ['search', 'filter'] },
  { stem: 'статус', terms: ['status', 'statuses', 'state'] },
  { stem: 'сделк', terms: ['deal', 'deals', 'pipeline'] },
  { stem: 'платеж', terms: ['payment', 'payments', 'schedule'] },
  { stem: 'платёж', terms: ['payment', 'payments', 'schedule'] },
  { stem: 'клиент', terms: ['client', 'customer'] },
  { stem: 'документ', terms: ['document', 'documents', 'files'] },
  { stem: 'график', terms: ['schedule', 'timeline'] },
  { stem: 'команд', terms: ['team', 'contacts'] },
];

function expandPromptTaskTerm(term: string): string[] {
  const expanded = new Set([term]);
  for (const item of RU_PROMPT_TERM_SYNONYMS) {
    if (term.startsWith(item.stem)) {
      for (const synonym of item.terms) expanded.add(synonym);
    }
  }
  return [...expanded];
}

function compactText(value: string, maxChars: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  return compact.length <= maxChars ? compact : `${compact.slice(0, maxChars - 3)}...`;
}

function compactMarkdown(value: string, maxChars: number): string {
  const compact = value
    .split('\n')
    .map((line) => line.replace(/[ \t]+/gu, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
  if (!compact) return '';
  return compact.length <= maxChars ? compact : `${compact.slice(0, maxChars - 3)}...`;
}

function normalizePromptTerms(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}
