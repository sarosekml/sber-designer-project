import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ChangesCard,
  IdeaCard,
  InvestmentReportCard,
  KpiCard,
} from '../components/cards';
import { CardGrid, PageStack } from '../components/page-layouts';
import { cardDescription, describeComponent, describeStory } from '../storybook/descriptions';

function CardsCatalog() {
  return (
    <PageStack>
      <CardGrid>
        <KpiCard label="Portfolio value" value="128.4" unit="bn RUB" delta="+4.2% this month" />
        <KpiCard label="Open ideas" value="24" delta="7 high confidence" />
        <KpiCard label="Pending changes" value="9" delta="3 need legal review" />
      </CardGrid>
      <CardGrid>
        <InvestmentReportCard />
        <IdeaCard />
        <ChangesCard />
      </CardGrid>
    </PageStack>
  );
}

const meta = {
  title: 'Components/Cards/Catalog',
  component: CardsCatalog,
  tags: ['autodocs'],
  parameters: describeComponent(cardDescription),
} satisfies Meta<typeof CardsCatalog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => <CardsCatalog />,
  parameters: describeStory(cardDescription),
};
