import { NavigationSchema } from '@sber-ibp/core';

export const getBreadcrumbsRootCache = <RouteType extends string = string>(
  newRoutes?: NavigationSchema<RouteType>[],
): NavigationSchema<RouteType>[] => {
  newRoutes && localStorage.setItem('breadcrumbsRootCache', JSON.stringify(newRoutes));
  const currentRoutes = localStorage.getItem('breadcrumbsRootCache');
  return currentRoutes ? JSON.parse(currentRoutes) : [];
};
