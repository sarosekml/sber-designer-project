import React, { memo } from 'react';

import { Grid } from '@/components/atoms';
import { SxBox } from '@/components/atoms/SxBox';

import { ErrorImage } from '../components/ErrorImage';
import { ErrorMessage } from '../components/ErrorMessage';
import { ErrorTitle } from '../components/ErrorTitle';

import { getImageContainerStyles, sectionContainerStyles } from './ErrorSection.styles';
import { ErrorReason, ErrorSectionSize } from './ErrorSection.types';

export interface ErrorSectionProps {
  reason: ErrorReason;
  title?: string;
  message?: string;
  size?: ErrorSectionSize;
  actions?: React.ReactNode;
}

export const ErrorSection = memo(({ reason, title, message, size = 'md', actions }: ErrorSectionProps) => (
  <Grid
    container
    item
    display={'flex'}
    direction={'row'}
    justifyContent={'center'}
    alignItems={'center'}
    height={'100%'}
  >
    <Grid item spacing={4} container sx={sectionContainerStyles}>
      <Grid item container width={'fit-content'} spacing={6} direction={'column'}>
        <ErrorTitle reason={reason} title={title} textType={'H3Reg'} disabled />
        <ErrorMessage message={message} disabled />
        {actions}
      </Grid>
      <Grid item width={'fit-content'} alignItems={'center'}>
        <SxBox sx={getImageContainerStyles(size)}>
          <ErrorImage reason={reason} />
        </SxBox>
      </Grid>
    </Grid>
  </Grid>
));

ErrorSection.displayName = 'ErrorSection';
