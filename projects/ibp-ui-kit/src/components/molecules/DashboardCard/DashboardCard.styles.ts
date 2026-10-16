import { useMemo } from 'react';
import { useTheme } from '@mui/material';

import { breakpoints } from '@/styles/theme/breakpoints';
import { mergeSx, Sx } from '@/utils';

const cardSx: Sx = (theme) => ({
  'display': 'flex',
  'flexDirection': 'row',
  'justifyContent': 'space-between',
  'borderRadius': theme.spacing(2),
  'cursor': 'pointer',
  '&..dmb-uikit-MuiPaper-elevation1': {
    boxShadow: 'none',
  },
  'width': '100%',
  'position': 'relative',
  'padding': '0',
});

interface Props {
  disabled: boolean;
}

export const disabledStyles = ({ disabled }: Props): Sx => {
  return {
    ...(disabled && {
      opacity: 0.3,
      cursor: 'no-drop',
    }),
  };
};

export const getDashBoardStyles = ({ disabled }: Props): Sx =>
  useMemo(() => mergeSx(cardSx, disabledStyles({ disabled })), [disabled]);

export const titleSx: Sx = (theme) => ({
  color: theme.palette.Text.TextPrimary,
  marginTop: theme.spacing(2),
  [theme.breakpoints.up(breakpoints.xs)]: {
    marginBottom: theme.spacing(1),
    ...theme.typography.H5StrongSmb,
  },
  [theme.breakpoints.up(breakpoints.sm)]: {
    marginBottom: theme.spacing(2),
    ...theme.typography.H4StrongExtensiveSmb,
  },
});

export const iconSx: Sx = (theme) => ({
  [theme.breakpoints.up(breakpoints.xs)]: {
    display: 'none',
  },
  [theme.breakpoints.up(breakpoints.md)]: {
    display: 'inline-block',
    width: '195px',
    height: '140px',
    position: 'absolute',
    top: '0',
    left: '100%',
    margin: '24.5px 0px 24.5px -195px',
  },
});

export const getСardTextContentStyles = (Icon: boolean): Sx => {
  const theme = useTheme();

  return {
    width: '100%',

    [theme.breakpoints.up(breakpoints.xs)]: {
      height: 'auto',
      padding: theme.spacing(8, 9),

      display: 'inline-block',
      flexDirection: 'unset',
    },
    [theme.breakpoints.up(breakpoints.md)]: {
      minHeight: Icon ? '189px' : 'auto',
      padding: Icon ? theme.spacing(8, 0, 8, 9) : theme.spacing(6),
      marginRight: Icon ? theme.spacing(40) : 0,

      display: 'flex',
      flexDirection: 'column',
    },
  };
};
