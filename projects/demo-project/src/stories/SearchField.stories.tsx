import type { Meta, StoryObj } from '@storybook/react-vite';

import { Field, SearchField } from '../components/primitives';
import { describeComponent, describeStory, inputDescription } from '../storybook/descriptions';

const meta = {
  title: 'Components/Search Field',
  component: SearchField,
  tags: ['autodocs'],
  parameters: describeComponent(inputDescription),
  args: {
    placeholder: 'Найти актив, фонд или идею...',
  },
} satisfies Meta<typeof SearchField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: () => (
    <div style={{ maxWidth: 760 }}>
      <Field label="Поиск">
        <SearchField placeholder="Найти актив, фонд или идею..." />
      </Field>
    </div>
  ),
  parameters: describeStory({
    purpose: 'Local search field with leading icon for lists, tables, and panel filtering.',
    agentGuidance: inputDescription.agentGuidance,
  }),
};
