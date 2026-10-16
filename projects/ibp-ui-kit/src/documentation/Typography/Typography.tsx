import React from 'react';
import { Box, useTheme } from '@mui/material';

import { Text } from '@/components/atoms/typography';

import { typographyDescription } from './Typography.const';
import { getStyles } from './Typography.styles';

export const Typography = () => {
  const theme = useTheme();
  const classes = getStyles(theme);

  return (
    <Box>
      {typographyDescription.map((font) => (
        <Box sx={classes.card} key={font.subtitle}>
          <Text dataTestId={font.subtitle} sx={classes.header}>
            {font.subtitle}
          </Text>

          {font.data.map(({ kind, text }) => (
            <Box sx={classes.root} key={kind}>
              <Text dataTestId={kind} type={kind}>
                {text}
              </Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};
