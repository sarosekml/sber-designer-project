import { useCallback } from 'react';

import {
  ensureStorybookStoryReady,
  type StorybookReadinessStatus,
} from '@/lib/storybook-readiness';
import { pushEditorState } from '@/lib/api-client';
import { useCatalogStore } from '@/stores/catalog-store';
import { useEditorStore } from '@/stores/editor-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useSandboxSession } from '@/hooks/useSandboxSession';

export function useStorybookReadiness() {
  const setStorybookReloadPending = useEditorStore((s) => s.setStorybookReloadPending);
  const bumpCanvasReloadKey = useEditorStore((s) => s.bumpCanvasReloadKey);
  const session = useSandboxStore((s) => s.session);
  const setCatalog = useCatalogStore((s) => s.setCatalog);
  const { createSession } = useSandboxSession();

  return useCallback(
    async (storyId: string): Promise<StorybookReadinessStatus> => {
      setStorybookReloadPending(true);
      void pushEditorState({ storybookReloadPending: true });
      try {
        return await ensureStorybookStoryReady({
          storyId,
          previewUrl: session?.previewUrl ?? null,
          workspacePath: session?.workspacePath ?? null,
          setCatalog,
          createSession,
        });
      } finally {
        setStorybookReloadPending(false);
        bumpCanvasReloadKey();
        void pushEditorState({ storybookReloadPending: false });
      }
    },
    [
      bumpCanvasReloadKey,
      createSession,
      session?.previewUrl,
      session?.workspacePath,
      setCatalog,
      setStorybookReloadPending,
    ],
  );
}
