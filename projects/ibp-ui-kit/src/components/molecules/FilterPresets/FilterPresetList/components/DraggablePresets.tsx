import React, { memo } from 'react';
import { Draggable } from 'react-beautiful-dnd';

import { FilterPreset } from '@sber-ibp/core';

import { FilterPresetRow } from '../../FilterPresetRow';

interface Props<Filter extends object> {
  onDelete: (index: number) => void;
  onRename: (newName: string, index: number) => void;
  presets?: FilterPreset<Filter>[];
}

export const DraggablePresetsComponent = <Filter extends object>({ onDelete, onRename, presets }: Props<Filter>) => {
  return presets?.map((preset, index) => (
    <Draggable draggableId={preset.objectId} index={index} key={`draggable_${preset.objectId}`}>
      {(draggableProvided) => (
        <FilterPresetRow
          key={`preset_${index}`}
          preset={preset}
          filterPresets={presets}
          onDelete={() => onDelete(index)}
          onSave={(name) => onRename(name, index)}
          draggableProvided={draggableProvided}
          index={index}
        />
      )}
    </Draggable>
  ));
};

const DraggablePresetsUntyped = memo(DraggablePresetsComponent);
DraggablePresetsUntyped.displayName = 'DraggablePresets';

export const DraggablePresets = DraggablePresetsUntyped as typeof DraggablePresetsComponent;
