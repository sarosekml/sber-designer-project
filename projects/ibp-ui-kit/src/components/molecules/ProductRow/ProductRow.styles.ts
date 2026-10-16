import { SxProps } from '@mui/material';

import { theme } from '@/styles';

import { StylesProps } from './ProductRows.types';

export const useRootStyles: (props: StylesProps) => SxProps = ({
  disabled,
  variant,
  error,
  buttonLabel,
  active,
  highlight,
}) => [
  () => {
    return {
      display: 'flex',
      padding: theme.spacing(3, 4),
      background: theme.palette.BG.BGPopup,
      borderRadius: '4px',
    };
  },

  variant === 'flat' && {
    '&:hover': {
      background: disabled ? 'none' : theme.palette.Primary.PrimaryBGLight,
    },
  },

  variant === 'bordered' &&
    (() => {
      const {
        Error: { Error },
        Border: { BorderPrimary },
        Primary: { Primary },
      } = theme.palette;
      return {
        border: error ? `1px solid ${Error}` : `1px solid ${BorderPrimary}`,
        '&:hover': {
          border: error ? `1px solid ${Error}` : `1px solid ${Primary}`,
        },
      };
    }),

  variant === 'transparent' &&
    (() => {
      const {
        Error: { Error },
        Primary: { Primary },
      } = theme.palette;
      return {
        border: error ? `1px solid ${Error}` : `1px solid transparent`,
        '&:hover': {
          border: error ? `1px solid ${Error}` : `1px solid ${Primary}`,
        },
      };
    }),

  !!buttonLabel &&
    (() => {
      const {
        Primary: { PrimaryLight, Primary, PrimaryDark },
      } = theme.palette;

      return {
        color: PrimaryLight,
        border: `1px solid ${PrimaryLight}`,
        '& svg': {
          color: PrimaryLight,
        },
        '&:hover': {
          color: Primary,
          border: `1px solid ${Primary}`,
          '& svg': {
            color: Primary,
          },
        },
        '&:active': {
          color: PrimaryDark,
          border: `1px solid ${PrimaryDark}`,
          '& svg': {
            color: PrimaryDark,
          },
        },
      };
    }),

  !!disabled &&
    (() => {
      const {
        Disabled: { DisabledBorder },
        Text: { TextInactive },
      } = theme.palette;

      const isButtonLabel = buttonLabel && { color: TextInactive };
      const disabledBorder = variant === 'flat' ? 'none' : `1px solid ${DisabledBorder}`;

      return {
        border: disabledBorder,
        color: TextInactive,
        '&:hover': {
          color: TextInactive,
          border: disabledBorder,
          '& svg': {
            ...isButtonLabel,
          },
        },
        '& svg': {
          ...isButtonLabel,
        },
      };
    }),

  !!highlight &&
    (() => {
      return {
        backgroundColor: theme.palette.BG.BGTableDefaultHover,
      };
    }),

  !!active &&
    (() => {
      const {
        Primary: { Primary, PrimaryBG },
      } = theme.palette;

      return {
        backgroundColor: PrimaryBG,
        border: `1px solid ${Primary}`,
      };
    }),
];

export const actionsStyles: SxProps = {
  display: 'flex',
  flexWrap: 'nowrap',
  width: 'fit-content',
  alignItems: 'flex-start',
  columnGap: 2,
};

export const subTitleIconStyles = {
  color: theme.palette.Success.Success,
  '& svg': {
    width: theme.spacing(4),
    height: theme.spacing(4),
  },
  '& span': {
    marginRight: theme.spacing(1),
  },
};

export const titleContainerStyles = { display: 'flex', flexWrap: 'nowrap', columnGap: 4 };
export const titleStyles = {
  flexWrap: 'nowrap',
  width: 'fit-content',
  maxWidth: '70%',
};
export const titlePostfixStyles = {
  display: 'flex',
  flexWrap: 'nowrap',
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  columnGap: 4,
};
export const titlePrefixStyles = {
  display: 'flex',
  flexWrap: 'nowrap',
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  columnGap: 4,
};
