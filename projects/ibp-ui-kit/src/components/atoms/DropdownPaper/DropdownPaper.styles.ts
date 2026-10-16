import { Sx } from '@/utils';

export const dropStyles = {
  wordWrap: 'break-word',
  whiteSpace: 'normal',
  minHeight: '40px',
};

export const paperStyles: Sx = (theme) => {
  const font = theme.typography.BodyMReg;

  return {
    '& .dmb-uikit-MuiAutocomplete-listbox': {
      '& .dmb-uikit-MuiAutocomplete-option': {
        paddingLeft: theme.spacing(3),
        paddingRight: theme.spacing(3),
        color: theme.palette.Text.TextPrimary,
        ...dropStyles,
        ...font,
      },
    },
  };
};
