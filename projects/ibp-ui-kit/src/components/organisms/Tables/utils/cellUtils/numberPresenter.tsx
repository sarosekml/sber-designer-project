import React from 'react';

import { EmptyCellPlaceholder } from '@/components/atoms';
import { InputNumber, InputNumberProps } from '@/components/molecules/Inputs';

/**
 * Util to return EmptyCellPlaceholder if value is empty
 * */
export const noEmptyNumberPresenter = ({ value, ...props }: InputNumberProps) =>
  typeof value === 'number' ? (
    <InputNumber {...props} value={value} size={props.size ?? 'sm'} viewType={props.viewType ?? 'read'} />
  ) : (
    <EmptyCellPlaceholder />
  );
