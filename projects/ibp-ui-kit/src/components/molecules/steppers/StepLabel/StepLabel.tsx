import React, { FC } from 'react';
import { Grid, StepLabel as MuiStepLabel, Typography, useTheme } from '@mui/material';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/typography';
import { getDataTestId, mergeSx } from '@/utils';

import { useHelperStyles, useIconStyles, useStyles } from './StepLabel.styles';
import { Props } from './StepLabel.types';

export const StepLabel: FC<Props> = React.memo(
  ({
    active = false,
    children,
    completed = false,
    cursorPointer = true,
    customIcon,
    dataTestId,
    disabled = false,
    helperText,
    iconVisible = true,
    stepperType = 'checkmark',
    sx,
  }) => {
    const theme = useTheme();
    const styles = useStyles({
      active,
      children,
      completed,
      cursorPointer,
      disabled,
      helperText,
      iconVisible,
      stepperType,
    });
    const helperStyles = useHelperStyles({
      iconVisible,
    });
    const iconStyles = useIconStyles({ active, completed, disabled, stepperType });

    const getDefaultIconOnStandardStepper = () => {
      if (completed) {
        return <Icon name={'CheckCircleFilled'} sx={iconStyles} dataTestId="DoneIcon" />;
      }
      return <Icon name={'Circle'} sx={iconStyles} dataTestId="NotDoneIcon_Active" />;
    };

    const getDefaultIconOnStepperAsList = () =>
      active ? <Icon name={'ArrowRight'} sx={iconStyles} size={'sm'} dataTestId="CurrentStepIcon_Arrow" /> : null;

    const getDefaultIcon = () => {
      if (stepperType === 'arrowed') return getDefaultIconOnStepperAsList();
      return getDefaultIconOnStandardStepper();
    };

    return (
      <>
        <MuiStepLabel
          data-testid={getDataTestId(dataTestId, 'StepLabel')}
          sx={mergeSx(styles, sx)}
          icon={iconVisible ? customIcon ?? getDefaultIcon() : undefined}
        >
          {children && <Typography variant="BodyMReg">{children}</Typography>}
        </MuiStepLabel>
        {helperText && (
          <Grid sx={helperStyles}>
            <Text
              color={theme.palette.Text.TextInactive}
              dataTestId={getDataTestId(dataTestId, 'Step', 'HelperText')}
              type="BodySReg"
            >
              {helperText}
            </Text>
          </Grid>
        )}
      </>
    );
  },
);
