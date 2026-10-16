import React, { useEffect } from 'react';

import { BreadcrumbsNavigationData, CORE_CHANNEL_ID, CoreEvents, triggerEvent } from '@sber-ibp/core';

export const breadcrumbsTriggerComponent = <RouteType extends string = string>(
  schema: BreadcrumbsNavigationData<RouteType>,
): JSX.Element | null => {
  const Component = (): JSX.Element | null => {
    useEffect(() => {
      triggerEvent<CoreEvents, 'breadcrumbs'>(CORE_CHANNEL_ID, 'breadcrumbs', schema);
    }, []);
    return null;
  };

  return <Component />;
};
