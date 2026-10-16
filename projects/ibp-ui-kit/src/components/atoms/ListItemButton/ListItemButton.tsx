import React, { FC } from 'react';
import { ListItemButton as MuiListItemButton } from '@mui/material';
import clsx from 'clsx';

import { ListItemButtonType } from './ListItemButton.types';

const root = 'ListItemButton';

export const ListItemButton: FC<ListItemButtonType> = ({
  dataTestId,
  onClick,
  disabled,
  children,
  className,
  sx,
  disableGutters,
  selected,
}) => {
  return (
    <MuiListItemButton
      data-testid={dataTestId ? `ListItem_${dataTestId}` : 'ListItem'}
      className={clsx(root, className)}
      onClick={onClick}
      disabled={disabled}
      sx={sx}
      disableGutters={disableGutters}
      selected={selected}
    >
      {children}
    </MuiListItemButton>
  );
};

ListItemButton.displayName = root;
