import { ElementType, ReactNode } from 'react';

import { DataTestIdProps } from '@/types';

import { IconName } from '../../atoms';
import { UserProfileType } from '../../molecules';

import { NavItemProps } from './NavItem';

type NavItem = Pick<NavItemProps, 'text' | 'iconCoveredElement' | 'postfixElement' | 'disabled'>;

interface BaseNavigationItem extends NavItem, DataTestIdProps {
  access: boolean;
  icon: IconName;
  compartment?: string;
  onClick?: () => void;
}

export interface NavigationItem extends BaseNavigationItem {
  external?: boolean;
  route: string;
}

export interface InteractionItem extends BaseNavigationItem {
  /**
   * The custom callback which is performed instead of navigation
   * action. The return result defines whether to close or not
   * navigation menu after callback execution (If `true` then menu will stay opened).
   */
  onClickInteraction: () => boolean | void;
}

export type CombinedItem = NavigationItem | InteractionItem;

export type NavigationItemsType = {
  compartment: string;
  items: Array<CombinedItem>;
};

export interface NavigationProps extends DataTestIdProps {
  items: Array<NavigationItemsType>;
  userProfile?: Partial<UserProfileType>;
  localLinkComponent: ElementType;
  externalLinkComponent?: ElementType;
  languageComponent?: ReactNode;
  logoutComponent?: ReactNode;
  onUserProfileClick?: () => void;
}
