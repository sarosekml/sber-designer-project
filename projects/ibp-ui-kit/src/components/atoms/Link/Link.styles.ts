import { CSSProperties } from 'react';
import { SxProps } from '@mui/material';

import { theme } from '@/styles';
import { MediumSizeType } from '@/types';

import { fontVariants, textUnderlineOffset } from './Link.const';
import { defaultColors, disabledColors, hoverColors, Severity } from './Link.types';

interface LinkStylesProps {
  severity: Severity;
  size: MediumSizeType;
  disabled: boolean | undefined;
}

export const linkStyles = ({ severity, size, disabled }: LinkStylesProps): SxProps => {
  const defaultColor = defaultColors[severity];
  const hoverColor = hoverColors[severity];
  const disabledColor = disabledColors[severity];

  const root: CSSProperties = {
    color: defaultColor,
    textDecoration: 'none',
    cursor: 'pointer',

    ...theme.typography[fontVariants[size]],
    ...(disabled && {
      color: disabledColor,
      borderBottom: disabledColor,
      pointerEvents: 'none',
    }),
  };

  const hover: CSSProperties = {
    color: hoverColor,
    textDecoration: severity === 'products' ? 'none' : 'underline',
    textUnderlineOffset: textUnderlineOffset[size],
  };

  const active: CSSProperties = {
    opacity: 0.8,
  };

  return [root, () => ({ '&:hover': hover }), () => ({ '&:active': active })];
};
