import * as React from 'react';
import { Table as TableMUI } from '@mui/material';

import { stickyTableStyles } from '@/components/organisms/Tables/Table/components/StickyTable/StickyTable.styles';
import { PropTypes } from '@/components/organisms/Tables/Table/components/StickyTable/StickyTable.types';

export const StickyTable = React.memo(({ children, className, forwardedRef, ...restProps }: PropTypes) => {
  return (
    <TableMUI
      sx={stickyTableStyles}
      ref={forwardedRef}
      stickyHeader
      aria-label="sticky table"
      className={className}
      {...restProps}
    >
      {children}
    </TableMUI>
  );
});
