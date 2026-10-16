import { Sx } from '@/utils';

interface StyleProps {
  selected?: boolean;
  disabled?: boolean;
}

export const cardStyles: (props: StyleProps) => Sx =
  ({ selected, disabled }) =>
  (theme) => {
    const borderActiveStyle = `1px solid ${theme.palette.Primary.Primary}`;

    return {
      padding: 0,
      borderRadius: 2,
      boxShadow: 'none',
      border: `1px solid ${theme.palette.Border.BorderPrimary}`,

      '&:hover': {
        cursor: 'pointer',
        border: borderActiveStyle,
      },

      ...(selected && {
        backgroundColor: theme.palette.Primary.PrimaryBGLight,
        border: borderActiveStyle,
      }),

      ...(disabled && {
        cursor: 'auto',
        pointerEvents: 'none',
        border: `1px solid ${theme.palette.Disabled.DisabledBorder}`,
        opacity: 0.5,
      }),
    };
  };

export const headerStyle: Sx = (theme) => ({
  padding: theme.spacing(4, 6, 4, 4),
  color: theme.palette.Text.TextPrimary,
});

export const headerIconStyle: Sx = (theme) => ({
  backgroundColor: theme.palette.Secondary.SecondaryBGDark,
  width: 40,
  height: 40,
  borderRadius: 2,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: theme.spacing(3),
  padding: theme.spacing(2),
});

export const actionsStyle: Sx = (theme) => ({
  padding: 0,
  paddingTop: theme.spacing(4),
});

export const bodyStyle: Sx = (theme) => ({
  padding: theme.spacing(0, 5, 4, 4),
  '&:last-child': {
    padding: theme.spacing(0, 4, 5),
  },
});
