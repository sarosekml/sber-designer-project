import type { PromptHtmlAttachmentAnalysis } from '@sber-designer/shared-types';

const MAX_HEADINGS = 16;
const MAX_LANDMARKS = 12;
const MAX_SECTIONS = 8;
const MAX_FORMS = 6;
const MAX_TABLES = 6;
const MAX_LISTS = 8;
const MAX_ACTIONS = 24;
const MAX_MOCK_TEXT = 24;
const MAX_CLASS_HINTS = 32;
const HTML_ANALYSIS_MAX_CHARS = 64 * 1024;

const BLOCK_CONTENT_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'iframe',
  'object',
  'embed',
  'template',
  'svg',
]);
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
const LANDMARK_ROLES = new Set([
  'banner',
  'navigation',
  'main',
  'complementary',
  'contentinfo',
  'region',
  'search',
  'form',
]);

interface ElementMatch {
  tag: string;
  attrs: string;
  body: string;
}

export function analyzeHtmlReference(source: string): PromptHtmlAttachmentAnalysis {
  const analysisSource = htmlAnalysisSource(source);
  const warnings = htmlWarnings(source);
  if (analysisSource.truncated) {
    warnings.push(
      'Analyzed the first 64 KB of oversized HTML; full source remains saved as evidence.',
    );
  }
  const sanitized = sanitizeHtmlForAnalysis(analysisSource.source);
  const title = textFromFirstTag(sanitized, 'title');
  const headings = extractHeadings(sanitized);
  return {
    ...(title ? { title } : {}),
    headings,
    landmarks: extractLandmarks(sanitized),
    sections: extractSections(sanitized),
    forms: extractForms(sanitized),
    tables: extractTables(sanitized),
    lists: extractLists(sanitized),
    actions: extractActions(sanitized),
    mockText: extractMockText(sanitized),
    classHints: extractClassHints(sanitized),
    warnings,
  };
}

export function htmlReferenceVisibleExcerpt(source: string): string {
  return compactText(stripTags(sanitizeHtmlForAnalysis(htmlAnalysisSource(source).source))).slice(
    0,
    2000,
  );
}

function htmlAnalysisSource(source: string): { source: string; truncated: boolean } {
  if (source.length <= HTML_ANALYSIS_MAX_CHARS) return { source, truncated: false };
  return { source: source.slice(0, HTML_ANALYSIS_MAX_CHARS), truncated: true };
}

function htmlWarnings(source: string): string[] {
  const warnings: string[] = [];
  if (/<script[\s>]/iu.test(source)) warnings.push('Removed script content from HTML reference.');
  if (/<style[\s>]/iu.test(source)) warnings.push('Removed style content from HTML reference.');
  if (/<(?:iframe|object|embed|noscript|template|svg)[\s>]/iu.test(source)) {
    warnings.push('Ignored embedded or non-HTML-reference content.');
  }
  if (/<!--[\s\S]*?-->/u.test(source)) {
    warnings.push('Ignored HTML comments as non-actionable metadata.');
  }
  if (/\son[a-z]+\s*=/iu.test(source)) {
    warnings.push('Ignored inline event handlers in HTML reference.');
  }
  if (
    /\shidden(?:\s|=|>)/iu.test(source) ||
    /aria-hidden\s*=\s*["']?true/iu.test(source) ||
    /display\s*:\s*none/iu.test(source) ||
    /type\s*=\s*["']hidden["']/iu.test(source)
  ) {
    warnings.push('Ignored hidden HTML content as non-actionable.');
  }
  if (/(?:href|src)\s*=\s*["']\s*(?:https?:|javascript:|data:)/iu.test(source)) {
    warnings.push('Ignored external URL references in HTML reference.');
  }
  return unique(warnings);
}

function sanitizeHtmlForAnalysis(source: string): string {
  return removeElementBlocks(stripHtmlComments(source), (tag, attrs) => {
    return BLOCK_CONTENT_TAGS.has(tag) || hasHiddenContentAttrs(attrs);
  })
    .replace(/<(?:link|meta)\b[^>]*>/giu, ' ')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/giu, ' ')
    .replace(
      /\s(?:href|src)\s*=\s*(?:"\s*(?:https?:|javascript:|data:)[^"]*"|'\s*(?:https?:|javascript:|data:)[^']*')/giu,
      ' ',
    );
}

function extractHeadings(source: string): PromptHtmlAttachmentAnalysis['headings'] {
  return extractElements(source, ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'], MAX_HEADINGS)
    .map((element) => ({ level: Number(element.tag.slice(1)), text: cleanFragment(element.body) }))
    .filter((heading) => heading.text)
    .slice(0, MAX_HEADINGS);
}

function extractLandmarks(source: string): PromptHtmlAttachmentAnalysis['landmarks'] {
  const landmarks: PromptHtmlAttachmentAnalysis['landmarks'] = [];
  const tagRoles: Record<string, string> = {
    header: 'banner',
    nav: 'navigation',
    main: 'main',
    aside: 'complementary',
    footer: 'contentinfo',
  };
  for (const match of matchAll(source, /<([a-z0-9:-]+)\b([^>]*)>/giu)) {
    const tag = (match[1] ?? '').toLowerCase();
    const attrs = match[2] ?? '';
    const explicitRole = attrValue(attrs, 'role')?.toLowerCase();
    const role = explicitRole && LANDMARK_ROLES.has(explicitRole) ? explicitRole : tagRoles[tag];
    if (!role) continue;
    const label = attrValue(attrs, 'aria-label');
    landmarks.push({
      role,
      ...(label ? { label } : {}),
    });
  }
  return dedupeObjects(landmarks).slice(0, MAX_LANDMARKS);
}

function extractSections(source: string): PromptHtmlAttachmentAnalysis['sections'] {
  return extractElements(source, ['section', 'article', 'main', 'aside'], MAX_SECTIONS)
    .map((element) => {
      const body = element.body;
      const heading = extractHeadings(body)[0]?.text;
      const summary = compactText(stripTags(body), 260);
      return { ...(heading ? { heading } : {}), summary };
    })
    .filter((section) => section.summary)
    .slice(0, MAX_SECTIONS);
}

function extractForms(source: string): PromptHtmlAttachmentAnalysis['forms'] {
  return extractElements(source, ['form'], MAX_FORMS)
    .map((element) => {
      const attrs = element.attrs;
      const body = element.body;
      const fields = [
        ...extractElements(body, ['label'], 24).map((item) =>
          cleanFragment(stripFormControls(item.body)),
        ),
        ...matchAll(body, /<(?:input|select|textarea)\b([^>]*)>/giu)
          .map(
            (item) =>
              attrValue(item[1] ?? '', 'aria-label') ||
              attrValue(item[1] ?? '', 'placeholder') ||
              attrValue(item[1] ?? '', 'name'),
          )
          .filter((value): value is string => Boolean(value)),
      ];
      const label = attrValue(attrs, 'aria-label');
      return {
        ...(label ? { label } : {}),
        fields: unique(fields.map(cleanText).filter(Boolean)).slice(0, 12),
        actions: extractButtonTexts(body).slice(0, 8),
      };
    })
    .filter((form) => form.fields.length > 0 || form.actions.length > 0)
    .slice(0, MAX_FORMS);
}

function stripFormControls(source: string): string {
  return removeElementBlocks(source, (tag) => tag === 'select' || tag === 'textarea').replace(
    /<input\b[^>]*>/giu,
    ' ',
  );
}

function extractTables(source: string): PromptHtmlAttachmentAnalysis['tables'] {
  return extractElements(source, ['table'], MAX_TABLES)
    .map((element) => {
      const body = element.body;
      const caption = textFromFirstTag(body, 'caption');
      const columns = extractElements(body, ['th'], 12)
        .map((cell) => cleanFragment(cell.body))
        .filter(Boolean)
        .slice(0, 12);
      const sampleRows = extractElements(body, ['tr'], 12)
        .map((row) =>
          extractElements(row.body, ['td'], 12)
            .map((cell) => cleanFragment(cell.body))
            .filter(Boolean),
        )
        .filter((row) => row.length > 0)
        .slice(0, 3);
      return {
        ...(caption ? { caption } : {}),
        columns,
        sampleRows,
      };
    })
    .filter((table) => table.columns.length > 0 || table.sampleRows.length > 0)
    .slice(0, MAX_TABLES);
}

function extractLists(source: string): PromptHtmlAttachmentAnalysis['lists'] {
  return extractElements(source, ['ul', 'ol'], MAX_LISTS)
    .map((element) => ({
      items: extractElements(element.body, ['li'], 8)
        .map((item) => cleanFragment(item.body))
        .filter(Boolean)
        .slice(0, 5),
    }))
    .filter((list) => list.items.length > 0)
    .slice(0, MAX_LISTS);
}

function extractActions(source: string): string[] {
  const links = extractElements(source, ['a'], MAX_ACTIONS).map((match) =>
    cleanFragment(match.body),
  );
  return unique([...extractButtonTexts(source), ...links].filter(Boolean)).slice(0, MAX_ACTIONS);
}

function extractButtonTexts(source: string): string[] {
  const buttons = extractElements(source, ['button'], MAX_ACTIONS).map((match) =>
    cleanFragment(match.body),
  );
  const roleButtons = extractElementsWhere(source, MAX_ACTIONS, (_tag, attrs) => {
    return attrValue(attrs, 'role')?.toLowerCase() === 'button';
  }).map((match) => cleanFragment(match.body));
  return unique([...buttons, ...roleButtons].filter(Boolean));
}

function extractMockText(source: string): string[] {
  const textBlocks = [
    ...extractElements(source, ['p'], MAX_MOCK_TEXT).map((match) => cleanFragment(match.body)),
    ...extractElements(source, ['dt', 'dd', 'span', 'strong'], MAX_MOCK_TEXT).map((match) =>
      cleanFragment(match.body),
    ),
  ];
  return unique(textBlocks.filter((text) => text.length >= 3)).slice(0, MAX_MOCK_TEXT);
}

function extractClassHints(source: string): string[] {
  const values = matchAll(source, /\b(?:class|id)\s*=\s*["']([^"']+)["']/giu)
    .flatMap((match) => (match[1] ?? '').split(/\s+/u))
    .map((value) => value.trim())
    .filter((value) => /^[a-z0-9_-]{3,40}$/iu.test(value));
  return unique(values).slice(0, MAX_CLASS_HINTS);
}

function textFromFirstTag(source: string, tag: string): string | undefined {
  const text = cleanFragment(extractElements(source, [tag], 1)[0]?.body ?? '');
  return text || undefined;
}

function stripTags(source: string): string {
  return decodeHtmlEntities(source.replace(/<[^>]+>/gu, ' '));
}

function cleanFragment(source: string): string {
  return cleanText(stripTags(source));
}

function cleanText(source: string): string {
  return decodeHtmlEntities(source).replace(/\s+/gu, ' ').trim();
}

function compactText(source: string, maxLength = 220): string {
  const compact = cleanText(source);
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 3))}...`;
}

function attrValue(attrs: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'iu').exec(
    attrs,
  );
  return cleanText(match?.[1] ?? match?.[2] ?? match?.[3] ?? '') || undefined;
}

function decodeHtmlEntities(source: string): string {
  return source
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/giu, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function stripHtmlComments(source: string): string {
  let output = '';
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf('<!--', cursor);
    if (start === -1) return output + source.slice(cursor);
    output += source.slice(cursor, start);
    const end = source.indexOf('-->', start + 4);
    if (end === -1) return output;
    cursor = end + 3;
  }
  return output;
}

function removeElementBlocks(
  source: string,
  shouldRemove: (tag: string, attrs: string) => boolean,
): string {
  const tagPattern = /<\/?([a-z0-9:-]+)\b[^>]*>/giu;
  let output = '';
  let keepStart = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(source))) {
    const fullTag = match[0];
    if (isClosingTag(fullTag)) continue;
    const tag = (match[1] ?? '').toLowerCase();
    const attrs = attrsFromOpeningTag(fullTag, tag);
    if (!shouldRemove(tag, attrs)) continue;
    output += source.slice(keepStart, match.index);
    if (isSelfClosingTag(fullTag, tag)) {
      keepStart = tagPattern.lastIndex;
      continue;
    }
    const close = findElementClose(source, tag, tagPattern);
    keepStart = close?.after ?? source.length;
    tagPattern.lastIndex = keepStart;
  }
  return output + source.slice(keepStart);
}

function extractElements(source: string, tags: string[], maxMatches: number): ElementMatch[] {
  const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));
  return extractElementsWhere(source, maxMatches, (tag) => tagSet.has(tag));
}

function extractElementsWhere(
  source: string,
  maxMatches: number,
  predicate: (tag: string, attrs: string) => boolean,
): ElementMatch[] {
  const elements: ElementMatch[] = [];
  const tagPattern = /<\/?([a-z0-9:-]+)\b[^>]*>/giu;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(source)) && elements.length < maxMatches) {
    const fullTag = match[0];
    if (isClosingTag(fullTag)) continue;
    const tag = (match[1] ?? '').toLowerCase();
    const attrs = attrsFromOpeningTag(fullTag, tag);
    if (!predicate(tag, attrs)) continue;
    if (isSelfClosingTag(fullTag, tag)) {
      elements.push({ tag, attrs, body: '' });
      continue;
    }
    const bodyStart = tagPattern.lastIndex;
    const close = findElementClose(source, tag, tagPattern);
    if (!close) break;
    elements.push({
      tag,
      attrs,
      body: source.slice(bodyStart, close.start),
    });
    tagPattern.lastIndex = close.after;
  }
  return elements;
}

function findElementClose(
  source: string,
  tag: string,
  tagPattern: RegExp,
): { start: number; after: number } | null {
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(source))) {
    const fullTag = match[0];
    const currentTag = (match[1] ?? '').toLowerCase();
    if (currentTag !== tag) continue;
    if (isClosingTag(fullTag)) {
      depth -= 1;
      if (depth === 0) return { start: match.index, after: tagPattern.lastIndex };
      continue;
    }
    if (!isSelfClosingTag(fullTag, currentTag)) depth += 1;
  }
  return null;
}

function attrsFromOpeningTag(fullTag: string, tag: string): string {
  const start = fullTag.toLowerCase().indexOf(tag) + tag.length;
  return fullTag.slice(start, fullTag.endsWith('>') ? -1 : undefined).replace(/\/\s*$/u, '');
}

function isClosingTag(fullTag: string): boolean {
  return /^<\s*\//u.test(fullTag);
}

function isSelfClosingTag(fullTag: string, tag: string): boolean {
  return /\/\s*>$/u.test(fullTag) || VOID_TAGS.has(tag);
}

function hasHiddenContentAttrs(attrs: string): boolean {
  return (
    /\shidden(?:\s|=|$)/iu.test(` ${attrs}`) ||
    /aria-hidden\s*=\s*["']?true/iu.test(attrs) ||
    /display\s*:\s*none/iu.test(attrs) ||
    /type\s*=\s*["']hidden["']/iu.test(attrs)
  );
}

function matchAll(source: string, pattern: RegExp): RegExpMatchArray[] {
  return Array.from(source.matchAll(pattern));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function dedupeObjects<T>(values: T[]): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
