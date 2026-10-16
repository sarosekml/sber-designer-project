import { useEffect, useRef } from 'react';
import { shouldCloseStaleOverlay } from '@/lib/overlay-runtime';

/**
 * An overlay belongs to the underlay that opened it. Close stale overlay state
 * if another control changes the active base screen behind it.
 */
export function useOverlayUnderlayLifecycle(
  underlayScreenId: string | null,
  overlayScreenId: string | null,
  onClose: () => void,
): void {
  const originRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!overlayScreenId) {
      originRef.current = null;
      return;
    }
    if (originRef.current === null) {
      originRef.current = underlayScreenId;
      return;
    }
    if (shouldCloseStaleOverlay(originRef.current, underlayScreenId)) {
      onCloseRef.current();
    }
  }, [overlayScreenId, underlayScreenId]);
}
