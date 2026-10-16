import React, { memo, useContext } from 'react';
import { Plugin } from '@devexpress/dx-react-core';
import { ColumnChooser, TableColumnVisibility, Toolbar } from '@devexpress/dx-react-grid-material-ui';

import { defaultTableMessage } from '../../TableProps/useTableProps';

import { ColumnChooserContainer } from './ColumnChooserContainer';
import { ColumnChooserItem } from './ColumnChooserItem';
import { ColumnVisibilityManagerContext } from './ColumnVisibilityManagerPlugin.context';
import { Overlay } from './Overlay';
import { ToggleButtonComponent } from './ToggleButtonComponent';
import { Toolbar as ToolbarComponent } from './Toolbar';

const ROOT = 'ColumnVisibilityManagerPlugin';

/**
 * Column Manager plugin provides a functionality for managing columns visibility.
 * By default it immediately applies changes, so we use context to substitute and emulate some
 * states of the plugin.
 */
export const ColumnVisibilityManagerPlugin = memo(() => {
  const { actualHiddenColumnNames, order, setHiddenColumnNames, messages } = useContext(ColumnVisibilityManagerContext);
  return (
    <Plugin>
      <TableColumnVisibility
        messages={{ noColumns: messages?.noColumns ?? defaultTableMessage.noColumns }}
        hiddenColumnNames={actualHiddenColumnNames}
        onHiddenColumnNamesChange={setHiddenColumnNames}
        defaultHiddenColumnNames={order}
      />
      <Toolbar rootComponent={ToolbarComponent} />
      <ColumnChooser
        toggleButtonComponent={ToggleButtonComponent}
        overlayComponent={Overlay}
        containerComponent={ColumnChooserContainer}
        itemComponent={ColumnChooserItem}
      />
    </Plugin>
  );
});

ColumnVisibilityManagerPlugin.displayName = ROOT;
