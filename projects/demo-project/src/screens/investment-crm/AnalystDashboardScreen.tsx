import {
  ChangesCard,
  IdeaCard,
  InvestmentReportCard,
  KpiCard,
} from "../../components/cards";
import { Sparkline } from "../../components/charts";
import {
  DealPanel,
  NewsPanel,
  TaskPanel,
} from "../../components/business-cards";
import { AppShell, PageHeader, TopToolbar } from "../../components/layout";
import {
  CardGrid,
  ContentGrid,
  PageStack,
} from "../../components/page-layouts";
import { Badge } from "../../components/primitives";
import { ChartPanel } from "../../components/patterns";
import { dealItems, newsItems, taskItems } from "../../data/demo";

export function AnalystDashboardScreen() {
  return (
    <AppShell screenId="screen-analyst-dashboard" section="Overview">
      <PageHeader
        title="Analyst dashboard"
        subtitle="Daily workspace for investment managers: KPI pulse, required deals, tasks, news, and AI recommendations."
        actions={<TopToolbar />}
      />

      <CardGrid>
        <KpiCard
          chart={<Sparkline values={[38, 42, 44, 47, 53, 51, 58, 64]} />}
          delta="+8.4% YoY"
          label="Portfolio value"
          unit="bn RUB"
          value="2,840"
        />
        <KpiCard
          chart={
            <Sparkline tone="info" values={[18, 22, 21, 26, 27, 31, 35, 42]} />
          }
          delta="7 high priority"
          label="Open ideas"
          value="42"
        />
        <KpiCard
          chart={
            <Sparkline
              tone="warning"
              values={[12, 16, 14, 13, 11, 15, 12, 9]}
            />
          }
          delta="3 require legal review"
          label="Pending changes"
          value="9"
        />
      </CardGrid>

      <ContentGrid gap="md">
        <PageStack>
          <ChartPanel
            comparisonValues={[46, 47, 49, 50, 52, 55, 57, 59]}
            meta="Last 12 months"
            title="Portfolio performance"
            values={[42, 45, 48, 47, 53, 58, 61, 67]}
          />

          <DealPanel meta={<Badge tone="info">+5</Badge>} items={dealItems} />
          <NewsPanel
            meta={<span className="t-micro">Source-linked</span>}
            items={newsItems.slice(0, 3)}
          />
        </PageStack>

        <PageStack>
          <TaskPanel
            meta={<span className="t-micro">Today</span>}
            items={taskItems}
          />
          <InvestmentReportCard />
          <IdeaCard />
          <ChangesCard />
        </PageStack>
      </ContentGrid>
    </AppShell>
  );
}
