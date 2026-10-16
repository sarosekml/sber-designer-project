import React, { memo } from 'react';
import { IconButton as MaterialIconButton, useTheme } from '@mui/material';

import { getDataTestId } from '@/utils/getDataTestId';

import { Icon } from '../Icon/Icon';

import { actualIconButtonColors } from './IconButton.const';
import { useIconButtonStyles } from './IconButton.styles';
import { IconButtonColors, IconButtonProps } from './IconButton.types';

export const IconButton = memo(
  ({
    title,
    size = 'md',
    dataTestId,
    disabled = false,
    color,
    sx,
    ref,
    onClick,
    className,
    name,
    draggableProps,
  }: IconButtonProps): JSX.Element => {
    const theme = useTheme();
    const iconColor = color && actualIconButtonColors.includes(color) ? color : theme.palette.Secondary.Secondary;
    const mergedStyles = useIconButtonStyles({
      size,
      disabled,
      color: iconColor as IconButtonColors,
      sx,
    });

    return (
      <MaterialIconButton
        className={className}
        data-testid={getDataTestId(dataTestId, 'IconButton')}
        sx={mergedStyles}
        disabled={disabled}
        ref={ref}
        onClick={onClick}
        title={title}
        {...draggableProps}
      >
        <Icon name={name} color={iconColor} size={size} className={'IconButton_icon__controller'} />
      </MaterialIconButton>
    );
  },
);

IconButton.displayName = 'IconButton';
