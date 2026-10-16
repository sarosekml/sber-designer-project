import { useMemo } from 'react';
import type { ProjectScreen } from '@sber-designer/shared-types';

import { screenPreviewUrl } from '@/lib/screen-url';
import { useCatalogStore } from '@/stores/catalog-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';

/**
 * Stable empty-array reference. Returning `[]` literal from a Zustand
 * selector triggers React's `useSyncExternalStore` infinite-loop guard
 * (every snapshot is a fresh `[]`, so React thinks state changed each
 * render). Reuse one frozen instance instead.
 */
const EMPTY_SCREENS: readonly ProjectScreen[] = Object.freeze([]);

/**
 * Resolves the iframe URL for the currently-active screen (Phase 5.2).
 *
 * Rules:
 *   - story screen + ready sandbox → `<previewUrl>/iframe.html?id=<storyId>&viewMode=story&shortcuts=false&singleStory=true`
 *   - page screen  + ready sandbox → `<previewUrl>/<filePath>` (best-effort; the dev-server's router decides what's valid)
 *   - no active screen, ready sandbox → `<previewUrl>` (the sandbox root, default)
 *   - no sandbox → fall back to editor-store.canvasUrl (the local demo fixture)
 */
export function useActiveScreenUrl(): string {
  const session = useSandboxStore((s) => s.session);
  const screens = useProjectStore((s) => s.project?.screens) ?? EMPTY_SCREENS;
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const activeComponentId = useEditorStore((s) => s.activeComponentId);
  const activeDesignSystemReferencePath = useEditorStore((s) => s.activeDesignSystemReferencePath);
  const canvasView = useEditorStore((s) => s.canvasView);
  const fallback = useEditorStore((s) => s.canvasUrl);
  const catalog = useCatalogStore((s) => s.catalog);

  return useMemo(() => {
    const previewUrl = session?.previewUrl ?? null;
    const screen = activeScreenId ? (screens.find((s) => s.id === activeScreenId) ?? null) : null;
    const component =
      canvasView !== 'screen' && activeComponentId
        ? (catalog?.components.find((entry) => entry.id === activeComponentId) ?? null)
        : null;
    return screenPreviewUrl(
      screen,
      previewUrl,
      fallback,
      canvasView,
      component,
      activeDesignSystemReferencePath,
    );
  }, [
    session?.status,
    session?.previewUrl,
    canvasView,
    activeScreenId,
    activeComponentId,
    activeDesignSystemReferencePath,
    catalog,
    screens,
    fallback,
  ]);
}
