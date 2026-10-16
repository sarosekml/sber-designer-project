import { ChangeEvent, KeyboardEventHandler, ReactNode } from 'react';

import { IconName, TooltipPosition } from '@/components/atoms';
import { DataTestIdProps, MediumSizeType, ViewType } from '@/types/common.types';
import { Sx } from '@/utils';

export type InputViewType = ViewType | 'present';
export type InputValidationType = 'error' | 'warning';
export type InputAdornmentPosition = 'start' | 'end';

export type InputEventType = ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

export interface BaseInputTooltipOptions {
  tooltipValue?: string;
}

export interface BaseInputLabelOptions extends BaseInputTooltipOptions {
  ellipsis?: boolean;
}

export interface BaseInputValidationOptions {
  message: string;
  type: InputValidationType;
  placement?: TooltipPosition;
}

export interface BaseInputActionOptions {
  onStartAction: () => void;
  iconName: IconName;
}

export interface BaseInputProps extends DataTestIdProps {
  value: string;
  label?: string;
  name?: string;
  placeholder?: string;
  viewType?: InputViewType;
  onChange?: (event: InputEventType) => void;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement | undefined>;
  autoFocus?: boolean;
  prefix?: ReactNode;
  postfix?: ReactNode;
  /**
   * Options for tooltip content
   * @param tooltipValue: 'string'
   */
  labelOptions?: BaseInputLabelOptions;
  helperText?: string;
  disabled?: boolean;
  size?: MediumSizeType;
  onClear?: () => void;
  onInfo?: () => void;
  /**
   * Options for tooltip content
   * @param tooltipValue: 'string'
   */
  infoOptions?: BaseInputTooltipOptions;
  multiline?: boolean;
  rows?: number;
  minRows?: number;
  maxRows?: number;
  maxLength?: number;
  isColoredBg?: boolean;
  errorTooltip?: {
    placement?: TooltipPosition;
  };
  /**
   * Config for validation error
   * type: 'error' | 'warning'
   * message: 'string'
   */
  validationOptions?: BaseInputValidationOptions;
  startAction?: BaseInputActionOptions;
  endAction?: BaseInputActionOptions;
  inputRef?: React.Ref<HTMLInputElement>;
  textColor?: string;
  sx?: Sx;
}

export interface BaseInputHookProps {
  autoFocus?: boolean;
}
