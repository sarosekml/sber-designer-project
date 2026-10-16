import { Sx } from '@/utils';

import { ContextMenuButtonProps } from './ContextMenuButton.types';

export const getContextMenuButtonStyles =
  ({ disabled, type }: Partial<ContextMenuButtonProps>): Sx =>
  (theme) => {
    const outlinedStyles = {
      border: `${theme.spacing(0.25)} solid ${
        disabled ? theme.palette.Disabled.DisabledBorder : theme.palette.Secondary.Secondary
      }`,
      borderRadius: 2,

      '.dmb-uikit-MuiSvgIcon-root': {
        color: disabled ? undefined : theme.palette.Primary.Primary,
      },

      '&:hover:before': {
        width: '100%',
        height: '100%',
        borderRadius: 2,
      },
    };

    return {
      width: theme.spacing(10),
      height: theme.spacing(10),

      '.dmb-uikit-MuiIconButton-root': type === 'outlined' && {
        ...outlinedStyles,
      },
    };
  };
