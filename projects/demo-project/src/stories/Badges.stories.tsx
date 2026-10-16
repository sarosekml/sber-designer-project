import type { Meta, StoryObj } from '@storybook/react-vite';

import { AiBadge, Badge, Pill, Status, Tag } from '../components/primitives';
import { badgeDescription, describeComponent, describeStory } from '../storybook/descriptions';

function IndustryTagsSet() {
  return (
    <div className="demo-section-stack">
      <div className="demo-story-row">
        <Tag tone="hotel">Отели, рестораны и объекты досуга</Tag>
        <Tag tone="metal">Металлы и руды</Tag>
        <Tag tone="pharma">Фармацевтика</Tag>
      </div>
      <div className="demo-story-row">
        <Tag tone="bank">Банки</Tag>
        <Tag tone="it">Информационно-технологические услуги</Tag>
        <Tag tone="finance">Многоотраслевые финансовые услуги</Tag>
      </div>
      <div className="demo-story-row">
        <Tag tone="soft">Программное обеспечение</Tag>
        <Tag tone="capital">Рынки капитала</Tag>
      </div>
    </div>
  );
}

function PriorityPillsSet() {
  return (
    <div className="demo-story-row">
      <Pill tone="high">ВЫСОКИЙ ПРИОРИТЕТ</Pill>
      <Pill tone="strategic">СТРАТЕГИЧЕСКИЙ</Pill>
      <Pill tone="growth">РОСТ</Pill>
      <Pill tone="warn">РЕГУЛЯТОРНЫЙ</Pill>
      <Pill tone="neutral">СТЕЙКХОЛДЕР</Pill>
    </div>
  );
}

function AiAccentSet() {
  return (
    <div className="demo-story-row">
      <AiBadge>AI Рекомендация</AiBadge>
      <AiBadge>AI Анализ</AiBadge>
      <AiBadge>AI Прогноз</AiBadge>
    </div>
  );
}

function StatusBadgesSet() {
  return (
    <div className="demo-section-stack">
      <div className="demo-story-row">
        <Badge tone="success" dot>
          Активен
        </Badge>
        <Badge tone="warning" dot>
          На паузе
        </Badge>
        <Badge tone="danger" dot>
          Закрыт
        </Badge>
        <Badge tone="info" dot>
          Новый
        </Badge>
        <Badge tone="violet" dot>
          AI
        </Badge>
        <Badge tone="neutral">Черновик</Badge>
      </div>
      <div className="demo-story-row">
        <Badge tone="solid-success">Активен</Badge>
        <Badge tone="solid-info">Обновлено</Badge>
        <Badge tone="solid-danger">Срочно</Badge>
        <Badge tone="solid-neutral">v2.4</Badge>
      </div>
      <div className="demo-story-row">
        <Status tone="active">Активен</Status>
        <Status tone="paused">На паузе</Status>
        <Status tone="archived">Архив</Status>
      </div>
    </div>
  );
}

function BadgesPreview() {
  return (
    <div className="demo-section-stack">
      <StatusBadgesSet />
      <div className="hr" />
      <IndustryTagsSet />
      <div>
        <div className="sub-title" style={{ margin: '0 0 12px' }}>
          Приоритет-пиллы (новости)
        </div>
        <PriorityPillsSet />
      </div>
      <div>
        <div className="sub-title" style={{ margin: '0 0 12px' }}>
          AI-акцент
        </div>
        <AiAccentSet />
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/Badges',
  component: BadgesPreview,
  tags: ['autodocs'],
  parameters: describeComponent(badgeDescription),
} satisfies Meta<typeof BadgesPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllStyles: Story = {
  name: 'All Styles',
  parameters: describeStory(badgeDescription),
};

export const StatusBadges: Story = {
  name: 'Status Badges',
  render: () => <StatusBadgesSet />,
  parameters: describeStory(badgeDescription),
};

export const Soft: Story = {
  render: () => (
    <div className="demo-story-row">
      <Badge tone="success" dot>
        Активен
      </Badge>
      <Badge tone="warning" dot>
        На паузе
      </Badge>
      <Badge tone="danger" dot>
        Закрыт
      </Badge>
      <Badge tone="info" dot>
        Новый
      </Badge>
      <Badge tone="violet" dot>
        AI
      </Badge>
      <Badge tone="neutral">Черновик</Badge>
    </div>
  ),
  parameters: describeStory(badgeDescription),
};

export const Solid: Story = {
  render: () => (
    <div className="demo-story-row">
      <Badge tone="solid-success">Активен</Badge>
      <Badge tone="solid-info">Обновлено</Badge>
      <Badge tone="solid-danger">Срочно</Badge>
      <Badge tone="solid-neutral">v2.4</Badge>
    </div>
  ),
  parameters: describeStory(badgeDescription),
};

export const LifecycleStatus: Story = {
  render: () => (
    <div className="demo-story-row">
      <Status tone="active">Активен</Status>
      <Status tone="paused">На паузе</Status>
      <Status tone="archived">Архив</Status>
    </div>
  ),
  parameters: describeStory(badgeDescription),
};

export const IndustryTags: Story = {
  render: () => <IndustryTagsSet />,
  parameters: describeStory(badgeDescription),
};

export const PriorityPills: Story = {
  render: () => <PriorityPillsSet />,
  parameters: describeStory(badgeDescription),
};

export const AiAccent: Story = {
  name: 'AI Accent',
  render: () => <AiAccentSet />,
  parameters: describeStory(badgeDescription),
};
