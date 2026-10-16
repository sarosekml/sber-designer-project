import type { Meta, StoryObj } from '@storybook/react-vite';

import { Field, Toggle } from '../components/primitives';
import { describeComponent, describeStory, toggleDescription } from '../storybook/descriptions';

function ToggleGroup() {
  return (
    <Field label="Оповещения">
      <div className="stack" style={{ gap: 10 }}>
        <Toggle defaultChecked label="E-mail дайджест" />
        <Toggle label="Push-уведомления" />
        <Toggle defaultChecked label="AI-рекомендации" />
      </div>
    </Field>
  );
}

const meta = {
  title: 'Components/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  parameters: describeComponent(toggleDescription),
  args: {
    label: 'E-mail дайджест',
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = {
  args: {
    defaultChecked: true,
  },
};

export const Group: Story = {
  render: () => <ToggleGroup />,
  parameters: describeStory(toggleDescription),
};
