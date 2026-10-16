import { useMemo } from 'react';
import type { Theme } from '@mui/material';

import { mergeSx,Sx } from '@/utils';

import { ButtonColorTheme, FloatingButtonColorThemeSx } from './FloatingButton.types';

export const isPlainTheme = (themeSx: FloatingButtonColorThemeSx): themeSx is ButtonColorTheme => {
  return typeof themeSx !== 'function';
};

const executeTheme = (themeSx: FloatingButtonColorThemeSx = {}, theme: Theme) => {
  if (isPlainTheme(themeSx)) return themeSx;

  return themeSx(theme);
};

const getFloatingButtonSx =
  (buttonTheme?: FloatingButtonColorThemeSx): Sx =>
  (theme) => {
    const { backgroundColor, backgroundColorHover } = executeTheme(buttonTheme, theme);

    if (!backgroundColor && !backgroundColorHover) return {};

    return {
      backgroundColor,
      '&:hover': {
        backgroundColor: backgroundColorHover,
      },
    };
  };

export const useFloatingButtonStyles = (themeSx?: FloatingButtonColorThemeSx, customSx?: Sx): Sx =>
  useMemo(() => {
    const floatingButtonSx = getFloatingButtonSx(themeSx);
    return mergeSx(floatingButtonSx, customSx);
  }, [customSx, themeSx]);

export const defaultFloatingButtonTheme: FloatingButtonColorThemeSx = (theme) => ({
  backgroundColor: theme.palette.BG.BGHint,
  backgroundColorHover: theme.palette.Status.SGrey,
});
