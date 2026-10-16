import { Sx } from '@/utils';

export const inputDateStyles: Sx = (theme) => ({
  '& .dmb-uikit-MuiPickersDay-root': {
    ':hover': {
      backgroundColor: theme.palette.Secondary.SecondaryLight,
    },
    ':focus': {
      backgroundColor: theme.palette.Secondary.SecondaryLight,
    },
  },
  '& .dmb-uikit-MuiPickersDay-root.Mui-selected': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.Text.TextOnDark,
    ':focus': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.Text.TextOnDark,
    },
    ':hover': {
      backgroundColor: theme.palette.primary.dark,
      color: theme.palette.Text.TextOnDark,
    },
  },
  '& .dmb-uikit-MuiPickersDay-today': {
    ':not(.Mui-selected)': {
      border: 'none',
      color: theme.palette.Primary.Primary,
      fontWeight: 'bold',
    },
  },
});
