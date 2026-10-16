import React, { memo, PropsWithChildren, useContext } from 'react';
import { Table } from '@devexpress/dx-react-grid-material-ui';

import { mergeRefs } from '@sber-ibp/core';

import { TableRowContext } from '../TableRow';

import { HoverContainer } from './HoverContainer';
import { useScrollRestoration } from './TableContainer.hooks';

const containerSx = { position: 'relative' };

export const TableContainer = memo((props: PropsWithChildren<any>) => {
  const { rowProps, tableCode } = useContext(TableRowContext);

  const { ref, handleScroll } = useScrollRestoration(props);

  return (
    <Table.Container
      {...props}
      forwardedRef={mergeRefs([props?.forwardedRef, ref])}
      onScroll={handleScroll}
      sx={containerSx}
    >
      {props.children}
      {rowProps?.hoverConfig ? <HoverContainer {...rowProps.hoverConfig} tableCode={tableCode} /> : null}
    </Table.Container>
  );
});

TableContainer.displayName = 'TableContainer';
