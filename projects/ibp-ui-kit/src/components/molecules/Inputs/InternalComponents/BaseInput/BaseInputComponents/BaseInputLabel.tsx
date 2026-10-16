import React, { memo } from 'react';
import { useTheme } from '@mui/material';

import { Icon, SxBox, Text, Tooltip } from '@/components/atoms';
import { DataTestIdProps } from '@/types/common.types';
import { mergeSx } from '@/utils/mergeSx';

import { BaseInputProps } from '../BaseInput.types';
import { baseInputIconColorStyles } from '../BaseInputStyles/BaseInput.styles';
import {
  baseInputLabelContainerSx,
  baseInputLabelIconStyles,
  getBaseInputLabelSx,
  leftContainerSx,
} from '../BaseInputStyles/BaseInputLabel.styles';

/**
 * Component for BaseInput dynamic Label
 * */
type BaseInputLabelProps = Pick<BaseInputProps, 'label' | 'labelOptions' | 'disabled' | 'maxLength'> & {
  value?: string;
} & DataTestIdProps;

const root = 'BaseInputLabel';

export const BaseInputLabel = memo(
  ({ label, labelOptions, dataTestId, disabled, value, maxLength }: BaseInputLabelProps) => {
    const theme = useTheme();

    if (!label) return null;

    const isLabelTooltip = labelOptions?.tooltipValue;
    const isEllipsis = labelOptions?.ellipsis;

    return (
      <SxBox sx={baseInputLabelContainerSx} data-testid={dataTestId ? root + '_' + dataTestId : root}>
        <SxBox sx={leftContainerSx}>
          <Text sx={getBaseInputLabelSx(disabled, isEllipsis)} type={'BodyXSReg'}>
            {label}
          </Text>
          {isLabelTooltip ? (
            <SxBox>
              <Tooltip placement={'top'} arrow={'bottom'} title={labelOptions.tooltipValue}>
                <Icon sx={mergeSx(baseInputIconColorStyles({}), baseInputLabelIconStyles)} name={'InfoCircle'} />
              </Tooltip>
            </SxBox>
          ) : null}
        </SxBox>
        {maxLength != null && value != null && (
          <Text color={theme.palette.Disabled.Disabled} type={'BodyXSReg'}>
            {value?.length || 0}/{maxLength}
          </Text>
        )}
      </SxBox>
    );
  },
);
BaseInputLabel.displayName = root;
