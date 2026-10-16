import React, { ChangeEvent, memo, MutableRefObject, useCallback, useMemo } from 'react';
import { AutocompleteRenderInputParams } from '@mui/material';

import { emptyString, isEmpty } from '@sber-ibp/core';

import { SxBox } from '@/components/atoms/SxBox';
import { Text } from '@/components/atoms/typography/Text/Text';
import { getInputTextDecorator } from '@/components/molecules/Inputs/InputText/InputTextDecorator/InputTextDecorator';
import { DecoratedTextField } from '@/components/molecules/Inputs/InternalComponents/InputDecoratedText/DecoratedTextField';

import { BaseInputEndActions } from '../../InternalComponents/BaseInput/BaseInputComponents/BaseInputEndActions';
import { BaseInputHelperText } from '../../InternalComponents/BaseInput/BaseInputComponents/BaseInputHelperText';
import { BaseInputLabel } from '../../InternalComponents/BaseInput/BaseInputComponents/BaseInputLabel';
import { BaseInputStartActions } from '../../InternalComponents/BaseInput/BaseInputComponents/BaseInputStartActions';
import { baseInputStyles } from '../../InternalComponents/BaseInput/BaseInputStyles/BaseInput.styles';
import { OnChangeDecoratedCallback } from '../../InternalComponents/InputDecoratedText/DecoratedTextField.types';
import { InputAutocompleteProps } from '../InputAutocomplete.types';
import { inputAutocompleteEndActionsStyles } from '../InputAutocompleteStyles/InputAutocompleteText.styles';

const textDecorator = getInputTextDecorator({});

interface InputAutocompleteTextProps<T, Multiple extends boolean>
  extends Omit<
    InputAutocompleteProps<T, Multiple>,
    'options' | 'getOptionLabel' | 'optionsGroupBy' | 'isOptionEqualToValue' | 'asyncOptions' | 'onChange'
  > {
  params: AutocompleteRenderInputParams;
  onOpen: () => void;
  onClose: () => void;
  onClear: (() => void) | undefined;
  isOpened: boolean;
  focused: boolean;
  getPostfixRef: (postfixRef: MutableRefObject<HTMLDivElement | null>) => void;
  inputValue: string;
}

const root = 'InputAutocompleteText';

export const InputAutocompleteTextComponent = <T, Multiple extends boolean>({
  params,
  label,
  labelOptions,
  dataTestId,
  size,
  disabled,
  startAction,
  prefix,
  onClear,
  onInfo,
  infoOptions,
  postfix,
  inputValue,
  onOpen,
  onClose,
  isOpened,
  helperText,
  focused,
  validationOptions,
  getPostfixRef,
  autoFocus,
  multiple,
  value,
  placeholder,
  viewFormat,
  hasClearIndicator,
}: InputAutocompleteTextProps<T, Multiple>) => {
  const styles = useMemo(
    () => baseInputStyles({ focused, validationOptions, disabled }),
    [disabled, focused, validationOptions],
  );
  const endActionsStyles = useMemo(() => inputAutocompleteEndActionsStyles({ size }), [size]);

  const getPostfixRefCallback = useCallback(
    (postfixRef: React.MutableRefObject<HTMLDivElement | null>) => {
      getPostfixRef(postfixRef);
    },
    [getPostfixRef],
  );

  const onChange: OnChangeDecoratedCallback<string> = useCallback(
    (_, e) => params?.inputProps?.onChange?.({ ...e } as ChangeEvent<HTMLInputElement>),
    [params],
  );

  const isOuterChip = viewFormat === 'outerChip' && multiple;
  const showPlaceholder = isOuterChip ? isEmpty(inputValue) : isEmpty(value);
  const resolvedPlaceholder = placeholder ?? (isOuterChip ? 'Поиск...' : undefined);

  return (
    <SxBox>
      <DecoratedTextField
        /**
         * This is params which necessary correct working of the material Autocomplete
         * If we do not transfer them - we lost methods onMouseDown, onBlur, onFocus ...ect
         * And the component can not work correct
         * For correct working without this line we need to rewrite Autocomplete fully on our side without material-ui
         *  */
        {...params}
        decorator={textDecorator}
        autoFocus={autoFocus}
        onChange={onChange}
        sx={styles}
        value={inputValue}
        disabled={disabled}
        placeholder={showPlaceholder ? resolvedPlaceholder : undefined}
        data-testid={root + '_' + dataTestId}
        label={<BaseInputLabel label={label} labelOptions={labelOptions} dataTestId={dataTestId} disabled={disabled} />}
        InputProps={{
          ...params.InputProps,
          ref: params.InputProps.ref,
          /**
           * We must have TextField for rendering adornments for single and multiple modes.
           * Need to provide - params.InputProps.startAdornment in the multiple mode,
           * because of without this property - multiple values don't rendering
           */
          startAdornment: multiple ? (
            params.InputProps.startAdornment
          ) : (
            <BaseInputStartActions
              size={size}
              disabled={disabled}
              startAction={startAction}
              prefix={prefix}
              dataTestId={dataTestId}
            />
          ),
          endAdornment: (
            <SxBox sx={endActionsStyles}>
              <BaseInputEndActions
                size={size}
                disabled={disabled}
                onClear={onClear}
                onInfo={onInfo}
                postfix={postfix}
                infoOptions={infoOptions}
                dataTestId={dataTestId}
                onOpen={onOpen}
                onClose={onClose}
                isOpened={isOpened}
                getPostfixRef={getPostfixRefCallback}
                value={multiple && isEmpty(value) ? emptyString : multiple ? inputValue + ' ' : inputValue}
                hasClearIndicator={hasClearIndicator}
              />
            </SxBox>
          ),
        }}
      />
      <BaseInputHelperText helperText={helperText} dataTestId={dataTestId} />
    </SxBox>
  );
};

InputAutocompleteTextComponent.displayName = root;
export const InputAutocompleteText = memo(InputAutocompleteTextComponent) as typeof InputAutocompleteTextComponent;
