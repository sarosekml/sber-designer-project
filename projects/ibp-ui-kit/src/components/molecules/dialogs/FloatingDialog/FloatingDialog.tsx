import React, { memo } from 'react';

import { getDataTestId } from '@/utils';

import { SxBox } from '../../../atoms';
import { DialogBody } from '../DialogBody';

import { useFloatingDialogStyles } from './FloatingDialog.styles';
import { FloatingDialogProps } from './FloatingDialog.types';

export const FloatingDialog = memo(({ dataTestId, height, sx, width, ...bodyProps }: FloatingDialogProps) => {
  const style = useFloatingDialogStyles(sx);
  return (
    <SxBox data-testid={getDataTestId(dataTestId, 'FloatingDialog')} width={width} height={height} sx={style}>
      <DialogBody {...bodyProps} />
    </SxBox>
  );
});

FloatingDialog.displayName = 'FloatingDialog';
