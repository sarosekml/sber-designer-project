import {
  DEFAULT_PROMPT_ATTACHMENT_LIMITS,
  promptAttachmentLimitsFromConfig,
} from '@sber-designer/llm-gateway';
import { normalizePromptImageMimeType } from '@sber-designer/shared-types';
import type { ChatAttachment } from '@/stores/chat-store';

export const TEXT_ATTACHMENT_MAX_BYTES = DEFAULT_PROMPT_ATTACHMENT_LIMITS.textMaxBytes;
export const IMAGE_ATTACHMENT_MAX_BYTES = DEFAULT_PROMPT_ATTACHMENT_LIMITS.imageMaxBytes;
export const SVG_ATTACHMENT_MAX_BYTES = DEFAULT_PROMPT_ATTACHMENT_LIMITS.svgMaxBytes;
export { promptAttachmentLimitsFromConfig };

const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.html',
  '.htm',
  '.css',
]);

export interface AttachmentFileLike {
  name: string;
  type: string;
}

export interface TextAttachmentContextItem {
  name: string;
  mimeType: string;
  size: number;
  text: string;
}

export function isSupportedTextAttachment(file: AttachmentFileLike): boolean {
  if (file.type.startsWith('image/')) return false;
  if (
    file.type.startsWith('text/') ||
    file.type === 'application/json' ||
    file.type === 'application/yaml' ||
    file.type === 'application/x-yaml' ||
    file.type === 'application/xhtml+xml'
  ) {
    return true;
  }
  return TEXT_ATTACHMENT_EXTENSIONS.has(fileExtension(file.name));
}

export function isSupportedImageAttachment(file: AttachmentFileLike): boolean {
  return Boolean(normalizePromptImageMimeType(file.type, file.name));
}

export function isSupportedPromptAttachment(file: AttachmentFileLike): boolean {
  return isSupportedImageAttachment(file) || isSupportedTextAttachment(file);
}

export function inferImageMimeType(name: string, fallback = ''): string {
  return normalizePromptImageMimeType(fallback, name) ?? 'application/octet-stream';
}

export function isLikelyImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  return Boolean(normalizePromptImageMimeType('', url.pathname));
}

export function buildImageUrlAttachment(value: string): ChatAttachment {
  const url = new URL(value.trim());
  const name = imageUrlAttachmentName(url);
  const mimeType = normalizePromptImageMimeType('', name) ?? 'image/png';
  return {
    id: `att-url-${stableStringHash(url.toString())}`,
    kind: 'image',
    name,
    mimeType,
    size: 0,
    sourceUrl: url.toString(),
  };
}

export function extractImageUrlsFromText(text: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const match of text.matchAll(/https:\/\/[^\s<>"'`]+/giu)) {
    const candidate = trimUrlToken(match[0]);
    if (!isLikelyImageUrl(candidate)) continue;
    const normalized = new URL(candidate).toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return urls;
}

export function buildImageUrlAttachmentsFromText(input: {
  text: string;
  existingAttachments?: ChatAttachment[];
  maxCount: number;
}): ChatAttachment[] {
  const existingUrls = new Set(
    (input.existingAttachments ?? [])
      .map((attachment) => attachment.sourceUrl)
      .filter((url): url is string => Boolean(url)),
  );
  const slots = Math.max(0, input.maxCount - (input.existingAttachments?.length ?? 0));
  if (slots === 0) return [];
  return extractImageUrlsFromText(input.text)
    .filter((url) => !existingUrls.has(url))
    .slice(0, slots)
    .map(buildImageUrlAttachment);
}

export function buildTextAttachmentContext(items: TextAttachmentContextItem[]): string {
  if (items.length === 0) return '';
  const blocks = items.map((item, index) => {
    const language = markdownLanguage(item.name, item.mimeType);
    return [
      `File ${index + 1}: ${item.name} (${item.mimeType || 'text/plain'}, ${item.size} bytes)`,
      `\`\`\`${language}`,
      item.text.trimEnd(),
      '```',
    ].join('\n');
  });
  return ['Attached text files:', ...blocks].join('\n\n');
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  const mb = size / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function imageUrlAttachmentName(url: URL): string {
  const raw = url.pathname.split('/').filter(Boolean).at(-1) ?? 'remote-image.png';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function trimUrlToken(value: string): string {
  return value.replace(/[),.;:!?]+$/gu, '');
}

function stableStringHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function markdownLanguage(name: string, mimeType: string): string {
  const ext = fileExtension(name);
  if (ext === '.md') return 'markdown';
  if (
    ext === '.html' ||
    ext === '.htm' ||
    mimeType === 'text/html' ||
    mimeType === 'application/xhtml+xml'
  ) {
    return 'html';
  }
  if (ext === '.json' || mimeType === 'application/json') return 'json';
  if (ext === '.yaml' || ext === '.yml' || mimeType.includes('yaml')) return 'yaml';
  if (ext === '.css' || mimeType === 'text/css') return 'css';
  return 'text';
}
