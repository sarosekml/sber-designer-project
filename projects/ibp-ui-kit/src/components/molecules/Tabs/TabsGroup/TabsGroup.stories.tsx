import React from 'react';
import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryObj } from '@storybook/react';

import { Grid, Paper, Tab } from '@/components/atoms';

import { TabPanel } from './TabPanel';
import { TabsGroup } from './TabsGroup';

const meta: Meta<typeof TabsGroup> = {
  title: 'Molecules/TabsGroup',
  component: TabsGroup,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    orientation: { control: 'radio' },
    value: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof TabsGroup>;

const MainTemplate = (args) => {
  const [_, updateArgs] = useArgs();
  const onChange = (_event: any, value: string) => {
    updateArgs({ value });
  };
  return (
    <Paper dataTestId={'paper'} sx={{ p: 0 }}>
      <Grid container spacing={3} direction={args.orientation === 'horizontal' ? 'column' : 'row'}>
        <Grid item xs={6}>
          <TabsGroup {...args} onChange={onChange}>
            <Tab orientation={args.orientation} dataTestId={'One'} label={'Tab1'} value={'one'} iconValue={10} />
            <Tab
              orientation={args.orientation}
              dataTestId={'Two'}
              label={'Tab2 Very long tab name lorem ipsum sit amet'}
              value={'two'}
              iconValue={2345}
            />
            <Tab orientation={args.orientation} dataTestId={'Three'} label={'Tab3'} value={'three'} iconValue={3} />
            <Tab
              orientation={args.orientation}
              dataTestId={'Four'}
              label={'Tab4'}
              value={'four'}
              iconValue={4e9}
              disabled
            />
          </TabsGroup>
        </Grid>
        <Grid item xs={6}>
          <TabPanel currentTab={args.value} tabName={'one'} dataTestId={'panel1'}>
            Panel 1 content
          </TabPanel>
          <TabPanel currentTab={args.value} tabName={'two'} dataTestId={'panel2'}>
            Panel 2 content
          </TabPanel>
          <TabPanel currentTab={args.value} tabName={'three'} dataTestId={'panel3'}>
            Panel 3 content
          </TabPanel>
        </Grid>
      </Grid>
    </Paper>
  );
};

const HorizontalTemplate = (args) => {
  const [_, updateArgs] = useArgs();
  const onChange = (_event: any, index: string) => {
    updateArgs({ value: index });
  };
  return (
    <TabsGroup {...args} onChange={onChange}>
      <Tab dataTestId={'One'} label={'Tab1'} value={'one'} iconValue={1} />
      <Tab dataTestId={'Two'} label={'Tab2'} value={'two'} iconValue={2} />
      <Tab dataTestId={'Three'} label={'Tab3'} value={'three'} iconValue={3} />
      <Tab dataTestId={'Four'} label={'Tab4'} value={'four'} iconValue={4} disabled />
    </TabsGroup>
  );
};

const VerticalTemplate = (args) => {
  const [_, updateArgs] = useArgs();
  const onChange = (_event: any, index: string) => {
    updateArgs({ value: index });
  };
  return (
    <TabsGroup {...args} onChange={onChange}>
      <Tab dataTestId={'One'} label={'Tab1'} value={'one'} orientation={'vertical'} iconValue={1} />
      <Tab dataTestId={'Two'} label={'Tab2'} value={'two'} orientation={'vertical'} iconValue={2} />
      <Tab dataTestId={'Three'} label={'Tab3'} value={'three'} orientation={'vertical'} iconValue={3} />
      <Tab dataTestId={'Four'} label={'Tab4'} value={'four'} orientation={'vertical'} iconValue={4} disabled />
    </TabsGroup>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение TabsGroup',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    orientation: 'vertical',
    value: 'two',
    onChange: action('onChange'),
  },
  render: (args) => MainTemplate(args),
};

export const Horizontal: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Горизонтальное отображение TabsGroup',
      },
    },
  },
  args: {
    ...Main.args,
    orientation: 'horizontal',
  },
  render: (args) => HorizontalTemplate(args),
};

export const Vertical: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Вертикальное отображение TabsGroup',
      },
    },
  },
  args: {
    ...Main.args,
  },
  render: (args) => VerticalTemplate(args),
};
