import React, { ComponentProps, FC, useState } from 'react';
import { Meta, StoryFn } from '@storybook/react';
import { fn } from '@storybook/test';

import { SearchRequestDto } from '@sber-ibp/core';

import { Text } from '@/components/atoms';
import { Grid } from '@/components/atoms/gridTiles';
import { Table } from '@/components/organisms/Tables';
import { backendRequestMock } from '@/components/organisms/Tables/Table/mocks/backendRequestMock';
import { useEmployeeDataRows } from '@/components/organisms/Tables/Table/mocks/hooks/useEmployeeDataRows';
import { EmployeeData } from '@/components/organisms/Tables/Table/mocks/types';

import { columnsMock, rowsMock, TemplateFilterFields } from '../Table/mocks';

export default {
  title: 'Organisms/Table/DataInteraction',
  component: Table,
  parameters: {
    viewMode: 'canvas',
  },
  argTypes: {
    sorting: {
      description: 'Конфигурация сортировки таблицы',
    },
    paging: {
      description: 'Параметры пагинации',
    },
    filters: {
      description: 'Фильтры для таблицы',
    },
    updateData: {
      description: 'Функция обновления данных таблицы',
    },
  },
} as Meta<typeof Table>;

type TableStory = StoryFn<
  FC<
    Omit<ComponentProps<typeof Table<EmployeeData, TemplateFilterFields>>, 'rows'> & {
      employeeData: EmployeeData[];
    }
  >
>;

const Template: TableStory = (props) => {
  const { employeeData, ...additionalProps } = props;
  const [data, setData] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(false);
  const rows = useEmployeeDataRows(data);

  const updateData = (config: SearchRequestDto<TemplateFilterFields>) => {
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

export const Sorting: TableStory = Template.bind({});
Sorting.args = {
  employeeData: rowsMock,
  onUiStateChanged: fn(),
  rowProps: {
    identifColumn: 'personalNumber',
    onRowClick: () => null,
  },
};
Sorting.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Для включения сортировки необходимо в свойство `sorting` добавить массив `sorting`, содержащий начальное состояние сортировки - объект с названием колонки и порядком сортировки (`asc` / `desc`)',
    },
  },
};

export const DisableColumnSorting: TableStory = Template.bind({});
DisableColumnSorting.args = {
  employeeData: rowsMock,
  onUiStateChanged: fn(),
};
DisableColumnSorting.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Для отключения сортировки по колонке, вы можете добавить объект, содержащий имя колонки и `sortingEnabled` со значением `false` в массив `columnExtensions` свойства `sorting`.',
    },
  },
};

export const Paging: StoryFn<typeof Table> = () => {
  const [data, setData] = useState<EmployeeData[]>(rowsMock);
  const [totalCount, setTotalCount] = useState(rowsMock.length);
  const [loading, setLoading] = useState(false);

  const rows = useEmployeeDataRows(data);

  const updateData = (config: SearchRequestDto<TemplateFilterFields>) => {
    setLoading(true);
    void backendRequestMock(config).then(({ rows, totalCount: newTotalCount }) => {
      setLoading(false);
      setTotalCount(newTotalCount);
      setData(rows);
    });
  };

  return (
    <Table
      dataTestId="TableExamplesPage"
      columns={columnsMock}
      rows={rows}
      isLoading={loading}
      updateData={updateData}
      tableConfig={{
        hasStickyHeader: true,
        height: '40vh',
      }}
      paging={{
        currentPage: 0,
        pageSize: 2,
        totalCount,
        pageSizes: [1, 2, 5, 10, 15, 0],
      }}
    />
  );
};

Paging.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'За пагинацию отвечает объект `paging`, содержащий следующие параметры:\n' +
        '\n * `currentPage*`- номер текущей страницы;\n' +
        '\n * `pageSize*`- максимальное количество элементов на странице;\n' +
        '\n * `totalCount*`- общее количество элементов на всех страницах;\n' +
        '\n * `pageSizes`- массив с размерами страницы для выбора пользователем.\n' +
        '\nПараметры `currentPage` и `pageSize` нужны для инициализации состояния, дальнейшее управление состоянием осуществляет таблица.\n' +
        '\n`*`- обязательный параметр.',
    },
  },
};

export const CustomFooter: StoryFn<typeof Table> = () => {
  const [data, setData] = useState<EmployeeData[]>(rowsMock);
  const [totalCount, setTotalCount] = useState(rowsMock.length);
  const [loading, setLoading] = useState(false);

  const rows = useEmployeeDataRows(data);

  const updateData = (config: SearchRequestDto<TemplateFilterFields>) => {
    setLoading(true);
    void backendRequestMock(config).then(({ rows, totalCount: newTotalCount }) => {
      setLoading(false);
      setTotalCount(newTotalCount);
      setData(rows);
    });
  };

  return (
    <Table
      dataTestId="TableExamplesPage"
      columns={columnsMock}
      rows={rows}
      isLoading={loading}
      updateData={updateData}
      tableConfig={{
        hasStickyHeader: true,
        height: '80vh',
      }}
      paging={{
        currentPage: 0,
        pageSize: 2,
        totalCount,
        pageSizes: [1, 2, 5, 10, 15, 0],
      }}
      customFooter={(pagingPanel) => (
        <Grid container direction={'row'} justifyContent={'space-between'}>
          <Grid item container alignContent={'center'} width={'unset'} pl={6} direction={'row'} columnGap={8}>
            <Grid item>
              <Text>Сумма дохода: 23 597 млрд.руб</Text>
            </Grid>
            <Grid item>
              <Text>Сумма дохода с учетом вероятности: 23 597 млрд.руб</Text>
            </Grid>
          </Grid>

          <Grid item>{pagingPanel}</Grid>
        </Grid>
      )}
    />
  );
};

CustomFooter.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
};
