import React, { ReactNode, useMemo } from 'react';

import { emptyString, isEmpty } from '@sber-ibp/core';

import { Icon } from '@/components/atoms/Icon';
import { Loader } from '@/components/atoms/loaders';
import { SxBox } from '@/components/atoms/SxBox';
import { useTheme } from '@/styles/theme';

import { InputAutocompleteAsyncOptions } from '../InputAutocomplete.types';
import {
  inputAutocompleteOptionsIconContainerStyles,
  inputAutocompleteOptionsStateStyles,
} from '../InputAutocompleteStyles/InputAutocompleteOptions.styles';

const inputAutocompleteText = {
  isLoading: 'Поиск в справочнике',
  isEmptyValue: 'Ничего не найдено',
  isError: 'Не удалось загрузить данные',
  inputSomeSymbols: (count: number) => `Введите минимум ${count} символа(ов)`,
};

interface InputAutocompleteOptionsStateProps {
  imageComponent: ReactNode;
  text: string;
  color: string;
}

export const InputAutocompleteOptionsState = ({ imageComponent, text, color }: InputAutocompleteOptionsStateProps) => {
  const styles = useMemo(() => inputAutocompleteOptionsStateStyles(color), [color]);
  return (
    <SxBox sx={styles}>
      <SxBox sx={inputAutocompleteOptionsIconContainerStyles}>{imageComponent}</SxBox>
      <SxBox>{text}</SxBox>
    </SxBox>
  );
};
InputAutocompleteOptionsState.displayName = 'InputAutocompleteOptionsState';

interface ConstructNoOptionsTextProps<T> {
  options: T[];
  isError: boolean;
  isResponded: boolean;
  asyncOptions?: InputAutocompleteAsyncOptions<T>;
}

export const useConstructNoOptionsText = <T,>({
  options,
  isError,
  isResponded,
  asyncOptions,
}: ConstructNoOptionsTextProps<T>) => {
  const theme = useTheme();

  const emptyDataComponent = useMemo(
    () => (
      <InputAutocompleteOptionsState
        color={theme.palette.Text.TextPrimary}
        imageComponent={<Icon color={'primary'} name={'Blocked'} />}
        text={inputAutocompleteText.isEmptyValue}
      />
    ),
    [theme.palette.Text.TextPrimary],
  );

  if (!asyncOptions && isEmpty(options)) return emptyDataComponent;

  if (asyncOptions) {
    if (asyncOptions.isLoading) {
      return (
        <InputAutocompleteOptionsState
          color={theme.palette.Disabled.Disabled}
          imageComponent={<Loader color={'disabled'} size={'sm'} />}
          text={inputAutocompleteText.isLoading}
        />
      );
    }
    if (isError) {
      return (
        <InputAutocompleteOptionsState
          color={theme.palette.Text.TextPrimary}
          imageComponent={<Icon color={'error'} name={'AlertCircle'} />}
          text={inputAutocompleteText.isError}
        />
      );
    }
    if (isResponded && isEmpty(options)) return emptyDataComponent;
    return inputAutocompleteText.inputSomeSymbols(asyncOptions.minSearchCount ?? 3);
  }
  return emptyString;
};
