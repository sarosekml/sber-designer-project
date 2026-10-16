import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { BaseTile, IconButton } from '@/index';

import { GridTileContainer } from './GridTileContainer';

export default {
  title: 'Atoms/GridTiles/GridTileContainer',
  component: GridTileContainer,
  argTypes: {
    dataTestId: { table: { disable: true } },
    stretchAll: { table: { disable: true } },
    className: { table: { disable: true } },
    justify: { table: { disable: true } },
    alignItems: { table: { disable: true } },
    alignContent: { table: { disable: true } },
  },
} as Meta;

const Template: StoryFn<typeof GridTileContainer> = (args) => <GridTileContainer {...args} />;

export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
  spacing: 2,
  sizes: { xs: 12 },
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
