import { Sx } from '@/utils';

import { EntitySize } from './Entity.types';

export const containerStyles: Sx = {
  display: 'flex',
  gap: 2,
  width: '100%',
};

export const leftContainerStyles =
  (size: EntitySize): Sx =>
  () => ({
    display: 'flex',
    gap: size === 'xl' ? 4 : 2,
    width: '100%',
  });

export const textContainerStyles =
  (size: EntitySize): Sx =>
  () => ({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: size === 'xl' ? 2 : 1,
  });
