import React, { FC, useMemo } from 'react';
import { Typography } from '@mui/material';

import { getDataTestId,Sx } from '@/utils';

import { getStyles } from './Title.styles';
import { TitleProps } from './Title.types';

export const Title: FC<TitleProps> = React.memo(
  ({ children, type = 'title', className, gutterBottom = true, gutterRight = true, dataTestId, sx = {} }) => {
    const styles = useMemo(() => getStyles({ gutterRight, type }), [gutterRight, type]);
    const combinedStyles = useMemo(() => ({ ...styles, ...sx } as Sx), [styles, sx]);
    return (
      <Typography
        data-testid={getDataTestId(dataTestId, 'Title')}
        component={'h1'}
        className={className}
        gutterBottom={gutterBottom}
        sx={combinedStyles}
      >
        {children}
      </Typography>
    );
  },
);
