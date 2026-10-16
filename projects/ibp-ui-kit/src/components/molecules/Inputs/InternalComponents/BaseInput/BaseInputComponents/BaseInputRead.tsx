import React, { memo, useMemo } from 'react';

import { SxBox } from '@/components/atoms/SxBox';
import { Tooltip, TooltipProps } from '@/components/atoms/Tooltip';
import { Text } from '@/components/atoms/typography/Text';
import { mergeSx } from '@/utils';

import { BaseInputProps } from '../BaseInput.types';
import { baseInputReadAndPresentStyles } from '../BaseInputStyles/BaseInput.styles';

import { BaseInputEndActions } from './BaseInputEndActions';
import { BaseInputHelperText } from './BaseInputHelperText';
import { BaseInputLabel } from './BaseInputLabel';
import { BaseInputStartActions } from './BaseInputStartActions';

const root = 'BaseInputRead';

interface BaseInputReadProps extends BaseInputProps {
  tooltipErrorOptions: Omit<TooltipProps, 'children'>;
  onMouseLeave: () => void;
  onMouseEnter: () => void;
}

export const BaseInputRead = memo(
  ({
    value,
    label,
    labelOptions,
    disabled,
    size = 'md',
    prefix,
    postfix,
    helperText,
    viewType = 'edit',
    dataTestId,
    validationOptions,
    tooltipErrorOptions,
    onMouseEnter,
    onMouseLeave,
    multiline,
    rows,
    sx,
    textColor,
  }: BaseInputReadProps) => {
    const isValidation = !!validationOptions;
    const isReadonly = viewType === 'read';

    const { valueContainerStyles, valueStyles } = useMemo(() => {
      const valueContainerStyles = isReadonly
        ? baseInputReadAndPresentStyles.valueReadContainer(isValidation)
        : baseInputReadAndPresentStyles.valuePresentContainer(isValidation, size);

      const valueStyles = baseInputReadAndPresentStyles.valueText({ size, multiline, rows, disabled, textColor });

      return {
        valueContainerStyles,
        valueStyles,
      };
    }, [isReadonly, isValidation, size, multiline, rows, disabled, textColor]);

    return (
      <SxBox
        sx={mergeSx(sx, baseInputReadAndPresentStyles.container)}
        className={'BaseInputRead_container'}
        data-testid={dataTestId ? root + '_' + dataTestId : root}
      >
        <Tooltip {...tooltipErrorOptions}>
          <SxBox onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            <BaseInputLabel label={label} labelOptions={labelOptions} dataTestId={dataTestId} disabled={disabled} />
            <SxBox sx={valueContainerStyles}>
              <BaseInputStartActions dataTestId={dataTestId} prefix={prefix} size={size} disabled={disabled} />
              <Text sx={valueStyles}>{value}</Text>
              <BaseInputEndActions
                size={size}
                postfix={postfix}
                dataTestId={dataTestId}
                disabled={disabled}
                value={value}
              />
            </SxBox>
          </SxBox>
        </Tooltip>
        <BaseInputHelperText helperText={helperText} dataTestId={dataTestId} />
      </SxBox>
    );
  },
);

BaseInputRead.displayName = root;
