import React from 'react';

import { IconName } from '@/components/atoms';

import { HoverStickOrientation, TableColorSchema } from '../Table';
import { RowDefinition } from '../TemplatedTable';

export interface RowHoverAction<RowDataType extends object> {
  icon: IconName;
  label: string;
  onClick?: (row: RowDefinition<RowDataType>) => void;
  isDisabled?: (row: RowDefinition<RowDataType>) => boolean;
  isHintTooltip?: boolean;
}

export interface RowHoverProps<RowDataType extends object> extends RowDefinition<RowDataType> {
  actions: RowHoverAction<RowDataType>[];
  rowColorSchema: TableColorSchema;
  stickTo?: HoverStickOrientation;
}

export interface RowHoverTemplateProps {
  colorSchema?: TableColorSchema;
  children: React.ReactNode;
  stickTo?: HoverStickOrientation;
}

export interface RowHoverUtilityProps<RowDataType extends object> {
  actions: RowHoverAction<RowDataType>[];
  items: RowDataType[];
  defaultColorSchema?: TableColorSchema;
  stickTo?: HoverStickOrientation;
}

export type TemplatedRowHoverUtilityProps<RowDataType extends object> = Omit<
  RowHoverUtilityProps<RowDataType>,
  'items'
>;
