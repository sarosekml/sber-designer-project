import React, { memo } from 'react';

import { SxBox, Text } from '@/components/atoms';
import { useTheme } from '@/styles/theme';
import { DataTestIdProps } from '@/types/common.types';
import { Sx } from '@/utils';

import { BaseInputProps } from '../BaseInput.types';

/**
 * Component for BaseInput helper text presenting
 * */
type BaseInputHelperTextProps = Pick<BaseInputProps, 'helperText'> & DataTestIdProps;

const baseInputHelperTextStyles: Sx = (theme) => ({
  mt: theme.spacing(1),
});

const root = 'BaseInputHelperText';

export const BaseInputHelperText = memo(({ helperText, dataTestId }: BaseInputHelperTextProps) => {
  const theme = useTheme();

  return helperText ? (
    <SxBox sx={baseInputHelperTextStyles} data-testid={dataTestId ? root + '_' + dataTestId : root}>
      <Text type={'BodyXSReg'} color={theme.palette.Text.TextInactive}>
        {helperText}
      </Text>
    </SxBox>
  ) : null;
});

BaseInputHelperText.displayName = root;
