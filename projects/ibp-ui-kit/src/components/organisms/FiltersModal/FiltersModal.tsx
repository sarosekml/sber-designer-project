import React, { memo, useMemo } from 'react';

import { emptyArray, i18n, isEmpty } from '@sber-ibp/core';

import { Button, ContextMenuButton, ContextMenuItem, Grid, SxBox } from '@/components/atoms';
import { ButtonGroup } from '@/components/atoms/buttons/ButtonGroup';
import { FieldValues, Modal } from '@/components/molecules';
import { mergeSx } from '@/utils';

import { useFilterPresets } from '../Tables/TableFilters/FilterPresets.context';
import { getStaticFilters } from '../Tables/TableFilters/TableFilters.utils';
import { useTable } from '../Tables/utils';

import { SavePresetModal, useSavePresetModalVisibleController } from './components/SavePresetModal';
import { defaultFiltersModalLocalization } from './FiltersModal.consts';
import { buttonGroupStyles, filterModalStyles } from './FiltersModal.styles';
import { FiltersModalProps } from './FiltersModal.types';
import { useFiltersModal } from './useFiltersModal';

const root = 'FiltersModal';

export const FiltersModalComponent = <Filter extends object, FormType extends FieldValues>(
  props: FiltersModalProps<Filter, FormType>,
) => {
  const {
    closeModal: closeSavePresetModal,
    openModal: openSavePresetModal,
    visible: visibleSavePresetModal,
  } = useSavePresetModalVisibleController();

  const { actions } = useFiltersModal(props, openSavePresetModal);
  const {
    onOpenModal,
    disabled,
    title,
    formId,
    closeModal,
    visible,
    width,
    height,
    contentSx,
    actionsJustify,
    children,
    fullScreen,
    localization = defaultFiltersModalLocalization,
    enablePresets = false,
    staticFilterKeys,
    filterFormMethods,
    formToDto,
  } = props;

  const { presets, storePresets } = useFilterPresets();

  const filterButton = (
    <Button
      size={'xs'}
      type={'outlined'}
      startIcon={'Filter'}
      onClick={onOpenModal}
      dataTestId={'OpenFilterButton'}
      color={'primary'}
      disabled={disabled}
    >
      {localization.filter}
    </Button>
  );

  const { tableState, controller } = useTable<never, Filter>(formId);

  const presetContextMenuItems = useMemo(() => {
    const settingsItem: ContextMenuItem = {
      value: i18n.t<string>('Setting up presets'),
      action: props.openEditPresetsModal,
      selected: false,
    };

    if (!presets || isEmpty(presets)) return [settingsItem];
    return [
      ...presets.map(
        (preset): ContextMenuItem => ({
          value: preset.name,
          action: () => {
            const updatedPresets =
              presets?.map((item) => {
                return item.objectId === preset.objectId ? { ...item, active: true } : { ...item, active: false };
              }) ?? emptyArray;

            if (staticFilterKeys?.length) {
              const staticFilters = getStaticFilters(staticFilterKeys, tableState?.filters);
              controller.setFilters({ ...preset.filters, ...staticFilters });
              void storePresets(updatedPresets);
            } else {
              controller.setFilters(preset.filters as Filter);
            }
          },
          selected: preset.active,
        }),
      ),
      settingsItem,
    ];
  }, [controller, presets, props.openEditPresetsModal, storePresets, staticFilterKeys, tableState?.filters]);

  return (
    <>
      <Grid pl={1}>
        {enablePresets && !isEmpty(presets) ? (
          <SxBox sx={buttonGroupStyles}>
            <ButtonGroup disabled={disabled} size={'xs'} type={'outlined'} color={'primary'}>
              {filterButton}
              <ContextMenuButton
                dataTestId={'filterPresets'}
                icon={'ChevronDown'}
                items={presetContextMenuItems ?? emptyArray}
                onSelectItem={(item) => item.action?.()}
                viewType={'button'}
                anchorMenu={{ vertical: 'bottom', horizontal: 'left' }}
                transformMenu={{ vertical: 'top', horizontal: 'center' }}
                isSelectedShown
              />
            </ButtonGroup>
          </SxBox>
        ) : (
          filterButton
        )}
      </Grid>

      <Modal
        title={title ?? localization.title}
        name={formId}
        closeModal={closeModal}
        visible={visible}
        height={height}
        actions={actions}
        contentSx={mergeSx(filterModalStyles, contentSx)}
        width={width}
        fullScreen={fullScreen}
        actionsJustify={actionsJustify}
      >
        {children}
      </Modal>

      <SavePresetModal
        visible={visibleSavePresetModal}
        closeModal={closeSavePresetModal}
        filterFormMethods={filterFormMethods}
        formToDto={formToDto}
      />
    </>
  );
};

FiltersModalComponent.displayName = root;
export const FiltersModal = memo(FiltersModalComponent) as typeof FiltersModalComponent;
