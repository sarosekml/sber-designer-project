import React, { useCallback, useMemo } from 'react';

import { i18n } from '@sber-ibp/core';

import { Button, Grid } from '@/components/atoms';
import { FieldValues } from '@/components/molecules';

import { defaultFiltersModalLocalization } from './FiltersModal.consts';
import { FiltersModalProps } from './FiltersModal.types';

export const useFiltersModal = <Filter extends object, FormType extends FieldValues>(
  {
    onClear,
    onApplyFilters,
    formId,
    isClearing,
    isSubmitting,
    isValidationFailed,
    localization = defaultFiltersModalLocalization,
    enablePresets = false,
  }: FiltersModalProps<Filter, FormType>,
  openSavePresetModal: () => void,
) => {
  const localApplyFiltersTrigger = useCallback(() => null, []);

  const actions = useMemo(
    () => (
      <Grid display={'flex'} direction={'row'} justifyContent={'space-between'} width={'100%'}>
        {enablePresets ? (
          <Grid>
            <Button dataTestId={'SaveButton'} startIcon={'Save'} onClick={openSavePresetModal} type={'transparent'}>
              {i18n.t<string>('Save preset')}
            </Button>
          </Grid>
        ) : null}
        <Grid container gap={2} justifyContent={'flex-end'}>
          <Grid item>
            <Button dataTestId={'ClearButton'} onClick={onClear} type={'transparent'} hasLoader={isClearing}>
              {localization.clearFilter}
            </Button>
          </Grid>
          <Grid item>
            <Button
              htmlType={'submit'}
              form={formId}
              dataTestId={'SubmitButton'}
              onClick={onApplyFilters ?? localApplyFiltersTrigger}
              disabled={isValidationFailed}
              hasLoader={isSubmitting}
            >
              {localization.access}
            </Button>
          </Grid>
        </Grid>
      </Grid>
    ),
    [
      enablePresets,
      openSavePresetModal,
      onClear,
      isClearing,
      localization.clearFilter,
      localization.access,
      formId,
      onApplyFilters,
      localApplyFiltersTrigger,
      isValidationFailed,
      isSubmitting,
    ],
  );

  return {
    actions,
  };
};
