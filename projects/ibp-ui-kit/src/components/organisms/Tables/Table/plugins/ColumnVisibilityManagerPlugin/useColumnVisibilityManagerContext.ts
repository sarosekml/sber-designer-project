import { useCallback, useEffect, useMemo, useState } from 'react';
import { TableColumnVisibilityProps } from '@devexpress/dx-react-grid';

import { Column, ColumnName, TableMessages } from '../../TableProps';

export interface ColumnVisibilityContextProps<RowType extends object>
  extends Required<Pick<TableColumnVisibilityProps, 'onHiddenColumnNamesChange'>> {
  columns: Column<RowType>[];
  hiddenColumnNames: ColumnName<RowType>[];
  order: ColumnName<RowType>[];
  messages: TableMessages;
  onResetTableSettings?: () => void;
}

/**
 * We use context in the ColumnVisibilityManagerPlugin to pass temporary state in the
 * component so we have our own hiddenColumnNames state which is not applied to the real columns state,
 * and we use hiddenColumns set which is passed to the context to check if checkbox
 * is checked or not, to disallow immediate state propagation and apply state only
 * in response to submit button click.
 */
export const useColumnVisibilityManagerContext = <RowType extends object>({
  columns,
  onHiddenColumnNamesChange,
  hiddenColumnNames: actualHiddenColumnNames,
  order,
  messages,
  onResetTableSettings,
}: ColumnVisibilityContextProps<RowType>) => {
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [hiddenColumnNames, setHiddenColumnNames] = useState<string[]>(actualHiddenColumnNames);
  const hiddenColumns = useMemo(() => new Set<string>(hiddenColumnNames), [hiddenColumnNames]);

  const openVisibilitySettings = useCallback(() => {
    setIsOverlayVisible(true);
  }, []);

  const onApplyVisibilityChanges = useCallback(() => {
    onHiddenColumnNamesChange(hiddenColumnNames);
    setIsOverlayVisible(false);
  }, [hiddenColumnNames, onHiddenColumnNamesChange]);

  const onToggle = useCallback(
    (columnName: string) => {
      if (hiddenColumns.has(columnName)) {
        hiddenColumns.delete(columnName);
      } else {
        hiddenColumns.add(columnName);
      }
      setHiddenColumnNames(Array.from(hiddenColumns));
    },
    [hiddenColumns],
  );

  const onToggleAllVisibility = useCallback(() => {
    const newHidden = hiddenColumnNames.length === 0 ? columns.map((it) => it.name) : [];
    setHiddenColumnNames(newHidden);
  }, [hiddenColumnNames, columns]);

  const onCancelVisibilityChanges = useCallback(() => {
    setHiddenColumnNames(actualHiddenColumnNames);
    setIsOverlayVisible(false);
  }, [actualHiddenColumnNames]);

  useEffect(() => {
    if (actualHiddenColumnNames !== hiddenColumnNames) {
      setHiddenColumnNames(actualHiddenColumnNames);
    }
  }, [actualHiddenColumnNames]);

  return useMemo(
    () => ({
      actualHiddenColumnNames,
      hiddenColumnNames,
      hiddenColumns,
      isOverlayVisible,
      messages,
      onCancelVisibilityChanges,
      onResetTableSettings,
      onSaveVisibilityChanges: onApplyVisibilityChanges,
      onToggle,
      onToggleAllVisibility,
      openVisibilitySettings,
      order,
      setHiddenColumnNames,
    }),
    [
      actualHiddenColumnNames,
      hiddenColumnNames,
      hiddenColumns,
      isOverlayVisible,
      messages,
      onApplyVisibilityChanges,
      onCancelVisibilityChanges,
      onResetTableSettings,
      onToggle,
      onToggleAllVisibility,
      openVisibilitySettings,
      order,
      setHiddenColumnNames,
    ],
  );
};
