import React, { useCallback, useState } from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { Grid } from '@/components/atoms';

import {
  branchesMock,
  currenciesMock,
  defaultFilters,
  departmentsMock,
  desksMock,
  FormData,
} from '../FormConstructor/FormConstructor.mocks';

import { FiltersChips } from './FiltersChips';
import { filtersChipsConfig } from './FiltersChips.mocks';
import { clearTableFilters } from './FiltersChips.utils';

export default {
  title: 'Organisms/FiltersChips',
  component: FiltersChips,
  argTypes: {
    width: { control: 'number' },
    height: { control: 'number' },
    trimmingLength: { control: 'number' },
    disabled: { control: 'boolean' },
    fullScreen: { control: 'boolean' },
    onClearFilter: { table: { disable: true } },
    onClearAllFilters: { table: { disable: true } },
  },
} as Meta<typeof FiltersChips>;

const initFilters: FormData = {
  amount: 1000,
  branch: branchesMock[0],
  creationDate: {
    from: '2022-01-20',
    to: '2022-02-22',
  },
  currencies: currenciesMock,
  departments: [departmentsMock[0]],
  desks: desksMock,
  isActive: true,
  lastUpdate: '15.01.2022',
  price: {
    from: 500,
    to: 5000,
  },
  project: 'Project 1',
  kmStateTypes: null,
};

const Template: StoryFn<typeof FiltersChips> = (args) => {
  const [filters, setFilters] = useState(initFilters);

  const onClearFilters = useCallback(
    (filterIds?: (keyof FormData)[]) => {
      if (!filterIds) {
        return setFilters(defaultFilters);
      }

      const newFilters = clearTableFilters(filterIds, filters);
      setFilters(newFilters);
    },
    [filters, setFilters],
  );
  return (
    <Grid container spacing={4}>
      <Grid container item rowGap={1} alignItems={'center'}>
        <FiltersChips
          {...args}
          filters={filters}
          filtersChipsConfig={filtersChipsConfig}
          onClearFilters={onClearFilters}
        />
      </Grid>
    </Grid>
  );
};

export const BaseTemplate: StoryFn<typeof FiltersChips> = Template.bind({});
BaseTemplate.args = {};
