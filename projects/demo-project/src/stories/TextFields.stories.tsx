import type { Meta, StoryObj } from '@storybook/react-vite';

import { Field, SearchField, Textarea, TextInput } from '../components/primitives';
import { describeComponent, describeStory, inputDescription } from '../storybook/descriptions';

function TextFields() {
  return (
    <div className="demo-section-stack" style={{ maxWidth: 760 }}>
      <Field label="Название актива" required>
        <TextInput defaultValue="Норильский Никель" />
      </Field>
      <Field label="Поиск">
        <SearchField placeholder="Найти актив, фонд или идею..." />
      </Field>
      <Field label="E-mail" hint="Уведомления об изменениях отправляются на этот адрес.">
        <TextInput defaultValue="invest-ideas@interos.ru" type="email" />
      </Field>
      <Field label="Комментарий">
        <Textarea placeholder="Опишите инвестиционную идею..." />
      </Field>
      <Field label="Неверное значение" error="Введите сумму в рублях.">
        <TextInput defaultValue="не число" invalid />
      </Field>
      <Field label="Только для чтения">
        <TextInput defaultValue="987 650 000 000" disabled />
      </Field>
    </div>
  );
}

const meta = {
  title: 'Components/Text Fields',
  component: TextInput,
  tags: ['autodocs'],
  parameters: describeComponent(inputDescription),
  args: {
    placeholder: 'Норильский Никель',
  },
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextInputDefault: Story = {
  name: 'Text Input',
  args: {
    defaultValue: 'Норильский Никель',
  },
};

export const TextFieldsSet: Story = {
  name: 'Text Fields Set',
  render: () => <TextFields />,
  parameters: describeStory(inputDescription),
};

export const Invalid: Story = {
  args: {
    defaultValue: 'не число',
    invalid: true,
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: '987 650 000 000',
    disabled: true,
  },
};
