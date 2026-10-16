import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  DetailsCard,
  MetricsCard,
  StatusListCard,
  SummaryCard,
  ThesisCard,
  TimelineCard,
} from '../components/business-cards';
import { Badge } from '../components/primitives';
import { CardGrid, PageStack } from '../components/page-layouts';
import { borrowerItems, collateralItems, timelineItems } from './cardFixtures';
import { businessCardDescription, describeComponent, describeStory } from '../storybook/descriptions';

function BusinessCardsCatalog() {
  return (
    <PageStack>
      <CardGrid>
        <ThesisCard
          badge={<Badge tone="success" dot>91% confidence</Badge>}
          title="Increase exposure to port and cold-chain infrastructure before tariff changes."
          description="Catalog preview only. Use the nested Business Cards stories for individual components."
          tags={[
            { label: 'Capital markets', tone: 'capital' },
            { label: 'Logistics', tone: 'soft' },
            { label: 'Debt financing', tone: 'finance' },
          ]}
        />
        <DetailsCard title="Заёмщик" items={borrowerItems} />
        <MetricsCard
          title="Риск-профиль"
          meta={<Badge tone="warning">BB+</Badge>}
          items={[
            { label: 'PD (1 год)', progress: 8, tone: 'warning', value: '0.8%' },
            { label: 'LGD', progress: 45, tone: 'warning', value: '45%' },
            { label: 'Страновой риск', progress: 30, tone: 'info', value: 'Низкий' },
          ]}
        />
      </CardGrid>
      <CardGrid>
        <StatusListCard title="Обеспечение" action={<span className="tnum text-success text-strong">152%</span>} items={collateralItems} />
        <TimelineCard title="История сделки" items={timelineItems} />
        <SummaryCard title="Decision summary" badge={<Badge tone="info">Draft</Badge>} text="SummaryCard is a bounded prose card for recommendations and AI summaries." />
      </CardGrid>
    </PageStack>
  );
}

const meta = {
  title: 'Components/Business Cards/Catalog',
  component: BusinessCardsCatalog,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof BusinessCardsCatalog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => <BusinessCardsCatalog />,
  parameters: describeStory(businessCardDescription),
};
