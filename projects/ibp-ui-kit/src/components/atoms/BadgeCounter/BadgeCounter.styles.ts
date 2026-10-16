import { Sx } from '@/utils';

export type BadgeCounterSize = 'md' | 'sm';

const fontSizes: Record<BadgeCounterSize, string> = {
  sm: '8px',
  md: '14px',
};

const heightSizes: Record<BadgeCounterSize, string> = {
  sm: '14px',
  md: '24px',
};

const borderRadiusSizes: Record<BadgeCounterSize, string> = {
  sm: '7px',
  md: '12px',
};

const minWidthSizes: Record<BadgeCounterSize, string> = {
  sm: '14px',
  md: '24px',
};

const paddingXSizes: Record<BadgeCounterSize, string> = {
  sm: '4px',
  md: '8px',
};

export const useBadgeCounterStyles =
  ({ size: counterSize }: { size: BadgeCounterSize }): Sx =>
  (theme) => {
    return {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      ml: '4px',
      backgroundColor: theme.palette.Primary.Primary,
      color: theme.palette.Text.TextOnDark,
      height: heightSizes[counterSize],
      minWidth: minWidthSizes[counterSize],
      borderRadius: borderRadiusSizes[counterSize],
      fontSize: fontSizes[counterSize],
      paddingX: paddingXSizes[counterSize],
    };
  };
