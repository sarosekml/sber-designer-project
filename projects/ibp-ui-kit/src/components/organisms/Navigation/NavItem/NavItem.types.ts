import { ElementType, ReactNode } from 'react';

import { DataTestIdProps } from '@/types';

import { IconName } from '../../../atoms';

export interface NavItemProps extends DataTestIdProps {
  linkComponent: ElementType;
  opened: boolean;
  icon?: IconName;
  iconCoveredElement?: ReactNode;
  postfixElement?: ReactNode;
  text: string;
  route?: string;
  disabled?: boolean;
  onClick: () => void;
}
