import { DataTestIdProps } from '@/types';
import { Sx } from '@/utils';

export interface TitleProps extends DataTestIdProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  type?: TitleType;
  /** @deprecated use sx prop */
  className?: string;
  gutterBottom?: boolean;
  gutterRight?: boolean;
  sx?: Sx;
}

export type TitleType = 'title' | 'subTitle' | 'SubtitleBody';

export interface StylesProps {
  gutterRight: boolean;
  type: TitleType;
}
