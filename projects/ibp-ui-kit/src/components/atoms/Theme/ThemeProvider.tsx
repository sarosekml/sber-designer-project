import React, { FC } from 'react';
import { CssBaseline, ThemeProvider as MuiThemeProvider } from '@mui/material';
import { StyledEngineProvider } from '@mui/material/styles';

import { theme as mainTheme } from '@/styles';

import { ThemeProviderPropsType } from './ThemeProvider.types';

export const ThemeProvider: FC<ThemeProviderPropsType> = React.memo(({ children, theme = mainTheme }) => {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline>
        <StyledEngineProvider injectFirst>{children}</StyledEngineProvider>
      </CssBaseline>
    </MuiThemeProvider>
  );
});
