import { KpiCard } from "../../components/cards";
import { BarChart } from "../../components/charts";
import {
  ChangePanel,
  MetricsCard,
  NewsPanel,
  RelatedEntitiesCard,
  TimelineCard,
} from "../../components/business-cards";
import {
  AppShell,
  Breadcrumbs,
  PageHeader,
  Tabs,
} from "../../components/layout";
import {
  Badge,
  Button,
  PriorityBadge,
  Status,
  Tag,
} from "../../components/primitives";
import { Card } from "../../components/cards";
import {
  CardGrid,
  PageStack,
  SplitLayout,
} from "../../components/page-layouts";
import { ChartPanel, EntityHeader } from "../../components/patterns";
import { changeItems, newsItems } from "../../data/demo";

export function AssetPageScreen() {
  return (
    <AppShell screenId="screen-asset-page" section="Assets">
      <Breadcrumbs items={["Assets", "Norilsk Nickel"]} />
      <PageHeader
        title="Norilsk Nickel"
        subtitle="Asset card with financial indicators, operating metrics, priority ideas, news, history, and pending changes."
        actions={
          <>
            <Button variant="secondary">Export profile</Button>
            <Button>Add idea</Button>
          </>
        }
      />

      <EntityHeader
        actions={
          <>
            <Badge tone="success">+8.4%</Badge>
            <Status tone="active">Active</Status>
          </>
        }
        eyebrow={
          <>
            <Tag tone="metal">Metals and ore</Tag>
            <PriorityBadge tone="high">High priority</PriorityBadge>
          </>
        }
        logo="NN"
        meta={
          <>
            <Badge tone="neutral">Stake 31.9%</Badge>
            <Badge tone="info">842.6 bn RUB</Badge>
            <Badge tone="neutral">32 years in portfolio</Badge>
          </>
        }
        subtitle="Core metals exposure with updated capex plan, commodity-cycle research, and active committee questions."
        title="Norilsk Nickel"
      />

      <Tabs
        active="Overview"
        items={[
          { label: "Overview" },
          { label: "Financials", count: 4 },
          { label: "News", count: 8 },
          { label: "Ideas", count: 2 },
          { label: "Changes", count: 3 },
        ]}
      />

      <SplitLayout gap="md">
        <PageStack>
          <CardGrid>
            <KpiCard
              label="Current value"
              value="842.6"
              unit="bn RUB"
              delta="+8.4% YoY"
            />
            <KpiCard
              label="Accumulated yield"
              value="16.2"
              unit="%"
              delta="+1.8pp QoQ"
            />
            <KpiCard label="Debt load" value="2.1" unit="x" delta="stable" />
          </CardGrid>

          <ChartPanel
            comparisonValues={[58, 60, 61, 62, 63, 65, 66]}
            meta="Financial indicators"
            title="Revenue and margin"
            values={[52, 57, 61, 64, 68, 72, 76]}
          />

          <Card title="Operating metrics">
            <BarChart
              items={[
                { label: "Production plan", value: 86, detail: "86%" },
                {
                  label: "Export logistics",
                  value: 72,
                  detail: "72%",
                  tone: "info",
                },
                {
                  label: "Energy cost pressure",
                  value: 54,
                  detail: "Medium",
                  tone: "warning",
                },
              ]}
            />
          </Card>

          <NewsPanel title="Market news" items={newsItems} />
        </PageStack>

        <PageStack>
          <RelatedEntitiesCard
            action={<Badge tone="violet">AI</Badge>}
            title="Priority ideas"
            items={[
              {
                title: "Commodity-cycle hedge",
                meta: "AI confidence 82%",
                tag: "Idea",
                tone: "finance",
              },
              {
                title: "Port capacity partner",
                meta: "Linked to Port Murmansk",
                tag: "Idea",
                tone: "capital",
              },
            ]}
          />

          <TimelineCard
            title="Interaction history"
            items={[
              {
                title: "Research sent",
                text: "Commodity-cycle research pack shared with fund team.",
                when: "Apr 18, 2026",
              },
              {
                title: "Committee question",
                text: "Requested updated capex and debt covenant sensitivity.",
                when: "Apr 12, 2026",
                tone: "warning",
              },
              {
                title: "Ownership source updated",
                text: "Beneficiary perimeter verified against source package.",
                when: "Mar 28, 2026",
                tone: "info",
              },
            ]}
          />

          <ChangePanel
            title="Pending changes"
            items={changeItems.slice(0, 2)}
          />
          <MetricsCard
            title="Risk profile"
            items={[
              {
                label: "Commodity sensitivity",
                progress: 68,
                tone: "warning",
                value: "Medium",
              },
              { label: "Liquidity", progress: 42, value: "Low risk" },
              {
                label: "Regulatory pressure",
                progress: 57,
                tone: "warning",
                value: "Medium",
              },
            ]}
          />
        </PageStack>
      </SplitLayout>
    </AppShell>
  );
}
