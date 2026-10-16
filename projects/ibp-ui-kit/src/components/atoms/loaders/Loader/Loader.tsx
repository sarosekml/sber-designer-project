import React, { FC } from 'react';
import { CircularProgress } from '@mui/material';

import { getDataTestId } from '@/utils';
import { mergeSx } from '@/utils/mergeSx';

import { SxBox } from '../../SxBox';

import { sizes } from './Loader.const';
import { loaderRootStyles, useLoaderStyles } from './Loader.styles';
import { LoaderProps } from './Loader.types';

export const Loader: FC<LoaderProps> = React.memo(({ sx, dataTestId, size = 'lg', color = 'colored', className }) => {
  const loader = useLoaderStyles({ color });

  return (
    <SxBox sx={mergeSx(loaderRootStyles, sx)} className={className} data-testid={getDataTestId(dataTestId, 'Loader')}>
      <CircularProgress sx={loader} size={sizes[size]} />
    </SxBox>
  );
});
