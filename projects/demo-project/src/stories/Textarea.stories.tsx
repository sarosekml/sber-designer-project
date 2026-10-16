import type { Meta, StoryObj } from '@storybook/react-vite';

import { Field, Textarea } from '../components/primitives';
import { describeComponent, describeStory, inputDescription } from '../storybook/descriptions';

const meta = {
  title: 'Components/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  parameters: describeComponent(inputDescription),
  args: {
    placeholder: 'Опишите инвестиционную идею...',
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: () => (
    <div style={{ maxWidth: 760 }}>
      <Field label="Комментарий">
        <Textarea placeholder="Опишите инвестиционную идею..." />
      </Field>
    </div>
  ),
  parameters: describeStory({
    purpose: 'Labeled textarea for longer comments and investment ideas.',
    agentGuidance: inputDescription.agentGuidance,
  }),
};

export const Invalid: Story = {
  args: {
    defaultValue: 'Слишком коротко',
    invalid: true,
  },
};
