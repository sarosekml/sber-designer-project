import React, { memo, useCallback, useEffect, useMemo } from 'react';

import { Tab } from '@/components/atoms/Tab';

import { TabsGroup } from '../Tabs/TabsGroup/TabsGroup';

import { PageTabsProps } from './PageTabs.types';

const PageTabsComponent = <RouteKeys extends string>({
  tabList,
  dataTestId,
  locationPathname,
  navigateCallback,
  routeMap,
}: PageTabsProps<RouteKeys>) => {
  const getRouteByLocation = useCallback(
    (pathname: string) => {
      const key = Object.keys(routeMap).find((item) => routeMap[item as RouteKeys].pagePath === pathname);
      return { key, route: routeMap[key as RouteKeys] };
    },
    [routeMap],
  );
  const currentRoute = useMemo(() => getRouteByLocation(locationPathname), [getRouteByLocation, locationPathname]);

  useEffect(() => {
    if (!currentRoute || !currentRoute.route) return;
    navigateCallback(currentRoute.route.pagePath);
  }, [currentRoute, locationPathname]);

  const tabHandler = useCallback(
    (_event: React.ChangeEvent<object>, value: string) => {
      navigateCallback(routeMap[value as RouteKeys].pagePath);
    },
    [navigateCallback, routeMap],
  );

  return (
    <TabsGroup value={currentRoute.key ?? ''} onChange={tabHandler} dataTestId={dataTestId}>
      {tabList.map((it, index) => {
        const label = routeMap[it as RouteKeys] ? routeMap[it as RouteKeys].name : '';
        return <Tab dataTestId={`${it}_${index}`} key={it} label={label} value={it} />;
      })}
    </TabsGroup>
  );
};

export const PageTabs = memo(PageTabsComponent);
PageTabs.displayName = 'PageTabs';
