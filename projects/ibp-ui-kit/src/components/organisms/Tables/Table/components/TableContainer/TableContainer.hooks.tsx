import React, { PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import { debounce, useBrowserEventsListener, useEventApi, useEventApiListener } from '@sber-ibp/core';

import { ScrollState } from '../../TableState';
import { TableRowContext } from '../TableRow';

import { ScrollEvents } from './TableContainer.types';
import { makeScrollEventChannel, shouldSkipScrollEvent } from './TableContainer.utils';

export const useScrollRestoration = (props: PropsWithChildren<any>) => {
  const { setScroll, isLoading, rows, scroll, tableCode } = useContext(TableRowContext);
  const ref = useRef<HTMLDivElement>();
  const restoreOnlyOnce = useRef(false);
  const nextInitialScroll = useRef<ScrollState>();

  const { trigger } = useEventApi<ScrollEvents>(makeScrollEventChannel(tableCode));

  const debouncedTrigger = useMemo(() => debounce(trigger, 150), []);

  const setNextInitialScroll = useCallback((event) => {
    if (!event.currentTarget || shouldSkipScrollEvent(event)) {
      return;
    }

    const { scrollTop, scrollLeft } = event.currentTarget;

    nextInitialScroll.current = { top: scrollTop, left: scrollLeft };
    debouncedTrigger('currentState', { top: scrollTop, left: scrollLeft });
  }, []);

  const handleScroll = useCallback(
    (event) => {
      setNextInitialScroll(event);
      props?.onScroll?.(event);
    },
    [props?.onScroll, setNextInitialScroll],
  );

  const saveScrollPosition = useCallback(() => {
    if (nextInitialScroll.current) {
      const { top, left } = nextInitialScroll.current;
      setScroll?.({ top, left });
    }
  }, [setScroll]);

  /**
   * Save scroll after closing tab or browser
   */
  useBrowserEventsListener(
    () => {
      if (document.visibilityState === 'hidden') {
        saveScrollPosition();
      }
    },
    [],
    'visibilitychange',
  );

  /**
   * Save scroll after unmount
   */
  useEffect(() => {
    return () => saveScrollPosition();
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const container = ref.current;
    /**
     * Restore only after first isLoading or if initial rows exists
     */
    const shouldRestoreScroll = !isLoading && rows && rows.length > 0;

    if (container && shouldRestoreScroll && scroll && !restoreOnlyOnce.current) {
      const { top, left } = scroll;

      if (top != null && left != null) {
        container.scrollTop = top;
        container.scrollLeft = left;
      }
    }

    restoreOnlyOnce.current = true;
  }, [ref.current, isLoading, rows, scroll]);

  /**
   * User trigger scroll setting
   */
  useEventApiListener<ScrollEvents, 'change'>(
    ({ data: scroll }) => {
      const container = ref.current;
      const { top, left } = scroll;

      if (top != null && left != null && container) {
        container.scrollTop = top;
        container.scrollLeft = left;
      }
    },
    [],
    makeScrollEventChannel(tableCode),
    'change',
  );

  return { ref, handleScroll };
};
