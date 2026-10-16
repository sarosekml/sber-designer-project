import React, { useCallback } from 'react';
import { DragDropContext, Droppable, OnDragEndResponder } from 'react-beautiful-dnd';

import { Grid } from '@/components/atoms';

import { DraggablePresets } from './components';
import { FilterPresetListProps } from './FilterPresetList.types';
import { reorder } from './FilterPresetList.utils';

const root = 'FilterPresetList';

export const FilterPresetList = <Filter extends object>({
  dataTestId,
  presets,
  setInternalPresets,
}: FilterPresetListProps<Filter>) => {
  const testId = dataTestId ? `${root}_${dataTestId}` : root;

  const onDragEnd: OnDragEndResponder = (result) => {
    if (!presets) return;
    if (!result.destination || result.destination.index === result.source.index) return;

    const newPresets = reorder(presets, result.source.index, result.destination.index);
    setInternalPresets(newPresets);
  };

  const onRename = useCallback(
    (newName: string, index: number) => {
      if (!presets) return;

      const updatedPresets = [...presets];
      updatedPresets[index] = { ...updatedPresets[index], name: newName };

      setInternalPresets(updatedPresets);
    },
    [presets, setInternalPresets],
  );

  const onDelete = useCallback(
    (index: number) => {
      if (!presets) return;

      const updatedPresets = [...presets];
      updatedPresets.splice(index, 1);

      setInternalPresets(updatedPresets);
    },
    [presets, setInternalPresets],
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId={root}>
        {(provided) => (
          <Grid
            item
            container
            dataTestId={testId}
            direction={'column'}
            rowGap={1}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            <DraggablePresets onDelete={onDelete} onRename={onRename} presets={presets} />
            {provided.placeholder}
          </Grid>
        )}
      </Droppable>
    </DragDropContext>
  );
};
