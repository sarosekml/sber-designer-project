import { MediumSizeType } from '@/types';
import { Sx } from '@/utils';

import { TooltipType } from '../Tooltip';

type LineClamp = number | 'auto';

export interface TextMultiRowProps {
  children?: string;
  text?: string;
  /**
   * number OR "auto" - line-clamp value generated automatically by element height
   * @default 3
   * */
  lineClamp?: LineClamp;
  noTooltip?: boolean;
  /**
   * trimmingLength - trimming Tooltip length
   * @default 200
   * */
  trimmingLength?: number;
  dataTestId?: string;
  enterDelay?: number;
  size?: MediumSizeType;
  /**
   * tooltipType - Tooltip color
   */
  tooltipType?: TooltipType;
  whiteSpace?: React.CSSProperties['whiteSpace'];
  sx?: Sx;
}
