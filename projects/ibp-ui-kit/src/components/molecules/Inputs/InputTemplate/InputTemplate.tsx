import React, { memo, useMemo } from 'react';

import { Grid } from '@/components/atoms';
import { SxBox } from '@/components/atoms/SxBox';
import { Tooltip } from '@/components/atoms/Tooltip';
import { mergeSx, Sx } from '@/utils';

import { Text } from '../../../atoms';
import { useTooltipErrorOptions } from '../InternalComponents/BaseInput/BaseInput.utils';
import { BaseInputHelperText } from '../InternalComponents/BaseInput/BaseInputComponents/BaseInputHelperText';
import { BaseInputLabel } from '../InternalComponents/BaseInput/BaseInputComponents/BaseInputLabel';
import { baseInputReadAndPresentStyles } from '../InternalComponents/BaseInput/BaseInputStyles/BaseInput.styles';

import { InputTemplateProps } from './InputTemplate.types';

const root = 'InputTemplate';

const rootSx: Sx = {
  width: '100%',
  [`& .${root}__container`]: {
    [`& .${root}__label, & .${root}__body, & .${root}__helperText`]: {
      maxWidth: '100%',
      [`& .${root}__text`]: {
        width: '100%',
      },
    },
  },
};

/**
 * Sx reference classes:
 *  - InputTemplate__container
 *  - InputTemplate__label
 *  - InputTemplate__body
 *  - InputTemplate__helperText
 */
export const InputTemplate = memo(
  ({
    children,
    dataTestId,
    helperText,
    label,
    size = 'md',
    sx,
    labelOptions,
    validationOptions,
    disabled,
    errorTooltip,
  }: InputTemplateProps): JSX.Element => {
    const tooltipErrorOptions = useTooltipErrorOptions(validationOptions, 'auto', errorTooltip?.placement);
    const textSx = useMemo(() => baseInputReadAndPresentStyles.valueText({ size }), [size]);

    return (
      <SxBox sx={mergeSx(rootSx, sx)}>
        <Tooltip {...tooltipErrorOptions}>
          <Grid
            container
            dataTestId={dataTestId ? root + '_' + dataTestId : root}
            className={`${root}__container`}
            direction={'column'}
          >
            {label ? (
              <Grid item dataTestId={`${root}_label`} className={`${root}__label`}>
                <BaseInputLabel
                  label={label}
                  labelOptions={labelOptions}
                  dataTestId={dataTestId ?? root}
                  disabled={disabled}
                />
              </Grid>
            ) : null}
            {
              <Grid item dataTestId={`${root}_body`} className={`${root}__body`}>
                {React.isValidElement(children) ? (
                  children
                ) : (
                  <Text
                    sx={textSx}
                    className={`${root}__text`}
                    dataTestId={dataTestId ? root + '_' + dataTestId : root}
                  >
                    {children}
                  </Text>
                )}
              </Grid>
            }
            {helperText ? (
              <Grid item className={`${root}__helperText`}>
                <BaseInputHelperText helperText={helperText} dataTestId={`${root}_helperText`} />
              </Grid>
            ) : null}
          </Grid>
        </Tooltip>
      </SxBox>
    );
  },
);

InputTemplate.displayName = root;
