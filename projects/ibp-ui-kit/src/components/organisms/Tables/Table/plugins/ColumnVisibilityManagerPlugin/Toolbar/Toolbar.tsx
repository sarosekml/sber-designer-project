import React, { memo } from 'react';
import { Toolbar as ToolbarBase } from '@devexpress/dx-react-grid';

import { SxBox } from '@/components/atoms/SxBox';
import { Sx } from '@/utils';

import { TableTestKeys } from '../../../Table.const';

export const toolbarStyles: Sx = {
  height: '0',
  width: '100%',
  position: 'relative',
};

export const Toolbar = memo((props: ToolbarBase.RootProps) => (
  <SxBox sx={toolbarStyles} data-testid={`${TableTestKeys.columnChooserKey}_${TableTestKeys.toolbarKey}`}>
    {props.children}
  </SxBox>
));
