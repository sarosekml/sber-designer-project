import type { Meta, StoryObj } from '@storybook/react-vite';

import { AppShell, Breadcrumbs, PageHeader, Tabs, TopToolbar } from '../components/layout';
import { describeComponent, describeStory, navigationDescription } from '../storybook/descriptions';

function NavigationOverview() {
  return (
    <AppShell section="Funds">
      <Breadcrumbs items={['Funds', 'Infrastructure Fund I']} />
      <PageHeader
        title="Navigation pattern"
        subtitle="The shell keeps the same sidebar, page title, tabs, and page-level actions across generated screens."
        actions={<TopToolbar />}
      />
      <Tabs
        active="Overview"
        items={[
          { label: 'Overview' },
          { label: 'Assets', count: 12 },
          { label: 'Documents', count: 34 },
        ]}
      />
      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title">Content area</div>
        <p className="demo-page-subtitle" style={{ marginTop: 10 }}>
          Generated pages should place their unique workflow content here while preserving the
          shell, hierarchy, and page action placement.
        </p>
      </section>
    </AppShell>
  );
}

const meta = {
  title: 'Components/Navigation',
  component: NavigationOverview,
  tags: ['autodocs'],
  parameters: describeComponent(navigationDescription),
} satisfies Meta<typeof NavigationOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  parameters: describeStory(navigationDescription),
};
