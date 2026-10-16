import React, { memo } from 'react';

import { Grid, Paper, SxBox } from '@/components/atoms';
import { ErrorReason } from '@/components/molecules/Errors/ErrorSection';
import { mergeSx, Sx } from '@/utils';

import { ErrorImage } from '../components/ErrorImage';
import { ErrorMessage } from '../components/ErrorMessage';
import { ErrorTitle } from '../components/ErrorTitle';

import {
  contentWrapperStyles,
  imageContainerStyles,
  imageWrapperStyles,
  innerContainerStyles,
  paperStyles,
} from './ErrorBanner.styles';

export interface ErrorBannerProps {
  reason: ErrorReason;
  title?: string;
  message?: string | React.ReactNode;
  actions?: React.ReactNode;
  isImageOnTop?: boolean;
  sx?: Sx;
}

export const ErrorBanner = memo(({ reason, title, message, actions, sx, isImageOnTop = false }: ErrorBannerProps) => {
  return (
    <Paper dataTestId={isImageOnTop ? 'Empty' : 'Error'} sx={mergeSx(paperStyles, sx)}>
      <Grid container sx={innerContainerStyles({ isImageOnTop })}>
        {isImageOnTop && (
          <Grid item xs={12} sx={imageWrapperStyles({ isImageOnTop })}>
            <SxBox sx={imageContainerStyles({ isImageOnTop })}>
              <ErrorImage reason={reason} />
            </SxBox>
          </Grid>
        )}

        <Grid item container xs={12} md={isImageOnTop ? 12 : true} sx={contentWrapperStyles({ isImageOnTop })}>
          <ErrorTitle
            reason={reason}
            title={title}
            textType={isImageOnTop ? 'H3Reg' : 'H1Light'}
            isImageOnTop={isImageOnTop}
          />
          {typeof message === 'string' ? <ErrorMessage message={message} /> : message}
          {actions}
        </Grid>

        {!isImageOnTop && (
          <Grid item md="auto" sx={imageWrapperStyles({ isImageOnTop })}>
            <SxBox sx={imageContainerStyles({ isImageOnTop })}>
              <ErrorImage reason={reason} />
            </SxBox>
          </Grid>
        )}
      </Grid>
    </Paper>
  );
});

ErrorBanner.displayName = 'ErrorBanner';
