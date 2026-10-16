import React, { memo } from 'react';
import { Icon as MuiIcon } from '@mui/material';

import { getDataTestId } from '@/utils/getDataTestId';

import { iconsMap as actualIconsMap } from './Icon.const';
import { getIconStyles } from './Icon.styles';
import { IconProps } from './Icon.types';

export const Icon = memo(({ color, name, onClick, size = 'md', dataTestId, sx, className }: IconProps) => {
  const styles = getIconStyles(size, color, sx);

  const CurrentIcon = actualIconsMap[name];

  if (!CurrentIcon) {
    console.error(`Incorrect icon name: ${name}`);
  }

  return (
    <MuiIcon data-testid={getDataTestId(dataTestId, 'Icon')} onClick={onClick} sx={styles} className={className}>
      <CurrentIcon fontSize={'inherit'} color={'inherit'} />
    </MuiIcon>
  );
});

Icon.displayName = 'Icon';
