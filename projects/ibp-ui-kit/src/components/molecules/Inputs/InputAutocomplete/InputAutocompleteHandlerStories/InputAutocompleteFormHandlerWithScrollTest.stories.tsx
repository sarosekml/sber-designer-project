import React, { useCallback } from 'react';
import { Meta, StoryObj } from '@storybook/react';

import { Grid, Icon } from '@/components/atoms';
import { SubmitButton } from '@/components/atoms/buttons';
import { FormHandler, useForm } from '@/components/molecules/Inputs/FormHandler';

import { InputAutocompleteFormHandler, InputAutocompleteFormHandlerProps } from '../InputAutocomplete.handler';

type OptionType = {
  code: string;
  name: string;
  group: string;
  helperText: string;
  icon: JSX.Element;
};

interface FormData<T> {
  autocomplete1: T | T[] | null;
  autocomplete2: T | T[] | null;
  autocomplete3: T | T[] | null;
}

const generateOptions = (): OptionType[] =>
  Array.from({ length: 100 }, (_, i) => ({
    code: `book_${i}`,
    name: `Книга ${i + 1} - Очень длинное название для тестирования скролла`,
    group: i < 50 ? 'Группа A' : 'Группа B',
    helperText: `Дополнительная информация о книге ${i + 1}`,
    icon: <Icon name={'BookmarkCheck'} />,
  }));

const OPTIONS = generateOptions();

const meta: Meta<InputAutocompleteFormHandlerProps<OptionType, boolean>> = {
  title: 'Molecules/Inputs/InputAutocomplete/InputAutocompleteFormHandlerWithScrollTest',
  component: InputAutocompleteFormHandler,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<InputAutocompleteFormHandlerProps<OptionType, boolean>>;

export const InputAutocompleteFormHandlerWithScrollTest: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Тестирование сохранения позиции скролла при выборе элементов внизу списка для форм-хендлера',
      },
    },
  },
  render: (args) => {
    const methods = useForm<FormData<OptionType>>({
      defaultValues: {
        autocomplete1: [],
        autocomplete2: [OPTIONS[20], OPTIONS[25], OPTIONS[30]],
        autocomplete3: [OPTIONS[80]],
      },
    });

    const commonArgs = {
      ...args,
      label: 'Тест скролла (outerChip)',
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
      onChange: (value) => console.log('Selected books:', value),
    };

    const onSubmit = useCallback((formData: FormData<OptionType>) => {
      console.log('Get a submit');
      console.log('form data:', formData);
    }, []);

    return (
      <Grid container spacing={4} alignItems={'center'}>
        <Grid item xs={12}>
          <FormHandler
            dataTestId="testForm"
            methods={methods}
            formId={'InputAutocompleteScrollTest'}
            onSubmit={onSubmit}
          >
            <Grid container spacing={4}>
              <Grid item xs={12}>
                <InputAutocompleteFormHandler {...commonArgs} name="autocomplete1" />
              </Grid>
              <Grid item xs={12}>
                <InputAutocompleteFormHandler {...commonArgs} name="autocomplete2" />
              </Grid>
              <Grid item xs={12}>
                <InputAutocompleteFormHandler {...commonArgs} name="autocomplete3" />
              </Grid>
            </Grid>
          </FormHandler>
        </Grid>
        <Grid item xs={3}>
          <SubmitButton formId="InputAutocompleteScrollTest">Submit</SubmitButton>
        </Grid>
      </Grid>
    );
  },
  args: {},
};
