import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Meta, StoryObj } from '@storybook/react';

import { Grid } from '@/components/atoms';
import { SubmitButton } from '@/components/atoms/buttons';
import { FormHandler, useForm } from '@/components/molecules/Inputs/FormHandler';

import { InputAutocompleteFormHandler, InputAutocompleteFormHandlerProps } from '../InputAutocomplete.handler';
import {
  inputAutocompleteOptions,
  InputAutocompleteOptionsMockType,
} from '../InputAutocompleteStories/InputAutocomplete.mocks';

const meta: Meta<typeof InputAutocompleteFormHandler> = {
  title: 'Molecules/Inputs/InputAutocomplete/InputAutocompleteHandlerDynamic',
  component: InputAutocompleteFormHandler,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<InputAutocompleteFormHandlerProps<InputAutocompleteOptionsMockType, boolean>>;

interface FormData<T> {
  book: T | T[] | null;
}

const val0 = inputAutocompleteOptions;
const val1 = inputAutocompleteOptions.filter((it, index) => index % 2 === 0);

export const DynamicValueUpdate: Story = {
  parameters: {
    docs: {
      description: {
        story: `
### Тестирование обновления значения из внешнего источника

Эта стори демонстрирует возможность автоматического обновления значения InputAutocompleteFormHandler 
из внешнего источника каждую секунду. Значения случайным образом меняются, имитируя обновление данных 
из внешнего API или другого компонента.

**Важно:** Это тестовая функциональность для проверки реактивности компонента. 
Поведение может выглядеть дерганым - это ожидаемое поведение для тестирования.
        `,
      },
    },
  },
  render: (args) => {
    const methods = useForm<FormData<InputAutocompleteOptionsMockType>>({
      defaultValues: {
        book: [inputAutocompleteOptions[0], inputAutocompleteOptions[2]],
      },
    });

    useEffect(() => {
      const interval = setInterval(() => {
        const randomOptions = inputAutocompleteOptions.filter((_it) => {
          return Math.round(Math.random()) === 0;
        });
        (methods.setValue as any)('book', randomOptions);
      }, 2_000);

      return () => clearInterval(interval);
    }, [methods]);

    const onSubmit = useCallback((formData: FormData<InputAutocompleteOptionsMockType>) => {
      console.log('Get a submit');
      console.log('form ', formData);
    }, []);

    return (
      <Grid container spacing={4} alignItems={'center'}>
        <Grid item xs={12}>
          <FormHandler dataTestId="testForm" methods={methods} formId={'InputAutocompleteDynamic'} onSubmit={onSubmit}>
            <Grid container spacing={4}>
              <Grid item xs={8}>
                <InputAutocompleteFormHandler {...args} name="book" />
              </Grid>
            </Grid>
          </FormHandler>
        </Grid>
        <Grid item xs={3}>
          <SubmitButton formId="InputAutocompleteDynamic">Submit</SubmitButton>
        </Grid>
      </Grid>
    );
  },
  args: {
    label: 'Обновление значения извне',
    multiple: true,
    options: inputAutocompleteOptions,
    size: 'md',
    getOptionLabel: (option) => option.name,
    isOptionEqualToValue: (option, value) => option.code === value.code,
  },
};

export const DynamicOptionsUpdate: Story = {
  parameters: {
    docs: {
      description: {
        story: `
### Тестирование динамического обновления опций

Эта стори демонстрирует возможность автоматического обновления списка опций 
InputAutocompleteFormHandler каждые 4 секунды. Опции переключаются между двумя наборами данных,
имитируя загрузку новых опций из внешнего API.

**Важно:** Это тестовая функциональность для проверки корректного обновления опций. 
Поведение может выглядеть необычно - это ожидаемое поведение для тестирования.
        `,
      },
    },
  },
  render: (args) => {
    const methods = useForm<FormData<InputAutocompleteOptionsMockType>>({
      defaultValues: {
        book: [inputAutocompleteOptions[0], inputAutocompleteOptions[2]],
      },
    });

    const optionsRef = useRef(val0);
    const [options, setOptions] = useState(val0);

    useEffect(() => {
      const interval = setInterval(() => {
        optionsRef.current = optionsRef.current === val0 ? val1 : val0;
        setOptions(optionsRef.current);
        console.log('change options', optionsRef.current.length);
      }, 5_000);

      return () => clearInterval(interval);
    }, []);

    const onSubmit = useCallback((formData: FormData<InputAutocompleteOptionsMockType>) => {
      console.log('Get a submit');
      console.log('form ', formData);
    }, []);

    return (
      <Grid container spacing={4} alignItems={'center'}>
        <Grid item xs={12}>
          <FormHandler
            dataTestId="testForm"
            methods={methods}
            formId={'InputAutocompleteDynamicOptions'}
            onSubmit={onSubmit}
          >
            <Grid container spacing={4}>
              <Grid item xs={8}>
                <InputAutocompleteFormHandler {...args} name="book" options={options} />
              </Grid>
            </Grid>
          </FormHandler>
        </Grid>
        <Grid item xs={3}>
          <SubmitButton formId="InputAutocompleteDynamicOptions">Submit</SubmitButton>
        </Grid>
      </Grid>
    );
  },
  args: {
    label: 'Динамическое обновление опций',
    multiple: true,
    options: inputAutocompleteOptions,
    size: 'md',
    getOptionLabel: (option) => option.name,
    isOptionEqualToValue: (option, value) => option.code === value.code,
  },
};

export const UpdateDataOnBlur: Story = {
  parameters: {
    docs: {
      description: {
        story: `
### Тестирование обновление значение при onBlur

Используйте флаг updateOnCloseDropdown для обновления значений после Blur
        `,
      },
    },
  },
  render: (args) => {
    const methods = useForm<FormData<InputAutocompleteOptionsMockType>>({
      defaultValues: {
        book: [inputAutocompleteOptions[0], inputAutocompleteOptions[2]],
      },
    });
    const values = methods.getValues();

    useEffect(() => {
      console.log('value change', values.book);
    }, [values.book]);

    const onSubmit = useCallback((formData: FormData<InputAutocompleteOptionsMockType>) => {
      console.log('Get a submit');
      console.log('form ', formData);
    }, []);

    return (
      <Grid container spacing={4} alignItems={'center'}>
        <Grid item xs={12}>
          <FormHandler
            dataTestId="testForm"
            methods={methods}
            formId={'InputAutocompleteDynamicOptions'}
            onSubmit={onSubmit}
          >
            <Grid container spacing={4}>
              <Grid item xs={8}>
                <InputAutocompleteFormHandler
                  updateOnCloseDropdown
                  {...args}
                  name="book"
                  options={inputAutocompleteOptions}
                />
              </Grid>
            </Grid>
          </FormHandler>
        </Grid>
        <Grid item xs={3}>
          <SubmitButton formId="InputAutocompleteDynamicOptions">Submit</SubmitButton>
        </Grid>
      </Grid>
    );
  },
  args: {
    label: 'Обновление значений после закрытия выпадающего списка',
    multiple: true,
    options: inputAutocompleteOptions,
    size: 'md',
    getOptionLabel: (option) => option.name,
    isOptionEqualToValue: (option, value) => option.code === value.code,
  },
};
