import { fonts, heights } from '@/components/atoms/DictionaryBadge/DictionaryBadge.const';
import { Sx } from '@/utils';

import { spacings } from './Counter.const';
import { StyleProps } from './Counter.types';

export const counterSx =
  ({ type, variant, size }: StyleProps): Sx =>
  (theme) => {
    const spacing = spacings[type]?.[size];
    const font = theme.typography[fonts[type]?.[size]];

    const variantColors =
      variant === 'filled'
        ? {
            borderRadius: 2,
            bgcolor: (theme) => theme.palette.Tertiary.TertiaryLight,
            color: (theme) => theme.palette.Text.TextOnTertiary,
          }
        : {
            backgroundColor: 'transparent',
            color: (theme) => theme.palette.Text.TextOnTertiary,
          };

    return {
      display: 'inline-block',
      textAlign: 'center',
      p: (theme) => theme.spacing(spacing.tb, spacing.lr),
      height: `${heights[type]?.[size]}px`,
      cursor: 'help',
      m: '0 auto',
      ...font,
      ...variantColors,
    };
  };
