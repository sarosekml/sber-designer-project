import React, { memo } from 'react';
import { Grid } from '@mui/material';

import { Text } from '@/components/atoms/typography/Text/Text';
import { getDataTestId, mergeSx } from '@/utils';

import { counterSx } from './Counter.styles';
import { CounterProps } from './Counter.types';

export const Counter = memo(
  ({ dataTestId = 'Counter', count, size = 'md', type = 'edit', variant = 'transparent', sx }: CounterProps) => {
    const styles = counterSx({ type, size, variant });

    return (
      <Grid item sx={{ display: 'flex', alignItems: 'center' }}>
        <Text dataTestId={getDataTestId(dataTestId, 'Counter')} sx={mergeSx(styles, sx)}>
          {count}
        </Text>
      </Grid>
    );
  },
);

Counter.displayName = 'Counter';
