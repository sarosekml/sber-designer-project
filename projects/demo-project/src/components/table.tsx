import type { ReactNode } from 'react';

import { Button, SegmentedControl, Status, Tag, type TagTone } from './primitives';

export interface DataTableColumn<RowData> {
  key: string;
  header: ReactNode;
  cell: (row: RowData) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  muted?: boolean;
  sortable?: boolean;
  width?: number | string;
}

export interface DataTablePagination {
  label: string;
  pages: number[];
  activePage: number;
}

export interface DataTableProps<RowData> {
  title: ReactNode;
  meta?: ReactNode;
  rows: RowData[];
  columns: DataTableColumn<RowData>[];
  getRowId: (row: RowData) => string;
  actions?: ReactNode;
  className?: string;
  filters?: {
    items: string[];
    active: string;
  };
  pagination?: DataTablePagination;
  selectable?: boolean;
  selectedCount?: number;
}

export function DataTable<RowData>({
  title,
  meta,
  rows,
  columns,
  getRowId,
  actions,
  className = '',
  filters,
  pagination,
  selectable = false,
  selectedCount = 0,
}: DataTableProps<RowData>) {
  const hasToolbar = selectable || filters || actions;

  return (
    <section className={['tbl-wrap', className].filter(Boolean).join(' ')}>
      <div className="demo-head">
        <div className="demo-title">{title}</div>
        {meta ? <div className="demo-meta">{meta}</div> : null}
      </div>

      {hasToolbar ? (
        <div className="tbl-head">
          <div className="row-sm">
            {selectable ? (
              <>
                <TableCheckbox label="Select all rows" />
                <span className="t-caption">
                  Selected: <b>{selectedCount}</b>
                </span>
              </>
            ) : null}
          </div>
          <div className="row-sm">
            {filters ? <SegmentedControl active={filters.active} items={filters.items} /> : null}
            {actions}
          </div>
        </div>
      ) : null}

      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr>
              {selectable ? (
                <th className="cell-check">
                  <TableCheckbox label="Select all rows on this page" />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  className={[column.align === 'right' ? 'is-num' : '', column.className ?? '']
                    .filter(Boolean)
                    .join(' ')}
                  key={column.key}
                  style={{ width: column.width }}
                >
                  {column.header}
                  {column.sortable ? <span className="sort">↕</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getRowId(row)}>
                {selectable ? (
                  <td className="cell-check">
                    <TableCheckbox label={`Select row ${getRowId(row)}`} />
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td
                    className={[
                      column.align === 'right' ? 'is-num' : '',
                      column.muted ? 'is-muted' : '',
                      column.className ?? '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={column.key}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination ? <TablePagination pagination={pagination} /> : null}
    </section>
  );
}

export interface FundAssetRow {
  name: string;
  year: number;
  investment: string;
  industry: string;
  tagTone: TagTone;
}

export const fundAssetRows: FundAssetRow[] = [
  {
    name: 'Rosa Khutor',
    year: 2010,
    investment: '245,000,000',
    industry: 'Hotels and leisure',
    tagTone: 'hotel',
  },
  {
    name: 'Turyev Khutor',
    year: 2025,
    investment: '145,000,000',
    industry: 'Hotels and leisure',
    tagTone: 'hotel',
  },
  {
    name: 'Three Volcanoes Park',
    year: 2024,
    investment: '320,000,000',
    industry: 'Hotels and leisure',
    tagTone: 'hotel',
  },
  {
    name: 'Norilsk Nickel (31.9%)',
    year: 1994,
    investment: '2,845,000,000',
    industry: 'Metals and ore',
    tagTone: 'metal',
  },
  {
    name: 'Bystrinsky Mining',
    year: 2005,
    investment: '2,845,000,000',
    industry: 'Metals and ore',
    tagTone: 'metal',
  },
  {
    name: 'Petrovax Pharm',
    year: 2014,
    investment: '320,000,000',
    industry: 'Pharma',
    tagTone: 'pharma',
  },
  {
    name: 'T-Bank',
    year: 2022,
    investment: '320,000,000',
    industry: 'Banks',
    tagTone: 'bank',
  },
  {
    name: 'Tochka Bank',
    year: 2025,
    investment: '320,000,000',
    industry: 'Banks',
    tagTone: 'bank',
  },
  {
    name: 'Rosbank',
    year: 2022,
    investment: '950,000,000',
    industry: 'Banks',
    tagTone: 'bank',
  },
  {
    name: 'Yandex (9.93%)',
    year: 2025,
    investment: '950,000,000',
    industry: 'IT services',
    tagTone: 'it',
  },
];

const fundAssetColumns: DataTableColumn<FundAssetRow>[] = [
  {
    key: 'name',
    header: 'Asset name',
    cell: (row) => row.name,
    sortable: true,
  },
  {
    key: 'year',
    header: 'Acquisition year',
    cell: (row) => <span className="tnum">{row.year}</span>,
    muted: true,
    sortable: true,
    width: 180,
  },
  {
    key: 'investment',
    header: 'Investment volume',
    cell: (row) => <span className="tnum">{row.investment}</span>,
    align: 'right',
    sortable: true,
    width: 210,
  },
  {
    key: 'industry',
    header: 'Industry',
    cell: (row) => <Tag tone={row.tagTone}>{row.industry}</Tag>,
    width: 300,
  },
  {
    key: 'status',
    header: 'Status',
    cell: () => <Status tone="active">Active</Status>,
    sortable: true,
    width: 150,
  },
  {
    key: 'actions',
    header: '',
    cell: (row) => <TableActions label={`Actions for ${row.name}`} />,
    className: 'cell-actions',
  },
];

export function FundAssetsTable() {
  return (
    <DataTable
      actions={
        <>
          <Button size="sm" variant="ghost">
            <FilterIcon />
            Filter
          </Button>
          <Button size="sm" variant="secondary">
            Export
          </Button>
        </>
      }
      columns={fundAssetColumns}
      filters={{
        items: ['All', 'Active', 'Paused'],
        active: 'All',
      }}
      getRowId={(row) => row.name}
      meta="13 rows - hover - sortable"
      pagination={{
        label: 'Showing 1-10 of 13',
        pages: [1, 2, 3],
        activePage: 1,
      }}
      rows={fundAssetRows}
      selectable
      title="Fund assets"
    />
  );
}

function TableCheckbox({ label }: { label: string }) {
  return (
    <label className="check table-check">
      <input aria-label={label} type="checkbox" />
      <span className="box" />
    </label>
  );
}

function TableActions({ label }: { label: string }) {
  return (
    <button aria-label={label} className="icon-btn" type="button">
      <KebabIcon />
    </button>
  );
}

function TablePagination({ pagination }: { pagination: DataTablePagination }) {
  return (
    <div className="tbl-foot">
      <span className="t-caption">{pagination.label}</span>
      <div className="pager">
        <button disabled type="button">
          ‹
        </button>
        {pagination.pages.map((page) => (
          <button
            className={page === pagination.activePage ? 'is-active' : undefined}
            key={page}
            type="button"
          >
            {page}
          </button>
        ))}
        <button type="button">›</button>
      </div>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18M6 12h12M10 18h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}
