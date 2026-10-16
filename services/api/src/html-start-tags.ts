export interface HtmlStartTag {
  start: number;
  end: number;
  tagName: string;
  attributes: ReadonlyMap<string, string | null>;
}

const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

/** Scan real HTML start tags while ignoring comments, raw-text bodies and quoted values. */
export function scanHtmlStartTags(source: string): HtmlStartTag[] {
  const tags: HtmlStartTag[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf('<', cursor);
    if (open === -1) break;
    if (source.startsWith('<!--', open)) {
      const close = source.indexOf('-->', open + 4);
      cursor = close === -1 ? source.length : close + 3;
      continue;
    }
    const lead = source[open + 1];
    if (lead === '/' || lead === '!' || lead === '?') {
      cursor = tagEnd(source, open) ?? source.length;
      continue;
    }
    const end = tagEnd(source, open);
    if (end === null) break;
    const parsed = parseStartTag(source.slice(open, end), open, end);
    if (!parsed) {
      cursor = end;
      continue;
    }
    tags.push(parsed);
    cursor = end;
    if (RAW_TEXT_TAGS.has(parsed.tagName)) {
      const closing = source.toLowerCase().indexOf(`</${parsed.tagName}`, cursor);
      if (closing !== -1) cursor = closing;
    }
  }
  return tags;
}

export function htmlStartTagsWithAttribute(source: string, attribute: string): HtmlStartTag[] {
  const normalized = attribute.toLowerCase();
  return scanHtmlStartTags(source).filter((tag) => tag.attributes.has(normalized));
}

function tagEnd(source: string, open: number): number | null {
  let quote: '"' | "'" | null = null;
  for (let index = open + 1; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') return index + 1;
  }
  return null;
}

function parseStartTag(text: string, start: number, end: number): HtmlStartTag | null {
  const nameMatch = /^<\s*([^\s/>]+)/u.exec(text);
  const rawName = nameMatch?.[1];
  if (!rawName) return null;
  const attributes = new Map<string, string | null>();
  let cursor = nameMatch[0].length;
  while (cursor < text.length) {
    while (/\s/u.test(text[cursor] ?? '')) cursor += 1;
    if (text[cursor] === '>' || text[cursor] === '/' || cursor >= text.length) break;
    const nameStart = cursor;
    while (cursor < text.length && !/[\s=/>]/u.test(text[cursor] ?? '')) {
      cursor += 1;
    }
    const name = text.slice(nameStart, cursor).toLowerCase();
    if (!name) {
      cursor += 1;
      continue;
    }
    while (/\s/u.test(text[cursor] ?? '')) cursor += 1;
    let value: string | null = null;
    if (text[cursor] === '=') {
      cursor += 1;
      while (/\s/u.test(text[cursor] ?? '')) cursor += 1;
      const quote = text[cursor];
      if (quote === '"' || quote === "'") {
        cursor += 1;
        const valueStart = cursor;
        while (cursor < text.length && text[cursor] !== quote) cursor += 1;
        value = text.slice(valueStart, cursor);
        if (text[cursor] === quote) cursor += 1;
      } else {
        const valueStart = cursor;
        while (cursor < text.length && !/[\s>]/u.test(text[cursor] ?? '')) cursor += 1;
        value = text.slice(valueStart, cursor);
      }
    }
    attributes.set(name, value);
  }
  return {
    start,
    end,
    tagName: rawName.toLowerCase(),
    attributes,
  };
}
