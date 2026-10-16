import React from 'react';

import { EmptyCellPlaceholder } from '@/components/atoms';
import { InputDate, InputDateProps } from '@/components/molecules/Inputs';

/**
 * Util to return EmptyCellPlaceholder if date is empty
 * */
export const noEmptyDatePresenter = ({ value, ...props }: InputDateProps) =>
  value ? (
    <InputDate {...props} value={value} size={props.size ?? 'sm'} viewType={props.viewType ?? 'read'} />
  ) : (
    <EmptyCellPlaceholder />
  );
