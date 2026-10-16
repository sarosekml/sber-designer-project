import type { Meta, StoryObj } from '@storybook/react-vite';

import { Field, Radio } from '../components/primitives';
import { describeComponent, describeStory, radioDescription } from '../storybook/descriptions';

function RadioGroup() {
  return (
    <Field label="Приоритет">
      <div className="row-sm">
        <Radio label="Низкий" name="priority" />
        <Radio label="Средний" name="priority" />
        <Radio defaultChecked label="Высокий" name="priority" />
      </div>
    </Field>
  );
}

const meta = {
  title: 'Components/Radio',
  component: Radio,
  tags: ['autodocs'],
  parameters: describeComponent(radioDescription),
  args: {
    label: 'Высокий',
    name: 'priority-story',
  },
} satisfies Meta<typeof Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
};

export const Group: Story = {
  render: () => <RadioGroup />,
  parameters: describeStory(radioDescription),
};
