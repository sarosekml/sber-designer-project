import { cssImportant, Sx, Theme } from '@/utils';

const tableCommonStyles: Sx = {
  border: cssImportant('none'),
  fontStyle: 'normal',
  px: '8px',
  py: '2px',
  textAlign: 'start',
};

/* default markdown styles */
export const markdownSx = (theme: Theme) => ({
  '& p': {
    fontSize: theme.spacing(3.5),
    fontStyle: 'normal',
    lineHeight: theme.spacing(4),
    m: 0,
    mb: 0,
    padding: theme.spacing(1, 0, 0, 0),
  },
  '& pre': {
    '& code': {
      background: theme.palette.BG.BGTableDefaultFocus,
      borderRadius: theme.spacing(2),
      padding: theme.spacing(4),
    },
    fontFamily: 'SB Sans Text Mono',
    fontSize: theme.spacing(3.5),
    letterSpacing: '1px',
    lineHeight: theme.spacing(6),
    m: 0,
    mb: theme.spacing(2),
  },
  '& table': {
    '& th': {
      ...tableCommonStyles,
      backgroundColor: theme.palette.Text.TextOnTertiary,
      color: theme.palette.Text.TextOnDark,
      fontSize: theme.spacing(3),
      fontWeight: 400,
      lineHeight: theme.spacing(4),
    },
    '& tr:nth-child(even)': {
      '& td': tableCommonStyles,
      backgroundColor: cssImportant(theme.palette.Secondary.SecondaryBG),
      border: cssImportant('none'),
      color: theme.palette.Text.TextPrimary,
    },
    '& tr:nth-child(odd)': {
      '& td': tableCommonStyles,
      backgroundColor: cssImportant(theme.palette.Secondary.SecondaryBGDark),
      border: cssImportant('none'),
      color: theme.palette.Text.TextPrimary,
    },
    border: cssImportant('none'),
    borderCollapse: 'collapse',
    fontFamily: 'SB Sans Text',
    fontSize: theme.spacing(3),
    fontStyle: 'normal',
    mt: theme.spacing(2),
  },
  '& blockquote': {
    py: theme.spacing(2),
    px: theme.spacing(4),
    my: theme.spacing(2),
    position: 'relative',
    mx: 0,

    '&::before': {
      width: theme.spacing(1),
      background: theme.palette.Border.BorderLight,
      content: '" "',
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
    },
  },
  fontFamily: 'SB Sans Text',
  fontSize: theme.spacing(3.5),
  lineHeight: theme.spacing(4),
  overflow: 'hidden',
  width: '100%',
});
