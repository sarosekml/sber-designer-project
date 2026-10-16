import React, { useCallback } from 'react';
import { Breadcrumbs as MuiBreadcrumbs, Menu as MUIMenu, MenuItem as MUIItem, Typography } from '@mui/material';

import { IconButton } from '../../../atoms';
import { getBreadCrumbTextStyles } from '../BreadCrumbs.styles';
import { BreadCrumbsProps } from '../BreadCrumbs.types';

import { breadCrumbsDropdownSx } from './BreadCrumbsWithDropdown.styles';
import { useBreadCrumbsWithDropdown } from './BreadCrumbsWithDropdown.utils';

export const BreadCrumbsWithDropdown = <RouteType extends string = string>({
  navigationSchema,
  onClickLink,
  dataTestId,
  sx,
}: BreadCrumbsProps<RouteType>) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);
  const { head, dropdownItems, tailItems } = useBreadCrumbsWithDropdown(navigationSchema);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, [setAnchorEl]);

  const handleSelect = useCallback(
    (route: string) => {
      onClickLink(route);
      setAnchorEl(null);
    },
    [setAnchorEl, onClickLink],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement> | null) => {
      if (event) {
        setAnchorEl(event.currentTarget);
      }
    },
    [setAnchorEl],
  );

  return (
    <>
      <MUIMenu anchorEl={anchorEl} open={open} onClose={handleClose} aria-labelledby="with-menu-breadcrumbs">
        {dropdownItems.map(({ name, route }, idx) => (
          <MUIItem key={name} onClick={() => handleSelect(route)} data-testid={`Item_${idx + 1}`}>
            {name}
          </MUIItem>
        ))}
      </MUIMenu>
      <MuiBreadcrumbs data-testid={dataTestId} sx={sx}>
        <Typography
          onClick={() => onClickLink(head.route)}
          key={head.route}
          data-testid="Item_0"
          sx={getBreadCrumbTextStyles('active')}
        >
          {head.name}
        </Typography>
        <IconButton name="MoreDotsHorizontal" size="sm" onClick={handleClick} sx={breadCrumbsDropdownSx} />
        {tailItems.map(({ name, route }, index) => {
          const testId = `Item_${index}`;
          const isLast = tailItems.length - 1 === index;
          return (
            <Typography
              onClick={() => !isLast && onClickLink(route)}
              key={route}
              data-testid={testId}
              sx={getBreadCrumbTextStyles(isLast ? 'current' : 'active')}
            >
              {name}
            </Typography>
          );
        })}
      </MuiBreadcrumbs>
    </>
  );
};
