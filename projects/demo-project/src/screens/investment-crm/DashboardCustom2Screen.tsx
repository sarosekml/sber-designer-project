import {
  DropTargetCard,
  WidgetCatalogCard,
} from "../../components/business-cards";
import { AppShell, PageHeader } from "../../components/layout";
import { Badge, Button } from "../../components/primitives";
import { SplitLayout } from "../../components/page-layouts";
import {
  DashboardChartSet,
  DemoWidget,
  MiniPerformanceCard,
  TaskList,
} from "../../components/patterns";
import { taskItems } from "../../data/demo";

export function DashboardCustom2Screen() {
  return (
    <AppShell screenId="screen-dashboard-custom-2" section="Dashboards">
      <PageHeader
        title="Custom dashboard - edit mode"
        subtitle="Same dashboard surface in layout-editing mode with drop targets and widget catalog preview."
        actions={
          <>
            <Button variant="secondary">Cancel</Button>
            <Button>Publish layout</Button>
          </>
        }
      />

      <div className="edit-bar">
        <span className="edit-status">Editing layout</span>
        <Badge tone="info">Autosaved 12 seconds ago</Badge>
      </div>

      <SplitLayout gap="sm">
        <div className="demo-widget-grid">
          <DemoWidget editing title="Tasks">
            <TaskList items={taskItems.slice(0, 3)} />
          </DemoWidget>

          <DemoWidget editing span="wide" title="P&L day">
            <div className="demo-story-grid">
              <MiniPerformanceCard
                title="Revenue"
                value="+18.4m"
                values={[12, 14, 17, 16, 20, 24]}
              />
              <MiniPerformanceCard
                title="Risk cost"
                tone="warning"
                value="-2.1m"
                values={[8, 7, 9, 8, 6, 5]}
              />
            </div>
          </DemoWidget>

          <DashboardChartSet />
        </div>

        <aside className="demo-section-stack">
          <WidgetCatalogCard
            items={[
              "Currency rates",
              "Yield curve",
              "Approvals queue",
              "Sector exposure",
            ]}
          />
          <DropTargetCard />
        </aside>
      </SplitLayout>
    </AppShell>
  );
}
