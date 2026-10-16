import { TabProps as MuiTabProps } from '@mui/material';

import { HorizontalPosition, MediumSizeType, Orientation } from '@/types';

interface Props {
  size?: MediumSizeType;
  iconValue?: number | string;
  orientation?: Orientation;
  value: string;
  textAlign?: HorizontalPosition;
  dataTestId?: string;
  icon?: React.ReactElement;
}

export type TabProps = Omit<MuiTabProps, 'value' | 'icon'> & Props;
