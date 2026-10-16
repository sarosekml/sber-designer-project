import { Sx } from '@/utils';

interface StyleProps {
  isImageOnTop: boolean;
}

export const paperStyles: Sx = {
  flexGrow: 1,
  px: 8,
  py: 12,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

export const imageContainerStyles = ({ isImageOnTop }: StyleProps): Sx => ({
  width: 'fit-content',
  '& svg': {
    width: isImageOnTop ? '100%' : '400px',
    maxWidth: '100%',
    height: 'auto',
  },
});

export const innerContainerStyles = ({ isImageOnTop }: StyleProps): Sx => ({
  display: 'flex',
  width: 'fit-content',
  maxWidth: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: isImageOnTop ? 'column' : 'row',
  flexWrap: 'wrap',
  gap: 6,
  '@media (max-width: 1420px)': {
    flexDirection: 'column',
  },
});

export const contentWrapperStyles = ({ isImageOnTop }: StyleProps): Sx => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: isImageOnTop ? 'center' : 'flex-start',
  justifyContent: 'center',
  width: isImageOnTop ? '100%' : 'fit-content',
  maxWidth: isImageOnTop ? '800px' : 'none',
  gap: isImageOnTop ? 4 : 6,
  flexWrap: 'wrap',

  '.error__title, .error__text': {
    textAlign: isImageOnTop ? 'center' : 'left',
  },

  ...(isImageOnTop && {
    '.error__title': {
      mt: 4,
    },
  }),

  ...(isImageOnTop && {
    '.error__text': {
      mb: 4,
      maxWidth: 470,
    },
  }),
});

export const actionsWrapperStyles = ({ isImageOnTop }: StyleProps): Sx => ({
  display: 'flex',
  justifyContent: isImageOnTop ? 'center' : 'flex-start',
  width: '100%',
  marginTop: 4,
  gap: 2,
  flexWrap: 'wrap',
});

export const imageWrapperStyles = ({ isImageOnTop }: StyleProps): Sx => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: isImageOnTop ? '100%' : 'fit-content',
});
