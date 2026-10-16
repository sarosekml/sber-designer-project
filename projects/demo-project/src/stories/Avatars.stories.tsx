import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar } from '../components/primitives';
import { avatarDescription, describeComponent, describeStory } from '../storybook/descriptions';

function AvatarsPreview() {
  return (
    <div className="demo-section-stack">
      <div className="demo-story-row">
        <Avatar size="xs" tone="emerald">
          ПС
        </Avatar>
        <Avatar size="sm" tone="violet">
          ВП
        </Avatar>
        <Avatar size="md" tone="amber">
          АК
        </Avatar>
        <Avatar size="lg" tone="blue">
          МТ
        </Avatar>
        <Avatar size="xl" tone="rose">
          ЕМ
        </Avatar>
      </div>

      <div>
        <div className="sub-title" style={{ margin: '4px 0 14px' }}>
          Группы
        </div>
        <div className="avatar-stack">
          <Avatar tone="emerald">ПС</Avatar>
          <Avatar tone="violet">ВП</Avatar>
          <Avatar tone="amber">АК</Avatar>
          <Avatar tone="blue">МТ</Avatar>
          <Avatar tone="neutral">+5</Avatar>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/Avatars',
  component: AvatarsPreview,
  tags: ['autodocs'],
  parameters: describeComponent(avatarDescription),
} satisfies Meta<typeof AvatarsPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  parameters: describeStory(avatarDescription),
};

export const Stack: Story = {
  render: () => (
    <div className="avatar-stack">
      <Avatar tone="emerald">ПС</Avatar>
      <Avatar tone="violet">ВП</Avatar>
      <Avatar tone="amber">АК</Avatar>
      <Avatar tone="blue">МТ</Avatar>
      <Avatar tone="neutral">+5</Avatar>
    </div>
  ),
  parameters: describeStory(avatarDescription),
};
