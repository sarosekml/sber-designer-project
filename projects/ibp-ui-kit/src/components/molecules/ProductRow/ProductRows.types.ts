import { DataTestIdProps } from '@/types';

export interface IdentData {
  amount?: string | number | null;
  date?: string | null;
  dateTooltip?: React.ReactNode;
  amountTooltip?: React.ReactNode;
  currency?: string;
}

export interface ProductRowProps extends DataTestIdProps {
  title: React.ReactNode;
  subtitle?: string;
  variant?: 'bordered' | 'flat' | 'transparent';
  titlePostfix?: React.ReactNode;
  titlePrefix?: React.ReactNode;
  actions?: React.ReactNode;
  disabled?: boolean;
  highlight?: boolean;
  active?: boolean;
  error?: boolean;
  buttonLabel?: string;
  hasSpot?: boolean;
  onDoubleClick?: () => void;
  onClick?: () => void;
  identData?: IdentData;
  titleLink?: string;
}

export type StylesProps = Pick<
  ProductRowProps,
  'disabled' | 'variant' | 'error' | 'buttonLabel' | 'active' | 'highlight'
>;
