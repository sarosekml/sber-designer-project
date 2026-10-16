import type { Meta, StoryObj } from '@storybook/react-vite';

import { DetailsCard } from '../../components/business-cards';
import { borrowerItems, creditTermItems } from '../cardFixtures';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Details Card',
  component: DetailsCard,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof DetailsCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Borrower: Story = {
  args: { title: 'Заёмщик', items: borrowerItems },
  parameters: describeStory(businessCardDescription),
};

export const CreditTerms: Story = {
  args: { title: 'Условия кредита', items: creditTermItems },
  parameters: describeStory(businessCardDescription),
};
