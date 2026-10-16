import type { Meta, StoryObj } from '@storybook/react-vite';

import { BaseScreenTemplate } from '../components/templates';
import {
  baseScreenTemplateDescription,
  describeComponent,
  describeStory,
} from '../storybook/descriptions';

const meta = {
  title: 'Templates/Base Screen',
  component: BaseScreenTemplate,
  tags: ['autodocs'],
  parameters: describeComponent(baseScreenTemplateDescription),
} satisfies Meta<typeof BaseScreenTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SidebarShell: Story = {
  parameters: describeStory(baseScreenTemplateDescription),
};
