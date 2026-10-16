import React from 'react';

import { DataTestIdProps, GridSizes } from '@/types';

export interface AlertStylesProps {
  hasTitle: boolean;
  isExpanded: boolean;
}

export type AlertSeverity = 'error' | 'info' | 'success' | 'warning';

export interface AlertProps extends DataTestIdProps {
  severity: AlertSeverity;
  title?: string;
  isOpen?: boolean;
  onClose?: () => void;
  expandable?: boolean;
  actions?: React.ReactNode;
  gridSizes?: GridSizes;
  isDisableStyleAlertText?: boolean;
  children?: React.ReactNode;
}
