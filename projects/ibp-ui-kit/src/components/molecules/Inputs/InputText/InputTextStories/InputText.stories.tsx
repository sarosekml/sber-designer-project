import React, { ChangeEvent, useCallback, useState } from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { emptyString } from '@sber-ibp/core';

import { Grid } from '@/components/atoms';

import { InputText } from '../InputText';

const lorem =
  'Lorem Ipsum - это текст-"рыба", часто используемый в печати и вэб-дизайне. Lorem Ipsum является стандартной "рыбой" для текстов на латинице с начала XVI века. В то время некий безымянный печатник создал большую коллекцию размеров и форм шрифтов, используя Lorem Ipsum для распечатки образцов. Lorem Ipsum не только успешно пережил без заметных изменений пять веков, но и перешагнул в электронный дизайн. Его популяризации в новое время послужили публикация листов Letraset с образцами Lorem Ipsum в 60-х годах и, в более недавнее время, программы электронной вёрстки типа Aldus PageMaker, в шаблонах которых используется Lorem Ipsum.';

const meta: Meta<typeof InputText> = {
  title: 'Molecules/Inputs/InputText/InputText',
  component: InputText,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    disabled: { control: 'boolean' },
    multiline: { control: 'boolean' },
    isColoredBg: { control: 'boolean' },
    size: {
      options: ['sm', 'md', 'lg'],
      control: { type: 'radio' },
    },
    viewType: {
      options: ['read', 'edit', 'present'],
      control: { type: 'radio' },
    },
    value: { control: 'text' },
    label: { control: 'text' },
    helperText: { control: 'text' },
    name: { control: 'text' },
    textColor: { control: 'text' },
    minRows: { control: 'number' },
    maxRows: { control: 'number' },
    maxLength: { control: 'number' },
    placeholder: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof InputText>;

const InputTextStory = (args) => {
  const [value, setValue] = useState<string | null | undefined>(args.value);

  const onChange = useCallback(
    (newValue: string | null, _e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      console.log('Real value to upper wrapper:', newValue);
      setValue(newValue);
    },
    [setValue],
  );

  return (
    <Grid container spacing={4}>
      <Grid item xs={6}>
        <InputText {...args} value={value ?? emptyString} onChange={onChange} />
      </Grid>
    </Grid>
  );
};

const MultilineTemplate = (args) => {
  return (
    <Grid item container spacing={4} alignItems={'baseline'}>
      <Grid container item md={12} gap={10}>
        <InputText {...args} viewType={'edit'} />
        <InputText {...args} viewType={'present'} />
        <InputText {...args} viewType={'read'} />
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение InputText',
      },
    },
  },
  args: {
    label: 'Любая строка',
    name: 'anyString',
    value:
      ';)))$evfbbfb\t\n43543efb pdfvopdfmdfo goernbfnkbnk\nwegebfbfbdfb\nvbrbrbbfebebfe\ngregergere\newf0higvugvbddv',
    dataTestId: 'stories',
    disabled: false,
    helperText: 'Работаем со строкой',
    infoOptions: {
      tooltipValue: 'Информация о строке',
    },
    isColoredBg: false,
    labelOptions: {
      tooltipValue: 'Описание смысла этого поля ввода',
    },
    multiline: false,
    rows: 3,
    postfix: '###',
    prefix: '№№№',
    size: 'md',
    startAction: {
      onStartAction: () => console.log('onStartAction'),
      iconName: 'Add',
    },
    validationOptions: undefined,
    viewType: 'edit',
    minRows: 0,
    maxRows: 0,
    placeholder: 'placeholder text',
    onClear: action('onClear'),
    onInfo: action('onInfo'),
    onChange: action('onChange'),
  },
  render: (args) => <InputTextStory {...args} />,
};

export const Multiline: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Вариант использование multiline InputText',
      },
    },
  },
  args: {
    ...Main.args,
    value: lorem,
    multiline: true,
  },
  render: (args) => <MultilineTemplate {...args} />,
};
