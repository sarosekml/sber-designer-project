import {
  ChangesCard,
  IdeaCard,
  InteractionHistory,
  InvestmentReportCard,
} from "../../components/cards";
import { NewsPanel } from "../../components/business-cards";
import {
  AppShell,
  Breadcrumbs,
  PageHeader,
  Tabs,
} from "../../components/layout";
import { fundMetaItems, MetaList } from "../../components/meta-list";
import {
  Avatar,
  Badge,
  Button,
  PriorityBadge,
  Status,
} from "../../components/primitives";
import { PageStack, SplitLayout } from "../../components/page-layouts";
import { ChartPanel, EntityHeader } from "../../components/patterns";
import { FundAssetsTable } from "../../components/table";
import { newsItems } from "../../data/demo";

export function FundDetailScreen() {
  return (
    <AppShell screenId="screen-fund-detail" section="Funds">
      <Breadcrumbs items={["Funds", "Interros Capital"]} />
      <PageHeader
        title="Interros Capital"
        subtitle="Entity workspace with news, assets, AI idea, investment report, changes, trends, and interaction history."
        actions={
          <>
            <Button variant="secondary">Send update</Button>
            <Button>Add idea</Button>
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
            <Badge tone="solid-info">Global markets</Badge>
            <PriorityBadge tone="high">High priority</PriorityBadge>
            <Status tone="active">Active</Status>
          </>
        }
        logo="IC"
        meta={<MetaList columns={4} items={fundMetaItems} />}
        subtitle="Growth-stage portfolio spanning metals, logistics, digital banking, and pharma assets."
        title="Interros Capital"
      />

      <Tabs
        active="Overview"
        items={[
          { label: "Overview" },
          { label: "News", count: 8 },
          { label: "Assets", count: 13 },
          { label: "Interactions", count: 47 },
          { label: "Ideas", count: 1 },
          { label: "Changes", count: 2 },
        ]}
      />

      <SplitLayout gap="md">
        <PageStack>
          <NewsPanel title="Market news" items={newsItems} />
          <FundAssetsTable />
        </PageStack>
        <PageStack>
          <IdeaCard />
          <InvestmentReportCard />
          <ChangesCard />
          <ChartPanel
            comparisonValues={[48, 49, 51, 52, 53, 54, 56]}
            meta="16% below target"
            title="Trend"
            values={[52, 49, 47, 45, 44, 42, 41]}
            tone="warning"
          />
          <InteractionHistory />
        </PageStack>
      </SplitLayout>
    </AppShell>
  );
}
