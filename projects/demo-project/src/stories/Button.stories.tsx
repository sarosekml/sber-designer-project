import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button, KebabButton } from '../components/primitives';
import { buttonDescription, describeComponent, describeStory } from '../storybook/descriptions';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: describeComponent(buttonDescription),
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger', 'dangerOutline', 'link'],
    },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
    },
  },
  args: {
    children: 'Button',
    variant: 'primary',
    size: 'md',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="demo-story-row">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="dangerOutline">Danger outline</Button>
      <Button variant="link">Link action</Button>
    </div>
  ),
  parameters: describeStory({
    ...buttonDescription,
    purpose: 'Canonical button palette for generated screens.',
  }),
};

export const Sizes: Story = {
  render: () => (
    <div className="demo-story-row">
      <Button size="sm">Small</Button>
      <Button>Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const IconButtons: Story = {
  render: () => (
    <div className="demo-story-row">
      <KebabButton size="sm" />
      <KebabButton />
      <KebabButton size="lg" />
    </div>
  ),
  parameters: describeStory({
    purpose: 'Icon-only kebab menu buttons for compact row, card, and toolbar actions.',
    agentGuidance: [
      'Use KebabButton for overflow menus and secondary object actions.',
      'Always provide a meaningful aria-label when the action scope is specific.',
      'Do not use a text button when a familiar overflow icon is enough.',
    ],
  }),
};

export const States: Story = {
  render: () => (
    <div className="demo-story-row">
      <Button>Normal</Button>
      <Button style={{ background: 'var(--c-accent-2)' }}>Hover</Button>
      <Button style={{ background: 'oklch(0.50 0.14 155)' }}>Active</Button>
      <Button disabled>Disabled</Button>
      <Button loading>Loading...</Button>
    </div>
  ),
};
