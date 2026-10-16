import { Sx } from '@/utils';

const getDefaultFontStyles: Sx = (theme) => ({
  fontSize: theme.spacing(3.5),
  lineHeight: theme.spacing(4),
});

export const getBreadCrumbStyles: Sx = (theme) => ({
  '& nav:last-child': {
    paddingTop: theme.spacing(2),
  },
  '& nav:first-child': {
    paddingTop: 0,
  },
  '& > nav > ol > .dmb-uikit-MuiBreadcrumbs-separator': {
    ...getDefaultFontStyles(theme),
  },
});

export const getBreadCrumbTextStyles =
  (state: 'active' | 'current'): Sx =>
  (theme) => {
    const getChangingStyles = () => {
      switch (state) {
        case 'active':
          return {
            cursor: 'pointer',
            color: theme.palette.Text.TextSecondary,
            '&:hover': {
              textDecoration: 'underline',
            },
          };
        case 'current':
          return {
            cursor: 'default',
            color: theme.palette.Text.TextPrimary,
          };
      }
    };

    return {
      width: '100%',
      ...getDefaultFontStyles(theme),
      ...getChangingStyles(),
    };
  };
