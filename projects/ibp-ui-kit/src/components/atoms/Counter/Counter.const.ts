import { StyleVariants } from '../DictionaryBadge';

export const spacings: StyleVariants<{ lr: number; tb: number }> = {
  edit: {
    lg: {
      lr: 3,
      tb: 2,
    },
    md: {
      lr: 2,
      tb: 1.5,
    },
    sm: {
      lr: 1.5,
      tb: 1,
    },
  },
  read: {
    lg: {
      lr: 1.5,
      tb: 0.5,
    },
    md: {
      lr: 1,
      tb: 0.5,
    },
    sm: {
      lr: 1,
      tb: 0,
    },
  },
};
