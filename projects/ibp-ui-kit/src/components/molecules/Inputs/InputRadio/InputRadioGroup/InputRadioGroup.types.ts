import { InputRadioButtonProps } from '../InputRadioButton/InputRadioButton.types';

export type InputRadioGroupOrientation = 'vertical' | 'horizontal';

export type InputRadioButtonOptionType = Pick<InputRadioButtonProps, 'value' | 'label' | 'helperText'>;

export type InputRadioGroupProps = Pick<
  InputRadioButtonProps,
  'name' | 'dataTestId' | 'size' | 'viewType' | 'disabled'
> & {
  title?: string;
  value?: string;
  onChange?: (value: string) => void;
  orientation?: InputRadioGroupOrientation;
  list?: InputRadioButtonOptionType[];
};
