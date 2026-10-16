import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  DataTable,
  FundAssetsTable,
  type DataTableColumn,
  type FundAssetRow,
  fundAssetRows,
} from '../components/table';
import { Status, Tag } from '../components/primitives';
import { describeComponent, describeStory, tableDescription } from '../storybook/descriptions';

const compactColumns: DataTableColumn<FundAssetRow>[] = [
  {
    key: 'name',
    header: 'Asset',
    cell: (row) => row.name,
    sortable: true,
  },
  {
    key: 'industry',
    header: 'Industry',
    cell: (row) => <Tag tone={row.tagTone}>{row.industry}</Tag>,
  },
  {
    key: 'status',
    header: 'Status',
    cell: () => <Status tone="active">Active</Status>,
  },
];

const meta = {
  title: 'Components/Table',
  component: FundAssetsTable,
  tags: ['autodocs'],
  parameters: describeComponent(tableDescription),
} satisfies Meta<typeof FundAssetsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FundAssets: Story = {
  render: () => <FundAssetsTable />,
  parameters: describeStory(tableDescription),
};

export const CompactDataset: Story = {
  render: () => (
    <DataTable
      columns={compactColumns}
      getRowId={(row) => row.name}
      meta="3 строки · reusable"
      rows={fundAssetRows.slice(0, 3)}
      title="Compact table"
    />
  ),
  parameters: describeStory({
    ...tableDescription,
    purpose:
      'Compact table variant using the same DataTable component with a smaller column model.',
  }),
};
