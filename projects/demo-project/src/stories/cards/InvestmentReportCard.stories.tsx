import type { Meta, StoryObj } from '@storybook/react-vite';

import { InvestmentReportCard } from '../../components/cards';
import { cardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Cards/Investment Report Card',
  component: InvestmentReportCard,
  tags: ['autodocs'],
  parameters: describeComponent(cardDescription),
} satisfies Meta<typeof InvestmentReportCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  render: () => <InvestmentReportCard />,
  parameters: describeStory(cardDescription),
};
