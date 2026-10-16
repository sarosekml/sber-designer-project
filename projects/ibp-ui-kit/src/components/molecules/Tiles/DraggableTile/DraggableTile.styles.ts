import { SxProps } from '@mui/system';

import { DraggableStyleProps } from '@/components/molecules/Tiles/TilesTypes';

export const useStyles: (props: DraggableStyleProps) => SxProps =
  ({ theme, isDisabled }) =>
  () => {
    const {
      Primary: { Primary, PrimaryBGLight },
      Text: { TextPrimary, TextInactive },
      Disabled: { DisabledBorder },
      BG: { BGTile },
    } = theme.palette;

    const rootStyles = {
      borderRadius: theme.spacing(2),
      backgroundColor: BGTile,
      color: TextPrimary,
      ':hover': {
        borderColor: Primary,
      },
      ':active': {
        borderColor: Primary,
        backgroundColor: PrimaryBGLight,
      },
    };
    const disabledStyle = {
      color: TextInactive,
      borderColor: DisabledBorder,
      borderRadius: theme.spacing(2),
    };

    return isDisabled ? disabledStyle : rootStyles;
  };

export const useChildrenStyles: (props: DraggableStyleProps) => SxProps =
  ({ theme, isDisabled }) =>
  () => {
    const { TextSecondary, TextInactive } = theme.palette.Text;
    const font = theme.typography['BodySReg'];

    return {
      padding: theme.spacing(2, 4, 5, 4),
      color: isDisabled ? TextInactive : TextSecondary,
      ...font,
    };
  };
