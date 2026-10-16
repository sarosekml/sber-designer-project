import React from 'react';

import { DataTestIdProps } from '@/types';
import { Sx } from '@/utils';

export type PagePaddingType = 'title' | 'all';

export interface PageProps extends DataTestIdProps {
  type?: PagePaddingType;
  sx?: Sx;
  children?: React.ReactNode;
}
