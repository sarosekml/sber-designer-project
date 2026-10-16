import {
  ChecklistPanel,
  ParticipantsCard,
  SummaryCard,
} from "../../components/business-cards";
import { AppShell, PageHeader } from "../../components/layout";
import {
  AiBadge,
  Badge,
  Button,
  SearchField,
  SegmentedControl,
} from "../../components/primitives";
import { CommunicationList } from "../../components/patterns";
import { PageStack, SplitLayout } from "../../components/page-layouts";
import { communicationItems } from "../../data/demo";

export function CommunicationsScreen() {
  return (
    <AppShell screenId="screen-communications" section="Communications">
      <PageHeader
        title="Communications"
        subtitle="Meetings, emails, calls, system notes, tasks, statuses, and AI summaries across counterparties."
        actions={
          <>
            <Button variant="secondary">Import calendar</Button>
            <Button>Add contact</Button>
          </>
        }
      />

      <div className="demo-filter-bar">
        <SegmentedControl
          active="All"
          items={["All", "Meetings", "Emails", "Calls"]}
        />
        <SearchField placeholder="Search by topic or person" />
      </div>

      <SplitLayout>
        <CommunicationList items={communicationItems} />

        <PageStack>
          <ParticipantsCard
            badge={<Badge tone="success">Selected</Badge>}
            title="Q1 report discussion"
            sections={[
              {
                label: "Participants",
                items: [
                  <Badge tone="violet" key="vp">
                    VP
                  </Badge>,
                  <Badge tone="success" key="ps">
                    PS
                  </Badge>,
                  <Badge tone="warning" key="ak">
                    AK
                  </Badge>,
                ],
              },
              {
                label: "Key topics",
                items: [
                  <Badge tone="neutral" key="nn">
                    Norilsk Nickel
                  </Badge>,
                  <Badge tone="neutral" key="q1">
                    Q1 report
                  </Badge>,
                  <Badge tone="neutral" key="pm">
                    Port Murmansk
                  </Badge>,
                ],
              },
            ]}
          />

          <ChecklistPanel
            title="Actions"
            items={[
              { label: "Send meeting notes", checked: true },
              { label: "Prepare follow-up for Port Murmansk" },
              { label: "Request Q1 report details" },
            ]}
          />

          <SummaryCard
            badge={<AiBadge>AI</AiBadge>}
            title="AI summary"
            text="The meeting was constructive. Follow-up on Port Murmansk is expected within two weeks, and the quarterly Norilsk Nickel package is now requested."
          />
        </PageStack>
      </SplitLayout>
    </AppShell>
  );
}
