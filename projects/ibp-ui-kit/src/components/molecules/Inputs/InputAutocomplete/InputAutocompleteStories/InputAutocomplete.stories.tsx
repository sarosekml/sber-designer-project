import React, { useCallback, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';

import { Grid } from '@/components/atoms';

import { InputAutocomplete } from '../InputAutocomplete';
import { InputAutocompleteProps } from '../InputAutocomplete.types';

import {
  autocompleteArgsConfig,
  inputAutocompleteOptions,
  InputAutocompleteOptionsMockType,
} from './InputAutocomplete.mocks';

const meta: Meta<InputAutocompleteProps<InputAutocompleteOptionsMockType, boolean>> = {
  title: 'Molecules/Inputs/InputAutocomplete/InputAutocomplete',
  component: InputAutocomplete,
  tags: ['autodocs'],
  argTypes: autocompleteArgsConfig,
};

export default meta;
type Story = StoryObj<InputAutocompleteProps<InputAutocompleteOptionsMockType, boolean>>;

const useLazyGetDictionary = () => {
  const [isLoading, setIsLoading] = useState(false);
  let data: InputAutocompleteOptionsMockType[] = [];

  const getData = async (value: string) => {
    setIsLoading(true);
    return new Promise<InputAutocompleteOptionsMockType[]>((resolve, _reject) => {
      setTimeout(() => {
        data = inputAutocompleteOptions.filter((it) => it.name.search(value) !== -1);
        setIsLoading(false);
        resolve(data);
      }, 3000);
    });
  };
  return {
    getDictionary: async (value: string) => {
      return await getData(value);
    },
    isLoading,
  };
};

const InputAutocompleteTemplate = (args) => {
  const { getDictionary, isLoading } = useLazyGetDictionary();
  const onChange = useCallback(() => {
    console.log('onClear');
  }, []);

  return (
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <InputAutocomplete
          {...args}
          onInputChange={undefined}
          onChange={onChange}
          asyncOptions={{ ...args.asyncOptions, isLoading: isLoading, loadData: getDictionary }}
        />
      </Grid>
    </Grid>
  );
};

const MainComponentOptionsTemplate = ({ singleValue, multipleValue, ...args }: any) => {
  const spacing = 4;
  const colWidth = 3;

  return (
    <Grid container spacing={spacing}>
      <Grid item container spacing={spacing}>
        <Grid item md={colWidth} />
        <Grid item md={colWidth}>
          <Typography>L</Typography>
        </Grid>
        <Grid item md={colWidth}>
          <Typography>M</Typography>
        </Grid>
        <Grid item md={colWidth}>
          <Typography>S</Typography>
        </Grid>
      </Grid>

      <Grid item container spacing={spacing} alignItems={'baseline'}>
        <Grid item md={colWidth} alignSelf={'center'}>
          <Typography>Form Default Text</Typography>
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete {...args} onInputChange={undefined} value={singleValue} multiple={false} size={'lg'} />
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete {...args} onInputChange={undefined} value={singleValue} multiple={false} size={'md'} />
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete {...args} onInputChange={undefined} value={singleValue} multiple={false} size={'sm'} />
        </Grid>
      </Grid>

      <Grid item container spacing={spacing} alignItems={'baseline'}>
        <Grid item md={colWidth} alignSelf={'center'}>
          <Typography>Form Default Chips</Typography>
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete {...args} onInputChange={undefined} value={multipleValue} multiple={true} size={'lg'} />
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete {...args} onInputChange={undefined} value={multipleValue} multiple={true} size={'md'} />
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete {...args} onInputChange={undefined} value={multipleValue} multiple={true} size={'sm'} />
        </Grid>
      </Grid>

      <Grid item container spacing={spacing} alignItems={'baseline'}>
        <Grid item md={colWidth} alignSelf={'center'}>
          <Typography>Table ReadOnly Markers</Typography>
        </Grid>
        <Grid item md={colWidth} maxWidth={'100%'}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            value={multipleValue}
            viewType="read"
            viewFormat="marker"
            multiple={true}
            size={'lg'}
            valueIndicator={'marker'}
          />
        </Grid>
        <Grid item md={colWidth} maxWidth={'100%'}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            value={multipleValue}
            viewType="read"
            viewFormat="marker"
            multiple={true}
            size={'md'}
            valueIndicator={'marker'}
          />
        </Grid>
        <Grid item md={colWidth} maxWidth={'100%'}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            value={multipleValue}
            viewType="read"
            viewFormat="marker"
            multiple={true}
            size={'sm'}
            valueIndicator={'marker'}
          />
        </Grid>
      </Grid>

      <Grid item container spacing={spacing} alignItems={'baseline'}>
        <Grid item md={colWidth} alignSelf={'center'}>
          <Typography>Layout ReadOnly Text</Typography>
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            viewType="read"
            value={singleValue}
            multiple={false}
            size={'lg'}
          />
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            viewType="read"
            value={singleValue}
            multiple={false}
            size={'md'}
          />
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            viewType="read"
            value={singleValue}
            multiple={false}
            size={'sm'}
          />
        </Grid>
      </Grid>

      <Grid item container spacing={spacing} alignItems={'baseline'}>
        <Grid item md={colWidth} alignSelf={'center'}>
          <Typography>Layout ReadOnly Chips</Typography>
        </Grid>
        <Grid item md={colWidth} maxWidth={'100%'}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            viewType="read"
            value={multipleValue as InputAutocompleteOptionsMockType[]}
            multiple={true}
            size={'lg'}
          />
        </Grid>
        <Grid item md={colWidth} maxWidth={'100%'}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            viewType="read"
            value={multipleValue}
            multiple={true}
            size={'md'}
          />
        </Grid>
        <Grid item md={colWidth} maxWidth={'100%'}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            viewType="read"
            value={multipleValue}
            multiple={true}
            size={'sm'}
          />
        </Grid>
      </Grid>

      <Grid item container spacing={spacing} alignItems={'baseline'}>
        <Grid item md={colWidth} alignSelf={'center'}>
          <Typography>Layout ReadOnly Markers</Typography>
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            viewType="read"
            value={multipleValue}
            multiple={true}
            valueIndicator={'marker'}
            size={'lg'}
          />
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            viewType="read"
            value={multipleValue}
            multiple={true}
            valueIndicator={'marker'}
            size={'md'}
          />
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            viewType="read"
            value={multipleValue}
            multiple={true}
            valueIndicator={'marker'}
            size={'sm'}
          />
        </Grid>
      </Grid>

      <Grid item container spacing={spacing} alignItems={'baseline'}>
        <Grid item md={colWidth} alignSelf={'center'}>
          <Typography>Readonly singleValue</Typography>
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            viewType="read"
            value={undefined}
            multiple={false}
            size={'lg'}
            postfix={undefined}
            prefix={undefined}
          />
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            viewType="read"
            value={undefined}
            multiple={false}
            size={'md'}
            postfix={undefined}
            prefix={undefined}
          />
        </Grid>
        <Grid item md={colWidth}>
          <InputAutocomplete
            {...args}
            onInputChange={undefined}
            viewType="read"
            value={undefined}
            multiple={false}
            size={'sm'}
            postfix={undefined}
            prefix={undefined}
          />
        </Grid>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение InputAutocomplete',
      },
    },
  },
  args: {
    label: 'Лучшие книги мира',
    labelOptions: { tooltipValue: 'Получите максимум удовольствия от прочтения' },
    prefix: '@@',
    postfix: '$$',
    startAction: {
      iconName: 'Search',
      onStartAction: () => console.log('onStartAction'),
    },
    onInfo: () => console.log('onInfo'),
    multiple: true,
    viewFormat: 'text',
    viewType: 'edit',
    value: undefined,
    options: inputAutocompleteOptions,
    size: 'md',
    infoOptions: {
      tooltipValue: 'Здесь может быть какая-то полезная информация о книгах',
    },
    disabled: false,
    dataTestId: 'TestExample',
    getOptionLabel: (option) => option.name,
    getOptionIdentifier: (option) => option.code,
    optionsGroupBy: (option) => option.group,
    isOptionEqualToValue: (option, value) => option.code === value.code,
    hasClearIndicator: true,
    hasSelectAll: true,
  },
};

export const MainComponentOptions: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты использования InputAutocomplete',
      },
    },
  },
  args: {
    label: 'Лучшие книги мира',
    labelOptions: { tooltipValue: 'Получите максимум удовольствия от прочтения' },
    prefix: '@@',
    postfix: '$$',
    startAction: {
      iconName: 'Search',
      onStartAction: () => console.log('onStartAction'),
    },
    multipleOptions: {
      visibleItemsCount: 2,
    },
    onInfo: action('onInfo'),
    // @ts-ignore
    onClear: action('onClear'),
    multiple: false,
    viewFormat: 'text',
    viewType: 'edit',
    value: undefined,
    singleValue: inputAutocompleteOptions[0],
    multipleValue: inputAutocompleteOptions.filter((_, index) => index % 2 === 0),
    options: inputAutocompleteOptions,
    size: 'md',
    infoOptions: {
      tooltipValue: 'Здесь может быть какая-то полезная информация о книгах',
    },
    disabled: false,
    dataTestId: 'TestExample',
    getOptionLabel: (option) => option.name,
    optionsGroupBy: (option) => option.group,
    isOptionEqualToValue: (option, value) => option.code === value.code,
  },
  render: (args) => <MainComponentOptionsTemplate {...args} onInputChange={undefined} />,
};

export const InputAutocompleteAsyncOptions: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты использования InputAutocomplete',
      },
    },
  },
  args: {
    label: 'Лучшие книги мира',
    labelOptions: { tooltipValue: 'Получите максимум удовольствия от прочтения' },
    prefix: '@@',
    postfix: '$$',
    startAction: {
      iconName: 'Search',
      onStartAction: () => console.log('onStartAction'),
    },
    onInfo: () => console.log('onInfo'),
    multiple: true,
    viewFormat: 'marker',
    viewType: 'edit',
    value: [inputAutocompleteOptions[0], inputAutocompleteOptions[1], inputAutocompleteOptions[2]],
    multipleOptions: {
      staticValues: [inputAutocompleteOptions[1]],
      visibleItemsCount: 2,
    },
    options: inputAutocompleteOptions,
    size: 'md',
    infoOptions: {
      tooltipValue: 'Здесь может быть какая-то полезная информация о книгах',
    },
    disabled: false,
    dataTestId: 'TestExample',
    getOptionLabel: (option) => option.name,
    optionsGroupBy: (option) => option.group,
    isOptionEqualToValue: (option, value) => option.code === value.code,
    asyncOptions: {
      isLoading: false,
      loadData: () => Promise.resolve([]),
      minSearchCount: 3,
      userInputDelay: 500,
    },
    renderOptions: (option) => {
      return (
        <Box sx={{ display: 'flex', alignItems: 'start', flexDirection: 'column', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Box sx={{ width: 'auto', pr: '16px' }}>{option.icon}</Box>
            <Box sx={{ width: '100%' }}>{option.name}</Box>
          </Box>
          <Box sx={{ width: 'auto', color: 'lightGrey', fontSize: '12px', pt: '4px' }}>{option.helperText}</Box>
        </Box>
      );
    },
    onChange: (value) => console.log('Selected values:', value),
    helperText: 'Знание сила',
    onInputChange: (value) => console.log(value),
  },
  render: (args) => <InputAutocompleteTemplate {...args} />,
};
