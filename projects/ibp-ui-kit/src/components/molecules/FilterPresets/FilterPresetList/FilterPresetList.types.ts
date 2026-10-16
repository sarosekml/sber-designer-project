import { FilterPreset } from '@sber-ibp/core';

import { DataTestIdProps } from '@/types';

export interface FilterPresetListProps<Filter extends object> extends DataTestIdProps {
  presets?: FilterPreset<Filter>[];
  setInternalPresets: React.Dispatch<React.SetStateAction<FilterPreset<Filter>[] | undefined>>;
}
