import { MediumSizeType } from '@/types/common.types';
import { cssImportant, Sx } from '@/utils';

import { getFontBySize } from '../../InternalComponents/BaseInput/BaseInputStyles/BaseInput.styles';

import { inputAutocompleteCounterMargin } from './InputAutocomplete.const';

export const inputAutocompleteChipItemStyles =
  (viewFormat): Sx =>
  (theme) => ({
    marginLeft: viewFormat === 'outerChip' ? theme.spacing(0) : theme.spacing(1),
    marginTop: theme.spacing(1),
    '& .dmb-uikit-MuiChip-root': {
      maxWidth: '100%',
    },
  });

export const inputAutocompleteOuterChipItemStyles: Sx = (theme) => ({
  padding: cssImportant(theme.spacing(0, 4)),
});

export const inputAutocompleteChipsContainerStyles: Sx = (theme) => ({
  marginTop: 3,
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
});

export const InputAutocompleteTooltipText =
  (size: MediumSizeType = 'md'): Sx =>
  (theme) => ({
    fontSize: getFontBySize(size)(theme),
  });

export const inputAutocompleteCounterStyle =
  (size: MediumSizeType = 'md'): Sx =>
  (theme) => ({
    color: theme.palette.Text.TextPrimary,
    mt: theme.spacing(inputAutocompleteCounterMargin[size]),
  });
