import { MouseEventHandler, ReactElement } from 'react';
import { SvgIconProps } from '@mui/material';

import { DataTestIdProps } from '@/types';

export interface DashboardCardData {
  disabled: boolean;
  title: string;
  text?: string;
  links?: JSX.Element;
  icon?: (props: SvgIconProps) => ReactElement;
}

export interface DashboardCardProps extends DashboardCardData, DataTestIdProps {
  onCardClick?: MouseEventHandler<HTMLDivElement> | undefined;
}
