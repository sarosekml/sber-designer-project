import { createServer, type Server, type ServerResponse } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import type { SessionInfo, SessionStatus } from './session';

const LOG_TAIL_LIMIT = 80;

/**
 * 0136 R04 — the static preview used to serve any file inside the lexical
 * workspace root. A probe for `/.env` returned 200. The share proxy forwards
 * an arbitrary path to a live preview, so a share-token holder reached the
 * same surface.
 *
 * The rule is now positive: a request is served only when its extension is a
 * publishable web asset AND no path segment is a secret / VCS / runtime-state
 * directory. Anything else is 404 — the same answer as a missing file, so the
 * response does not confirm that a `.env` exists.
 */
const SERVABLE_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.css',
  '.js',
  '.mjs',
  '.map',
  '.json',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.bmp',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.mp4',
  '.webm',
  '.ogg',
  '.mp3',
  '.wav',
  '.txt',
  '.webmanifest',
  '.xml',
  '.pdf',
]);

/** Directories that never belong in a preview, whatever they contain. */
const BLOCKED_SEGMENTS = new Set([
  '.git',
  '.hg',
  '.svn',
  '.sber-designer',
  '.agents',
  '.ssh',
  '.gnupg',
  '.aws',
  '.config',
  'node_modules/.cache',
]);

/** Exact filenames that are secrets or tooling state regardless of extension. */
const BLOCKED_FILENAMES = new Set([
  '.env',
  '.npmrc',
  '.netrc',
  '.git-credentials',
  '.htpasswd',
  'id_rsa',
  'id_ed25519',
]);

export function isServableStaticPath(relPath: string): boolean {
  const segments = relPath.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  for (const segment of segments) {
    if (segment === '.' || segment === '..') return false;
    if (BLOCKED_SEGMENTS.has(segment)) return false;
  }
  const name = segments.at(-1) ?? '';
  if (BLOCKED_FILENAMES.has(name)) return false;
  // `.env`, `.env.local`, `.env.production` …
  if (name.startsWith('.env')) return false;
  return SERVABLE_EXTENSIONS.has(extname(name).toLowerCase());
}

export interface StaticHtmlPreviewResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer | string;
}

export class StaticHtmlSession {
  readonly id = randomUUID();
  readonly startedAt = Date.now();
  readonly command = 'static-html';
  readonly args: string[];
  status: SessionStatus = 'starting';
  previewUrl: string | null = null;
  readyAt: number | null = null;
  errorMessage: string | null = null;
  diagnostics = null;
  private server: Server | null = null;
  private readonly logTail: string[] = [];

  constructor(
    readonly workspacePath: string,
    readonly port: number,
    args: string[] = [],
  ) {
    this.args = args;
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      void this.serve(req.url ?? '/', res);
    });
    await new Promise<void>((resolveStart, rejectStart) => {
      this.server?.once('error', rejectStart);
      this.server?.listen(this.port, '127.0.0.1', () => resolveStart());
    });
    this.status = 'ready';
    this.readyAt = Date.now();
    this.previewUrl = `http://localhost:${this.port}`;
    this.appendLog(`[static-html] serving ${this.workspacePath} on ${this.previewUrl}`);
  }

  async stop(): Promise<void> {
    if (!this.server || this.status === 'stopped') return;
    await new Promise<void>((resolveStop) => {
      this.server?.close(() => resolveStop());
    });
    this.status = 'stopped';
  }

  toJSON(): SessionInfo {
    return {
      id: this.id,
      workspacePath: this.workspacePath,
      command: this.command,
      args: this.args,
      port: this.port,
      status: this.status,
      previewUrl: this.previewUrl,
      logsTail: this.logTail.slice(-50),
      startedAt: this.startedAt,
      readyAt: this.readyAt,
      errorMessage: this.errorMessage,
      diagnostics: this.diagnostics,
    };
  }

  private async serve(url: string, res: ServerResponse) {
    const response = await readStaticHtmlPreviewResponse(this.workspacePath, url);
    res.writeHead(response.status, response.headers);
    res.end(response.body);
  }

  private appendLog(line: string) {
    this.logTail.push(line);
    if (this.logTail.length > LOG_TAIL_LIMIT) this.logTail.shift();
  }
}

const NOT_FOUND: StaticHtmlPreviewResponse = {
  status: 404,
  headers: { 'content-type': 'text/plain; charset=utf-8' },
  body: 'Not found',
};

export async function readStaticHtmlPreviewResponse(
  workspacePath: string,
  url: string,
): Promise<StaticHtmlPreviewResponse> {
  let target: ReturnType<typeof resolveRequestPath>;
  try {
    target = resolveRequestPath(workspacePath, url);
  } catch {
    return NOT_FOUND;
  }
  if (!target) {
    return {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: 'Forbidden',
    };
  }
  if (!isServableStaticPath(target.relPath)) return NOT_FOUND;
  try {
    // Canonical check (0136 R02/R04): a symlink inside the workspace must not
    // publish a file from outside it.
    const canonicalRoot = await realpath(resolve(workspacePath));
    const canonicalTarget = await realpath(target.absPath);
    const insideRel = relative(canonicalRoot, canonicalTarget);
    if (!insideRel || insideRel.startsWith('..') || isAbsolute(insideRel)) return NOT_FOUND;
    if (!isServableStaticPath(insideRel.split('\\').join('/'))) return NOT_FOUND;
    const info = await stat(canonicalTarget);
    if (!info.isFile()) {
      return {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        body: 'Not found',
      };
    }
    const raw = await readFile(canonicalTarget);
    const mime = mimeType(target.relPath);
    return {
      status: 200,
      headers: { 'content-type': mime },
      body: mime.startsWith('text/html')
        ? transformHtml(raw.toString('utf8'), target.relPath)
        : raw,
    };
  } catch {
    return {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: 'Not found',
    };
  }
}

function resolveRequestPath(
  workspacePath: string,
  url: string,
): { absPath: string; relPath: string } | null {
  const pathname = new URL(url, 'http://localhost').pathname;
  let relPath = decodeURIComponent(pathname).replace(/^\/+/u, '');
  if (!relPath || relPath.endsWith('/')) relPath = `${relPath}index.html`;
  const absPath = resolve(workspacePath, relPath);
  const relToRoot = relative(workspacePath, absPath);
  if (!relToRoot || relToRoot.startsWith('..') || isAbsolute(relToRoot)) return null;
  return { absPath, relPath: relToRoot.split('\\').join('/') };
}

function transformHtml(contents: string, relPath: string): string {
  const withLoc = addSourceLocations(contents, relPath);
  const withRoot = ensureScreenRoot(withLoc);
  const marker = '<script>window.__SBER_DESIGNER_STATIC_HTML__ = true;</script>';
  if (/<\/body>/iu.test(withRoot)) return withRoot.replace(/<\/body>/iu, `${marker}\n</body>`);
  return `${withRoot}\n${marker}\n`;
}

function ensureScreenRoot(contents: string): string {
  if (/\bdata-sd-screen-root\b/iu.test(contents)) return contents;
  if (/<body\b/iu.test(contents)) {
    return contents.replace(/<body\b/iu, '<body data-sd-screen-root');
  }
  if (/<main\b/iu.test(contents)) {
    return contents.replace(/<main\b/iu, '<main data-sd-screen-root');
  }
  return contents;
}

function addSourceLocations(contents: string, relPath: string): string {
  return contents
    .split(/\r?\n/u)
    .map((line, index) =>
      line.replace(/<(?!\/|!)([a-z][a-z0-9-]*)([^<>]*?)>/giu, (full, tag, attrs) => {
        if (/\sdata-sd-loc\s*=/iu.test(attrs)) return full;
        return `<${tag} data-sd-loc="${escapeAttr(relPath)}:${index + 1}"${attrs}>`;
      }),
    )
    .join('\n');
}

function mimeType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.html':
    case '.htm':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
