import React, { useEffect, useState } from 'react';
import { useTheme } from '@mui/material';

import { emptyArray, i18n, isEmpty } from '@sber-ibp/core';

import { Button, Grid, Text } from '@/components/atoms';
import { FilterPresetList, Modal, ModalProps } from '@/components/molecules';
import { TableFilterModalProps } from '@/components/organisms/Tables';
import { useFilterPresets } from '@/components/organisms/Tables/TableFilters/FilterPresets.context';
import { useClearAllFilters } from '@/components/organisms/Tables/TableFilters/TableFilterModal/useClearAllFilters';

export type EditPresetsModalProps<Filter extends object> = Pick<ModalProps, 'closeModal' | 'visible'> & {
  tableCode: string;
} & Pick<
    TableFilterModalProps<Filter, never>,
    'emptyFilter' | 'onCustomClearFilters' | 'staticFilterKeys' | 'tableCode'
  >;

const root = 'EditPresetsModal';

export const EditPresetsModal = <Filter extends object>({
  visible,
  closeModal,
  tableCode,
  ...props
}: EditPresetsModalProps<Filter>) => {
  const theme = useTheme();

  const { presets, storePresets } = useFilterPresets();

  const [internalPresets, setInternalPresets] = useState(presets);

  const clearAllFilters = useClearAllFilters({ tableCode, ...props });

  useEffect(() => setInternalPresets(presets), [presets]);

  const onSave = () => {
    const prevStateActivePreset = presets?.find((item) => item.active);
    const isRemovedActivePreset = prevStateActivePreset
      ? !internalPresets?.find((item) => item.objectId === prevStateActivePreset.objectId)
      : false;
    if (isRemovedActivePreset) clearAllFilters();
    void storePresets(internalPresets ?? emptyArray);

    closeModal?.();
  };

  const actions: React.ReactNode = (
    <Button type={'accent'} onClick={onSave}>
      {i18n.t<string>('Save')}
    </Button>
  );

  return (
    <Modal
      title={i18n.t<string>('Setting up presets')}
      name={root}
      closeModal={closeModal}
      visible={visible}
      actions={actions}
      width={900}
      useTopPadding
    >
      {isEmpty(internalPresets) || !internalPresets ? (
        <Grid display={'flex'} p={7} justifyContent={'center'}>
          <Text type={'BodyLReg'} color={theme.palette.Text.TextSecondary}>
            {i18n.t<string>('No saved presets')}
          </Text>
        </Grid>
      ) : (
        <FilterPresetList presets={internalPresets} setInternalPresets={setInternalPresets} />
      )}
    </Modal>
  );
};
