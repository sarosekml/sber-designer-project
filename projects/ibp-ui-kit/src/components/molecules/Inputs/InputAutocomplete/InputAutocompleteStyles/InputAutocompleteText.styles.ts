import { getPaddingBySize } from '@/components/molecules/Inputs/InternalComponents/BaseInput/BaseInputStyles/BaseInput.styles';
import { Sx } from '@/utils';

import { InputAutocompleteEndActionsStylesType } from './InputAutocompleteStyles.types';

export const inputAutocompleteEndActionsStyles =
  ({ size }: InputAutocompleteEndActionsStylesType): Sx =>
  (theme) => ({
    position: 'absolute',
    right: getPaddingBySize(size)(theme),
    top: '50%',
    transform: 'translate(0, -50%)',
  });
