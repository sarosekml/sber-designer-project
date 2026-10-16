import { AssistantWidgetPrompt } from "../../components/business-cards";
import { AppShell, PageHeader } from "../../components/layout";
import { Button } from "../../components/primitives";
import {
  DashboardChartSet,
  DealList,
  DemoWidget,
  NewsList,
  TaskList,
} from "../../components/patterns";
import { dealItems, newsItems, taskItems } from "../../data/demo";

export function DashboardCustomScreen() {
  return (
    <AppShell screenId="screen-dashboard-custom" section="Dashboards">
      <PageHeader
        title="Custom dashboard"
        subtitle="Configurable analyst workspace with reusable widgets, charts, lists, and quick actions."
        actions={
          <>
            <Button variant="secondary">Add widget</Button>
            <Button>Save layout</Button>
          </>
        }
      />

      <div className="demo-widget-grid">
        <DemoWidget title="Tasks">
          <TaskList items={taskItems} />
        </DemoWidget>

        <DemoWidget title="News">
          <NewsList items={newsItems.slice(0, 3)} />
        </DemoWidget>

        <DemoWidget title="AI banker" span="wide">
          <AssistantWidgetPrompt
            text="Ask the assistant to turn feed signals into investment ideas, source-backed summaries, or committee-ready memos."
            actions={
              <>
                <Button size="sm">Generate idea</Button>
                <Button size="sm" variant="ghost">
                  Summarize news
                </Button>
              </>
            }
          />
        </DemoWidget>

        <DemoWidget title="Required deals" span="wide">
          <DealList items={dealItems} />
        </DemoWidget>

        <DashboardChartSet />

        <DemoWidget title="Quick actions">
          <div className="demo-story-row">
            <Button size="sm">Add idea</Button>
            <Button size="sm" variant="secondary">
              Import source
            </Button>
            <Button size="sm" variant="ghost">
              Export report
            </Button>
          </div>
        </DemoWidget>
      </div>
    </AppShell>
  );
}
