import { ListItemButtonBaseProps } from '@mui/material';

import { DataTestIdProps } from '@/types';

export interface ListItemButtonType extends DataTestIdProps, Pick<ListItemButtonBaseProps, 'sx' | 'disableGutters'> {
  disabled?: boolean;
  onClick?: (e: React.SyntheticEvent<HTMLElement>) => void;
  className?: string;
  children?: React.ReactNode;
  selected?: boolean;
}
