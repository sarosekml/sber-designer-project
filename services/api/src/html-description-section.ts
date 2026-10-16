export function htmlDescriptionSectionToMarkdown(html: string): string {
  const codeBlocks: string[] = [];
  let normalized = html.replace(
    /<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/giu,
    (_match, code: string) => {
      const token = `__SD_DESCRIPTION_CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push(`\n\n\`\`\`html\n${decodeHtml(code).trim()}\n\`\`\`\n\n`);
      return token;
    },
  );
  normalized = normalized
    .replace(
      /<h[1-6]\b[^>]*>\s*Description\s+for\s+AI\s*<\/h[1-6]>/giu,
      '\n## Description for AI\n',
    )
    .replace(/<strong\b[^>]*>\s*([^<]*?:?)\s*<\/strong>/giu, (_match, label: string) => {
      const normalizedLabel = decodeHtml(label)
        .trim()
        .replace(/:?\s*$/u, ':');
      return `**${normalizedLabel}** `;
    })
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/giu, (_match, code: string) => {
      return `\`${decodeHtml(code).trim()}\``;
    })
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<li\b[^>]*>/giu, '\n- ')
    .replace(/<\/li>/giu, '\n')
    .replace(/<\/(?:p|div|section|ul|ol|h[1-6])>/giu, '\n')
    .replace(/<[^>]+>/gu, '');
  normalized = decodeHtml(normalized);
  for (let index = 0; index < codeBlocks.length; index += 1) {
    normalized = normalized.replace(`__SD_DESCRIPTION_CODE_BLOCK_${index}__`, codeBlocks[index]!);
  }
  const markdown = normalized
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
  if (/^#{1,6}\s*Description\s+for\s+AI\s*$/imu.test(markdown)) return markdown;
  return `## Description for AI\n\n${markdown}`;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, '&');
}
