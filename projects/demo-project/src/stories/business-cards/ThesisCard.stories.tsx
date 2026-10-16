import type { Meta, StoryObj } from '@storybook/react-vite';

import { ThesisCard } from '../../components/business-cards';
import { Badge, Button } from '../../components/primitives';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Thesis Card',
  component: ThesisCard,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof ThesisCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: {
    badge: <Badge tone="success" dot>91% confidence</Badge>,
    title: 'Increase exposure to port and cold-chain infrastructure before tariff changes.',
    description: 'The thesis combines route traffic growth, revised capex programs, and early signals from operator hiring plans.',
    tags: [
      { label: 'Capital markets', tone: 'capital' },
      { label: 'Logistics', tone: 'soft' },
      { label: 'Debt financing', tone: 'finance' },
    ],
    actions: (
      <>
        <Button size="sm">Send to committee</Button>
        <Button size="sm" variant="secondary">Open sources</Button>
      </>
    ),
  },
  parameters: describeStory(businessCardDescription),
};
