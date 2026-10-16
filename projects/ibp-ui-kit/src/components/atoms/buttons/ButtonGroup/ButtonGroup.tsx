import React, { memo } from 'react';
import { ButtonGroup as MuiButtonGroup } from '@mui/material';

import { Grid } from '@/components/atoms';

import { getContainerStyles } from './ButtonGroup.styles';
import { ButtonGroupProps } from './ButtonGroup.types';
import { ButtonGroupContext } from './ButtonGroupContext';

export const ButtonGroup = memo(
  ({
    children,
    orientation = 'horizontal',
    fullWidth,
    type = 'accent',
    color = 'default',
    size = 'md',
    ...props
  }: ButtonGroupProps) => {
    const styles = React.useMemo(() => getContainerStyles(type, color, orientation), [type, color, orientation]);

    const context = React.useMemo(
      () => ({ fullWidth, type, size, color, isGrouped: true, ...props }),
      [props, fullWidth, type, size, color],
    );

    return (
      <Grid sx={styles}>
        <ButtonGroupContext.Provider value={context}>
          <MuiButtonGroup orientation={orientation} fullWidth={fullWidth}>
            {children}
          </MuiButtonGroup>
        </ButtonGroupContext.Provider>
      </Grid>
    );
  },
);

ButtonGroup.displayName = 'ButtonGroup';
