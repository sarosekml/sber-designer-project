import React from 'react';

import { HoverConfig } from '../Table';
import { TemplatedHoverConfig } from '../TemplatedTable';

import { RowHover } from './RowHover';
import { RowHoverUtilityProps, TemplatedRowHoverUtilityProps } from './RowHover.types';

export const prepareTemplatedRowHover = <RowDataType extends object>({
  defaultColorSchema,
  stickTo,
  ...props
}: TemplatedRowHoverUtilityProps<RowDataType>): TemplatedHoverConfig<RowDataType> => ({
  render: (rowDefinition, rowColorSchema) => (
    <RowHover {...props} {...rowDefinition} rowColorSchema={rowColorSchema ?? defaultColorSchema} stickTo={stickTo} />
  ),
  stickTo,
});

export const prepareRowHover = <RowDataType extends object>({
  items,
  ...props
}: RowHoverUtilityProps<RowDataType>): HoverConfig<RowDataType> => {
  const { render, ...templatedHover } = prepareTemplatedRowHover(props);
  return {
    render: (_row, rowIndex, rowColorSchema) => {
      return render(
        {
          data: items[rowIndex],
          index: rowIndex,
        },
        rowColorSchema,
      );
    },
    ...templatedHover,
  };
};
