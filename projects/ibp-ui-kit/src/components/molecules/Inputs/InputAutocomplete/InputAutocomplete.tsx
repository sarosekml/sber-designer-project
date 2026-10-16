/* eslint-disable @typescript-eslint/no-misused-promises */
import React, { memo, useCallback } from 'react';
import { Autocomplete, AutocompleteRenderInputParams, AutocompleteValue } from '@mui/material';

import { emptyArray, isEmpty } from '@sber-ibp/core';

import { DictionaryBadge, SxBox, Tooltip } from '@/components/atoms';

import { CheckboxListRow } from '../../CheckboxList';
import { useTooltipErrorOptions } from '../InternalComponents/BaseInput/BaseInput.utils';

import { InputAutocompleteDropdownPaper } from './InputAutocompleteComponents/InputAutocompleteDropdown';
import { InputAutocompleteRead } from './InputAutocompleteComponents/InputAutocompleteRead';
import { InputAutocompleteTags } from './InputAutocompleteComponents/InputAutocompleteTags';
import { InputAutocompleteText } from './InputAutocompleteComponents/InputAutocompleteText';
import { useInputAutocompleteSx } from './InputAutocompleteStyles/InputAutocomplete.styles';
import {
  inputAutocompleteChipItemStyles,
  inputAutocompleteChipsContainerStyles,
  inputAutocompleteOuterChipItemStyles,
} from './InputAutocompleteStyles/InputAutocompleteTags.styles';
import { InputAutocompleteProps } from './InputAutocomplete.types';
import { isStaticValue } from './InputAutocomplete.utils';
import { useInputAutocompleteState } from './useInputAutocompleteState';

const root = 'InputAutocomplete';

export const InputAutocompleteComponent = <T, Multiple extends boolean>(props: InputAutocompleteProps<T, Multiple>) => {
  const {
    getOptionLabel,
    optionsGroupBy,
    renderOptions,
    dataTestId,
    validationOptions,
    size = 'md',
    onInfo,
    postfix,
    getOptionDisabled,
    multiple,
    viewType = 'edit',
    multipleOptions,
    disabled,
    viewFormat,
    filterOptions,
    hasClearIndicator = true,
    hasSelectAll = false,
    errorTooltip = { placement: 'right' },
  } = props;

  const {
    isOptionEqualToValue,
    getOptionIdentifier,
    noOptionsText,
    isOpened,
    isSelectedAll,
    onChangeCallback,
    onKeyUpCallback,
    onOpenCallback,
    onCloseCallback,
    onClearCallback,
    onSelectAllCallback,
    internalOptions,
    selectedValue,
    inputText,
    focused,
    hovered,
    onBlur,
    onFocus,
    onMouseEnter,
    onMouseLeave,
    getPostfixRefCallback,
    postfixRef,
    onInputChangeCallback,
    getOptionDisabledCallback,
  } = useInputAutocompleteState(props);

  const inputSx = useInputAutocompleteSx({
    size,
    multiple,
    selectedValue,
    onClose: onCloseCallback,
    onOpen: onOpenCallback,
    hasClearIndicator,
    onInfo,
    postfix,
    postfixRef,
    viewFormat,
  });

  const isOuterChip = viewFormat === 'outerChip';

  const tooltipErrorOptions = useTooltipErrorOptions(
    validationOptions,
    (!disabled && hovered) || focused,
    errorTooltip.placement,
  );

  const PaperComponent = useCallback(
    (paperProps: React.HTMLAttributes<HTMLElement>) => (
      <InputAutocompleteDropdownPaper
        clearAllCallback={onClearCallback}
        hasSelectAll={hasSelectAll}
        isSelectedAll={isSelectedAll}
        multiple={multiple}
        selectAllCallback={onSelectAllCallback}
        {...paperProps}
      />
    ),
    [hasSelectAll, isSelectedAll, multiple, onClearCallback, onSelectAllCallback],
  );

  if (viewType !== 'edit') {
    return (
      <InputAutocompleteRead
        {...props}
        selectedValue={selectedValue}
        focused={focused}
        tooltipErrorOptions={tooltipErrorOptions}
      />
    );
  }

  return (
    <SxBox sx={{ width: '100%' }}>
      <Autocomplete
        fullWidth
        data-testid={root + '_' + dataTestId}
        value={selectedValue as AutocompleteValue<T, Multiple, boolean, boolean>}
        onChange={onChangeCallback as never}
        inputValue={inputText}
        onInputChange={onInputChangeCallback}
        open={isOpened}
        sx={inputSx}
        onOpen={onOpenCallback}
        onClose={onCloseCallback}
        getOptionLabel={getOptionLabel as any}
        isOptionEqualToValue={isOptionEqualToValue}
        groupBy={optionsGroupBy}
        filterOptions={filterOptions}
        noOptionsText={noOptionsText}
        options={internalOptions}
        multiple={multiple}
        onFocus={onFocus}
        onBlur={onBlur}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onKeyUp={onKeyUpCallback}
        disabled={disabled}
        disableCloseOnSelect={!!multiple}
        getOptionDisabled={
          !multiple || isEmpty(multipleOptions?.staticValues) ? getOptionDisabled : getOptionDisabledCallback
        }
        PaperComponent={PaperComponent}
        renderOption={(optionProps, option, { selected }) => {
          const key = getOptionIdentifier(option);
          const label = renderOptions ? renderOptions(option) : (getOptionLabel(option) as any);

          const content = isOuterChip ? (
            <CheckboxListRow
              label={label}
              checked={selected}
              checkboxSize={size}
              id={key}
              name={getOptionLabel(option)}
              onChange={() => undefined}
            />
          ) : (
            label
          );

          return (
            <SxBox
              {...(optionProps as any)}
              key={key}
              sx={isOuterChip ? inputAutocompleteOuterChipItemStyles : undefined}
            >
              {content}
            </SxBox>
          );
        }}
        renderTags={(_value, getTagProps, _ownerState) => {
          if (!multiple || !(selectedValue as T[])?.length) return null;
          return (
            <InputAutocompleteTags
              {...props}
              getTagProps={getTagProps}
              selectedValues={(selectedValue as T[]) ?? emptyArray}
              focused={focused}
            />
          );
        }}
        renderInput={(params: AutocompleteRenderInputParams) => {
          return (
            <Tooltip {...tooltipErrorOptions}>
              <InputAutocompleteText
                {...props}
                params={params}
                inputValue={params.inputProps.value as any}
                onOpen={onOpenCallback}
                onClose={onCloseCallback}
                isOpened={isOpened}
                onClear={hasClearIndicator ? onClearCallback : undefined}
                focused={focused}
                validationOptions={validationOptions}
                getPostfixRef={getPostfixRefCallback}
              />
            </Tooltip>
          );
        }}
      />

      {isOuterChip && multiple && Array.isArray(selectedValue) && selectedValue.length > 0 && (
        <SxBox sx={inputAutocompleteChipsContainerStyles}>
          {(selectedValue as T[]).map((value, index) => {
            const label = getOptionLabel(value);

            const preparedDisabled =
              disabled ||
              (multipleOptions?.staticValues &&
                isOptionEqualToValue &&
                isStaticValue(value, multipleOptions.staticValues, isOptionEqualToValue));

            return (
              <DictionaryBadge
                key={getOptionIdentifier(value) ?? `${label}_${index}`}
                sx={inputAutocompleteChipItemStyles(viewFormat)}
                size={'sm'}
                component="Chip"
                code={label}
                name={label}
                disabled={preparedDisabled}
                onDelete={
                  preparedDisabled
                    ? undefined
                    : () => {
                        const next = (selectedValue as T[]).filter((v) => !isOptionEqualToValue(v, value));
                        onChangeCallback({} as never, next as never);
                      }
                }
              />
            );
          })}
        </SxBox>
      )}
    </SxBox>
  );
};

InputAutocompleteComponent.displayName = root;
export const InputAutocomplete = memo(InputAutocompleteComponent) as typeof InputAutocompleteComponent;
