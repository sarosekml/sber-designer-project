import { KpiCard } from "../../components/cards";
import {
  ContactListCard,
  NewsPanel,
  TimelineCard,
} from "../../components/business-cards";
import {
  AppShell,
  Breadcrumbs,
  PageHeader,
  Tabs,
} from "../../components/layout";
import {
  GlobeIcon,
  MessageIcon,
  MetaList,
  TrendIcon,
  UserIcon,
} from "../../components/meta-list";
import {
  Avatar,
  Button,
  PriorityBadge,
  Status,
  Tag,
} from "../../components/primitives";
import {
  CardGrid,
  PageStack,
  SplitLayout,
} from "../../components/page-layouts";
import { ChartPanel, EntityHeader } from "../../components/patterns";
import { newsItems } from "../../data/demo";

const dealMetaItems = [
  { icon: <GlobeIcon />, label: "Industry", value: "Logistics" },
  { icon: <TrendIcon />, label: "Amount", value: "18.4 bn RUB", mono: true },
  { icon: <MessageIcon />, label: "Stage", value: "Due Diligence" },
  { icon: <UserIcon />, label: "Lead", value: "Sergey Petrov" },
];

export function DealPageScreen() {
  return (
    <AppShell
      screenId="screen-investment-crm-deal-page-port-murmansk"
      section="Deals"
    >
      <Breadcrumbs items={["Deals", "D-1042 Port Murmansk"]} />
      <PageHeader
        title="D-1042 · Port Murmansk"
        subtitle="Minority stake acquisition with contracted terminal revenue. Logistics sector deal in due diligence stage."
        actions={
          <>
            <Button variant="secondary">Export summary</Button>
            <Button>Add note</Button>
          </>
        }
      />

      <EntityHeader
        actions={
          <>
            <Avatar tone="blue">SP</Avatar>
            <Avatar tone="emerald">AK</Avatar>
            <Avatar tone="amber">MG</Avatar>
          </>
        }
        eyebrow={
          <>
            <Tag tone="capital">Logistics</Tag>
            <PriorityBadge tone="high">High priority</PriorityBadge>
            <Status tone="active">Active</Status>
          </>
        }
        logo="PM"
        meta={<MetaList columns={4} items={dealMetaItems} />}
        subtitle="Minority stake in Port Murmansk with contracted terminal revenue, targeting northern route growth."
        title="Port Murmansk"
      />

      <Tabs
        active="Overview"
        items={[
          { label: "Overview" },
          { label: "Financials", count: 3 },
          { label: "Documents", count: 12 },
          { label: "Timeline", count: 8 },
          { label: "Team", count: 4 },
        ]}
      />

      <SplitLayout gap="md">
        <PageStack>
          <CardGrid>
            <KpiCard
              label="Deal amount"
              value="18.4"
              unit="bn RUB"
              delta="Due diligence stage"
            />
            <KpiCard
              label="Target stake"
              value="25.1"
              unit="%"
              delta="Minority"
            />
            <KpiCard
              label="Est. IRR"
              value="19.4"
              unit="%"
              delta="Above benchmark"
            />
          </CardGrid>

          <ChartPanel
            comparisonValues={[14, 15, 16, 17, 18, 19, 20]}
            meta="Valuation trend"
            title="Terminal revenue forecast"
            values={[15, 16, 16.5, 17, 17.8, 18.2, 18.4]}
          />

          <NewsPanel items={newsItems.slice(0, 3)} />
        </PageStack>

        <PageStack>
          <TimelineCard
            title="Deal timeline"
            items={[
              {
                title: "Deal sourced",
                text: "Arctic corridor thesis identified Port Murmansk as a strategic acquisition target.",
                when: "Feb 12, 2026",
              },
              {
                title: "Term sheet signed",
                text: "Non-binding term sheet signed with terminal operating company.",
                when: "Mar 5, 2026",
                tone: "info",
              },
              {
                title: "Due diligence started",
                text: "Legal, financial, and operational due diligence workstream launched.",
                when: "Mar 22, 2026",
                tone: "warning",
              },
              {
                title: "Committee review",
                text: "Investment committee reviewed preliminary findings and approved next phase.",
                when: "Apr 10, 2026",
                tone: "info",
              },
            ]}
          />

          <ContactListCard
            items={[
              {
                initials: "SP",
                name: "Sergey Petrov",
                role: "Deal lead",
                tone: "blue",
              },
              {
                initials: "AK",
                name: "Anna Kim",
                role: "Analyst",
                tone: "emerald",
              },
              {
                initials: "MG",
                name: "Mikhail Govorov",
                role: "Legal counsel",
                tone: "amber",
              },
            ]}
          />
        </PageStack>
      </SplitLayout>
    </AppShell>
  );
}
