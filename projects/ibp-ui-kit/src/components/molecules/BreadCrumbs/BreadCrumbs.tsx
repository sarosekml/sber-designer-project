import React, { memo, useMemo } from 'react';
import { Breadcrumbs as MuiBreadcrumbs, Typography } from '@mui/material';

import { SxBox } from '@/components/atoms/SxBox';
import { getDataTestId, mergeSx } from '@/utils';

import { getBreadCrumbStyles, getBreadCrumbTextStyles } from './BreadCrumbs.styles';
import { BreadCrumbsProps } from './BreadCrumbs.types';
import { BreadCrumbsWithDropdown } from './BreadCrumbsWithDropdown';

/**
 * Breadcrumbs Component
 *
 * This component renders a breadcrumbs navigation based on a provided navigation schema
 *
 * @description
 * The component displays breadcrumbs for site navigation. If the navigation schema contains more than 5 routes,
 * the routes between the first route and the last two routes are collapsed into a dropdown menu to maintain a concise layout.
 *
 * @example
 * const navigationSchema = [
 *    { name: 'Home', route: '/' },
 *    { name: 'Administration', route: '/admin' },
 *    { name: 'Clients', route: '' } // Current page (non-clickable)
 * ]
 *
 */
export const BreadCrumbs = memo(
  <RouteType extends string = string>({
    navigationSchema,
    onClickLink,
    dataTestId,
    sx,
  }: BreadCrumbsProps<RouteType>) => {
    const breadCrumbSx = useMemo(() => mergeSx(getBreadCrumbStyles, sx), [sx]);

    return (
      <SxBox data-testid={getDataTestId(dataTestId, 'Breadcrumbs')} sx={breadCrumbSx}>
        {navigationSchema.length > 5 ? (
          <BreadCrumbsWithDropdown
            navigationSchema={navigationSchema}
            onClickLink={onClickLink}
            dataTestId={getDataTestId(dataTestId, 'Breadcrumbs')}
            sx={sx}
          />
        ) : (
          <MuiBreadcrumbs data-testid={getDataTestId(dataTestId, 'Breadcrumbs')}>
            {navigationSchema.map(({ name, route }, index) => {
              const testId = `Item_${index}`;
              const isLast = navigationSchema.length - 1 === index;
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
        )}
      </SxBox>
    );
  },
);

BreadCrumbs.displayName = 'BreadCrumbs';
