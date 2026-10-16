import { CSSProperties, ReactNode } from 'react';

import { TextTypes } from '@/styles/theme/typography';
import { DataTestIdProps, HorizontalPosition } from '@/types';
import { Sx } from '@/utils';

export interface TextProps extends DataTestIdProps {
  align?: HorizontalPosition;
  cancelSelect?: boolean;
  className?: string;
  color?: string;
  gutterBottom?: boolean;
  gutterLeft?: boolean;
  gutterRight?: boolean;
  gutterTop?: boolean;
  span?: true;
  /**
   * use sx prop
   * @deprecated
   * */
  style?: CSSProperties;
  type?: TextTypes;
  sx?: Sx;
  children?: ReactNode;
}

export interface TextStyledProps extends Pick<TextProps, 'type' | 'align' | 'span' | 'cancelSelect' | 'color'> {
  color?: string;
  gutterBottom?: boolean;
  gutterLeft?: boolean;
  gutterRight?: boolean;
  gutterTop?: boolean;
}

export interface TextVariantStyles {
  color?: string;
  fontSize: string;
  fontWeight: 300 | 400 | 700;
}
