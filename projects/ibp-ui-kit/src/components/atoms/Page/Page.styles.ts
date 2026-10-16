import { cGrey } from '@/styles/colors';
import { Sx } from '@/utils';

import { PagePaddingType } from './Page.types';

export const getPageStyles =
  (type: PagePaddingType): Sx =>
  (theme) => ({
    /** @todo move color to palette */
    color: cGrey[700],
    display: 'flex',
    flexBasis: '100%',
    flexDirection: 'column',
    overflow: 'auto',
    padding: theme.spacing(type === 'all' ? 4 : 6, 6),
    position: 'relative',
    width: '100%',
  });
