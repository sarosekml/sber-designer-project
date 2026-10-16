import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material';

import { BadgeColorScheme, BadgeStyleVariant } from './DictionaryBadge.types';
import { getBadgeColorScheme } from './DictionaryBadge.utils';

export const useEllipsisMonitor = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [isEllipsisActive, setIsEllipsisActive] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const label = ref.current.querySelector('.dmb-uikit-MuiGrid-root') as HTMLDivElement | undefined;

    setIsEllipsisActive(Boolean(label && label.offsetWidth < label.scrollWidth));
  }, [ref]);

  return { ref, isEllipsisActive };
};

export const useBadgeColorScheme = (variant: BadgeStyleVariant): BadgeColorScheme => {
  const theme = useTheme();

  return useMemo(() => getBadgeColorScheme(variant, theme), [variant, theme]);
};
