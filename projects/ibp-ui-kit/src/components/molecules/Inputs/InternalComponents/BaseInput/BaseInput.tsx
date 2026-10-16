import React, { memo, useMemo } from 'react';
import { TextField } from '@mui/material';

import { SxBox } from '@/components/atoms/SxBox';
import { Tooltip } from '@/components/atoms/Tooltip';
import { mergeSx } from '@/utils';

import { BaseInputEndActions } from './BaseInputComponents/BaseInputEndActions';
import { BaseInputHelperText } from './BaseInputComponents/BaseInputHelperText';
import { BaseInputLabel } from './BaseInputComponents/BaseInputLabel';
import { BaseInputRead } from './BaseInputComponents/BaseInputRead';
import { BaseInputStartActions } from './BaseInputComponents/BaseInputStartActions';
import { baseInputStyles } from './BaseInputStyles/BaseInput.styles';
import { BaseInputProps } from './BaseInput.types';
import { useTooltipErrorOptions } from './BaseInput.utils';
import { useBaseInput } from './useBaseInput';

const root = 'BaseInput';

export const BaseInput = memo(
  ({
    value,
    label,
    name,
    labelOptions,
    placeholder,
    disabled,
    size = 'md',
    prefix,
    postfix,
    onClear = undefined,
    onInfo = undefined,
    helperText,
    onChange,
    onKeyDown,
    multiline,
    rows,
    minRows,
    maxRows,
    viewType = 'edit',
    infoOptions,
    dataTestId,
    validationOptions,
    isColoredBg,
    startAction,
    endAction,
    inputRef,
    autoFocus,
    textColor,
    maxLength,
    errorTooltip,
    sx,
  }: BaseInputProps) => {
    const isValidation = !!validationOptions;
    const isEditable = viewType === 'edit';
    const { focused, onFocus, onBlur, onMouseLeave, onMouseEnter, hovered } = useBaseInput({ autoFocus });

    const styles = mergeSx(
      baseInputStyles({ size, disabled, focused, validationOptions, isColoredBg, textColor, multiline }),
      sx,
    );
    const tooltipErrorOptions = useTooltipErrorOptions(
      validationOptions,
      !disabled && (hovered || focused),
      errorTooltip?.placement,
    );

    /** Edit view */
    const baseInputEditWithToolTip = useMemo(() => {
      return (
        <SxBox width={'100%'}>
          <Tooltip {...tooltipErrorOptions}>
            <TextField
              autoFocus={autoFocus}
              name={name}
              data-testid={dataTestId ? root + '_' + dataTestId : root}
              fullWidth
              onFocus={onFocus}
              onBlur={onBlur}
              disabled={disabled}
              sx={styles}
              label={
                <BaseInputLabel
                  label={label}
                  labelOptions={labelOptions}
                  dataTestId={dataTestId}
                  disabled={disabled}
                  value={value}
                  maxLength={maxLength}
                />
              }
              placeholder={placeholder}
              value={value}
              InputProps={{
                startAdornment: (
                  <BaseInputStartActions
                    size={size}
                    disabled={disabled}
                    startAction={startAction}
                    prefix={prefix}
                    dataTestId={dataTestId}
                  />
                ),
                endAdornment: (
                  <BaseInputEndActions
                    size={size}
                    disabled={disabled}
                    onClear={onClear}
                    onInfo={onInfo}
                    postfix={postfix}
                    endAction={endAction}
                    infoOptions={infoOptions}
                    dataTestId={dataTestId}
                    value={value}
                  />
                ),
              }}
              inputProps={{ maxLength }}
              inputRef={inputRef}
              onChange={onChange}
              onKeyDown={onKeyDown}
              helperText={undefined}
              multiline={multiline}
              rows={rows}
              minRows={minRows}
              maxRows={maxRows}
              onMouseEnter={isValidation ? onMouseEnter : undefined}
              onMouseLeave={isValidation ? onMouseLeave : undefined}
            />
          </Tooltip>
          <BaseInputHelperText helperText={helperText} dataTestId={dataTestId} />
        </SxBox>
      );
    }, [
      tooltipErrorOptions,
      name,
      dataTestId,
      onFocus,
      onBlur,
      disabled,
      styles,
      label,
      labelOptions,
      placeholder,
      value,
      size,
      startAction,
      prefix,
      onClear,
      onInfo,
      postfix,
      infoOptions,
      inputRef,
      onChange,
      onKeyDown,
      multiline,
      isValidation,
      onMouseEnter,
      onMouseLeave,
      helperText,
      rows,
      minRows,
      maxRows,
      autoFocus,
    ]);

    return isEditable ? (
      baseInputEditWithToolTip
    ) : (
      <BaseInputRead
        value={value}
        label={label}
        labelOptions={labelOptions}
        disabled={disabled}
        size={size}
        prefix={prefix}
        postfix={postfix}
        helperText={helperText}
        viewType={viewType}
        dataTestId={dataTestId}
        validationOptions={validationOptions}
        onMouseLeave={onMouseLeave}
        onMouseEnter={onMouseEnter}
        tooltipErrorOptions={tooltipErrorOptions}
        multiline={multiline}
        rows={rows}
        textColor={textColor}
        sx={sx}
      />
    );
  },
);

BaseInput.displayName = 'BaseInput';
