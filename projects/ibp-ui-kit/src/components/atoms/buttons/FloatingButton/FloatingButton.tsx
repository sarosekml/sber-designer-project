import React, { memo } from 'react';
import { Fab, FabProps } from '@mui/material';

import { MediumSizeType } from '@/types/common.types';
import { getDataTestId } from '@/utils';

import { defaultFloatingButtonTheme, useFloatingButtonStyles } from './FloatingButton.style';
import { FloatingButtonProps } from './FloatingButton.types';

const kitSizeToFabSize: Record<MediumSizeType, FabProps['size']> = {
  sm: 'small',
  md: 'medium',
  lg: 'large',
};

export const FloatingButton = memo(
  ({
    children,
    dataTestId,
    sx,
    variant = 'circular',
    colorThemeSx = defaultFloatingButtonTheme,
    disabled,
    size = 'lg',
    ariaLabel,
    onClick,
  }: FloatingButtonProps) => {
    const styles = useFloatingButtonStyles(colorThemeSx, sx);
    return (
      <Fab
        sx={styles}
        aria-label={ariaLabel}
        variant={variant}
        disabled={disabled}
        data-testid={getDataTestId(dataTestId, 'FloatingButton')}
        size={kitSizeToFabSize[size]}
        onClick={onClick}
      >
        {children}
      </Fab>
    );
  },
);

FloatingButton.displayName = 'FloatingButton';
