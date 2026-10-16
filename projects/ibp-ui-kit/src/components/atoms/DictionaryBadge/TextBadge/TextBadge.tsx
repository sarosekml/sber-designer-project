import React, { memo, useMemo } from 'react';
import { Avatar } from '@mui/material';

import { getDataTestId, mergeSx } from '@/utils';

import { TextBadgeRoot } from './TextBadge.const';
import { textBadgeStyles } from './TextBadge.styles';
import { TextBadgeProps } from './TextBadge.types';
import { convertTextToInitials } from './TextBadge.utils';

export const TextBadge = memo(({ dataTestId, sx, children }: TextBadgeProps) => {
  const styles = textBadgeStyles();

  const label = useMemo(() => {
    return convertTextToInitials(children);
  }, [children]);

  return (
    <Avatar className={TextBadgeRoot} data-testid={getDataTestId(dataTestId, 'TextBadge')} sx={mergeSx(styles, sx)}>
      {label}
    </Avatar>
  );
});

TextBadge.displayName = 'TextBadge';
