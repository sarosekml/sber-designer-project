import { Card } from "../../components/cards";
import { BarChart, LineChart } from "../../components/charts";
import {
  MetricsCard,
  SummaryCard,
  ThesisCard,
} from "../../components/business-cards";
import { AppShell, PageHeader, Tabs } from "../../components/layout";
import {
  CardGrid,
  PageStack,
  TwoColumnLayout,
} from "../../components/page-layouts";
import {
  AiBadge,
  Badge,
  Button,
  Field,
  SearchField,
  SelectControl,
  TextInput,
} from "../../components/primitives";
import { ProgressSteps, ScenarioPicker } from "../../components/patterns";

const analysisSteps = [
  {
    title: "Collect source filings",
    text: "Quarterly reports, capex updates, and ownership records.",
    done: true,
  },
  {
    title: "Run market fit model",
    text: "Route growth, debt capacity, and terminal occupancy.",
    done: true,
  },
  {
    title: "Score risks",
    text: "Regulatory, FX, execution, and minority protection checks.",
    active: true,
  },
  {
    title: "Draft committee memo",
    text: "Summary, open questions, and recommendation package.",
  },
];

export function AiAnalysisScreen() {
  return (
    <AppShell screenId="screen-ai-analysis" section="Analytics">
      <PageHeader
        title="AI Analysis"
        subtitle="Scenario selection, parameters, progress, targets, and evidence checks for the active idea."
        actions={<Button>Add note</Button>}
      />

      <Tabs
        active="Investment fit"
        items={[
          { label: "Investment fit" },
          { label: "Risks" },
          { label: "Sources" },
          { label: "History" },
        ]}
      />

      <PageStack gap="md">
        <ThesisCard
          badge={<Badge tone="info">Draft</Badge>}
          eyebrow={<AiBadge>AI Analysis</AiBadge>}
          title="Port Murmansk acquisition review"
          description="Choose a scenario, tune assumptions, and run background analysis."
        >
          <ScenarioPicker />
        </ThesisCard>

        <TwoColumnLayout>
          <PageStack>
            <Card title="Parameters">
              <div className="demo-story-grid">
                <Field label="Target asset">
                  <TextInput defaultValue="Port Murmansk" />
                </Field>
                <Field label="Scenario horizon">
                  <SelectControl defaultValue="2026-2028">
                    <option>2026-2028</option>
                    <option>2027-2029</option>
                  </SelectControl>
                </Field>
                <Field label="Evidence search">
                  <SearchField placeholder="Search reports, news, and calls" />
                </Field>
              </div>
            </Card>

            <Card title="Analysis progress">
              <ProgressSteps items={analysisSteps} />
            </Card>

            <Card title="Target sensitivity">
              <LineChart
                comparisonValues={[52, 54, 53, 55, 57, 58, 60]}
                tone="violet"
                values={[44, 48, 51, 57, 62, 66, 71]}
              />
            </Card>
          </PageStack>

          <PageStack>
            <MetricsCard
              title="Decision scores"
              items={[
                {
                  label: "Portfolio overlap",
                  progress: 28,
                  tone: "info",
                  value: "Low conflict",
                },
                {
                  label: "Macro sensitivity",
                  progress: 54,
                  tone: "warning",
                  value: "Moderate",
                },
                { label: "Data completeness", progress: 83, value: "Strong" },
                {
                  label: "Committee readiness",
                  progress: 47,
                  tone: "violet",
                  value: "Draft",
                },
              ]}
            />

            <Card title="Risk distribution">
              <BarChart
                items={[
                  {
                    label: "Regulatory",
                    value: 58,
                    detail: "Medium",
                    tone: "warning",
                  },
                  { label: "FX", value: 32, detail: "Low", tone: "info" },
                  {
                    label: "Execution",
                    value: 62,
                    detail: "Medium",
                    tone: "warning",
                  },
                  {
                    label: "Liquidity",
                    value: 74,
                    detail: "High",
                    tone: "danger",
                  },
                ]}
              />
            </Card>

            <SummaryCard
              title="Decision summary"
              text="Recommended next step is focused review of terminal capacity, debt covenants, and minority investor protections before committee submission."
              actions={
                <>
                  <Button size="sm">Accept</Button>
                  <Button variant="ghost" size="sm">
                    Ask agent
                  </Button>
                </>
              }
            />
          </PageStack>
        </TwoColumnLayout>
      </PageStack>
    </AppShell>
  );
}
