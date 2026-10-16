import { ReactNode } from 'react';

export interface RightColumnStylesProps {
  minColumnWidth: string;
}

export interface LeftColumnStylesProps {
  minColumnWidth: string;
  leftColumnWidth: string;
}

export interface SplitterProps {
  dataTestId?: string;
  leftColumn: NonNullable<ReactNode>;
  leftColumnWidth?: string;
  rightColumn: ReactNode;
  minColumnWidth?: string;
}
