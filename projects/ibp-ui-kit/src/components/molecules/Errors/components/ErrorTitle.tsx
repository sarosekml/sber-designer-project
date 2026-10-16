import React from 'react';

import { Grid } from '@/components/atoms';
import { Text } from '@/components/atoms/typography';
import { TextTypes } from '@/styles/theme/typography';

import { ErrorReason } from '../ErrorSection/ErrorSection.types';

const getReasonTitle = (reason: ErrorReason) => {
  if (reason === 'Forbidden') return 'Ресурс\nне\xa0доступен';
  if (reason === 'ServerFail') return 'Ошибка\nсервера';
  if (reason === 'FrontendFail') return 'Что-то пошло не\xa0так';
  if (reason === 'NothingHereYet') return 'Здесь пока ничего нет';
  return `Ресурс\nне\xa0найден`;
};

interface ErrorTitleProps {
  title?: string;
  reason: ErrorReason;
  textType: TextTypes;
  disabled?: boolean;
  isImageOnTop?: boolean;
}

export const ErrorTitle = ({ title, reason, textType, disabled, isImageOnTop }: ErrorTitleProps) => {
  const errorTitle = title ?? getReasonTitle(reason);
  return (
    <Grid item>
      <Text
        dataTestId={'Error_Title'}
        type={textType}
        sx={(theme) => ({
          color: disabled ? theme.palette.Disabled.Disabled : theme.palette.Text.TextPrimary,
          textTransform: isImageOnTop ? 'inherit' : 'uppercase',
        })}
        className="error__title"
      >
        {errorTitle}
      </Text>
    </Grid>
  );
};
