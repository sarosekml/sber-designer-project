import {
  HTML_DESIGN_SYSTEM_PATHS,
  type ComponentEntry,
  type ProjectScreen,
} from '@sber-designer/shared-types';

import { apiBaseUrl } from '@/lib/api-client';

const PREVIEW_PROXY_BASE = `${apiBaseUrl.replace(/\/+$/, '')}/api/preview`;

export function screenPreviewUrl(
  screen: ProjectScreen | null,
  previewUrl: string | null | undefined,
  fallback: string,
  canvasView: 'screen' | 'storybook' | 'design-system' = 'screen',
  activeComponent?: ComponentEntry | null,
  activeDesignSystemReferencePath?: string | null,
): string {
  if (!previewUrl) return fallback;
  if (canvasView === 'storybook') {
    const story = activeComponent?.stories[0];
    if (!story) return previewUrl;
    const url = new URL('iframe.html', `${PREVIEW_PROXY_BASE}/`);
    url.searchParams.set('id', story.id);
    url.searchParams.set('viewMode', 'docs');
    url.searchParams.set('shortcuts', 'false');
    url.searchParams.set('singleStory', 'true');
    return url.toString();
  }
  if (canvasView === 'design-system') {
    if (activeDesignSystemReferencePath) {
      return `${PREVIEW_PROXY_BASE}/${activeDesignSystemReferencePath.replace(/^\/+/, '')}`;
    }
    const docsAnchor = activeComponent?.docsAnchor?.replace(/^#/, '');
    return `${PREVIEW_PROXY_BASE}/${HTML_DESIGN_SYSTEM_PATHS.previewHtml}${docsAnchor ? `#${encodeURIComponent(docsAnchor)}` : ''}`;
  }
  if (!screen) return PREVIEW_PROXY_BASE;

  if (screen.kind === 'story' && screen.storyId) {
    const url = new URL('iframe.html', `${PREVIEW_PROXY_BASE}/`);
    url.searchParams.set('id', screen.storyId);
    url.searchParams.set('viewMode', 'story');
    url.searchParams.set('shortcuts', 'false');
    url.searchParams.set('singleStory', 'true');
    return url.toString();
  }
  if (screen.kind === 'page' && screen.filePath) {
    const path = screen.filePath.replace(/^src\//, '').replace(/\.tsx?$/, '');
    return `${PREVIEW_PROXY_BASE}/${path}`;
  }
  return PREVIEW_PROXY_BASE;
}
