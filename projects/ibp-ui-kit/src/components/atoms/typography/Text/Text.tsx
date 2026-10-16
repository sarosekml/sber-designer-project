import React, { FC, memo } from 'react';
import { Typography } from '@mui/material';

import { getDataTestId } from '@/utils';
import { mergeSx } from '@/utils/mergeSx';

import { getTextStyles } from './Text.styles';
import { TextProps } from './Text.types';

export const Text: FC<TextProps> = memo(
  ({
    children,
    type = 'BodyMReg',
    gutterRight,
    gutterLeft,
    gutterBottom,
    gutterTop,
    className,
    align,
    span,
    style,
    cancelSelect,
    color,
    dataTestId,
    sx,
  }) => {
    const baseSx = getTextStyles({
      type,
      gutterRight,
      gutterLeft,
      gutterBottom,
      gutterTop,
      align,
      span,
      cancelSelect,
      color,
    });
    return (
      <Typography
        data-testid={getDataTestId(dataTestId, 'Text')}
        sx={mergeSx(baseSx, sx)}
        variant={type}
        style={style}
        className={className}
      >
        {children}
      </Typography>
    );
  },
);

Text.displayName = 'Text';
