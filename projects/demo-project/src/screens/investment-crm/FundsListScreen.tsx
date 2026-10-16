import { KpiCard } from "../../components/cards";
import { Sparkline } from "../../components/charts";
import { AppShell, PageHeader, Tabs } from "../../components/layout";
import {
  Badge,
  Button,
  PriorityBadge,
  SearchField,
  SegmentedControl,
  Status,
} from "../../components/primitives";
import {
  CardGrid,
  FilterPanel,
  PageStack,
} from "../../components/page-layouts";
import { DataTable, type DataTableColumn } from "../../components/table";
import { fundRows, type FundRow } from "../../data/demo";

const fundColumns: DataTableColumn<FundRow>[] = [
  {
    key: "name",
    header: "Fund",
    cell: (row) => (
      <div>
        <strong>{row.name}</strong>
        <div className="t-micro">{row.manager}</div>
      </div>
    ),
    sortable: true,
  },
  {
    key: "aum",
    header: "AUM",
    cell: (row) => <span className="tnum">{row.aum}</span>,
    align: "right",
    sortable: true,
    width: 170,
  },
  {
    key: "irr",
    header: "IRR",
    cell: (row) => <Badge tone="success">{row.irr}</Badge>,
    align: "right",
    width: 110,
  },
  {
    key: "assets",
    header: "Assets",
    cell: (row) => <span className="tnum">{row.assets}</span>,
    align: "right",
    width: 100,
  },
  {
    key: "priority",
    header: "Priority",
    cell: (row) => (
      <PriorityBadge tone={row.priority}>
        {row.priority === "high"
          ? "High"
          : row.priority === "mid"
            ? "Medium"
            : "Low"}
      </PriorityBadge>
    ),
    width: 150,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => (
      <Status tone={row.status}>
        {row.status === "active" ? "Active" : "Paused"}
      </Status>
    ),
    width: 130,
  },
];

export function FundsListScreen() {
  return (
    <AppShell screenId="screen-funds-list" section="Funds">
      <PageHeader
        title="Funds"
        subtitle="Fund list with inline preview, table filters, bulk actions, and current portfolio totals."
        actions={
          <>
            <Button variant="secondary">Export</Button>
            <Button>Add fund</Button>
          </>
        }
      />

      <Tabs
        active="All funds"
        items={[
          { label: "All funds", count: 14 },
          { label: "Priority", count: 7 },
          { label: "Paused", count: 2 },
        ]}
      />

      <PageStack gap="md">
        <CardGrid>
          <KpiCard
            chart={<Sparkline values={[40, 42, 44, 48, 53, 56, 61, 68]} />}
            delta="+8.4% YoY"
            label="Total capital"
            unit="bn RUB"
            value="2,840"
          />
          <KpiCard label="Active funds" value="14" delta="+4 this quarter" />
          <KpiCard
            label="Benchmark spread"
            value="+4.8"
            unit="pp"
            delta="vs benchmark +12.8%"
          />
        </CardGrid>

        <FilterPanel>
          <div className="demo-filter-bar">
            <SearchField placeholder="Find fund by name, owner, or mandate" />
            <SegmentedControl
              active="All"
              items={["All", "Active", "Paused"]}
            />
          </div>
          <DataTable
            actions={
              <>
                <Button size="sm" variant="ghost">
                  Filter
                </Button>
                <Button size="sm" variant="secondary">
                  Bulk action
                </Button>
              </>
            }
            columns={fundColumns}
            filters={{ active: "AUM", items: ["AUM", "IRR", "Priority"] }}
            getRowId={(row) => row.name}
            meta="14 records - sorted by AUM"
            pagination={{
              label: "Showing 1-6 of 14",
              pages: [1, 2, 3],
              activePage: 1,
            }}
            rows={fundRows}
            selectable
            title="Fund list"
          />
        </FilterPanel>
      </PageStack>
    </AppShell>
  );
}
