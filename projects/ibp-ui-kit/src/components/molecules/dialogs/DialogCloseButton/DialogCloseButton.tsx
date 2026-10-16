import React, { memo } from 'react';

import { IconButton } from '@/components/atoms/IconButton';
import { getDataTestId } from '@/utils';

interface Props {
  dataTestId: string | undefined;
  disabled: boolean | undefined;
  /**
   * @deprecated use `onClick`
   */
  closeModal?: () => void;
  onClick?: () => void;
}

export const DialogCloseButton = memo(({ dataTestId, disabled, onClick, closeModal }: Props) => {
  return (
    <IconButton
      name={'Close'}
      aria-label={'Закрыть'}
      onClick={onClick ?? closeModal}
      size={'lg'}
      dataTestId={getDataTestId(dataTestId, 'CloseButton')}
      disabled={disabled}
    />
  );
});

DialogCloseButton.displayName = 'DialogCloseButton';
