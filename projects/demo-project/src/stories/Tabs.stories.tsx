import type { Meta, StoryObj } from '@storybook/react-vite';

import { Tabs } from '../components/layout';
import { describeComponent, describeStory, tabsDescription } from '../storybook/descriptions';

const entityTabs = [
  { label: 'Общая информация' },
  { label: 'Новости' },
  { label: 'Активы' },
  { label: 'Взаимодействие' },
  { label: 'Идеи', count: 1 },
  { label: 'Изменения', count: 2 },
];

function TabsPreview() {
  return (
    <div style={{ maxWidth: 760 }}>
      <Tabs active="Общая информация" items={entityTabs} />
      <div style={{ padding: '18px 0' }}>
        <p className="t-caption">Содержимое активного таба отображается в этом контейнере.</p>
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/Tabs',
  component: TabsPreview,
  tags: ['autodocs'],
  parameters: describeComponent(tabsDescription),
} satisfies Meta<typeof TabsPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Underline: Story = {
  parameters: describeStory(tabsDescription),
};

export const WithCounters: Story = {
  render: () => (
    <div style={{ maxWidth: 760 }}>
      <Tabs active="Идеи" items={entityTabs} />
    </div>
  ),
  parameters: describeStory(tabsDescription),
};
