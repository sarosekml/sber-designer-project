import { createContext } from 'react';

import { TableMessages } from '@/index';

export interface ColumnVisibilityManagerContextData {
  messages?: TableMessages;
  hiddenColumnNames?: string[];
  actualHiddenColumnNames?: string[];
  isOverlayVisible?: boolean;
  onCancelVisibilityChanges?: () => void;
  order?: string[];
  onResetTableSettings?: () => void;
  onSaveVisibilityChanges?: () => void;
  onToggle?: (columnName: string) => void;
  onToggleAllVisibility?: () => void;
  openVisibilitySettings?: () => void;
  setHiddenColumnNames?: (newState: string[]) => void;
}

export const ColumnVisibilityManagerContext = createContext<ColumnVisibilityManagerContextData>({});
