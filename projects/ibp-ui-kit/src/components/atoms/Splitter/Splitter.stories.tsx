import React, { useState } from 'react';
import { Grid } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';

import { Button } from '@/index';
import { IconButton } from '@/components/atoms/IconButton';
import { CheckboxList } from '@/components/molecules/CheckboxList';
import { Tile } from '@/components/molecules/Tiles/Tile';

import { Splitter } from './Splitter';

export default {
  title: 'Atoms/Splitter',
  component: Splitter,
  argTypes: {
    leftColumn: {
      description: 'Component of left column',
      control: 'text',
    },
    leftColumnWidth: {
      description: 'Default width of left column. Width of right column calculated automatically',
      control: 'text',
    },
    minColumnWidth: {
      description: 'Minimal width to which the column can be reduced',
      control: 'text',
    },
    rightColumn: {
      description: 'Component of right column',
    },
    dataTestId: { table: { disable: true } },
  },
  parameters: {
    docs: {
      description: {
        component: 'Double-clicking on splitter returns it to its initial position',
      },
    },
  },
} as Meta;

const Template: StoryFn<typeof Splitter> = (args) => {
  const [isOpenRightColumn, setIsOpenRightColumn] = useState(true);

  return (
    <Grid height={'300px'}>
      <Grid sx={{ display: 'flex', justifyContent: 'flex-end', mb: '20px' }}>
        <Button dataTestId="stories" onClick={() => setIsOpenRightColumn(!isOpenRightColumn)}>
          open/close right column
        </Button>
      </Grid>

      <Splitter {...args} rightColumn={isOpenRightColumn ? args.rightColumn : null} />
    </Grid>
  );
};

export const AMain: StoryFn<typeof Splitter> = Template.bind({});
AMain.args = {
  dataTestId: 'stories',
  leftColumn: (
    <Grid sx={{ pr: '20px' }}>
      <CheckboxList
        data={[
          {
            checked: false,
            label: 'First item',
            id: '1',
          },
          {
            checked: true,
            label: 'Second item',
            id: '2',
          },
          {
            checked: false,
            label: 'Third item',
            id: '3',
          },
        ]}
        dataTestId="stories"
        onChange={() => {
          console.log('onChange');
        }}
        title="Table title"
      />
    </Grid>
  ),
  rightColumn: (
    <Tile
      actions={<IconButton dataTestId="Edit" name="Edit" />}
      dataTestId="stories"
      gridSizes={{
        xs: 12,
      }}
      onDoubleClick={() => {
        console.log('onDoubleClick');
      }}
      subtitle="Tile subtitle"
      title="Tile title"
    >
      Tile content
    </Tile>
  ),
  leftColumnWidth: '50%',
  minColumnWidth: '15%',
};

AMain.argTypes = {
  leftColumn: { table: { disable: true } },
  rightColumn: { table: { disable: true } },
};

const BChangeableColumnsTemplate: StoryFn<typeof Splitter> = (args) => {
  const [isOpenRightColumn, setIsOpenRightColumn] = useState(true);

  return (
    <Grid height={'170px'}>
      <Grid sx={{ display: 'flex', justifyContent: 'flex-end', mb: '20px' }}>
        <Button dataTestId="stories" onClick={() => setIsOpenRightColumn(!isOpenRightColumn)}>
          open/close right column
        </Button>
      </Grid>

      <Splitter {...args} rightColumn={isOpenRightColumn ? args.rightColumn : null} />
    </Grid>
  );
};

export const BChangeableColumns: StoryFn<typeof Splitter> = BChangeableColumnsTemplate.bind({});
BChangeableColumns.args = {
  dataTestId: 'stories',
  leftColumn: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  rightColumn: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  leftColumnWidth: '50%',
  minColumnWidth: '15%',
};
