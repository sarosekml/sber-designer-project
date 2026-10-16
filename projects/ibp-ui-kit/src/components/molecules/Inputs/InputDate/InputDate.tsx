import React, { memo, useMemo } from 'react';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { SxBox } from '@/components/atoms/SxBox';

import { BaseInputActionOptions } from '../InternalComponents/BaseInput/BaseInput.types';
import { InputDecoratedText } from '../InternalComponents/InputDecoratedText/InputDecoratedText';

import { datePlaceholder, localeMap } from './InputDate.const';
import { inputDateStyles } from './InputDate.styles';
import { InputDateProps } from './InputDate.types';
import { getInputDateDecorator } from './InputDateDecorator';
import { calculateYearInterval } from './InputDateUtils';
import { useInputDate } from './useInputDate';

const root = 'InputDate';
const propertyProps = {
  sx: inputDateStyles,
};

export const InputDate = memo(
  ({
    autoFocus,
    label = '',
    helperText,
    isColoredBg,
    name,
    value,
    viewType = 'edit',
    locale = 'ru',
    size = 'md',
    disabled,
    dataTestId,
    view,
    infoOptions,
    onChange,
    onClear,
    onInfo,
    strictCheck,
    labelOptions,
    prefix,
    postfix,
    validationOptions,
    textColor,
    sx,
  }: InputDateProps) => {
    const { inputValue, error, onDatePickerChange, onInputChange, onPressBackspace, handleClear } = useInputDate({
      value,
      locale,
      view,
      onChange,
      onClear,
    });

    const decorator = useMemo(() => getInputDateDecorator(locale, view, strictCheck), [locale, strictCheck, view]);
    const langLocale = localeMap[locale];
    const placeholder = datePlaceholder[locale];

    const [minDate, maxDate] = useMemo(() => calculateYearInterval(), []);

    return (
      <SxBox data-testid={dataTestId ? root + '_' + dataTestId : root} width={'100%'}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={langLocale}>
          <DatePicker
            views={view ? [view] : undefined}
            value={inputValue}
            disabled={disabled}
            minDate={minDate}
            maxDate={maxDate}
            onChange={onDatePickerChange}
            PopperProps={propertyProps}
            renderInput={(params) => {
              const onClick = (params.InputProps?.endAdornment as any)?.props?.children?.props?.onClick;
              const endAction: BaseInputActionOptions = {
                iconName: 'Calendar',
                onStartAction: onClick,
              };

              return (
                <InputDecoratedText
                  autoFocus={autoFocus}
                  name={name}
                  viewType={viewType}
                  helperText={helperText}
                  isColoredBg={isColoredBg}
                  decorator={decorator}
                  value={inputValue}
                  placeholder={placeholder}
                  onChange={onInputChange}
                  dataTestId={dataTestId}
                  inputRef={params?.inputRef}
                  label={label}
                  labelOptions={labelOptions}
                  size={size}
                  disabled={disabled}
                  onClear={inputValue ? handleClear : undefined}
                  onInfo={onInfo}
                  infoOptions={infoOptions}
                  prefix={prefix}
                  postfix={postfix}
                  endAction={endAction}
                  validationOptions={validationOptions ?? error}
                  onKeyDown={strictCheck ? onPressBackspace : undefined}
                  textColor={textColor}
                  sx={sx}
                />
              );
            }}
          />
        </LocalizationProvider>
      </SxBox>
    );
  },
);

InputDate.displayName = root;
