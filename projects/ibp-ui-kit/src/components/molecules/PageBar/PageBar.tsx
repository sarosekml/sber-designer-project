import React, { memo } from 'react';
import { AppBar, Toolbar } from '@mui/material';

import { SxBox } from '@/components/atoms/SxBox';
import { Text } from '@/components/atoms/typography';
import { getDataTestId, mergeSx } from '@/utils';

import { appBarStyles, extraBarStyles, getToolbarStyles, subBarStyles, tileContainerStyles } from './PageBar.styles';
import { PageBarProps } from './PageBar.types';

export const PageBar = memo(
  ({
    title,
    extra,
    className = '',
    prefix,
    titlePostfix,
    subExtra,
    subTitle,
    dataTestId,
    sx,
    isStickButtonLeft = false,
  }: PageBarProps) => {
    const toolbarStyles = mergeSx(getToolbarStyles({ isStickButtonLeft }), sx);

    return (
      <AppBar
        className={className}
        color="transparent"
        position="static"
        data-testid={getDataTestId(dataTestId, 'PageBar')}
        sx={appBarStyles}
      >
        <Toolbar sx={toolbarStyles} disableGutters>
          <SxBox sx={tileContainerStyles}>
            {prefix}
            <Text gutterBottom={false} dataTestId={dataTestId} type={'H3StrongSmb'}>
              {title}
            </Text>
            {titlePostfix}
          </SxBox>
          {extra && <SxBox sx={extraBarStyles}>{extra}</SxBox>}
        </Toolbar>
        {[subTitle, subExtra].some(Boolean) && (
          <SxBox sx={subBarStyles}>
            <SxBox>{subTitle}</SxBox>
            <SxBox>{subExtra}</SxBox>
          </SxBox>
        )}
      </AppBar>
    );
  },
);
