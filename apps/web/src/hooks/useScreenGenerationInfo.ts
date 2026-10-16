import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchScreenGenerationInfo } from '@/lib/api/screens';
import { useAssistantRunStore } from '@/stores/assistant-run-store';

export const screenGenerationInfoQueryKey = (screenId: string) =>
  ['screen-generation-info', screenId] as const;

export function useScreenGenerationInfo(screenId: string | null, open: boolean) {
  const queryClient = useQueryClient();
  const runs = useAssistantRunStore((state) => state.runs);
  const hasActiveRun = useMemo(
    () =>
      Boolean(
        screenId &&
        Object.values(runs).some(
          (run) =>
            run.screenId === screenId &&
            (run.status === 'queued' || run.status === 'running' || run.status === 'stopping'),
        ),
      ),
    [runs, screenId],
  );
  const wasActive = useRef(hasActiveRun);

  useEffect(() => {
    if (screenId && wasActive.current && !hasActiveRun) {
      void queryClient.invalidateQueries({ queryKey: screenGenerationInfoQueryKey(screenId) });
    }
    wasActive.current = hasActiveRun;
  }, [hasActiveRun, queryClient, screenId]);

  return useQuery({
    queryKey: screenGenerationInfoQueryKey(screenId ?? ''),
    queryFn: ({ signal }) => fetchScreenGenerationInfo(screenId!, signal),
    enabled: open && Boolean(screenId),
    refetchOnMount: 'always',
    refetchInterval: open && hasActiveRun ? 2_000 : false,
  });
}
