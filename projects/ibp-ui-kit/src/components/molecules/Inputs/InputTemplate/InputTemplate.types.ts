import React from 'react';

import { TooltipPosition } from '@/index';
import { MediumSizeType } from '@/types/common.types';
import { Sx } from '@/utils';

import { BaseInputLabelOptions, BaseInputValidationOptions } from '../InternalComponents/BaseInput/BaseInput.types';

export interface InputTemplateProps {
  children: React.ReactNode;
  dataTestId?: string;
  helperText?: string;
  label?: string;
  size?: MediumSizeType;
  sx?: Sx;
  validationOptions?: BaseInputValidationOptions;
  errorTooltip?: {
    placement?: TooltipPosition;
  };
  labelOptions?: BaseInputLabelOptions;
  disabled?: boolean;
}
