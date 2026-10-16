import type { Meta, StoryObj } from '@storybook/react-vite';

import { CommandSearch, Field } from '../components/primitives';
import {
  commandSearchDescription,
  describeComponent,
  describeStory,
} from '../storybook/descriptions';

const meta = {
  title: 'Components/Command Search',
  component: CommandSearch,
  tags: ['autodocs'],
  parameters: describeComponent(commandSearchDescription),
  args: {
    placeholder: 'Поиск по платформе...',
    shortcut: '⌘K',
  },
} satisfies Meta<typeof CommandSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: describeStory(commandSearchDescription),
};

export const WithLabel: Story = {
  render: () => (
    <Field label="Поиск-бокс (топбар)">
      <CommandSearch placeholder="Поиск по платформе..." />
    </Field>
  ),
};
