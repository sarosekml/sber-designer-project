import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { BaseTile, IconButton } from '@/index';

import { GridTileSection } from './GridTileSection';

export default {
  title: 'Atoms/GridTiles/GridTileSection',
  component: GridTileSection,
  argTypes: {
    textColor: { control: 'color' },
    dataTestId: { table: { disable: true } },
    sx: { table: { disable: true } },
    id: { table: { disable: true } },
    stretchAll: { table: { disable: true } },
  },
} as Meta;

const Template: StoryFn<typeof GridTileSection> = (args) => <GridTileSection {...args} />;

export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
  title: 'GridTileSection title',
  textColor: '#000000de',
  sizes: { xs: 12 },
  spacing: 2,
  children: (
    <>
      <BaseTile
        actions={
          <>
            <IconButton dataTestId="Edit" name="Edit" />
            <IconButton dataTestId="Delete" name="MinusCircle" />
          </>
        }
        dataTestId="stories"
        gridSizes={{ xs: 12, sm: 6 }}
        onDoubleClick={() => {}}
        subtitle="Tile subtitle"
        title="Tile 1"
        variant="outlined"
      >
        Tile content
      </BaseTile>

      <BaseTile dataTestId={'Tile2'} title={'Tile 2'} variant={'outlined'} gridSizes={{ xs: 12, sm: 6 }}>
        Huge content... Huge content... Huge content... Huge content... Huge content... Huge content... Huge content...
        Huge content... Huge content... Huge content... Huge content... Huge content... Huge content... Huge content...
        Huge content... Huge content... Huge content... Huge content... Huge content... Huge content... Huge
      </BaseTile>
    </>
  ),
};
