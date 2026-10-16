import { ReactNode } from 'react';

import { Dictionary } from '@sber-ibp/core';

import { DataTestIdProps } from '@/types';

type MinimalDesk = Dictionary & { departmentCode?: string };

export interface UserProfileType {
  firstName: string;
  lastName: string;
  position: string;
  desks: MinimalDesk[];
}

export interface UserProfileProps extends DataTestIdProps {
  userProfile: UserProfileType;
  languageComponent?: ReactNode;
  logoutComponent?: ReactNode;
  onAvatarClick?: () => void;
  isOpen: boolean;
  onUserProfileClick?: () => void;
}
