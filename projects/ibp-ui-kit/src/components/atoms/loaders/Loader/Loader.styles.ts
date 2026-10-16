import { SxProps } from '@mui/material';

import { Sx } from '@/utils';

import { Color } from './Loader.types';

export const loaderRootStyles: SxProps = () => ({
  alignItems: 'center',
  display: 'flex',
  height: '100%',
  justifyContent: 'center',
  width: '100%',
});

export const useLoaderStyles =
  ({ color }: { color: Color }): Sx =>
  (theme) => {
    const loaderColors: Record<Color, string> = {
      colored: theme.palette.Primary.Primary,
      white: theme.palette.Text.TextOnDark,
      disabled: theme.palette.Disabled.Disabled,
    };
    return {
      color: loaderColors[color],
    };
  };
