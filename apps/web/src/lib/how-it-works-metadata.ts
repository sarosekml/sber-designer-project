export interface HowItWorksMetadata {
  fileName: string;
  slug: string;
  title: string;
  excerpt: string;
  updated: string;
  route: string;
}

export interface ParsedHowItWorksDocument {
  metadata: HowItWorksMetadata;
  body: string;
}

const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/u;
const UPDATED_PATTERN = /^updated:\s*(.+?)\s*$/mu;

export function parseHowItWorksDocument(
  source: string,
  fileName: string,
  today = new Date(),
): ParsedHowItWorksDocument {
  const frontmatter = FRONTMATTER_PATTERN.exec(source);
  if (!frontmatter) {
    throw new Error(`${fileName}: How it works document must start with YAML frontmatter.`);
  }

  const updatedValue = UPDATED_PATTERN.exec(frontmatter[1] ?? '')?.[1];
  const updated = unquote(updatedValue?.trim() ?? '');
  if (!updated) {
    throw new Error(`${fileName}: frontmatter.updated is required.`);
  }
  if (!isValidUpdatedAt(updated)) {
    throw new Error(`${fileName}: frontmatter.updated must be an ISO date or timestamp.`);
  }

  const todayKey = today.toISOString().slice(0, 10);
  if (updated.slice(0, 10) > todayKey) {
    throw new Error(`${fileName}: frontmatter.updated cannot be in the future.`);
  }

  const body = source.slice(frontmatter[0].length).replace(/^(?:\r?\n)+/u, '');
  const slug = fileName === 'README.md' ? 'overview' : fileName.replace(/\.md$/u, '');
  const title = extractDocumentTitle(body, fileName);

  return {
    metadata: {
      fileName,
      slug,
      title,
      excerpt: extractDocumentExcerpt(body),
      updated,
      route: documentationRoute(slug),
    },
    body,
  };
}

export function selectRecentlyUpdatedDocuments(
  documents: readonly HowItWorksMetadata[],
  limit = 3,
): HowItWorksMetadata[] {
  return [...documents]
    .sort((left, right) => {
      const updatedOrder = Date.parse(right.updated) - Date.parse(left.updated);
      if (updatedOrder !== 0) return updatedOrder;
      const titleOrder = left.title.localeCompare(right.title, undefined, {
        sensitivity: 'base',
      });
      return titleOrder || left.slug.localeCompare(right.slug);
    })
    .slice(0, Math.max(0, limit));
}

export function documentationRoute(slug: string): string {
  return slug === 'overview' ? '/how-it-works' : `/how-it-works/${encodeURIComponent(slug)}`;
}

function isValidUpdatedAt(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/u.test(
      value,
    )
  ) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

function extractDocumentTitle(content: string, fileName: string): string {
  const heading = /^#\s+(.+)$/mu.exec(content)?.[1]?.trim();
  if (heading) return heading.replace(/[`*_]/gu, '');
  if (fileName === 'README.md') return 'Overview';
  return fileName
    .replace(/\.md$/u, '')
    .split('-')
    .map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function extractDocumentExcerpt(content: string): string {
  const paragraphs = content.split(/\r?\n\s*\r?\n/u);
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (
      !trimmed ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('```') ||
      trimmed.startsWith('|') ||
      trimmed.startsWith('<')
    ) {
      continue;
    }

    const plain = trimmed
      .replace(/!\[([^\]]*)\]\([^)]+\)/gu, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
      .replace(/`([^`]+)`/gu, '$1')
      .replace(/^[>*+-]\s+/gmu, '')
      .replace(/[*_~]/gu, '')
      .replace(/\s+/gu, ' ')
      .trim();
    if (plain) return plain.slice(0, 220);
  }
  return 'Product documentation for Sber Designer.';
}

function unquote(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"')))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
