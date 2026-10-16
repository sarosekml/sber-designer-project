import type { Meta, StoryObj } from '@storybook/react';

import { Test3OpencodeTextT7 } from '../../../screens/Megatest-03/Test3OpencodeTextT7';

const meta = {
  title: 'Screens/Megatest-03/test3-opencode-text-T7',
  component: Test3OpencodeTextT7,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    isLoading: { control: 'boolean' },
    error: { control: 'text' },
    onEdit: { action: 'edit' },
    onTransfer: { action: 'transfer' },
    onDocumentsClick: { action: 'documentsClick' },
    onBreadcrumbClick: { action: 'breadcrumbClick' },
  },
} satisfies Meta<typeof Test3OpencodeTextT7>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'test3-opencode-text-T7',
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const WithError: Story = {
  args: {
    error: '\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0434\u0430\u043D\u043D\u044B\u0445 \u043A\u043E\u0440\u043F\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0430',
  },
};
