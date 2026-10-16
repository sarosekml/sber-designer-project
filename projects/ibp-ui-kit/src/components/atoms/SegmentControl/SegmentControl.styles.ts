import { Sx } from '@/utils';

import { fontVariants, heightSegment, paddingSegment } from './SegmentControl.const';
import { StyledProps } from './SegmentControl.types';

export const segmentedControlStyles: Sx = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
};

export const useSegmentStyles =
  ({ size }: StyledProps): Sx =>
  (theme) => {
    const {
      Primary: { Primary },
      BG: { BGTile },
    } = theme.palette;
    const typography = theme?.typography[fontVariants[size]];
    const radius = theme.spacing(2);

    return {
      display: 'flex',
      justifyContent: 'center',
      height: heightSegment[size],
      alignItems: 'center',
      textAlign: 'center',
      cursor: 'pointer',
      color: Primary,
      background: BGTile,
      padding: paddingSegment[size],

      '&:first-of-type': {
        borderTopLeftRadius: radius,
        borderBottomLeftRadius: radius,
        borderLeft: `1px solid ${Primary}`,
      },

      '&:last-of-type': {
        borderTopRightRadius: radius,
        borderBottomRightRadius: radius,
        borderRight: `1px solid ${Primary}`,
      },

      boxShadow: `inset 0px 0px 0px ${Primary}, inset 0px 1px 0px ${Primary}, inset 0px -1px 0px ${Primary}`,
      ...typography,
    };
  };

export const useUnselectedSegment: Sx = (theme) => ({
  '&:hover': {
    color: theme.palette.Primary.PrimaryDark,
    background: theme.palette.Tertiary.TertiaryLight,
    '& svg': {
      color: theme.palette.Primary.PrimaryDark,
    },
  },
});

export const useSelectedSegment: Sx = (theme) => ({
  color: theme.palette.BG.BGTile,
  backgroundColor: theme.palette.Primary.Primary,
  '& svg': {
    color: theme.palette.BG.BGTile,
  },
});

export const useDisabledStyles: Sx = (theme) => ({
  pointerEvents: 'none',
  color: theme.palette.Disabled.Disabled,
  background: theme.palette.BG.BGTile,
  '& svg': {
    color: theme.palette.Disabled.Disabled,
  },
});

export const segmentIconStyles: Sx = {
  display: 'flex',
  alignItems: 'center',
  '& span': {
    display: 'flex',
    alignItems: 'center',
  },
};
