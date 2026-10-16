export interface RouteData {
  name: string;
  pagePath: string;
  route: string;
}

export interface PageTabsProps<RouteKeys extends string> {
  dataTestId: string;
  tabList: string[];
  routeMap: Record<RouteKeys, RouteData>;

  /**
   * @example
   * import { hostRoutes } from 'tasks-app/routes';
   * <PageTabs {...args} locationPathname={hostRoutes.general.path} />
   */
  locationPathname: string;

  /**
   * @example
   * import { useNavigate } from 'react-router';
   * const navigate = useNavigate();
   * <PageTabs {...args} navigateCallback={navigate} />
   *
   * @example
   * // or use local util with path params
   * <PageTabs {...args} navigateCallback={navigate} navigateCallback={getNavigateCallback(navigate, { pathParam })}
   * // where getNavigateCallback.utils.ts is local util
   * import { NavigateFunction, Params, generatePath } from 'react-router';
   * export const getNavigateCallback = (navigate: NavigateFunction, params: Params<string> | undefined) => {
   *   return (currentRoute: string) => navigate(generatePath(currentRoute, params));
   * };
   *
   */
  navigateCallback: (route: string) => void;
}
