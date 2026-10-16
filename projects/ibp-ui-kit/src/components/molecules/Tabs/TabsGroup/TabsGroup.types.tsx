import { ChangeEvent, ReactNode } from 'react';

import { DataTestIdProps, Orientation } from '@/types';
import { Sx } from '@/utils';

export interface TabsProps extends DataTestIdProps {
  value: string;
  children: ReactNode;
  onChange: (event: ChangeEvent<object>, value: any) => void;
  variant?: TabVariants;
  orientation?: Orientation;
  sx?: Sx;
}

export type TabVariants = 'standard' | 'scrollable' | 'fullWidth';
