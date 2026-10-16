import type { ComponentCatalog } from '@sber-designer/shared-types';

import { fetchCatalog } from '@/lib/api-client';

export type StorybookReadinessStatus = 'indexed' | 'restarted' | 'timeout';

export interface EnsureStorybookStoryReadyInput {
  storyId: string;
  previewUrl: string | null | undefined;
  workspacePath: string | null | undefined;
  setCatalog: (catalog: ComponentCatalog) => void;
  createSession: (workspacePath: string, options?: { force?: boolean }) => Promise<unknown>;
  delaysMs?: readonly number[];
}

export async function ensureStorybookStoryReady(
  input: EnsureStorybookStoryReadyInput,
): Promise<StorybookReadinessStatus> {
  const indexed = await waitForCatalogStory(input);
  if (indexed) return 'indexed';
  if (!input.workspacePath) return 'timeout';
  const restarted = await input.createSession(input.workspacePath, { force: true });
  const restartedPreviewUrl =
    restarted &&
    typeof restarted === 'object' &&
    'previewUrl' in restarted &&
    typeof restarted.previewUrl === 'string'
      ? restarted.previewUrl
      : input.previewUrl;
  await waitForCatalogStory({
    ...input,
    previewUrl: restartedPreviewUrl,
  });
  return 'restarted';
}

export async function waitForCatalogStory(
  input: Pick<EnsureStorybookStoryReadyInput, 'storyId' | 'previewUrl' | 'setCatalog'> & {
    delaysMs?: readonly number[];
  },
): Promise<boolean> {
  if (!input.previewUrl) return false;
  const delays = input.delaysMs ?? [0, 350, 700, 1000, 1400, 1800];
  for (const delayMs of delays) {
    if (delayMs > 0) await sleep(delayMs);
    try {
      const nextCatalog = await fetchCatalog({ previewUrl: input.previewUrl, refresh: true });
      input.setCatalog(nextCatalog);
      if (catalogHasStory(nextCatalog, input.storyId)) return true;
    } catch {
      // Storybook may still be rebuilding its index. Keep polling briefly.
    }
  }
  return false;
}

export function catalogHasStory(catalog: ComponentCatalog | null, storyId: string): boolean {
  return Boolean(
    catalog?.components.some((component) =>
      component.stories.some((story) => story.id === storyId),
    ),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
