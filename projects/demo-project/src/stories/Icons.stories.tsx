import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  DocIcon,
  HashIcon,
  PendingIcon,
  PercentIcon,
  ShieldIcon,
  TargetIcon,
  UsersIcon,
} from '../components/icons';
import { Card } from '../components/cards';
import { CardGrid } from '../components/page-layouts';
import { describeComponent, describeStory, iconDescription } from '../storybook/descriptions';

const icons = [
  ['Building', <BuildingIcon key="building" />],
  ['Calendar', <CalendarIcon key="calendar" />],
  ['Check', <CheckIcon key="check" />],
  ['Document', <DocIcon key="document" />],
  ['Hash', <HashIcon key="hash" />],
  ['Pending', <PendingIcon key="pending" />],
  ['Percent', <PercentIcon key="percent" />],
  ['Shield', <ShieldIcon key="shield" />],
  ['Target', <TargetIcon key="target" />],
  ['Users', <UsersIcon key="users" />],
] as const;

function IconsOverview() {
  return (
    <CardGrid mode="auto">
      {icons.map(([label, icon]) => (
        <Card title={label} key={label}>
          <div className="demo-story-row">
            <span className="status-list-icon">{icon}</span>
            <span className="t-caption">Use inside MetaItem, DetailsCard, and StatusListCard.</span>
          </div>
        </Card>
      ))}
    </CardGrid>
  );
}

const meta = {
  title: 'Components/Icons',
  component: IconsOverview,
  tags: ['autodocs'],
  parameters: describeComponent(iconDescription),
} satisfies Meta<typeof IconsOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  parameters: describeStory(iconDescription),
};
