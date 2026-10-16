import React, { memo, useContext } from 'react';
import { ColumnChooser } from '@devexpress/dx-react-grid-material-ui';

import { CheckboxListRow } from '@/components/molecules/CheckboxList';

import { ColumnVisibilityManagerContext } from '../ColumnVisibilityManagerPlugin.context';

export const ColumnChooserItem = memo(({ item, disabled }: ColumnChooser.ItemProps) => {
  const { onToggle, hiddenColumnNames } = useContext(ColumnVisibilityManagerContext);
  const isHidden = Boolean(hiddenColumnNames?.includes(item.column.name));
  return (
    <CheckboxListRow
      data-testid={`ColumnChooserItem_${item.column.name}`}
      key={item.column.name}
      label={item.column.title || ''}
      checked={!isHidden}
      checkboxSize="md"
      onChange={() => onToggle?.(item.column.name)}
      disabled={disabled}
      id={item.column.name}
    />
  );
});
ColumnChooserItem.displayName = 'ColumnChooserItem';
