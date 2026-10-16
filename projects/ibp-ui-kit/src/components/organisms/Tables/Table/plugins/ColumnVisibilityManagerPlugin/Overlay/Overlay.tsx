import React, { memo, useCallback, useContext, useEffect, useState } from 'react';
import { ColumnChooser } from '@devexpress/dx-react-grid-material-ui';
import { Box } from '@mui/material';

import { Button, Text, Tooltip } from '@/components/atoms';
import { Modal } from '@/components/molecules/Modal';
import { Sx } from '@/utils';

import { CheckboxTable } from '../../../components/CheckboxTable';
import { ColumnVisibilityManagerContext } from '../ColumnVisibilityManagerPlugin.context';

import { overlayText } from './Overlay.const';

const subtitleStyles: Sx = { my: 4 };

const actionsContainerSx: Sx = {
  display: 'flex',
  justifyContent: 'space-between',
  width: '100%',
};

const confirmActionsSx: Sx = {
  display: 'flex',
  gap: 2,
};

const ROOT = 'Overlay';

export const Overlay = memo((props: ColumnChooser.OverlayProps) => {
  const {
    isOverlayVisible,
    hiddenColumnNames,
    onCancelVisibilityChanges,
    onResetTableSettings,
    onSaveVisibilityChanges,
    onToggleAllVisibility,
  } = useContext(ColumnVisibilityManagerContext);

  const [isAllChecked, setIsAllChecked] = useState(hiddenColumnNames?.length === 0);

  const onToggleAll = useCallback(() => {
    if (!onToggleAllVisibility) return;
    onToggleAllVisibility();
    setIsAllChecked((prev) => !prev);
  }, [onToggleAllVisibility]);

  const onClose = useCallback(() => {
    onCancelVisibilityChanges?.();
  }, [onCancelVisibilityChanges]);

  useEffect(() => {
    setIsAllChecked(hiddenColumnNames?.length === 0);
  }, [hiddenColumnNames]);

  return (
    <Modal
      name={'ColumnsVisibility'}
      visible={!!isOverlayVisible}
      closeModal={onClose}
      title={overlayText['Table configuration']}
      width={450}
      actions={
        <Box sx={actionsContainerSx}>
          {onResetTableSettings ? (
            <Box>
              <Tooltip title={overlayText['Reset column visibility and order in the table']}>
                <Button
                  type={'transparent'}
                  dataTestId={'ResetTableSettings'}
                  onClick={onResetTableSettings}
                  startIcon={'Refresh'}
                >
                  {overlayText['Reset']}
                </Button>
              </Tooltip>
            </Box>
          ) : (
            <Box />
          )}
          <Box sx={confirmActionsSx}>
            <Button type={'transparent'} dataTestId={'Cancel'} onClick={onCancelVisibilityChanges}>
              {overlayText['Cancel']}
            </Button>
            <Button type={'accent'} dataTestId={'Confirm'} onClick={onSaveVisibilityChanges}>
              {overlayText['Apply']}
            </Button>
          </Box>
        </Box>
      }
    >
      <Text dataTestId={'Subtitle'} sx={subtitleStyles}>
        {overlayText['Please select which columns are visible']}
      </Text>
      <CheckboxTable
        title={overlayText['Select all']}
        isAllChecked={isAllChecked}
        data={props.children}
        onChangeAll={onToggleAll}
      />
    </Modal>
  );
});

Overlay.displayName = ROOT;
