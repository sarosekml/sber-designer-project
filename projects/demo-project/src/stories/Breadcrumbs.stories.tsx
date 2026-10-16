import type { Meta, StoryObj } from '@storybook/react-vite';

import { Breadcrumbs } from '../components/layout';
import {
  breadcrumbsDescription,
  describeComponent,
  describeStory,
} from '../storybook/descriptions';

const breadcrumbItems = ['Главная', 'Фонды', 'Гаражный кооператив «Фауна»'];

const meta = {
  title: 'Components/Breadcrumbs',
  component: Breadcrumbs,
  tags: ['autodocs'],
  parameters: describeComponent(breadcrumbsDescription),
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: breadcrumbItems,
  },
  parameters: describeStory(breadcrumbsDescription),
};

export const InCardContext: Story = {
  args: {
    items: breadcrumbItems,
  },
  render: () => (
    <div style={{ maxWidth: 760 }}>
      <Breadcrumbs items={breadcrumbItems} />
    </div>
  ),
  parameters: describeStory(breadcrumbsDescription),
};
