import { apiBaseUrl, type ProjectEntry } from '@/lib/api-client';
import type { AppTheme } from '@/lib/theme';

export const DEFAULT_PROJECT_THUMBNAILS = [
  '/project-preview/image01.webp',
  '/project-preview/image02.webp',
  '/project-preview/image03.webp',
  '/project-preview/image04.webp',
  '/project-preview/image05.webp',
] as const;

export const LIGHT_PROJECT_THUMBNAILS: Record<(typeof DEFAULT_PROJECT_THUMBNAILS)[number], string> =
  {
    '/project-preview/image01.webp': '/project-preview/image01-light.webp',
    '/project-preview/image02.webp': '/project-preview/image02-light.webp',
    '/project-preview/image03.webp': '/project-preview/image03-light.webp',
    '/project-preview/image04.webp': '/project-preview/image04-light.webp',
    '/project-preview/image05.webp': '/project-preview/image05-light.webp',
  };

const LEGACY_STOCK_THUMBNAILS = new Map(
  DEFAULT_PROJECT_THUMBNAILS.map((thumbnail) => [thumbnail.replace(/\.webp$/u, '.png'), thumbnail]),
);

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

export function projectThumbnailSrc(entry: ProjectEntry, theme: AppTheme): string {
  const configuredPath = entry.thumbnailPath ?? defaultThumbnailForEntry(entry);
  const thumbnailPath = LEGACY_STOCK_THUMBNAILS.get(configuredPath) ?? configuredPath;
  return resolveThumbnailSrc(projectThumbnailVariantPath(thumbnailPath, theme));
}

/**
 * URL of the auto-generated project cover (0135). Served by id straight from
 * the project folder without a running sandbox; the endpoint 404s when no cover
 * has been generated yet, so callers layer it over the stock placeholder and
 * hide it on error. Not versioned: the endpoint revalidates via ETag.
 */
export function projectCoverUrl(id: string): string {
  return `${apiBaseUrl}/api/projects/${encodeURIComponent(id)}/cover`;
}

export function generatedProjectCoverSrc(
  entry: ProjectEntry,
  generativeThumbnailEnabled: boolean,
): string | null {
  return entry.thumbnailPath || !generativeThumbnailEnabled ? null : projectCoverUrl(entry.id);
}

export function projectThumbnailVariantPath(thumbnailPath: string, theme: AppTheme): string {
  if (theme !== 'light') return thumbnailPath;
  const normalized = thumbnailPath.split('?')[0];
  if (!normalized) return thumbnailPath;
  const lightPath =
    LIGHT_PROJECT_THUMBNAILS[normalized as (typeof DEFAULT_PROJECT_THUMBNAILS)[number]];
  return lightPath ?? thumbnailPath;
}

export function normalizeThumbnailPath(thumbnailPath: string | undefined): string | null {
  if (!thumbnailPath) return null;
  try {
    const url = new URL(thumbnailPath, window.location.origin);
    return url.pathname;
  } catch {
    return thumbnailPath.split('?')[0] ?? thumbnailPath;
  }
}

export function readImageAsDataUrl(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return Promise.reject(new Error('Thumbnail must be a PNG, JPEG, or WebP image.'));
  }
  if (file.size > MAX_THUMBNAIL_BYTES) {
    return Promise.reject(new Error('Thumbnail is larger than 5MB.'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () =>
      reject(reader.error ?? new Error('Could not read thumbnail.')),
    );
    reader.readAsDataURL(file);
  });
}

function defaultThumbnailForEntry(entry: ProjectEntry): string {
  const seed = entry.id || entry.workspacePath || entry.name;
  const index = stableHash(seed) % DEFAULT_PROJECT_THUMBNAILS.length;
  return DEFAULT_PROJECT_THUMBNAILS[index] ?? DEFAULT_PROJECT_THUMBNAILS[0];
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function resolveThumbnailSrc(thumbnailPath: string): string {
  if (
    thumbnailPath.startsWith('http://') ||
    thumbnailPath.startsWith('https://') ||
    thumbnailPath.startsWith('data:')
  ) {
    return thumbnailPath;
  }
  if (thumbnailPath.startsWith('/api/')) {
    return `${apiBaseUrl}${thumbnailPath}`;
  }
  return thumbnailPath;
}
