export interface HtmlSnapshot {
  fileName: string;
  html: string;
}

const EXPORT_HTML_MESSAGE = 'sber-designer:export-html';
const EXPORT_HTML_RESULT_MESSAGE = 'sber-designer:export-html-result';
const URL_ATTRS = ['href', 'src', 'poster'] as const;

export function buildHtmlSnapshot(
  document: Document,
  sourceUrl: string,
  screenName: string,
): HtmlSnapshot {
  const root = document.documentElement.cloneNode(true) as HTMLElement;
  root.querySelectorAll('script').forEach((node) => node.remove());
  root.querySelectorAll('[data-sber-designer-overlay]').forEach((node) => node.remove());

  absolutizeUrls(root, sourceUrl);
  ensureSnapshotMeta(root, sourceUrl);

  return {
    fileName: htmlFileNameForScreen(screenName),
    html: `<!doctype html>\n${root.outerHTML}\n`,
  };
}

export function buildHtmlSnapshotFromHtml(html: string, screenName: string): HtmlSnapshot {
  return {
    fileName: htmlFileNameForScreen(screenName),
    html,
  };
}

export function requestHtmlSnapshotFromIframe(
  iframe: HTMLIFrameElement,
  timeoutMs = 5000,
): Promise<string> {
  const targetWindow = iframe.contentWindow;
  if (!targetWindow) {
    return Promise.reject(new Error('Canvas iframe is not ready yet.'));
  }

  const requestId = `export-html-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for canvas export.'));
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== targetWindow) return;
      const data = event.data;
      if (!isExportHtmlResult(data) || data.requestId !== requestId) return;

      cleanup();
      if (data.error) {
        reject(new Error(data.error));
        return;
      }
      resolve(data.html);
    };

    window.addEventListener('message', onMessage);
    targetWindow.postMessage({ type: EXPORT_HTML_MESSAGE, requestId }, '*');
  });
}

export function downloadTextFile(fileName: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function htmlFileNameForScreen(screenName: string): string {
  return `${slugifyFileName(screenName) || 'screen'}.html`;
}

function isExportHtmlResult(data: unknown): data is {
  type: typeof EXPORT_HTML_RESULT_MESSAGE;
  requestId: string;
  html: string;
  error?: string;
} {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  if (record.type !== EXPORT_HTML_RESULT_MESSAGE) return false;
  if (typeof record.requestId !== 'string') return false;
  if (typeof record.error === 'string') return true;
  return typeof record.html === 'string';
}

function absolutizeUrls(root: HTMLElement, sourceUrl: string): void {
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    for (const attr of URL_ATTRS) {
      const value = element.getAttribute(attr);
      if (!value || shouldKeepUrl(value)) continue;
      element.setAttribute(attr, new URL(value, sourceUrl).toString());
    }
    const srcset = element.getAttribute('srcset');
    if (srcset) element.setAttribute('srcset', absolutizeSrcset(srcset, sourceUrl));
  }
}

function ensureSnapshotMeta(root: HTMLElement, sourceUrl: string): void {
  const ownerDocument = root.ownerDocument;
  const head =
    root.querySelector('head') ??
    root.insertBefore(ownerDocument.createElement('head'), root.firstChild);
  const generator = ownerDocument.createElement('meta');
  generator.setAttribute('name', 'generator');
  generator.setAttribute('content', 'sber-designer html export');
  head.prepend(generator);

  const exportedFrom = ownerDocument.createElement('meta');
  exportedFrom.setAttribute('name', 'sber-designer:source');
  exportedFrom.setAttribute('content', sourceUrl);
  head.prepend(exportedFrom);
}

function absolutizeSrcset(srcset: string, sourceUrl: string): string {
  return srcset
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return trimmed;
      const [url, ...descriptor] = trimmed.split(/\s+/);
      if (!url || shouldKeepUrl(url)) return trimmed;
      return [new URL(url, sourceUrl).toString(), ...descriptor].join(' ');
    })
    .join(', ');
}

function shouldKeepUrl(value: string): boolean {
  return (
    value.startsWith('#') ||
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('javascript:') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:')
  );
}

function slugifyFileName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
