import { Sx } from '@/utils';

const getLeftPosition = (value: number) => {
  if (value <= 100 && value >= 96) return `calc(100% - 4ch)`;
  if (value <= 95 && value > 9) return `calc(${value}% - 2ch)`;
  if (value <= 9 && value > 2) return `calc(${value}% - 1ch)`;
  return 0;
};

export const linearProgressRootStyles: Sx = {
  display: 'flex',
  alignItems: 'center',
};
export const linearProgressStyles: Sx = {
  width: '100%',
  '.dmb-uikit-MuiLinearProgress-root': {
    background: (theme) => theme.palette.Tertiary.Tertiary,
  },
  '.dmb-uikit-MuiLinearProgress-bar': {
    background: (theme) => theme.palette.Tertiary.TertiaryDark,
  },
};
export const indicatorRootStyles: Sx = {
  width: '99.5%',
};

export const progressBarLabelStyles: Sx = (theme) => ({ color: theme.palette.Text.TextSecondary });

export const getIndicatorStyles = (value: number): Sx => ({
  position: 'relative',
  left: getLeftPosition(value),
  transition: 'left .4s linear',
  width: 'fit-content',
  textAlign: 'center',
});
