import { Sx } from '@/utils';

export const inputAutocompleteOptionsStateStyles =
  (color: string): Sx =>
  (theme) => ({
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    fontSize: theme.spacing(4),
    color,
  });

export const inputAutocompleteOptionsIconContainerStyles: Sx = (theme) => ({
  marginRight: theme.spacing(2.5),
});

export const getInputAutocompleteDropdownPapperStyles =
  (hasSelectAll: boolean): Sx =>
  (theme) => ({
    backgroundColor: theme.palette.BG.BGPopup,
    /** Styles for dropdown container without options */
    '& .dmb-uikit-MuiAutocomplete-noOptions': {
      padding: theme.spacing(5, 4),
      fontSize: theme.spacing(4),
      lineHeight: theme.spacing(5),
      color: theme.palette.Text.TextInactive,
    },
    /** Styles for dropdown container with options */
    '& .dmb-uikit-MuiAutocomplete-listbox': {
      padding: hasSelectAll ? theme.spacing(0, 0, 2, 0) : theme.spacing(2, 0),
      /** Styles for dropdown groups titles */
      '& .dmb-uikit-MuiListSubheader-root': {
        color: theme.palette.Text.TextSecondary,
        fontSize: theme.spacing(4),
        lineHeight: theme.spacing(9),
      },
      /** Styles for dropdown items */
      '& .dmb-uikit-MuiAutocomplete-groupUl': {
        '& .dmb-uikit-MuiAutocomplete-option': {
          color: theme.palette.Text.TextPrimary,
          fontSize: theme.spacing(4),
          padding: theme.spacing(2, 6),
          '&.Mui-focused': {
            backgroundColor: theme.palette.Tertiary.Tertiary,
          },
          '&[aria-selected="true"]': {
            backgroundColor: theme.palette.BG.BGTableDefaultFocus,
          },
          '&[aria-selected="true"].Mui-focused': {
            backgroundColor: theme.palette.Tertiary.Tertiary,
          },
        },
      },
    },
  });
