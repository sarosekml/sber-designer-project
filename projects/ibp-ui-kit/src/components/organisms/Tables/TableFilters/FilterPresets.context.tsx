import React, { createContext, useContext } from 'react';

import { FilterPreset } from '@sber-ibp/core';

export interface FilterPresetsContextData<Filter extends object> {
  presets?: FilterPreset<Filter>[];
  storePresets: (presets: FilterPreset<Filter>[]) => Promise<void>;
}

const createFilterPresetsContext = <Filter extends object>() => {
  const context = createContext<FilterPresetsContextData<Filter>>({ storePresets: (_presets) => Promise.resolve() });

  const FilterPresetsContextProvider = ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: FilterPresetsContextData<Filter>;
  }) => {
    return <context.Provider value={value}>{children}</context.Provider>;
  };

  const useFilterPresets = () => useContext(context);

  return { FilterPresetsContextProvider, useFilterPresets };
};
export const { FilterPresetsContextProvider, useFilterPresets } = createFilterPresetsContext();
