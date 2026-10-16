import { KpiCard } from "../../components/cards";
import {
  DealPanel,
  FeedEventList,
  NewsPanel,
  TaskPanel,
} from "../../components/business-cards";
import { AppShell, PageHeader } from "../../components/layout";
import {
  Badge,
  Button,
  SearchField,
  SegmentedControl,
} from "../../components/primitives";
import {
  CardGrid,
  ContentGrid,
  PageStack,
} from "../../components/page-layouts";
import { dealItems, newsItems, taskItems } from "../../data/demo";

const feedEvents = [
  {
    type: "News",
    title: "Norilsk Nickel announced revised capex guidance",
    text: "Source signal attached to Interros Capital and two active asset rows.",
    when: "2 hours ago",
    tone: "info" as const,
  },
  {
    type: "Task",
    title: "Legal review requested for Port Murmansk",
    text: "Minority investor protections need a committee-ready paragraph.",
    when: "3 hours ago",
    tone: "warning" as const,
  },
  {
    type: "Pipeline",
    title: "Deal D-1042 moved to diligence",
    text: "AI assistant added source package and target-sensitivity chart.",
    when: "yesterday",
    tone: "success" as const,
  },
  {
    type: "Change",
    title: "Beneficiary perimeter update is waiting for approval",
    text: "Old value and new value are both available with source links.",
    when: "yesterday",
    tone: "violet" as const,
  },
];

export function AnalystFeedScreen() {
  return (
    <AppShell screenId="screen-analyst-feed" section="Feed">
      <PageHeader
        title="Analyst feed"
        subtitle="Unified event stream for news, tasks, pipeline updates, and data changes."
        actions={
          <>
            <Button variant="secondary">Mark all read</Button>
            <Button>Add task ghn</Button>
          </>
        }
      />

      <div className="demo-filter-bar">
        <SegmentedControl
          active="All"
          items={["All", "News", "Tasks", "Pipeline"]}
        />
        <SearchField placeholder="Search feed events" />
      </div>

      <ContentGrid>
        <FeedEventList items={feedEvents} />

        <PageStack>
          <CardGrid mode="single">
            <KpiCard label="Unread" value="12" delta="4 need response" />
            <KpiCard label="High priority" value="7" delta="2 due today" />
          </CardGrid>
          <TaskPanel title="Tasks" items={taskItems.slice(0, 3)} />
          <DealPanel title="Pipeline" items={dealItems.slice(0, 2)} />
          <NewsPanel title="News" items={newsItems.slice(0, 2)} />
          <Badge tone="neutral">Feed is source-linked</Badge>
        </PageStack>
      </ContentGrid>
    </AppShell>
  );
}
