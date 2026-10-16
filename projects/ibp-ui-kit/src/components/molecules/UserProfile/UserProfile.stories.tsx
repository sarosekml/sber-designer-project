import React from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { UserProfile } from './UserProfile';

const meta: Meta<typeof UserProfile> = {
  title: 'Molecules/UserProfile',
  component: UserProfile,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    isOpen: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof UserProfile>;

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение Alert',
      },
    },
  },
  args: {
    userProfile: {
      firstName: 'Kirill',
      lastName: 'Laptev',
      position: 'Analyst',
      desks: [
        { code: 'SMB_INDUSTRIALS', departmentCode: 'DID', name: 'SMB Промышленность' },
        { code: 'SMB_INDUSTRIALS', departmentCode: 'DID', name: 'SMB Промышленность' },
      ],
    },
    dataTestId: 'stories',
    isOpen: true,
    onUserProfileClick: () => console.log('open Profile'),
    onAvatarClick: action('onAvatarClick'),
  },
};
