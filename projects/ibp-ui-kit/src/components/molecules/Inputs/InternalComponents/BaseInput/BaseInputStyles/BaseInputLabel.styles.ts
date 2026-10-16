import { mergeSx, Sx } from '@/utils/mergeSx';

export const baseInputLabelContainerSx: Sx = (theme) => ({
  display: 'flex',
  justifyContent: 'space-between',
  pb: theme.spacing(1),
  background: 'transparent',
});

export const leftContainerSx: Sx = {
  display: 'flex',
  pr: 1,
};

export const baseInputLabelIconStyles: Sx = (theme) => ({
  fontSize: theme.spacing(4),
  '& svg': {
    width: theme.spacing(4),
    height: theme.spacing(4),
  },
});

const ellipsisStyles: Sx = {
  width: '100%',
  textOverflow: 'ellipsis',
  overflowX: 'hidden',
  textWrap: 'nowrap',
  whiteSpace: 'nowrap',
  wordWrap: 'initial',
};

const getBaseLabelSx =
  (disabled: boolean | undefined): Sx =>
  (theme) => ({
    lineHeight: theme.spacing(4),
    pr: theme.spacing(1),
    wordWrap: 'break-word',
    whiteSpace: 'normal',
    maxWidth: '100%',
    color: disabled ? theme.palette.Text.TextInactive : theme.palette.Text.TextSecondary,
  });

export const getBaseInputLabelSx = (disabled?: boolean, ellipsis?: boolean): Sx => {
  const baseStyles = getBaseLabelSx(disabled);
  return ellipsis ? mergeSx(baseStyles, ellipsisStyles) : baseStyles;
};
