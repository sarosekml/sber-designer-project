import React from 'react';
import { Menu } from '@mui/material';

import { ListItemButton as MenuItem } from '@/components/atoms/ListItemButton';
import { getDataTestId } from '@/utils';

import { useStyles } from './ContextMenu.styles';
import { ContextMenuProps } from './ContextMenu.type';

const root = 'ContextMenu';

export const ContextMenu = ({
  dataTestId,
  items,
  contextMenuList,
  closeMenu,
  selectHandler,
  size = 'lg',
  anchorMenu,
  transformMenu,
  minWidth,
  onBackdropClick,
  isSelectedShown,
}: ContextMenuProps) => {
  const styles = useStyles({ size, minWidth });

  return (
    <Menu
      data-testid={getDataTestId(dataTestId, 'Menu')}
      sx={styles}
      className={root}
      anchorOrigin={anchorMenu}
      transformOrigin={transformMenu}
      anchorEl={contextMenuList}
      open={Boolean(contextMenuList)}
      onClose={closeMenu}
      onBackdropClick={onBackdropClick}
    >
      {items?.map((it, index) => (
        <MenuItem
          data-testid={getDataTestId(dataTestId, `${root}${index}`)}
          key={it.value}
          className={`${root}__item`}
          disabled={it.isDisabled}
          onClick={it.isDisabled ? undefined : (e) => selectHandler(it, e)}
          selected={isSelectedShown && it.selected}
        >
          {it.value}
        </MenuItem>
      ))}
    </Menu>
  );
};

ContextMenu.displayName = root;
