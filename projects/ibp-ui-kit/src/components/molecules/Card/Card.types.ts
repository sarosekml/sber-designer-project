import { MouseEventHandler } from 'react';

import { DataTestIdProps } from '@/types';

export interface PropTypes extends DataTestIdProps {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  extra?: React.ReactNode;
  onDoubleClick?: MouseEventHandler;
  onClick?: MouseEventHandler;
  disabled?: boolean;
  selected?: boolean;
  headerIcon?: React.ReactNode;
}
