import React, { ComponentProps, FC, useState } from 'react';
import { Meta, StoryFn } from '@storybook/react';
import { fn } from '@storybook/test';

import { SearchRequestDto } from '@sber-ibp/core';

import { SxBox } from '@/components/atoms';
import { Grid } from '@/components/atoms/gridTiles';
import { InputText } from '@/components/molecules/Inputs/InputText/InputText';
import { BrowsableTable, Row, Table, TableColorSchema, TemplatedTable } from '@/components/organisms/Tables';
import { backendRequestMock } from '@/components/organisms/Tables/Table/mocks/backendRequestMock';
import { useEmployeeDataRows } from '@/components/organisms/Tables/Table/mocks/hooks/useEmployeeDataRows';
import { EmployeeData } from '@/components/organisms/Tables/Table/mocks/types';

import { prepareRowHover, prepareTemplatedRowHover } from '../RowHover';
import { columnsMock, rowsMock } from '../Table/mocks';
import { useTemplatedTableController } from '../utils';

export default {
  title: 'Organisms/Table/Styling',
  component: Table,
  parameters: {
    viewMode: 'canvas',
  },
  argTypes: {
    isBordered: {
      description: 'Добавляет внешнюю границу к таблице',
    },
    rowProps: {
      description: 'Свойства строк таблицы (включая hoverConfig)',
    },
    showHover: {
      control: 'boolean',
    },
  },
} as Meta<typeof Table>;

type TableStory = StoryFn<
  FC<
    Omit<ComponentProps<typeof Table<EmployeeData, object>>, 'rows'> & {
      rowColorSchema: TableColorSchema;
      employeeData: EmployeeData[];
      showHover?: boolean;
    }
  >
>;

const Template: TableStory = (props) => {
  const { rowColorSchema, showHover, rowProps, ...additionalProps } = props;
  const [data, setData] = useState<EmployeeData[]>(rowsMock);
  const [loading, setLoading] = useState(false);
  const rows = useEmployeeDataRows(data, rowColorSchema);

  const updateData = (config: SearchRequestDto<object>) => {
    setLoading(true);
    void backendRequestMock(config).then(({ rows }) => {
      setLoading(false);
      setData(rows);
    });
  };

  return (
    <Table
      //@ts-ignore: This prop is specified more than once, so this usage will be overwritten. Spread always overwrites this property.
      dataTestId="PageName_ParentComponentName"
      //@ts-ignore: This prop is specified more than once, so this usage will be overwritten. Spread always overwrites this property.
      columns={columnsMock}
      //@ts-ignore: This prop is specified more than once, so this usage will be overwritten. Spread always overwrites this property.
      isLoading={loading}
      updateData={updateData}
      {...additionalProps}
      rowProps={showHover || showHover === undefined ? rowProps : { ...rowProps, hoverConfig: undefined }}
      rows={rows}
    />
  );
};

export const RowHoverProps: TableStory = Template.bind({});
RowHoverProps.args = {
  employeeData: rowsMock,
  columns: columnsMock,
  dataTestId: 'PageName_ParentComponentName',
  isLoading: false,
  tableConfig: {
    hasStickyHeader: true,
    height: '80vh',
  },
  onUiStateChanged: fn(),
  rowProps: {
    onRowClick: (row: Row<EmployeeData>) => console.log('clicked row', row),
    hoverConfig: prepareRowHover({
      items: rowsMock,
      actions: [
        {
          icon: 'Edit',
          label: 'Add something',
          onClick: (data) => console.log(`Add something => ${data.data.fullName}`),
          isHintTooltip: true,
        },
        { icon: 'Trash', label: 'Remove row', onClick: (data) => console.log(`Remove row => ${data.data.fullName}`) },
        {
          icon: 'Add',
          label: 'Add some info to row',
          onClick: (data) => console.log(`Add some info to row => ${data.data.fullName}`),
        },
        {
          icon: 'AlertCircle',
          label: 'Show alert',
          onClick: (data) => console.log(`Show alert => ${data.data.fullName}`),
        },
      ],
      stickTo: 'left',
    }),
  },
};
RowHoverProps.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
};

type TemplatedTableStory = StoryFn<typeof TemplatedTable<EmployeeData, object> & { rowColorSchema: TableColorSchema }>;

const TestPreview: React.FC<{ controller: any; selectedRow: any; index: number }> = React.memo(
  ({ controller, selectedRow, index }) => {
    return (
      <SxBox>
        Hello world {selectedRow.id}:{selectedRow.fullName}
        <InputText
          label="Full Name"
          value={selectedRow.fullName}
          onChange={(value) => controller.updateTableRow(index, { ...selectedRow, fullName: value ?? '' })}
        />
      </SxBox>
    );
  },
);
TestPreview.displayName = 'TestPreview';

const TemplatedTableRowHover: TemplatedTableStory = (props) => {
  const controller = useTemplatedTableController<EmployeeData, object>('TestTableCode');
  const { rowColorSchema, showHover, ...additionalProps } = props as any;

  return (
    <React.Fragment>
      <BrowsableTable<EmployeeData, object>
        tableCode="TestTableCode"
        //@ts-ignore: This prop is specified more than once, so this usage will be overwritten. Spread always overwrites this property.
        dataTestId="PageName_ParentComponentName"
        //@ts-ignore: This prop is specified more than once, so this usage will be overwritten. Spread always overwrites this property.
        columns={columnsMock}
        //@ts-ignore: This prop is specified more than once, so this usage will be overwritten. Spread always overwrites this property.
        {...additionalProps}
        fetchData={() =>
          Promise.resolve({
            items: useEmployeeDataRows(rowsMock),
            listInfo: { count: 0, limit: 0, offset: 0, totalCount: rowsMock.length },
          })
        }
        rowTemplate={(row: any) => row}
        rowProps={
          showHover || showHover === undefined
            ? {
                hoverConfig: prepareTemplatedRowHover({
                  actions: [
                    {
                      icon: 'Edit',
                      label: 'Add something',
                      onClick: (data) => console.log(`Add something => ${data.data.fullName}`),
                      isHintTooltip: true,
                    },
                    {
                      icon: 'Trash',
                      label: 'Remove row',
                      onClick: (data) => {
                        console.log(`Remove row => ${data.data.fullName}`);
                        controller.removeTableRow(data.index);
                      },
                    },
                    {
                      icon: 'Add',
                      label: 'Add some info to row',
                      onClick: (data) => console.log(`Add some info to row => ${data.data.fullName}`),
                    },
                  ],
                }),
              }
            : undefined
        }
        Preview={TestPreview}
      />
      <button onClick={() => controller.addTableRow(rowsMock[0])}>Add row</button>
    </React.Fragment>
  );
};

export const TemplatedTableRowHoverProps: TemplatedTableStory = TemplatedTableRowHover.bind({});
TemplatedTableRowHoverProps.args = {
  columns: columnsMock,
  canFixColumns: true,
  dataTestId: 'PageName_ParentComponentName',
  tableConfig: {
    hasStickyHeader: true,
    height: '80vh',
  },
  onUiStateChanged: fn(),
};
TemplatedTableRowHoverProps.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
};

export const TableWithBorder: StoryFn = () => {
  const rows = useEmployeeDataRows(rowsMock);
  const fiveColumns = columnsMock.slice(0, 5);
  const threeRows = rows.slice(0, 3);

  return (
    <Grid item container maxWidth={'800px'}>
      <Table dataTestId="TableWithBorder" columns={fiveColumns} rows={threeRows} isBordered />
    </Grid>
  );
};

TableWithBorder.parameters = {
  backgrounds: {
    default: 'white',
  },
  docs: {
    description: {
      story: 'При добавлении в таблицу свойства isBordered у таблицы появляется внешняя граница светло-серого цвета',
    },
  },
};
