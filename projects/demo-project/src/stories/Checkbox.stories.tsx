import type { Meta, StoryObj } from '@storybook/react-vite';

import { Checkbox, Field } from '../components/primitives';
import { checkboxDescription, describeComponent, describeStory } from '../storybook/descriptions';

function CheckboxGroup() {
  return (
    <Field label="Доступ">
      <div className="stack" style={{ gap: 8 }}>
        <Checkbox defaultChecked label="Фонд-менеджер" />
        <Checkbox defaultChecked label="Аналитик" />
        <Checkbox label="Внешний консультант" />
      </div>
    </Field>
  );
}

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: describeComponent(checkboxDescription),
  args: {
    label: 'Фонд-менеджер',
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
};

export const Group: Story = {
  render: () => <CheckboxGroup />,
  parameters: describeStory(checkboxDescription),
};
