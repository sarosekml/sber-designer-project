import { useMemo } from 'react';

import { mergeSx, Sx } from '@/utils';

import {
  borderRadius,
  fonts,
  heights,
  iconMargins,
  iconSizes,
  textBadgeSizes,
  textBadgeTextSize,
} from './DictionaryBadge.const';
import { useBadgeColorScheme } from './DictionaryBadge.hooks';
import {
  BadgeColorScheme,
  BadgeColorThemeSx,
  BadgeStyleVariant,
  DictionaryBadgeStyleProps,
} from './DictionaryBadge.types';
import { executeTheme, getBadgeSpacings } from './DictionaryBadge.utils';
import { DictionaryBadgeRoot } from './TextBadge';

export const getDefaultStyles =
  (
    { size, type, hoverable, component, hasDeleteButton, hasPostfix }: DictionaryBadgeStyleProps,
    colorScheme: BadgeColorScheme,
  ): Sx =>
  (theme) => {
    const spacing = getBadgeSpacings(hasPostfix)[type]?.[size];
    const font = theme.typography[fonts[type]?.[size]];
    const {
      Status: { StSystem },
    } = theme.palette;

    const { base, hover } = colorScheme;

    return {
      ...font,
      boxSizing: 'border-box',
      pr: spacing?.pr,
      pl: spacing?.pl,
      py: spacing?.tb,
      height: heights[type]?.[size],
      border: `1px solid`,
      borderRadius: component === 'Marker' ? '100px' : type === 'read' ? 1 : borderRadius[size],
      ...base,
      cursor: hoverable ? 'pointer' : 'default',
      '& .dmb-uikit-MuiSvgIcon-root': {
        color: StSystem,
        my: 0,
        mr: 0,
        fontSize: iconSizes[type]?.[size],
      },
      '& .dmb-uikit-MuiChip-deleteIcon': {
        ml: iconMargins[type]?.[size],
        mr: 0,
        cursor: hoverable || hasDeleteButton ? 'pointer' : 'default',
      },
      '& .dmb-uikit-MuiChip-icon': {
        ml: 0,
        mr: iconMargins[type]?.[size],
      },
      '&:hover': {
        ...(hoverable ? hover : base),
      },
      '& .dmb-uikit-MuiChip-label': {
        padding: 0,
      },
      '&:active': {
        boxShadow: 'unset',
      },
      [`& .${DictionaryBadgeRoot}`]: {
        width: textBadgeSizes[type]?.[size],
        height: textBadgeSizes[type]?.[size],
        ...textBadgeTextSize[type]?.[size],
      },
    };
  };

export const getDisabledStyles =
  (variant: BadgeStyleVariant, colorScheme: BadgeColorScheme): Sx =>
  (theme) => {
    const {
      Status: { StDisabled },
    } = theme.palette;

    const { disabled } = colorScheme;
    return {
      '&.dmb-uikit-MuiChip-root': {
        ...disabled,
        opacity: 1,
      },
      '& .dmb-uikit-MuiSvgIcon-root': {
        color: StDisabled,
      },
    };
  };

export const getActiveStyles =
  ({ hoverable }: DictionaryBadgeStyleProps, colorScheme: BadgeColorScheme): Sx =>
  (theme) => {
    const {
      Tertiary: { TertiaryLight },
    } = theme.palette;

    const { active, activeHover } = colorScheme;

    return {
      ...active,
      '& .dmb-uikit-MuiSvgIcon-root': {
        color: TertiaryLight,
      },
      '&:hover': {
        ...(hoverable ? activeHover : active),
        '& .dmb-uikit-MuiSvgIcon-root': {
          color: TertiaryLight,
        },
      },
    };
  };

export const getWithColorTheme =
  (colorThemeSx: BadgeColorThemeSx, hoverable?: boolean): Sx =>
  (theme) => {
    const { backgroundColor, borderColor, textColor, backgroundColorHover, borderColorHover, textColorHover } =
      executeTheme(colorThemeSx, theme);
    return {
      backgroundColor,
      borderColor,
      color: textColor,
      '& .dmb-uikit-MuiSvgIcon-root': {
        color: textColor,
      },
      '&:hover': {
        backgroundColor: hoverable ? backgroundColorHover : backgroundColor,
        borderColor: hoverable ? borderColorHover : borderColor,
        color: hoverable ? textColorHover : textColor,
        '& .dmb-uikit-MuiSvgIcon-root': {
          color: hoverable ? textColorHover : textColor,
        },
      },
    };
  };

export const labelStyles: Sx = {
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  whiteSpace: 'noWrap',
};

export const useStyles = (props: DictionaryBadgeStyleProps) => {
  const { variant, colorThemeSx, disabled, sx, hoverable, active } = props;

  const colorScheme = useBadgeColorScheme(variant);

  return useMemo(
    () =>
      mergeSx(
        getDefaultStyles(props, colorScheme),
        active && getActiveStyles(props, colorScheme),
        colorThemeSx && getWithColorTheme(colorThemeSx, hoverable),
        disabled && getDisabledStyles(variant, colorScheme),
        sx,
      ),
    [props, colorScheme, active, colorThemeSx, hoverable, disabled, variant, sx],
  );
};
