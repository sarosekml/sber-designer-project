import { ViewType } from '@/types/common.types';
import { Sx } from '@/utils';

export type CounterSize = 'lg' | 'md' | 'sm';
export type CounterVariant = 'filled' | 'transparent';

export interface TooltipItems {
  code: string | number;
  name?: string;
}

export interface CounterProps {
  dataTestId?: string;
  count: number | string;
  size?: CounterSize;
  /** component sizes change depending on the type */
  type?: ViewType;
  variant?: CounterVariant;
  sx?: Sx;
}

export type ListCounterProps = CounterProps & {
  /**
   * display remaining counter = count - cutCount
   * @example 10(counter) - 2(cutCount) => +8(remaining counter)
   */
  count: number;
  cutCount: number;
};

export interface StyleProps {
  type: ViewType;
  size: CounterSize;
  variant: CounterVariant;
}
