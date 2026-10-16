import React, { useState } from 'react';
import { yupResolver } from '@hookform/resolvers/yup/dist/yup';
import { useTheme } from '@mui/material';

import { FilterPreset } from '@sber-ibp/core';

import { Grid, IconButton, Text } from '@/components/atoms';
import { presetValidationSchema } from '@/utils';

import { FormHandler, InputTextFormHandler, useForm } from '../../Inputs';

import { getStyles } from './FilterPresetRow.styles';
import { FilterPresetRowProps } from './FilterPresetRow.types';

const root = 'FilterPresetRow';

export const FilterPresetRow = ({
  dataTestId,
  draggableProvided,
  onDelete,
  onSave,
  preset,
  index,
  filterPresets,
}: FilterPresetRowProps) => {
  const theme = useTheme();
  const testId = dataTestId ? `${root}_${dataTestId}_${index}` : `${root}_${index}`;
  const formId = `${root}Form_${index}`;

  const [internalName, setInternalName] = useState<string | null>(preset.name);
  const [isEditable, setEditable] = useState(false);

  const methods = useForm<Pick<FilterPreset<unknown>, 'name'>>({
    defaultValues: { name: preset.name },
    resolver: yupResolver(presetValidationSchema(filterPresets, preset)()),
    mode: 'onChange',
  });

  const handleEditMode = () => setEditable(true);

  const onSubmit = () => {
    if (!internalName) return;

    setEditable(false);
    onSave(internalName);
  };
  const handleSave = () => methods.handleSubmit(onSubmit)();

  const onChangeName = (value: string | null) => setInternalName(value);

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => event.key === 'Enter' && void handleSave();

  return (
    <Grid
      item
      container
      dataTestId={testId}
      sx={getStyles()}
      ref={draggableProvided.innerRef}
      {...draggableProvided.draggableProps}
    >
      <Grid
        item
        container
        columnGap={4}
        direction={'row'}
        width={'100%'}
        flexWrap={'nowrap'}
        alignItems={'center'}
        pt={2}
        pb={2}
      >
        <Grid
          item
          container
          sx={{ width: 'fit-content', p: 2.5 }}
          ref={draggableProvided.innerRef}
          {...draggableProvided.dragHandleProps}
        >
          <IconButton dataTestId={`${testId}_DragButton`} name={'DragDots'} size={'md'} sx={{ cursor: 'grab' }} />
        </Grid>
        <Grid item container gap={4} width={'100%'}>
          <FormHandler formId={formId} methods={methods} onSubmit={handleSave}>
            {isEditable ? (
              <InputTextFormHandler
                dataTestId={`${formId}_name`}
                size={'md'}
                viewType={'edit'}
                onClear={() => setInternalName(null)}
                onChange={onChangeName}
                name={'name'}
                onKeyDown={onKeyDown}
              />
            ) : (
              <Text dataTestId={`${testId}_name`} type={'BodyMReg'} color={theme.palette.Text.TextPrimary}>
                {internalName}
              </Text>
            )}
          </FormHandler>
        </Grid>
        <Grid item container direction={'row'} columnGap={4} sx={{ width: 'fit-content', p: 2.5 }} flexWrap={'nowrap'}>
          {isEditable ? (
            <IconButton
              dataTestId={`${testId}_SaveButton`}
              name={'Check'}
              size={'md'}
              onClick={() => void handleSave()}
            />
          ) : (
            <IconButton dataTestId={`${testId}_EditButton`} name={'Edit'} size={'md'} onClick={handleEditMode} />
          )}
          <IconButton dataTestId={`${testId}_DeleteButton`} name={'Trash'} size={'md'} onClick={onDelete} />
        </Grid>
      </Grid>
    </Grid>
  );
};
