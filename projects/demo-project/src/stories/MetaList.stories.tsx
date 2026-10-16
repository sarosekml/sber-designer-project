import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  fundMetaItems,
  GlobeIcon,
  MessageIcon,
  MetaItem,
  MetaList,
  TrendIcon,
  UserIcon,
} from '../components/meta-list';
import { describeComponent, describeStory, metaListDescription } from '../storybook/descriptions';

function MetaListPreview() {
  return <MetaList items={fundMetaItems} />;
}

const meta = {
  title: 'Components/Meta List',
  component: MetaListPreview,
  tags: ['autodocs'],
  parameters: describeComponent(metaListDescription),
} satisfies Meta<typeof MetaListPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div style={{ maxWidth: 760 }}>
      <MetaList items={fundMetaItems} />
    </div>
  ),
  parameters: describeStory(metaListDescription),
};

export const FourColumns: Story = {
  render: () => (
    <div style={{ maxWidth: 1040 }}>
      <MetaList columns={4} items={fundMetaItems} />
    </div>
  ),
  parameters: describeStory({
    ...metaListDescription,
    purpose:
      'Wider MetaList layout for dense detail headers where four facts should sit on one row.',
  }),
};

export const SingleItem: Story = {
  render: () => (
    <MetaItem icon={<TrendIcon />} label="Объем инвестиций" mono value="987,65 млрд ₽" />
  ),
  parameters: describeStory({
    ...metaListDescription,
    purpose: 'Single icon-label-value block for use inside cards and compact panels.',
  }),
};

export const AllIcons: Story = {
  render: () => (
    <div className="demo-story-row">
      <MetaItem icon={<GlobeIcon />} label="География" value="Российская Федерация" />
      <MetaItem icon={<TrendIcon />} label="Объем инвестиций" mono value="987,65 млрд ₽" />
      <MetaItem icon={<MessageIcon />} label="E-mail" value="invest-ideas@interos.ru" />
      <MetaItem icon={<UserIcon />} label="Бенефициар" value="Владимир Потанин" />
    </div>
  ),
  parameters: describeStory(metaListDescription),
};
