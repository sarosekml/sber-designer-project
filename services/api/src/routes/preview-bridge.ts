/**
 * Injecting the preview bridge, and rewriting root-relative URLs so a proxied
 * page still resolves its own assets (0136 R12 — extracted from preview.ts).
 *
 * Both proxies use these: the authenticated /api/preview route and the public
 * /api/preview-share/:token route, which passes its own prefix.
 */
import { readFileSync } from 'node:fs';

import { BRIDGE_SCRIPT } from './preview-bridge-script';

/**
 * Mark-layer rasterizer (0127): the bridge's snapshot handler delegates DOM →
 * PNG to html-to-image (MIT, inlined below so protected deployments need no
 * CDN). The hand-rolled foreignObject serializer stays as a fallback, but it
 * blank-renders on real pages (same failure class Open Design tracks as
 * issue #4064), so the library path is primary.
 */
let htmlToImageBundleCache: string | null | undefined;

function htmlToImageBundle(): string | null {
  if (htmlToImageBundleCache !== undefined) return htmlToImageBundleCache;
  try {
    const bundlePath = require.resolve('html-to-image/dist/html-to-image.js');
    htmlToImageBundleCache = readFileSync(bundlePath, 'utf8');
  } catch {
    htmlToImageBundleCache = null;
  }
  return htmlToImageBundleCache;
}

function rasterizerScript(): string {
  const bundle = htmlToImageBundle();
  if (!bundle) return '';
  return `<script data-sd-rasterizer>${bundle}</script>`;
}

export function injectPreviewBridge(html: string): string {
  if (html.includes('__SBER_DESIGNER_SELECTION_BRIDGE__')) return html;
  const injected = `${rasterizerScript()}${BRIDGE_SCRIPT}`;
  if (html.includes('</body>')) return html.replace('</body>', `${injected}</body>`);
  return `${html}${injected}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rewriteRootUrls(input: string, proxyPrefix = '/api/preview'): string {
  const prefix = proxyPrefix.replace(/\/+$/, '');
  const escapedPrefix = escapeRegExp(prefix.replace(/^\/+/, ''));
  const apiPrefixPattern = new RegExp(`(?:${escapedPrefix}|api/preview|api/preview-share/)`);
  return input
    .replace(
      /\b(src|href)=("|')\/(?!\/)([^"']*)\2/g,
      (match, attr: string, quote: string, path: string) =>
        apiPrefixPattern.test(path) ? match : `${attr}=${quote}${prefix}/${path}${quote}`,
    )
    .replace(/\bfrom\s+("|')\/(?!\/)([^"']*)\1/g, (match, quote: string, path: string) =>
      apiPrefixPattern.test(path) ? match : `from ${quote}${prefix}/${path}${quote}`,
    )
    .replace(/\bimport\s+("|')\/(?!\/)([^"']*)\1/g, (match, quote: string, path: string) =>
      apiPrefixPattern.test(path) ? match : `import ${quote}${prefix}/${path}${quote}`,
    )
    .replace(/\bimport\(("|')\/(?!\/)([^"']*)\1\)/g, (match, quote: string, path: string) =>
      apiPrefixPattern.test(path) ? match : `import(${quote}${prefix}/${path}${quote})`,
    )
    .replace(
      /\burl\(("|')?\/(?!\/)([^)"']*)\1?\)/g,
      (_match, quote: string | undefined, path: string) =>
        apiPrefixPattern.test(path)
          ? `url(${quote ?? ''}/${path}${quote ?? ''})`
          : `url(${quote ?? ''}${prefix}/${path}${quote ?? ''})`,
    );
}
