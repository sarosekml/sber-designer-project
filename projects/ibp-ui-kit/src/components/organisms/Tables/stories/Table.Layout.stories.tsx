import React, { ComponentProps, FC, useState } from 'react';
import { Meta, StoryFn } from '@storybook/react';
import { fn } from '@storybook/test';

import { SearchRequestDto } from '@sber-ibp/core';

import { Table } from '@/components/organisms/Tables';
import { backendRequestMock } from '@/components/organisms/Tables/Table/mocks/backendRequestMock';
import { useEmployeeDataRows } from '@/components/organisms/Tables/Table/mocks/hooks/useEmployeeDataRows';
import { EmployeeData } from '@/components/organisms/Tables/Table/mocks/types';

import { columnsMock, rowsMock } from '../Table/mocks';
import { rowsForVirtualizeTableMock } from '../Table/mocks/rowsMock';

export default {
  title: 'Organisms/Table/Layout',
  component: Table,
  parameters: {
    viewMode: 'canvas',
  },
  argTypes: {
    tableConfig: {
      description: 'Параметры конфигурации таблицы: высота, фиксация заголовка, виртуальный скролл и т.д.',
    },
    canReorderColumns: {
      description: 'Возможность изменения порядка колонок',
    },
    canChangeVisibility: {
      description: 'Возможность изменения видимости колонок',
    },
  },
} as Meta<typeof Table>;

type TableStory = StoryFn<
  FC<
    Omit<ComponentProps<typeof Table<EmployeeData, object>>, 'rows'> & {
      employeeData: EmployeeData[];
    }
  >
>;

const Template: TableStory = (props) => {
  const { employeeData, ...additionalProps } = props;
  const [data, setData] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(false);
  const rows = useEmployeeDataRows(data);

  const updateData = (config: SearchRequestDto<object>) => {
    setLoading(true);
    void backendRequestMock(config, employeeData).then(({ rows }) => {
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
      rows={rows}
    />
  );
};

export const VirtualizedTable: TableStory = Template.bind({});
VirtualizedTable.args = {
  employeeData: rowsForVirtualizeTableMock,
  columns: columnsMock.map((it) => ({ ...it, hidden: false })),
  tableConfig: {
    isVirtualTable: true,
    estimatedRowHeight: 60,
    height: '600px',
  },
  onUiStateChanged: fn(),
};
VirtualizedTable.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Виртуальный скролл добавляется при помощи `tableConfig`, содержащего поле `isVirtualTable` со значением true и поле `height` с указанием высоты таблицы.',
    },
  },
};

export const ColumnsReordering: TableStory = Template.bind({});
ColumnsReordering.args = {
  employeeData: rowsMock,
  canReorderColumns: true,
  columns: columnsMock.map((it) => ({ ...it, hidden: false })),
  onUiStateChanged: fn(),
};
ColumnsReordering.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Для добавления возможности изменения порядка колонок, необходимо в `columnsReordering` указать `order` - массив названий колонок в исходном порядке.',
    },
  },
};

export const ColumnsVisibility: TableStory = Template.bind({});
ColumnsVisibility.args = {
  employeeData: rowsMock,
  canChangeVisibility: true,
  columns: columnsMock.map((it) => ({ ...it, hidden: false })),
  onUiStateChanged: fn(),
};
ColumnsVisibility.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Для добавления кнопки и панели управления видимостью колонок, необходимо в `columnsVisibility` добавить массив названий скрытых колонок. Если по умолчанию отображаются все колонки, массив будет пустым.',
    },
  },
};
