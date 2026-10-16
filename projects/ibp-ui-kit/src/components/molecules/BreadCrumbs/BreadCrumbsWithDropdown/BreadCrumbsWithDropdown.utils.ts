import { NavigationSchema } from '../BreadCrumbs.types';

type UseBreadCrumbsWithDropdownResult<RouteType extends string> = {
  head: NavigationSchema<RouteType>;
  dropdownItems: NavigationSchema<RouteType>[];
  tailItems: NavigationSchema<RouteType>[];
};

export const useBreadCrumbsWithDropdown = <RouteType extends string>(
  routes: NavigationSchema<RouteType>[],
): UseBreadCrumbsWithDropdownResult<RouteType> => {
  const [head, ...dropdownItems] = routes;
  const tailItems = dropdownItems.splice(dropdownItems.length - 2, 2);
  return {
    head,
    dropdownItems,
    tailItems,
  };
};
