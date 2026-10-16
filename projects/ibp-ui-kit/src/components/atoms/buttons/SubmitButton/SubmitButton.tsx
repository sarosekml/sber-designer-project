import React, { memo, ReactNode } from 'react';

import { ButtonSize } from '@/types';

import { Button, ButtonColors } from '../Button';

interface Props {
  children?: ReactNode;
  color?: ButtonColors;
  disabled?: boolean;
  formId?: string;
  fullWidth?: boolean;
  hasLoader?: boolean;
  id?: string;
  size?: ButtonSize;
  onClick?: () => void;
  type?: 'outlined' | 'accent' | 'transparent';
  label?: string;
}

export const SubmitButton = memo<Props>(
  ({ children, formId = '', size = 'md', type, fullWidth, disabled = false, hasLoader, id, onClick, color, label }) => (
    <Button
      id={id}
      type={type}
      fullWidth={fullWidth}
      form={formId}
      dataTestId={`${formId}Submit`}
      htmlType={'submit'}
      size={size}
      disabled={disabled}
      hasLoader={hasLoader}
      onClick={onClick}
      color={color}
    >
      {children ?? label}
    </Button>
  ),
);

SubmitButton.displayName = 'SubmitButton';
