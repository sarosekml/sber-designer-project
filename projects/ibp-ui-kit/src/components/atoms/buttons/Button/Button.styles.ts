import { cssImportant, Sx } from '@/utils';

import { borderRadius, iconSizes, iconSpacings } from './Button.const';
import { ButtonIconStyles, ButtonStyledProps } from './Button.types';
import { getButtonHeight, getOutlinedButtonColorScheme, getPaddingByContent } from './Button.utils';

export const getButtonRootStyles = ({ size, hasLoader = false, contentVariant, fullWidth }: ButtonStyledProps): Sx => [
  (theme) => ({
    boxSizing: 'border-box',
    borderRadius: theme.spacing(borderRadius[size]),
    padding: getPaddingByContent(theme, size, contentVariant),
    height: getButtonHeight(theme, size),

    minWidth: 0,
    display: 'inline-flex',
    flexWrap: 'nowrap',
    flexDirection: 'row',
    justifyContent: fullWidth ? 'center' : 'space-between',
    alignItems: 'center',

    textTransform: 'none',
    whiteSpace: 'nowrap',
    '&:disabled': {
      cursor: hasLoader ? 'wait' : 'not-allowed',
      pointerEvents: 'all',
    },
    '& .Button__loader': {
      '& span': {
        fontSize: cssImportant(theme.spacing(iconSizes[size])),
        width: cssImportant(theme.spacing(iconSizes[size])),
        height: cssImportant(theme.spacing(iconSizes[size])),
      },
    },
  }),
];

export const getButtonAccentStyles = (): Sx => (theme) => ({
  backgroundColor: theme.palette.Primary.Primary,
  border: `1px solid transparent`,
  color: theme.palette.Text.TextOnDark,
  '& svg': {
    color: theme.palette.Text.TextOnDark,
  },
  '&:hover': {
    backgroundColor: theme.palette.Primary.PrimaryDark,
  },
  '&:active': {
    borderColor: theme.palette.Primary.PrimaryLight,
    backgroundColor: theme.palette.Primary.PrimaryLight,
  },
  '&:disabled': {
    backgroundColor: theme.palette.Disabled.Disabled,
    color: theme.palette.Text.TextOnDark,
  },
});

export const getButtonOutlinedStyles =
  ({ color }: ButtonStyledProps): Sx =>
  (theme) => {
    const { default: defaultColors, active, hover } = getOutlinedButtonColorScheme(color, theme);
    return {
      backgroundColor: 'transparent',
      border: `1px solid ${defaultColors.borderColor}`,
      color: defaultColors.color,
      '& svg': {
        color: defaultColors.color,
      },
      '&:hover': {
        ...hover,
        '& svg': {
          color: hover.color,
        },
      },
      '&:active': {
        ...active,
        '& svg': {
          color: active.color,
        },
      },
      '&:disabled, &:disabled:hover': {
        backgroundColor: 'transparent',
        borderColor: theme.palette.Disabled.Disabled,
        color: theme.palette.Disabled.Disabled,
        '& svg': {
          color: theme.palette.Disabled.Disabled,
        },
      },
    };
  };

export const getButtonTransparentStyles =
  ({ color }: ButtonStyledProps): Sx =>
  (theme) => {
    const { default: defaultColors, active, hover } = getOutlinedButtonColorScheme(color, theme);
    return {
      backgroundColor: 'transparent',
      color: defaultColors.color,
      '&:hover': {
        color: hover.color,
        backgroundColor: hover.backgroundColor,
        '& svg': {
          color: hover.color,
        },
      },
      '&:active': {
        color: active.color,
        backgroundColor: active.backgroundColor,
        '& svg': {
          color: active.color,
        },
      },
      '&:disabled, &:disabled:hover': {
        backgroundColor: 'transparent',
        color: theme.palette.Disabled.Disabled,
        '& svg': {
          color: theme.palette.Disabled.Disabled,
        },
      },
    };
  };

export const getButtonIconStyles = ({ size, hasChildren }: ButtonStyledProps): ButtonIconStyles => ({
  root: (theme) => ({
    boxSizing: 'content-box',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssImportant(theme.spacing(iconSizes[size])),
    width: cssImportant(theme.spacing(iconSizes[size])),
    height: cssImportant(theme.spacing(iconSizes[size])),
    '& svg': {
      fontSize: cssImportant(theme.spacing(iconSizes[size])),
      width: cssImportant(theme.spacing(iconSizes[size])),
      height: cssImportant(theme.spacing(iconSizes[size])),
    },
  }),
  startIcon: () => ({
    pr: hasChildren ? iconSpacings[size] : 0,
  }),
  endIcon: () => ({
    pl: hasChildren ? iconSpacings[size] : 0,
  }),
});
