import { ReactNode } from 'react';

import { AvatarProps, BadgeColorThemeSx, BadgeComponent } from '@/components/atoms';
import { MediumSizeType } from '@/types';
import { Sx } from '@/utils';

export interface SubHeaderProps {
  items: ReactNode[];
  max?: number;
  countBadge?: {
    showPlus?: boolean;
    type?: 'transparent' | 'outlined';
    colorThemeSx?: BadgeColorThemeSx;
    size?: MediumSizeType;
  };
}

export interface BadgesProps extends SubHeaderProps {
  items: string[];
  badge?: {
    colorThemeSx?: BadgeColorThemeSx;
    component?: BadgeComponent;
    size?: MediumSizeType;
  };
}

export type EntitySize = 'md' | 'lg' | 'xl';

export interface EntityProps {
  size?: EntitySize;
  avatar?: Omit<AvatarProps, 'size'> & { icon?: ReactNode };
  sx?: Sx;
  extra?: ReactNode;
  header?: ReactNode;
  text?: ReactNode;
  prefixText?: ReactNode;
  postfixText?: ReactNode;
  subHeaderPrefix?: ReactNode;
  subHeader?: SubHeaderProps;
  badges?: BadgesProps;
  icons?: ReactNode;
  dataTestId?: string;
}
