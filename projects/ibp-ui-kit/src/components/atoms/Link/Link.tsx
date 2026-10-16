import React, { ElementType, useMemo } from 'react';
import { Link as MaterialLink, LinkTypeMap } from '@mui/material';

import { getDataTestId, mergeSx } from '@/utils';

import { linkStyles } from './Link.styles';
import { LinkProps } from './Link.types';

export const Link = <D extends ElementType = LinkTypeMap['defaultComponent'], P = object>({
  disabled = false,
  dataTestId,
  severity = 'default',
  size = 'md',
  innerRef,
  ...props
}: LinkProps<D, P>) => {
  const sx = useMemo(() => linkStyles({ severity, size, disabled }), [severity, size, disabled]);

  return (
    <MaterialLink
      data-testid={getDataTestId(dataTestId, 'link')}
      {...props}
      ref={innerRef}
      sx={mergeSx(sx, props.sx)}
    />
  );
};
