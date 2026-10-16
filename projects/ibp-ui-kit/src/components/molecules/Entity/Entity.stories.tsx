import React from 'react';
import { Grid } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';

import { Button, Icon, IconButton } from '../../atoms';

import { Entity } from './Entity';
import { EntityProps } from './Entity.types';

export default {
  title: 'Molecules/Entity',
  component: Entity,
} as Meta<EntityProps>;

const Template: StoryFn<EntityProps> = (args) => (
  <Grid container spacing={3} gap={3} padding={'20px'}>
    <Grid container spacing={3} gap={3}>
      <Grid container>{'Entity'}</Grid>
      <Grid container maxWidth="700px">
        <Entity {...args} />
      </Grid>
    </Grid>
  </Grid>
);

export const Main = Template.bind({});

Main.args = {
  size: 'lg',
  subHeader: {
    items: ['Subheader', 'Subheader', 'Subheader', 'Subheader', 'Subheader'],
    max: 3,
    countBadge: { showPlus: true, type: 'transparent' },
  },
  badges: {
    items: ['Badge', 'Badge', 'Badge', 'Badge', 'Badge'],
    max: 3,
    countBadge: { showPlus: true },
  },
  text: 'Text',
  prefixText: 'prefixText',
  postfixText: (
    <Grid container gap={3} alignItems="flex-start">
      postfixText
      <IconButton name={'OpenWide'} size={'md'} />
    </Grid>
  ),
  header: 'Header',
  subHeaderPrefix: <IconButton name={'OpenWide'} size={'sm'} />,
  icons: (
    <>
      <IconButton name={'Phone'} size={'md'} />
      <IconButton name={'Mail'} size={'md'} />
      <IconButton name={'Passport'} size={'md'} />
      <IconButton name={'Target'} size={'md'} />
    </>
  ),
  extra: (
    <>
      <Button type="outlined" size="xs" endIcon="ChevronDown">
        Открыть
      </Button>
      <IconButton name={'Close'} size={'md'} />
    </>
  ),
  avatar: { variant: 'rounded', icon: <Icon color={'inherit'} name={'File'} size={'lg'} /> },
};

Main.parameters = {
  backgrounds: {
    default: 'white',
  },
};
