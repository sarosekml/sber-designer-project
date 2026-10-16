import { SummaryCard, TimelineCard } from "../../components/business-cards";
import { AppShell, Breadcrumbs, PageHeader } from "../../components/layout";
import {
  Badge,
  Button,
  SearchField,
  SegmentedControl,
} from "../../components/primitives";
import { ChangeReviewList } from "../../components/patterns";
import { PageStack, SplitLayout } from "../../components/page-layouts";
import { changeItems } from "../../data/demo";

export function ChangesScreen() {
  return (
    <AppShell screenId="screen-changes" section="Changes">
      <Breadcrumbs items={["Research", "Changes"]} />
      <PageHeader
        title="Changes to approve"
        subtitle="Old vs new values with sources, suggested owners, and audit trail for approval."
        actions={
          <>
            <Button variant="secondary">Reject selected</Button>
            <Button>Approve selected</Button>
          </>
        }
      />

      <div className="demo-filter-bar">
        <SegmentedControl
          active="Pending"
          items={["Pending", "Approved", "Rejected"]}
        />
        <SearchField placeholder="Search field, source, or entity" />
      </div>

      <SplitLayout>
        <ChangeReviewList items={changeItems} />

        <PageStack>
          <SummaryCard
            badge={<Badge tone="warning">2 need decision</Badge>}
            title="Review context"
            text="The queue combines AI-suggested updates and team edits. Each row keeps the previous value, proposed value, source, and timing."
          />

          <TimelineCard
            title="Audit trail"
            items={[
              {
                title: "AI matched source package",
                text: "Beneficiary data was extracted from the latest ownership document.",
                when: "2 hours ago",
                tone: "info",
              },
              {
                title: "Legal reviewer assigned",
                text: "Maria Petrova added to the Interros Capital review chain.",
                when: "5 hours ago",
              },
              {
                title: "Valuation update imported",
                text: "Quarterly report values normalized into the asset model.",
                when: "yesterday",
                tone: "warning",
              },
            ]}
          />
        </PageStack>
      </SplitLayout>
    </AppShell>
  );
}
