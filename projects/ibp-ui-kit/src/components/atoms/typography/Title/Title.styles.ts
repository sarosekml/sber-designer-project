import { CSSProperties } from 'react';

import { Sx } from '@/utils';

import { StylesProps } from './Title.types';

export const getStyles =
  ({ gutterRight, type }: StylesProps): Sx =>
  (theme) => {
    let titleVariantStyle: CSSProperties | { typography: string };
    switch (type) {
      case 'subTitle':
        titleVariantStyle = { typography: 'h6' };
        break;
      case 'SubtitleBody':
        titleVariantStyle = { typography: 'body1' };
        break;
      case 'title':
      default:
        titleVariantStyle = theme.typography.H3StrongSmb;
        break;
    }

    return {
      ...titleVariantStyle,
      marginRight: gutterRight ? theme.spacing(4) : 0,
      color: theme.palette.Text.TextBlack,
    };
  };
