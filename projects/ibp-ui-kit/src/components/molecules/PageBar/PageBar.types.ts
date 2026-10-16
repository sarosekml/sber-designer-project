import { ReactNode } from 'react';

import { DataTestIdProps } from '@/types';
import { Sx } from '@/utils';

export interface PageBarProps extends DataTestIdProps {
  /** @deprecated use sx prop */
  className?: string;
  extra?: ReactNode;
  subExtra?: ReactNode;
  subTitle?: ReactNode;
  prefix?: ReactNode;
  title?: ReactNode;
  titlePostfix?: ReactNode;
  titlePrefix?: ReactNode;
  isStickButtonLeft?: boolean;
  sx?: Sx;
}

export interface StylesProps {
  isStickButtonLeft: boolean;
}
