import { MutableRefObject } from 'react';

import { BaseInputEndActionsProps } from '@/components/molecules/Inputs/InternalComponents/BaseInput/BaseInputComponents/BaseInputEndActions';

import {
  InputAutocompleteInternalValueType,
  InputAutocompleteProps,
  InputAutocompleteViewFormat,
} from '../InputAutocomplete.types';

export type InputAutocompleteStyleType<T, Multiple extends boolean> = Pick<
  InputAutocompleteProps<T, Multiple>,
  'size' | 'hasClearIndicator' | 'onInfo' | 'postfix' | 'multiple'
> & {
  selectedValue?: InputAutocompleteInternalValueType<T, Multiple>;
  onOpen: () => void;
  onClose: () => void;
  postfixRef?: MutableRefObject<HTMLDivElement | null>;
  viewFormat?: InputAutocompleteViewFormat;
};

export type InputAutocompleteEndActionsStylesType = Pick<BaseInputEndActionsProps, 'size'> & {
  viewFormat?: InputAutocompleteViewFormat;
};
