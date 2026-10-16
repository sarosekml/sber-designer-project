import { Sx } from '@/utils';

import { LeftColumnStylesProps, RightColumnStylesProps } from './Splitter.types';

export const getRightColumnStyles = ({ minColumnWidth }: RightColumnStylesProps): Sx => ({
  minWidth: minColumnWidth,
  height: '100%',
  flex: 1,
});

export const getLeftColumnStyles = ({ minColumnWidth, leftColumnWidth }: LeftColumnStylesProps): Sx => ({
  minWidth: minColumnWidth,
  height: '100%',
  width: leftColumnWidth,
});

export const splitterStyles: Sx = (theme) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  transition: '0.25s',
  minWidth: theme.spacing(4),
  width: theme.spacing(4),
  backgroundColor: theme.palette.Primary.PrimaryBGLight,
  borderLeft: `1px solid ${theme.palette.Border.BorderLight}`,
  ':hover,:active ': {
    borderLeft: `1px solid ${theme.palette.Primary.Primary}`,
    cursor: 'col-resize',
    transition: '0.25s',
  },
  '& .dmb-uikit-MuiIcon-root': {
    alignItems: 'center',
  },
  '& .dmb-uikit-MuiSvgIcon-root': {
    height: theme.spacing(4),
  },
});

export const splitterContainerStyles: Sx = {
  display: 'flex',
  height: '100%',
  width: '100%',
  '& > .dmb-uikit-MuiBox-root > .dmb-uikit-MuiGrid-root': {
    height: '100%',
  },
};
