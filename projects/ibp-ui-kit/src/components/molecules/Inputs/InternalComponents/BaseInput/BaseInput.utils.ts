import { useMemo } from 'react';

import { TooltipPosition } from '@/index';
import { TooltipProps } from '@/components/atoms/Tooltip';

import { BaseInputValidationOptions } from './BaseInput.types';

export type TooltipErrorOptionsProps = Omit<TooltipProps, 'children'>;

const getTooltipErrorOptions = ({
  open,
  title,
  type,
  placement = 'bottom',
}: TooltipErrorOptionsProps): TooltipErrorOptionsProps => {
  const entries = [
    ['sx', { width: '100%' }],
    ['arrow', 'left'],
    ['placement', placement],
    ['type', type],
    ['title', title],
  ];
  if (open !== undefined) {
    entries.push(['open', open]);
  }
  return Object.fromEntries(entries);
};

export const useTooltipErrorOptions = (
  validationOptions: BaseInputValidationOptions | undefined,
  showTooltip: boolean | 'auto',
  placement?: TooltipPosition,
) =>
  useMemo(
    () =>
      getTooltipErrorOptions({
        open: showTooltip === 'auto' ? undefined : !!validationOptions && showTooltip,
        title: validationOptions?.message,
        type: validationOptions?.type,
        placement,
      }),
    [placement, showTooltip, validationOptions],
  );
