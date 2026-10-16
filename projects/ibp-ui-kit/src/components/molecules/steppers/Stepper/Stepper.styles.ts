import { Sx } from '@/utils';

import { PropsStylesMuiStepper, PropsStylesStepConnector } from './Stepper.types';

export const subStepperWrapperStyles: Sx = (theme) => ({
  maxWidth: '1280px',
  py: 6,
  px: 3,
  bgcolor: theme.palette.BG.BGTile,
  border: `1px solid ${theme.palette.Border.BorderPrimary}`,
  borderRadius: 1,
});

export const muiStepperStyles =
  ({ outlined, shouldRenderAsArrowed }: PropsStylesMuiStepper): Sx =>
  (theme) => ({
    height: 'fit-content',
    ...(outlined && {
      border: `1px solid ${theme.palette.Disabled.Disabled}`,
      borderRadius: theme.spacing(2),
      padding: theme.spacing(2),
    }),
    ...(shouldRenderAsArrowed && {
      gap: theme.spacing(10),
      '.dmb-uikit-MuiGrid-root': {
        '& .dmb-uikit-MuiTypography-root': {
          ml: theme.spacing(-1),
          mb: theme.spacing(4),
        },
      },
    }),
  });

export const stepConnectorStyles =
  ({ length, orientation }: PropsStylesStepConnector): Sx =>
  (theme) => ({
    height: '100%',
    padding: theme.spacing(3, 0),
    ...(orientation === 'horizontal' && {
      flexGrow: 0,
    }),
    '.dmb-uikit-MuiStepConnector-line': {
      borderColor: theme.palette.Border.BorderPrimary,
      ...((orientation === 'vertical' && {
        height: length ? theme.spacing(Number(length)) : theme.spacing(12),
      }) || {
        width: length ? theme.spacing(Number(length)) : theme.spacing(12),
      }),
    },
  });

export const getStepLabelCustomStyles =
  (shouldRenderAsArrowed: boolean, isActiveStep: boolean): Sx =>
  () => ({
    ...(shouldRenderAsArrowed && {
      '.dmb-uikit-MuiStepLabel-iconContainer': {
        display: isActiveStep ? 'inherit' : 'none',
      },
      ...(!isActiveStep && {
        '.dmb-uikit-MuiStepLabel-labelContainer': {
          pl: 4,
        },
      }),
    }),
  });
