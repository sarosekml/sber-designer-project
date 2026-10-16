import React from 'react';
import { Grid } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';

import { Icon } from '../Icon';
import { Text } from '../typography/Text';

import { DictionaryBadge } from './DictionaryBadge';
import {
  dictionaryBadgeOutlinedErrorColorThemeSx,
  dictionaryBadgeTransparentErrorColorThemeSx,
} from './DictionaryBadge.const';
import { TextBadge } from './TextBadge';

export default {
  title: 'Atoms/DictionaryBadge',
  component: DictionaryBadge,
  argTypes: {
    disabled: { control: 'boolean' },
    onClick: { table: { disable: true } },
    onDelete: { table: { disable: true } },
    dataTestId: { table: { disable: true } },
    hoverable: { control: 'boolean' },
  },
} as Meta<typeof DictionaryBadge>;

const gridSx = { rowGap: 3, columnGap: 1 };

export const Main: StoryFn<typeof DictionaryBadge> = (args) => (
  <Grid container flexDirection={'column'} spacing={3} gap={3}>
    <Grid container item sx={gridSx}>
      <Text dataTestId="test">args:</Text>
      <DictionaryBadge {...args} />
    </Grid>

    <Grid container item sx={gridSx}>
      <Text dataTestId="test">default all props:</Text>
      <DictionaryBadge component="Chip" dataTestId={args.dataTestId} code={args.code} name={args.code} />
    </Grid>

    <Grid container item sx={gridSx}>
      <Text dataTestId="test">sizes:</Text>
      <DictionaryBadge {...args} size="sm" />
      <DictionaryBadge {...args} size="md" />
      <DictionaryBadge {...args} size="lg" />
    </Grid>

    <Grid container item sx={gridSx}>
      <Text dataTestId="test">types:</Text>
      <DictionaryBadge {...args} type="edit" />
      <DictionaryBadge {...args} type="read" />
    </Grid>

    <Grid container item sx={gridSx}>
      <Text dataTestId="test">colors:</Text>
      <DictionaryBadge
        {...args}
        colorThemeSx={(theme) => ({
          backgroundColor: theme.palette.Success.SuccessBG,
          borderColor: theme.palette.Success.SuccessDark,
          textColor: theme.palette.Text.TextOnDark,
          backgroundColorHover: theme.palette.Success.SuccessDark,
          borderColorHover: theme.palette.Success.Success,
        })}
      />
      <DictionaryBadge
        {...args}
        colorThemeSx={(theme) => ({
          backgroundColor: theme.palette.Warning.WarningBG,
          borderColor: theme.palette.Warning.WarningDark,
          textColor: theme.palette.Text.TextOnDark,
          backgroundColorHover: theme.palette.Warning.WarningDark,
          borderColorHover: theme.palette.Warning.Warning,
        })}
      />
      <DictionaryBadge {...args} variant="outlined" colorThemeSx={dictionaryBadgeOutlinedErrorColorThemeSx} />
      <DictionaryBadge {...args} variant="transparent" colorThemeSx={dictionaryBadgeTransparentErrorColorThemeSx} />
    </Grid>

    <Grid container item sx={gridSx}>
      <Text dataTestId="test">variants:</Text>
      <DictionaryBadge {...args} variant="outlined" />
      <DictionaryBadge {...args} variant="transparent" />
    </Grid>

    <Grid container item sx={gridSx}>
      <Text dataTestId="test">a lot of items:</Text>
      <DictionaryBadge {...args} code={'1'} name={'Аналитик/консультант: Петров С.В., Сидоров А.А., Иванов М.А.'} />
      <DictionaryBadge {...args} code={'2'} name={'Аналитик/консультант: Петров С.В., Сидоров А.А., Иванов М.А.'} />
      <DictionaryBadge {...args} code={'3'} name={'Аналитик/консультант: Петров С.В., Сидоров А.А., Иванов М.А.'} />
      {[...Array(15).keys()].map((i) => (
        <DictionaryBadge {...args} key={i} />
      ))}
      <DictionaryBadge
        {...args}
        code="1"
        name='Lorem Ipsum - это текст-"рыба", часто используемый в печати и вэб-дизайне. Lorem Ipsum является стандартной "рыбой" для текстов на латинице с начала XVI века. В то время некий безымянный печатник создал большую коллекцию размеров и форм шрифтов, используя Lorem Ipsum для распечатки образцов. Lorem Ipsum не только успешно пережил без заметных изменений пять веков, но и перешагнул в электронный дизайн. Его популяризации в новое время послужили публикация листов Letraset с образцами Lorem Ipsum в 60-х годах и, в более недавнее время, программы электронной вёрстки типа Aldus PageMaker, в шаблонах которых используется Lorem Ipsum.'
      />
    </Grid>

    <Grid container item sx={gridSx}>
      <Text dataTestId="test">With TextBadge:</Text>
      <DictionaryBadge {...args} name="Иванов Иван" startIcon={<TextBadge>Иванов Иван</TextBadge>} />
      <DictionaryBadge {...args} startIcon={<TextBadge>{args.name}</TextBadge>} />
    </Grid>

    <Grid container item sx={gridSx}>
      <Text dataTestId="test">Markers:</Text>
      <DictionaryBadge {...args} component="Marker" />

      <Grid item>
        <DictionaryBadge
          code={'Marker'}
          name={'Marker'}
          size={'md'}
          component={'Marker'}
          startIcon={<Icon name={'ClockTimer'} size="sm" />}
          endIcon={<Icon name={'ClockTimer'} size="sm" />}
          type="read"
          colorThemeSx={{ textColor: 'red' }}
        />
      </Grid>

      <Grid item>
        <DictionaryBadge
          hoverable={false}
          code={'Marker'}
          name={'Hoverable false'}
          size={'md'}
          component={'Marker'}
          startIcon={<Icon name={'ClockTimer'} size="sm" />}
          endIcon={<Icon name={'ClockTimer'} size="sm" />}
          type="read"
          colorThemeSx={{ textColor: 'green' }}
        />
      </Grid>

      <DictionaryBadge
        dataTestId="Filled"
        colorThemeSx={(theme) => ({
          textColor: theme.palette.Text.TextOnDark,
          backgroundColor: theme.palette.Warning.Warning,
        })}
        code="Filled"
        name="Filled"
        component="Marker"
      />
      <DictionaryBadge code="1" name="Marker 1 - 100%" sx={{ width: '100%' }} component="Marker" />
      <DictionaryBadge code="2" name="Marker 2 - 300px" sx={{ width: '300px' }} component="Marker" />
      <DictionaryBadge code="3" name="Marker 3 - default" component="Marker" />
      <Grid width={'100%'}>
        <Grid pt={4} pb={2}>
          <Text>Show ellipsis on marker code if it doesn`t fit marker container</Text>
        </Grid>
        <Grid width={200}>
          <DictionaryBadge
            code="14"
            name="Marker 4 - very long marker to test tooltip on ellipsis"
            component="Marker"
          />
        </Grid>
      </Grid>
    </Grid>
  </Grid>
);
Main.args = {
  dataTestId: 'stories',
  variant: 'outlined',
  code: 'Atoms/DictionaryBadge',
  name: 'Atoms/DictionaryBadge',
  component: 'Chip',
  size: 'md',
  type: 'edit',
  disabled: false,
};

Main.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story: 'Atoms/DictionaryBadge',
    },
  },
};
