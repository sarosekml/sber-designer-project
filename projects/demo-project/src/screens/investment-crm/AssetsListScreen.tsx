import { KpiCard } from "../../components/cards";
import { AppShell, PageHeader, Tabs } from "../../components/layout";
import {
  Badge,
  Button,
  SearchField,
  SegmentedControl,
  Status,
  Tag,
} from "../../components/primitives";
import {
  CardGrid,
  FilterPanel,
  PageStack,
} from "../../components/page-layouts";
import { DataTable, type DataTableColumn } from "../../components/table";
import { assetRows, type AssetRow } from "../../data/demo";

const assetColumns: DataTableColumn<AssetRow>[] = [
  {
    key: "name",
    header: "Asset",
    cell: (row) => (
      <div>
        <strong>{row.name}</strong>
        <div className="t-micro">{row.owner}</div>
      </div>
    ),
    sortable: true,
  },
  {
    key: "industry",
    header: "Industry",
    cell: (row) => <Tag tone={row.tagTone}>{row.industry}</Tag>,
    width: 210,
  },
  {
    key: "value",
    header: "Current value",
    cell: (row) => <span className="tnum">{row.value}</span>,
    align: "right",
    sortable: true,
    width: 170,
  },
  {
    key: "change",
    header: "Change",
    cell: (row) => (
      <Badge tone={row.change.startsWith("-") ? "danger" : "success"}>
        {row.change}
      </Badge>
    ),
    align: "right",
    width: 110,
  },
  {
    key: "risk",
    header: "Risk",
    cell: (row) => (
      <Badge tone={row.risk === "High" ? "warning" : "neutral"}>
        {row.risk}
      </Badge>
    ),
    width: 120,
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

export function AssetsListScreen() {
  return (
    <AppShell screenId="screen-assets-list" section="Assets">
      <PageHeader
        title="Assets"
        subtitle="Coverage universe with sector grouping, fund ownership, valuation, status, and risk scan."
        actions={
          <>
            <Button variant="secondary">Import</Button>
            <Button>Add asset</Button>
          </>
        }
      />

      <Tabs
        active="All assets"
        items={[
          { label: "All assets", count: 186 },
          { label: "Watchlist", count: 18 },
          { label: "Pending review", count: 7 },
        ]}
      />

      <PageStack gap="md">
        <CardGrid>
          <KpiCard label="Tracked assets" value="186" delta="12 sectors" />
          <KpiCard
            label="Total valuation"
            value="2,840"
            unit="bn RUB"
            delta="+8.4% YoY"
          />
          <KpiCard
            label="High risk"
            value="11"
            delta="Needs committee attention"
          />
        </CardGrid>

        <FilterPanel>
          <div className="demo-filter-bar">
            <SearchField placeholder="Find asset, ISIN, owner, or sector" />
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
                  Export
                </Button>
              </>
            }
            columns={assetColumns}
            filters={{
              active: "All",
              items: ["All", "Metals", "Banks", "Pharma"],
            }}
            getRowId={(row) => row.name}
            meta="Grouped by industry - 8 of 186 shown"
            pagination={{
              label: "Showing 1-8 of 186",
              pages: [1, 2, 3],
              activePage: 1,
            }}
            rows={assetRows}
            selectable
            selectedCount={0}
            title="Assets by industry"
          />
        </FilterPanel>
      </PageStack>
    </AppShell>
  );
}
