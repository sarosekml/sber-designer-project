import { InvestmentReportCard } from "../../components/cards";
import {
  ChecklistPanel,
  CommentsCard,
  MetricsCard,
  RelatedEntitiesCard,
  ThesisCard,
} from "../../components/business-cards";
import {
  AppShell,
  Breadcrumbs,
  PageHeader,
  Tabs,
} from "../../components/layout";
import { AiBadge, Badge, Button } from "../../components/primitives";
import { PrioritySummary } from "../../components/patterns";
import { PageStack, TwoColumnLayout } from "../../components/page-layouts";

export function IdeaPageScreen() {
  return (
    <AppShell screenId="screen-idea-page" section="AI Ideas">
      <Breadcrumbs
        items={["Research", "AI Ideas", "Northern route expansion"]}
      />
      <PageHeader
        title="Buy-side acquisition of Port Murmansk"
        subtitle="AI-generated investment scenario for terminal operators and adjacent logistics assets."
        actions={
          <>
            <Button variant="secondary">Reject</Button>
            <Button>Send to committee</Button>
          </>
        }
      />

      <Tabs
        active="Overview"
        items={[
          { label: "Overview" },
          { label: "Reasoning", count: 5 },
          { label: "Tasks", count: 5 },
          { label: "Discussion", count: 3 },
        ]}
      />

      <TwoColumnLayout gap="md">
        <PageStack>
          <ThesisCard
            badge={
              <Badge tone="success" dot>
                91% confidence
              </Badge>
            }
            eyebrow={<AiBadge />}
            title="Increase exposure to port and cold-chain infrastructure before tariff changes."
            description="The thesis combines route traffic growth, revised capex programs, and early signals from operator hiring plans."
            tags={[
              { label: "Capital markets", tone: "capital" },
              { label: "Logistics", tone: "soft" },
              { label: "Debt financing", tone: "finance" },
            ]}
          />

          <MetricsCard
            title="AI reasoning"
            meta={<span className="t-micro">5-step chain</span>}
            items={[
              { label: "Terminal throughput", progress: 74, value: "+18%" },
              {
                label: "Contracted revenue",
                progress: 58,
                tone: "info",
                value: "+11%",
              },
              {
                label: "Debt capacity",
                progress: 49,
                tone: "warning",
                value: "Stable",
              },
              {
                label: "Regulatory pressure",
                progress: 42,
                tone: "warning",
                value: "Medium",
              },
            ]}
          />

          <RelatedEntitiesCard
            items={[
              {
                title: "Port Murmansk",
                meta: "Target asset - 18.4 bn RUB",
                tag: "Asset",
                tone: "capital",
              },
              {
                title: "Northern Logistics Fund",
                meta: "Potential buyer",
                tag: "Fund",
                tone: "finance",
              },
              {
                title: "Interros Capital",
                meta: "Stakeholder and committee owner",
                tag: "Fund",
                tone: "metal",
              },
            ]}
          />
        </PageStack>

        <PageStack>
          <PrioritySummary />
          <InvestmentReportCard />
          <ChecklistPanel
            title="Decision tasks"
            items={[
              { label: "Attach quarterly financial model", checked: true },
              { label: "Verify beneficiary source", checked: true },
              { label: "Request legal comment on minority protections" },
              { label: "Send committee memo for review" },
            ]}
          />
          <CommentsCard meta={<span className="t-micro">3 comments</span>} />
        </PageStack>
      </TwoColumnLayout>
    </AppShell>
  );
}
