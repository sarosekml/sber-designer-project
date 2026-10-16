import { ReactNode } from 'react';
import { SxProps } from '@mui/material';

import { TextTypes } from '@/styles/theme/typography';
import { DataTestIdProps, GridSizes } from '@/types';

export interface GridTileSectionProps extends DataTestIdProps {
  id?: string;
  sizes: GridSizes;
  stretchAll?: boolean;
  title?: string;
  textType?: TextTypes;
  textColor?: string;
  sx?: SxProps;
  spacing?: number;
  children?: ReactNode;
}
