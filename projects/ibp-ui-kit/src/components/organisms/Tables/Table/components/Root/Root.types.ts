import { Grid as DEGrid } from '@devexpress/dx-react-grid-material-ui';
import React from 'react';

export interface GridRootProps extends DEGrid.RootProps {
  className?: string;
  style?: React.CSSProperties;
}
