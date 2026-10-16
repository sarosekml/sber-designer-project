import {
  BreadcrumbsNavigationData as CoreBreadcrumbsNavigationData,
  NavigationSchema as CoreNavigationSchema,
} from '@sber-ibp/core';

import { DataTestIdProps } from '@/types';
import { SxProps } from '@/utils';

export type NavigationSchema<RouteType extends string = string> = CoreNavigationSchema<RouteType>;

export interface BreadCrumbsProps<RouteType extends string = string> extends DataTestIdProps {
  navigationSchema: NavigationSchema<RouteType>[];
  onClickLink: (prop: string) => void;
  sx?: SxProps;
}

export type BreadcrumbsNavigationData<RouteType extends string = string> = CoreBreadcrumbsNavigationData<RouteType>;

export interface BreadcrumbsEvents<RouteType extends string = string> {
  breadcrumbs: BreadcrumbsNavigationData<RouteType>;
}
export type BreadcrumbsEventType<RouteType extends string = string> = keyof BreadcrumbsEvents<RouteType>;
