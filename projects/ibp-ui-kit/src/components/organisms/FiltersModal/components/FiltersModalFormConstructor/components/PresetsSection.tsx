import React from 'react';

import { FilterPreset, i18n } from '@sber-ibp/core';

import { Button, Grid, Text } from '@/components/atoms';
import { InputAutocomplete } from '@/components/molecules';
import { InputAutocompleteInternalValueType } from '@/components/molecules/Inputs/InputAutocomplete/InputAutocomplete.types';
import { DataTestIdProps } from '@/types';

interface Props<Filter extends object> extends DataTestIdProps {
  fieldsSpacing?: number;
  onChangeCurrentPreset: (value: InputAutocompleteInternalValueType<FilterPreset<Filter>, false> | null) => void;
  openEditPresetsModal: () => void;
  preset: FilterPreset<Filter> | null;
  presetOptions?: FilterPreset<Filter>[];
}

const root = 'PresetsSection';

export const PresetsSection = <Filter extends object>({
  dataTestId,
  fieldsSpacing,
  onChangeCurrentPreset,
  openEditPresetsModal,
  preset,
  presetOptions,
}: Props<Filter>) => {
  return (
    <Grid container key={`${dataTestId}_${root}`} spacing={fieldsSpacing} mb={8}>
      <Grid item xs={12}>
        <Text dataTestId={`${dataTestId}_${root}_title`} type={'BodyMStrongSmb'}>
          {i18n.t<string>('Preset')}
        </Text>
      </Grid>
      <Grid item container width={'100%'} flexWrap={'nowrap'} gap={4} pt={4}>
        <Grid width={'100%'}>
          <InputAutocomplete
            dataTestId={`${dataTestId}_${root}`}
            getOptionLabel={(option) => option.name}
            viewFormat={'text'}
            value={preset}
            size={'md'}
            helperText={i18n.t<string>('The preset will be reset when the filter parameters are changed')}
            options={presetOptions}
            onChange={onChangeCurrentPreset}
          />
        </Grid>
        <Grid>
          <Button
            dataTestId={'EditPresetsButton'}
            startIcon={'Edit'}
            type={'outlined'}
            onClick={openEditPresetsModal}
          />
        </Grid>
      </Grid>
    </Grid>
  );
};
