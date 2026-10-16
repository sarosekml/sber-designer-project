import React, { memo } from 'react';
import { ListItem, ListItemButton, ListItemIcon } from '@mui/material';

import { Icon, SxBox, Text, Tooltip } from '@/components/atoms';

import {
  getListItemStyles,
  getListItemTextStyles,
  iconCoveredElementWrapperStyles,
  iconStyles,
  listItemIconStyles,
  postfixElementStyles,
} from './NavItem.styles';
import { NavItemProps } from './NavItem.types';

const ROOT = 'NavItem';

export const NavItem = memo(
  ({
    linkComponent,
    icon,
    dataTestId,
    route,
    disabled,
    text,
    opened,
    postfixElement,
    iconCoveredElement,
    onClick,
  }: NavItemProps) => {
    const textStyles = getListItemTextStyles(disabled);

    return (
      <ListItem disablePadding>
        <ListItemButton
          component={linkComponent}
          onClick={onClick}
          to={route}
          data-testid={dataTestId}
          sx={getListItemStyles}
          disabled={disabled}
        >
          {icon && (
            <ListItemIcon sx={listItemIconStyles}>
              <Tooltip
                dataTestId={dataTestId}
                title={text}
                placement={'right'}
                arrow={'left'}
                disabled={opened}
                type={'hint'}
              >
                <>
                  <Icon dataTestId={dataTestId} name={icon} sx={iconStyles} size={'lg'} />
                  {!opened ? <SxBox sx={iconCoveredElementWrapperStyles}>{iconCoveredElement}</SxBox> : null}
                </>
              </Tooltip>
            </ListItemIcon>
          )}

          {opened ? (
            <Text type={'BodyLReg'} sx={textStyles}>
              {text}
            </Text>
          ) : null}

          {opened ? <SxBox sx={postfixElementStyles}>{postfixElement}</SxBox> : null}
        </ListItemButton>
      </ListItem>
    );
  },
);

NavItem.displayName = ROOT;
