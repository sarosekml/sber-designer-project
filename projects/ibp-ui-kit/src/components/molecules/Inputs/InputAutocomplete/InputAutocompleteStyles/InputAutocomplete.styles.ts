import { useCallback } from 'react';

import {
  getFontBySize,
  getHeightBySize,
  getPaddingBySize,
} from '@/components/molecules/Inputs/InternalComponents/BaseInput/BaseInputStyles/BaseInput.styles';
import { cssImportant, Sx } from '@/utils';

import { inputAutocompleteIconSize } from './InputAutocomplete.const';
import { InputAutocompleteStyleType } from './InputAutocompleteStyles.types';

const countPaddingFromRightSide = <T, Multiple extends boolean>({
  onClose,
  onOpen,
  hasClearIndicator,
  onInfo,
  postfix,
  size = 'md',
  postfixRef,
}: Omit<InputAutocompleteStyleType<T, Multiple>, 'viewPreset' | 'value' | 'viewFormat'>): number => {
  const iconIndents = 2;
  const items = [onClose, onOpen, hasClearIndicator, onInfo].filter(Boolean);
  const postfixWidth = postfixRef?.current?.offsetWidth;
  return (
    items.length * inputAutocompleteIconSize[size] +
    items.length * iconIndents +
    // todo add theme with space
    (postfix && postfixWidth ? Math.round(postfixWidth / 4) + iconIndents : 0)
  );
};

export const useInputAutocompleteSx = <T, Multiple extends boolean>({
  size,
  multiple,
  selectedValue,
  onClose,
  onOpen,
  hasClearIndicator,
  onInfo,
  postfix,
  postfixRef,
  viewFormat = 'chip',
}: InputAutocompleteStyleType<T, Multiple>): Sx =>
  useCallback(
    (theme) => {
      const isMultipleWithValues = multiple && Array.isArray(selectedValue) && selectedValue.length > 0;
      const isSingle = viewFormat === 'outerChip';
      /** Fix correct indents for text input in the autocomplete implementation */
      return {
        '& .dmb-uikit-MuiInputBase-root': {
          minWidth: cssImportant('auto'),
        },
        '& .dmb-uikit-MuiInputBase-root, & .dmb-uikit-MuiAutocomplete-inputRoot': {
          display: cssImportant('flex'),
          alignItems: cssImportant('center'),
          padding: isMultipleWithValues ? cssImportant(0) : cssImportant(getPaddingBySize(size)(theme)),
          paddingBottom: isMultipleWithValues
            ? cssImportant(theme.spacing(1))
            : cssImportant(getPaddingBySize(size)(theme)),
          paddingRight: cssImportant(
            theme.spacing(
              countPaddingFromRightSide({
                onClose,
                onOpen,
                hasClearIndicator,
                onInfo,
                postfix,
                size,
                postfixRef,
                multiple,
              }),
            ),
          ),
        },
        '& div.dmb-uikit-MuiAutocomplete-inputRoot > .dmb-uikit-MuiInputBase-input, & .dmb-uikit-MuiAutocomplete-input':
          {
            padding: isMultipleWithValues ? theme.spacing(1, 1, 0, 1) : 0,
            fontSize: getFontBySize(size)(theme),
            lineHeight: getHeightBySize(size)(theme),
            height: getHeightBySize(size)(theme),
          },
        ...(isSingle &&
          multiple && {
            '& .dmb-uikit-MuiInputBase-root, & .dmb-uikit-MuiAutocomplete-inputRoot': {
              alignItems: cssImportant('center'),
              padding: cssImportant(0),
            },
            '& [data-testid^="span_text"]': {
              display: cssImportant('inline-flex'),
              alignItems: cssImportant('center'),
              flexShrink: cssImportant(0),
              paddingLeft: cssImportant(theme.spacing(2.5)),
              paddingTop: cssImportant(theme.spacing(2.5)),
              paddingBottom: cssImportant(theme.spacing(2.5)),
              paddingRight: cssImportant(0),
            },

            '& .dmb-uikit-MuiAutocomplete-input': {
              marginLeft: cssImportant(theme.spacing(2)),
              paddingTop: cssImportant(theme.spacing(2.5)),
              paddingBottom: cssImportant(theme.spacing(2.5)),
              paddingLeft: cssImportant(0),
              paddingRight: cssImportant(0),
              minWidth: cssImportant(0),
              flexGrow: cssImportant(1),
            },
          }),
        '& [data-testid="Tooltip"][data-mui-internal-clone-element="true"]': {
          width: cssImportant('auto'),
        },
      };
    },
    [hasClearIndicator, multiple, onClose, onInfo, onOpen, postfix, postfixRef, selectedValue, size, viewFormat],
  );
