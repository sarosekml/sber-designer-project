import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

import { SxBox } from '@/components/atoms/SxBox';
import { theme } from '@/styles';
import { mergeSx } from '@/utils/mergeSx';

import { colorListStyles } from './ColorList.styles';
import { ColorListProps, ColorProps } from './ColorList.types';
import { getColors } from './getColors';

const ColorRow = ({ name, hex }: ColorProps) => (
  <SxBox sx={colorListStyles.root}>
    <SxBox sx={mergeSx(colorListStyles.colorImg, { backgroundColor: hex })} />
    <SxBox sx={colorListStyles.textColumn}>
      <SxBox>{name}</SxBox>
      <SxBox sx={colorListStyles.hex}>{hex}</SxBox>
    </SxBox>
  </SxBox>
);

export const ColorList = ({ name }: ColorListProps) => {
  /**
   * useTheme doesn't work in MDX stories
   * theme as const used
   */
  const colors = getColors(theme, name);
  return (
    <Card sx={colorListStyles.card}>
      <CardContent sx={colorListStyles.cardHeader}>{name}</CardContent>
      {colors?.map(({ name, hex }: ColorProps, index: number) => (
        <ColorRow key={index} name={name} hex={hex} />
      ))}
    </Card>
  );
};
