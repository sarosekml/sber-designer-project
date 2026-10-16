import { Breakpoint } from '@mui/system';

import { Sx } from '@/utils';

import { ErrorSectionSize } from './ErrorSection.types';

const widthMap: Record<ErrorSectionSize, string | Partial<Record<Breakpoint, string>>> = {
  lg: {
    xs: '300px',
    md: '350px',
  },
  md: {
    xs: '200px',
    md: '220px',
  },
  sm: {
    xs: '100px',
    md: '140px',
  },
};

export const getImageContainerStyles = (size: ErrorSectionSize): Sx => ({
  width: 'fit-content',
  height: 'fit-content',
  '& svg': {
    width: widthMap[size],
    opacity: 0.4,
  },
});

export const sectionContainerStyles: Sx = {
  display: 'flex',
  width: 'fit-content',
  alignItems: 'center',
  justifyContent: 'center',
  flexWrap: {
    md: 'nowrap',
  },
};
