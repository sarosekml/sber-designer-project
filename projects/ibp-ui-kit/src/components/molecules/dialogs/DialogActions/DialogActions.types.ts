import { DataTestIdProps } from '@/types/common.types';

export interface PropTypes extends DataTestIdProps {
  children?: React.ReactNode;
  className?: string;
  disableSpacing?: boolean;
  justify?: 'flex-start' | 'flex-end';
}

export interface StylesProps {
  justify?: 'flex-start' | 'flex-end';
}
