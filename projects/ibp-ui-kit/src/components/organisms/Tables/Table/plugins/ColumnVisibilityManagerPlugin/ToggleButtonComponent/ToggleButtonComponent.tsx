import React, { memo, useContext } from 'react';
import { ColumnChooser } from '@devexpress/dx-react-grid-material-ui';

import { IconButton } from '@/components/atoms';

import { TableTestKeys } from '../../../Table.const';
import { ColumnVisibilityManagerContext } from '../ColumnVisibilityManagerPlugin.context';

import { toggleButtonStyles } from './ToggleButtonComponent.styles';

export const ToggleButtonComponent = memo(({ buttonRef }: ColumnChooser.ToggleButtonProps) => {
  const { openVisibilitySettings } = useContext(ColumnVisibilityManagerContext);

  return (
    <IconButton
      name={'MoreDots'}
      onClick={openVisibilitySettings}
      ref={buttonRef}
      dataTestId={TableTestKeys.toggleButtonKey}
      sx={toggleButtonStyles}
      size={'sm'}
    />
  );
});
ToggleButtonComponent.displayName = 'ToggleButtonComponent';
