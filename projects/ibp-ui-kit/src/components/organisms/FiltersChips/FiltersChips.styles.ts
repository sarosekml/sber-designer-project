import { Sx } from '@/utils';

export const clearAllFiltersChipStyles: Sx = (theme) => ({
  padding: theme.spacing(0, 0, 0, 1),
});

export const filterChipStyles: Sx = (theme) => ({
  overflow: 'hidden',
  maxWidth: '300px',
  padding: theme.spacing(0, 0, 0, 1),
});

export const filtersExpandedButtonStyles: Sx = {
  p: 0,
  pl: 2,
};
