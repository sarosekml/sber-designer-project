import { Sx } from '@/utils';

export const textBadgeStyles = (): Sx => (theme) => {
  return {
    background: theme.palette.Border.BorderPrimary,
    color: theme.palette.BG.BGPopup,
  };
};
