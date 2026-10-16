import React from 'react';

import { Button } from '@/components/atoms/buttons/Button';
import { ButtonProps } from '@/components/atoms/buttons/Button/Button.types';

import { ProductButtonStyles } from './ProductButton.styles';

type ProductButtonProps = Pick<ButtonProps, 'dataTestId' | 'disabled' | 'onClick' | 'children'>;

export const ProductButton = React.memo(({ dataTestId, disabled = false, onClick, children }: ProductButtonProps) => {
  return (
    <Button
      disabled={disabled}
      onClick={onClick}
      size={'lg'}
      type={'outlined'}
      fullWidth
      dataTestId={dataTestId}
      startIcon={'Add'}
      sx={ProductButtonStyles}
    >
      {children}
    </Button>
  );
});
