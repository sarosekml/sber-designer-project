/** Composer attachment limits and file readers. */

export const MAX_ATTACHMENTS = 4;

export const ACCEPTED_ATTACHMENTS =
  'image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg,.md,.txt,.json,.yaml,.yml,.html,.htm,.css,text/plain,text/markdown,text/html,text/css,application/json,application/yaml,text/yaml,application/xhtml+xml';

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('File read failed')));
    reader.readAsDataURL(file);
  });
}

export function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('File read failed')));
    reader.readAsText(file);
  });
}

export function inferTextMimeType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'application/yaml';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  if (lower.endsWith('.css')) return 'text/css';
  return 'text/plain';
}
