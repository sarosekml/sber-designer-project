import { useCallback, useEffect, useMemo, useState } from 'react';

import { IsoDate } from '@sber-ibp/core';

import { BaseInputValidationOptions } from '../InternalComponents/BaseInput/BaseInput.types';

import {
  convertLocalDateToIso,
  convertStringToIsoDate,
  dateToIsoDate,
  dateToViewString,
} from './InputDateUtils/InputDate.utils';
import { incorrectDateMessageText } from './InputDate.const';
import { InputDateLang, InputDateProps } from './InputDate.types';

type Props = Pick<InputDateProps, 'value' | 'view' | 'onChange' | 'onClear'> & {
  locale: InputDateLang;
};

export const useInputDate = ({ value, locale, view, onChange, onClear }: Props) => {
  const [inputValue, setInputValue] = useState<IsoDate | null>(null);
  const [isError, setIsError] = useState<boolean>(false);

  const error: BaseInputValidationOptions | undefined = useMemo(
    () => (isError ? { message: incorrectDateMessageText[locale], type: 'error' } : undefined),
    [isError, locale],
  );

  useEffect(() => {
    setInputValue(convertStringToIsoDate(value));
  }, [value]);

  const onDatePickerChange = useCallback(
    (dateValue: Date | null) => {
      if (dateValue !== null) {
        const isoValue = dateToIsoDate(dateValue);
        const viewValue = dateToViewString(dateValue, locale, view, true);
        setInputValue(isoValue);
        setIsError(false);
        onChange && onChange(isoValue, viewValue);
      }
    },
    [locale, view, onChange],
  );

  const onInputChange = useCallback(
    (realValue, e) => {
      const value: IsoDate = e?.target.value;
      const isoDate = convertLocalDateToIso(value, locale);
      setInputValue(isoDate ?? value);
      setIsError(!isoDate);
      onChange && onChange(realValue, value);
    },
    [locale, onChange],
  );

  const onPressBackspace = useCallback((e) => {
    if (e?.code === 'Backspace' || e?.code === 'Delete') {
      const value: string = e?.target.value;
      const selectionStart = e.target.selectionStart;
      e.target.value = value.slice(0, selectionStart);
    }
  }, []);

  const handleClear = useCallback(() => {
    setInputValue(null);
    onClear && onClear();
  }, [onClear]);

  return { inputValue, error, onDatePickerChange, onInputChange, onPressBackspace, handleClear };
};
