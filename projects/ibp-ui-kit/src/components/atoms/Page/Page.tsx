import React, { useMemo } from 'react';

import { SxBox } from '@/components/atoms/SxBox';
import { getDataTestId, mergeSx } from '@/utils';

import { getPageStyles } from './Page.styles';
import { PageProps } from './Page.types';

export const Page = ({ children, sx, dataTestId, type = 'all' }: PageProps) => {
  const mergedSx = useMemo(() => mergeSx(getPageStyles(type), sx), [sx, type]);

  return (
    <SxBox component={'div'} data-testid={getDataTestId(dataTestId, 'Page')} sx={mergedSx}>
      {children}
    </SxBox>
  );
};
