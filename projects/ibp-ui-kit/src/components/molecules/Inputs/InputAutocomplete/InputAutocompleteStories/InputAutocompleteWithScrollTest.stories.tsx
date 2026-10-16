import React, { useCallback, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Grid, Icon } from '@/components/atoms';

import { InputAutocomplete } from '../InputAutocomplete';
import { InputAutocompleteProps } from '../InputAutocomplete.types';

type OptionType = {
  code: string;
  name: string;
  group: string;
  helperText: string;
  icon: JSX.Element;
};

const generateOptions = (): OptionType[] =>
  Array.from({ length: 100 }, (_, i) => ({
    code: `item_${i}`,
    name: `Элемент ${i + 1} - Очень длинное название для тестирования скролла`,
    group: i < 50 ? 'Группа A' : 'Группа B',
    helperText: `Дополнительная информация о элементе ${i + 1}`,
    icon: <Icon name={'User'} />,
  }));

const OPTIONS = generateOptions();

const meta: Meta<InputAutocompleteProps<OptionType, boolean>> = {
  title: 'Molecules/Inputs/InputAutocomplete/InputAutocompleteWithScrollTest',
  component: InputAutocomplete,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<InputAutocompleteProps<OptionType, boolean>>;

export const InputAutocompleteWithScrollTest: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Тестирование сохранения позиции скролла при выборе элементов внизу списка',
      },
    },
  },
  render: () => {
    const [firstValue, setFirstValue] = useState<OptionType[]>([]);
    const [secondValue, setSecondValue] = useState<OptionType[]>([OPTIONS[20], OPTIONS[25], OPTIONS[30]]);
    const [thirdValue, setThirdValue] = useState<OptionType[]>([OPTIONS[50]]);

    const handleChange = useCallback(
      (setter: React.Dispatch<React.SetStateAction<OptionType[]>>) => (value) => {
        console.log('Selected values:', value);
        setter(value);
      },
      [],
    );

    const commonArgs = {
      label: 'Тестовый список с длинным содержимым',
      multiple: true as const,
      viewFormat: 'outerChip' as const,
      viewType: 'edit' as const,
      options: OPTIONS,
      size: 'md' as const,
      getOptionLabel: (option: OptionType) => option.name,
      getOptionIdentifier: (option: OptionType) => option.code,
      isOptionEqualToValue: (option: OptionType, value: OptionType) => option.code === value.code,
      hasClearIndicator: true,
      hasSelectAll: true,
      dataTestId: 'ScrollTestAutocomplete',
    };

    return (
      <Grid container spacing={4}>
        <Grid item xs={12}>
          <InputAutocomplete
            {...commonArgs}
            value={firstValue}
            onChange={handleChange(setFirstValue)}
            name="autocomplete-1"
          />
          <InputAutocomplete
            {...commonArgs}
            value={secondValue}
            onChange={handleChange(setSecondValue)}
            name="autocomplete-2"
          />
          <InputAutocomplete
            {...commonArgs}
            value={thirdValue}
            onChange={handleChange(setThirdValue)}
            name="autocomplete-3"
          />
        </Grid>
      </Grid>
    );
  },
};
