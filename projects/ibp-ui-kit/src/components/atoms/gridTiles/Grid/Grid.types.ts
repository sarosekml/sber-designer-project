import { GridProps as MuiGridProps } from '@mui/material';

import { DataTestIdProps, GridSizes } from '@/types';

export interface GridProps extends MuiGridProps, DataTestIdProps {
  sizes?: GridSizes;
}

export const sizesMap: string[] = ['xs', 'sm', 'md', 'lg', 'xl'];
