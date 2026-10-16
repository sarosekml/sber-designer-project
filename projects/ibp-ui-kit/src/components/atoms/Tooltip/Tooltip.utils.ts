import { ContainerPosition } from '@/types';

import { ArrowPosition } from './Tooltip.types';

export const isHorizontalPlacement = (placement: ContainerPosition) => ['bottom', 'top'].includes(placement);

export const isVerticalPlacement = (placement: ContainerPosition) => ['left', 'right'].includes(placement);

export const isArrowLeftOrRight = (arrowPosition: ArrowPosition) => ['left', 'right'].includes(arrowPosition);
