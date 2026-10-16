import type { Meta, StoryObj } from '@storybook/react-vite';

import { ParticipantsCard } from '../../components/business-cards';
import { Badge } from '../../components/primitives';
import { participantSections } from '../cardFixtures';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Participants Card',
  component: ParticipantsCard,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof ParticipantsCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: {
    badge: <Badge tone="success">Selected</Badge>,
    title: 'Participants and topics',
    sections: participantSections,
  },
  parameters: describeStory(businessCardDescription),
};
