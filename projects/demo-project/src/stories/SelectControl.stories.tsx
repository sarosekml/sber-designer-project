import type { Meta, StoryObj } from '@storybook/react-vite';

import { Field, SelectControl } from '../components/primitives';
import { describeComponent, describeStory, selectDescription } from '../storybook/descriptions';

function SelectExample() {
  return (
    <div style={{ maxWidth: 760 }}>
      <Field label="Отрасль">
        <SelectControl defaultValue="metal">
          <option value="hotel">Отели, рестораны и объекты досуга</option>
          <option value="metal">Металлы и руды</option>
          <option value="pharma">Фармацевтика</option>
          <option value="bank">Банки</option>
        </SelectControl>
      </Field>
    </div>
  );
}

const meta = {
  title: 'Components/Select',
  component: SelectControl,
  tags: ['autodocs'],
  parameters: describeComponent(selectDescription),
} satisfies Meta<typeof SelectControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <SelectExample />,
  parameters: describeStory(selectDescription),
};

export const Disabled: Story = {
  render: () => (
    <div style={{ maxWidth: 760 }}>
      <Field label="Отрасль">
        <SelectControl defaultValue="metal" disabled>
          <option value="metal">Металлы и руды</option>
        </SelectControl>
      </Field>
    </div>
  ),
};
