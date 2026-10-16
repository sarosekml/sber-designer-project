import { DraggableProvided } from 'react-beautiful-dnd';

import { FilterPreset } from '@sber-ibp/core';

import { DataTestIdProps } from '@/types';

export interface FilterPresetRowProps extends DataTestIdProps {
  draggableProvided: DraggableProvided;
  preset: FilterPreset<unknown>;
  filterPresets: FilterPreset<unknown>[];
  onDelete: () => void;
  onSave: (name: string) => void;
  index: number;
}
