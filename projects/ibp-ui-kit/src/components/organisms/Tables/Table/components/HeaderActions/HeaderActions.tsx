import React, { memo, useCallback, useContext } from 'react';
import { TableHeaderRow as TableHeaderRowBase } from '@devexpress/dx-react-grid';

import { IconButton, IconName } from '@/components/atoms';

import { useCustomRender } from '../../hooks';
import { HeaderCellContext } from '../HeaderCell';

const sortIconMap: Record<'asc' | 'desc' | 'noDirection', IconName> = {
  asc: 'ArrowNarrowUp',
  desc: 'ArrowNarrowDown',
  noDirection: 'ArrowUpDown',
};

const SortingIcon = ({ direction, onSort, disabled }: Omit<TableHeaderRowBase.SortLabelProps, 'children'>) => {
  const onIconClick = useCallback(() => {
    if (direction === 'asc') return onSort({ direction: 'desc' });
    if (direction === 'desc') return onSort({ direction: null });
    return onSort({ direction: 'asc' });
  }, [direction, onSort]);

  return disabled ? null : (
    <IconButton size={'sm'} name={sortIconMap[direction || 'noDirection']} onClick={onIconClick} />
  );
};

export const HeaderActions = memo((props: TableHeaderRowBase.SortLabelProps) => {
  const { children, ...noChildrenProps } = props;
  const { getColumnFixedState, setFixedColumn, canFixColumns } = useContext(HeaderCellContext);
  const render = useCustomRender(props);

  const columnName = props.column.name as never;
  const isFixedLeft = getColumnFixedState?.(columnName) === 'left' && canFixColumns;

  return (
    <>
      {/*
        If we have sorting icon, then we should perform custom render here and
        render children to show the base content of HeaderCell
      */}
      {render ? render(props) : children}
      <SortingIcon {...noChildrenProps} />
      {canFixColumns && (
        <IconButton
          size={'sm'}
          name={isFixedLeft ? 'PinFilled' : 'Pin'}
          onClick={() => setFixedColumn?.(columnName, isFixedLeft ? undefined : 'left')}
          className={isFixedLeft ? 'PinIconButton-fixed' : 'PinIconButton'}
        />
      )}
    </>
  );
});

HeaderActions.displayName = 'HeaderActions';
