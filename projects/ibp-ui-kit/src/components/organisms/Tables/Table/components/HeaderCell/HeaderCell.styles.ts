import { Sx } from '@/utils';

interface Props {
  sortingDisabled?: boolean;
}

/*root table rules for header*/
export const baseHeaderStyles: Sx = (theme) => ({
  height: theme.spacing(12),
  borderBottom: `1px solid ${theme.palette.Border.BorderPrimary}`,
  padding: theme.spacing(2, 2, 2, 4),

  '&:first-of-type': {
    paddingLeft: theme.spacing(6),
  },
  '&:last-of-type': {
    paddingRight: theme.spacing(8),
  },
});

export const getHeaderStyles =
  ({ sortingDisabled }: Props): Sx =>
  (theme) => ({
    '.PinIconButton': {
      opacity: 0,
    },

    '&:hover': {
      '.PinIconButton': {
        opacity: 1,
      },
    },
    '.Content-content': {
      columnGap: theme.spacing(2),
      ...theme.typography.BodySReg,
      color: theme.palette.Text.TextSecondary,
      verticalAlign: 'middle',
      wordWrap: 'break-word',
      whiteSpace: 'pre-line',

      cursor: sortingDisabled ? 'text' : undefined,
    },
  });
