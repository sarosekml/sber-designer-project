/** Small markdown/string utilities shared by the design-context modules. */

export function splitFrontmatter(contents: string): { frontmatter: string; body: string } {
  if (!contents.startsWith('---')) return { frontmatter: '', body: contents };
  const end = contents.indexOf('\n---', 3);
  if (end < 0) return { frontmatter: '', body: contents };
  const frontmatter = contents.slice(3, end).trim();
  const body = contents.slice(end + 4).trim();
  return { frontmatter, body };
}

export function extractFrontmatterMetadata(frontmatter: string): string[] {
  if (!frontmatter) return [];
  const allowed = new Set(['version', 'name', 'description']);
  const lines = frontmatter
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      const key = line.split(':', 1)[0]?.trim();
      return key ? allowed.has(key) : false;
    });
  return lines.length > 0 ? ['Metadata:', ...lines.map((line) => `- ${line}`)] : [];
}

export function extractMarkdownSections(
  body: string,
  sectionNames: readonly string[],
  maxSectionChars: number,
): string {
  const sections: string[] = [];
  for (const name of sectionNames) {
    const section = extractMarkdownSection(body, name);
    if (section) sections.push(truncateMarkdown(section, maxSectionChars));
  }
  return sections.join('\n\n');
}

export function extractMarkdownSection(body: string, name: string): string {
  const escaped = escapeRegExp(name);
  const re = new RegExp(`(^|\\n)(##\\s+${escaped}\\s*\\n[\\s\\S]*?)(?=\\n##\\s+|$)`, 'i');
  const match = body.match(re);
  return match?.[2]?.trim() ?? '';
}

export function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function normalizeSearchText(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase();
}

export function extractFrontmatterValue(frontmatter: string, key: string): string | null {
  const re = new RegExp(`^${escapeRegExp(key)}:\\s*["']?([^"'\n]+)["']?\\s*$`, 'm');
  return re.exec(frontmatter)?.[1]?.trim() ?? null;
}

export function sentenceCase(value: string): string {
  return value.length > 0 ? `${value[0]?.toUpperCase()}${value.slice(1)}` : value;
}

export function compactLine(value: string, max: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, Math.max(0, max - 3)).trim()}...`;
}

export function truncateMarkdown(value: string, max: number): string {
  const compact = value.replace(/\n{3,}/g, '\n\n').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 24).trim()}\n\n[context truncated]`;
}

export function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
