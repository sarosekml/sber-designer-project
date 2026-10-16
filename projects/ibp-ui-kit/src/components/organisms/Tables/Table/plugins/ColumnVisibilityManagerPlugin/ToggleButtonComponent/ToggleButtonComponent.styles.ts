import { Sx } from '@/utils';

import { tableZIndexes } from '../../../Table.styles';

export const toggleButtonStyles: Sx = (theme) => ({
  'position': 'absolute',
  'right': 0,
  'transform': 'translateY(22%)',
  'zIndex': tableZIndexes.toggleColumnsButton,
  'background': 'linear-gradient(270deg, #FFFFFF 73.75%, transparent 100%)',
  'borderRadius': 0,
  'borderTopRightRadius': 8,
  'p': 2.5,

  '&:hover': {
    background: 'linear-gradient(270deg, #FFFFFF 73.75%, transparent 100%)',
  },

  '& svg': {
    fill: theme.palette.Secondary.Secondary,
  },
});
