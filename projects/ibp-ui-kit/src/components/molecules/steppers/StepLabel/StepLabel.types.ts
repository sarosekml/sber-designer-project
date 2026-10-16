import { Theme } from '@mui/material';

import { DataTestIdProps } from '@/types';
import { Sx } from '@/utils';

import { SubStepperType } from '../Stepper';

export interface Props extends DataTestIdProps {
  /**
   * Flag for active step highlighting
   * @default false */
  active?: boolean;

  /**
   * In most cases will simply be a string containing a title for the label
   */
  children?: React.ReactNode;

  /**
   * Current step is fully finished or not
   * @default false
   */
  completed?: boolean;

  /**
   * Switches arrow cursor ("default" in css) to hand ("pointer" in css) on step hover
   * @default true
   */
  cursorPointer?: boolean;

  /** Replaces default icon by custom icon */
  customIcon?: React.ReactNode;

  /**
   * Flag for step disabling
   * @default false
   */
  disabled?: boolean;

  helperText?: string;

  /**
   * Disables any icon, if value is false
   * @default true
   */
  iconVisible?: boolean;

  /**
   * Type of parent Stepper
   * @default 'checkmark'
   */
  stepperType?: SubStepperType;

  sx?: Sx;
}
export type StylesProps = Omit<Props, 'dataTestId'>;
