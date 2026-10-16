import { ReactNode } from 'react';

import { DataTestIdProps } from '@/types';
import { Sx } from '@/utils';

const stepperOrientationValues = ['vertical', 'horizontal'] as const;
export type StepperOrientation = (typeof stepperOrientationValues)[number];

export const subStepperTypeValues = ['arrowed', 'checkmark'];
export type SubStepperType = (typeof subStepperTypeValues)[number];

export interface StepItem {
  active: boolean;
  completed: boolean;
  disabled?: boolean;
  helperText?: string;
  key?: string;
  onClick?: () => any;
  title: string;
  steps?: StepItem[];
}

export interface PropTypes extends DataTestIdProps {
  className?: string;
  connectorLength?: number;
  connectorSx?: Sx;
  orientation: StepperOrientation;
  outlined?: boolean;
  readonly?: boolean;
  steps?: StepItem[];
  onStepHandler?: (currentStep: StepItem) => void;
  children?: ReactNode;

  /**
   * Type of SubStepper displayng.
   * 'checkmark' shows SubStepper as usual stepper with check icons and dividers;
   * 'arrowed' shows SubStepper without dividers and changes check icons to arrow
   * @default 'checkmark'
   */
  subStepperType?: SubStepperType;
}

export interface PropsStylesMuiStepper {
  outlined?: boolean;
  shouldRenderAsArrowed?: boolean;
}

export interface PropsStylesStepConnector {
  length?: number | string;
  orientation: StepperOrientation;
}

export interface SubStepperProps extends PropTypes {
  title: string;
}
