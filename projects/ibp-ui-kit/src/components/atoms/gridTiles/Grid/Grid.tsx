import React, { forwardRef,memo, useMemo } from 'react';
import { Grid as MaterialGrid } from '@mui/material';

import { GridProps, sizesMap } from './Grid.types';

/**
 * @param props.xs extra-small: 0px
 * @param props.sm small: 600px
 * @param props.md medium: 960px
 * @param props.lg large: 1280px
 * @param props.xl extra-large: 1920px
 * @param props.sizes -{ xs, sm, md, lg, xl, all }
 */

/**
 * More props on [Grid](https://mui.com/material-ui/api/grid/)
 */
export const Grid = memo(
  forwardRef<HTMLDivElement | null, GridProps>(({ xs, sm, md, lg, xl, sizes = {}, dataTestId, ...otherProps }, ref) => {
    const sizesProps = { lg, md, sm, xl, xs };

    const customSizesProps = useMemo(
      () => sizesMap.reduce((acc, name) => ({ ...acc, [name]: sizes[name] || sizesProps[name] }), {}),
      [sizesProps, sizes],
    );

    return <MaterialGrid {...otherProps} {...customSizesProps} data-testid={dataTestId} ref={ref} />;
  }),
);

Grid.displayName = 'Grid';
