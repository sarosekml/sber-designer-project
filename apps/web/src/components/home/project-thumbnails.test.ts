import { expect, test } from 'bun:test';
import { stat } from 'node:fs/promises';

import {
  DEFAULT_PROJECT_THUMBNAILS,
  LIGHT_PROJECT_THUMBNAILS,
  generatedProjectCoverSrc,
  projectThumbnailSrc,
  projectThumbnailVariantPath,
} from './project-thumbnails';

test('built-in project thumbnails expose matching dark and light assets', async () => {
  expect(DEFAULT_PROJECT_THUMBNAILS).toHaveLength(5);

  for (const darkPath of DEFAULT_PROJECT_THUMBNAILS) {
    const lightPath = LIGHT_PROJECT_THUMBNAILS[darkPath];
    const [darkAsset, lightAsset] = await Promise.all([
      stat(`apps/web/public${darkPath}`),
      stat(`apps/web/public${lightPath}`),
    ]);

    expect(darkAsset.size).toBeGreaterThan(0);
    expect(lightAsset.size).toBeGreaterThan(0);
    expect(projectThumbnailVariantPath(darkPath, 'dark')).toBe(darkPath);
    expect(projectThumbnailVariantPath(darkPath, 'light')).toBe(lightPath);
  }
});

test('custom and uploaded thumbnails stay unchanged in both themes', () => {
  const customPaths = [
    '/api/projects/project-1/thumbnail?v=123',
    'data:image/png;base64,preview',
    'https://example.com/preview.png',
  ];

  for (const customPath of customPaths) {
    expect(projectThumbnailVariantPath(customPath, 'dark')).toBe(customPath);
    expect(projectThumbnailVariantPath(customPath, 'light')).toBe(customPath);
  }
});

test('legacy stock PNG selections migrate to the bundled WebP asset', () => {
  const entry = {
    id: 'legacy-stock',
    name: 'Legacy stock',
    workspacePath: '/tmp/legacy-stock',
    projectType: 'html' as const,
    lastOpenedAt: 1,
    createdAt: 1,
    thumbnailPath: '/project-preview/image01.png',
  };
  expect(projectThumbnailSrc(entry, 'dark')).toBe('/project-preview/image01.webp');
  expect(projectThumbnailSrc(entry, 'light')).toBe('/project-preview/image01-light.webp');
});

test('generated cover is used only without an explicit override and while enabled', () => {
  const entry = {
    id: 'project 1',
    name: 'Project',
    workspacePath: '/tmp/project',
    projectType: 'html' as const,
    lastOpenedAt: 1,
    createdAt: 1,
  };

  expect(generatedProjectCoverSrc(entry, true)?.endsWith('/api/projects/project%201/cover')).toBe(
    true,
  );
  expect(generatedProjectCoverSrc(entry, false)).toBeNull();
  expect(
    generatedProjectCoverSrc({ ...entry, thumbnailPath: '/project-preview/image01.webp' }, true),
  ).toBeNull();
});
