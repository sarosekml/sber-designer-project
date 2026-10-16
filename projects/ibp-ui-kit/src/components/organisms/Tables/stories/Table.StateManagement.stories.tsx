import React, { useCallback, useState } from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { SearchRequestDto } from '@sber-ibp/core';

import { Grid } from '@/components/atoms/gridTiles';
import { InputText } from '@/components/molecules';
import { Tile } from '@/components/molecules/Tiles/Tile';
import { Table } from '@/components/organisms/Tables';
import { backendRequestMock } from '@/components/organisms/Tables/Table/mocks/backendRequestMock';
import { useEmployeeDataRows } from '@/components/organisms/Tables/Table/mocks/hooks/useEmployeeDataRows';
import { EmployeeData } from '@/components/organisms/Tables/Table/mocks/types';

import { localStorageCacheLoader } from '../CacheableTable';
import { getTableCache } from '../CacheableTable/CacheableTable.utils';
import { columnsMock } from '../Table/mocks/';
import { useTable } from '../utils';

export default {
  title: 'Organisms/Table/StateManagement',
  component: Table,
  parameters: {
    viewMode: 'canvas',
  },
  argTypes: {
    tableCode: {
      description: 'Ключ для сохранения состояния таблицы',
    },
    cachingConfig: {
      description: 'Конфигурация кеширования различных состояний таблицы',
    },
    cacheLoader: {
      description: 'Функция для загрузки кеша',
    },
    configurationVersion: {
      description: 'Версия конфигурации для сброса кеша',
    },
  },
} as Meta<typeof Table>;

const col12 = { xs: 12 };
const col10 = { xs: 10 };
const col2 = { xs: 2 };

interface TableFilter {
  fullName?: string;
  personalNumber?: string;
}

const useTableFilterForm = (tableCode: string) => {
  const { tableState, controller } = useTable<object, TableFilter>(tableCode);
  const [configVersion, setConfigVersion] = useState(0);

  const [methods] = useState(() => ({
    setValue: (field: string, value: any) => {},
  }));
  const onSubmit = () => {};
  const onReset = useCallback(() => {
    controller.resetFilters();
  }, [controller]);
  const onResetPaging = useCallback(() => {
    controller.resetPageSize();
  }, [controller]);
  const updateConfigVersion = useCallback(() => {
    setConfigVersion(configVersion + 1);
  }, [configVersion]);

  // Provide current value of the cache for test reasons: do not copy these lines
  const [tableCache, setTableCache] = useState<any>();
  React.useEffect(() => {
    setTimeout(() => setTableCache(getTableCache(tableCode)), 100);
  }, [tableCode, configVersion, tableState]);

  return {
    tableCache,
    configVersion,
    formFilter: (
      <Tile
        dataTestId="tableCache.filterForm.stories"
        gridSizes={{
          xs: 12,
        }}
        title="Table filters"
      >
        <div>
          <Grid container spacing={2}>
            <Grid item sizes={col12}>
              <InputText label="Табельный номер" value="" onChange={() => {}} />
            </Grid>
            <Grid item sizes={col12}>
              <InputText label="ФИО" value="" onChange={() => {}} />
            </Grid>
            <Grid item sizes={col12}>
              <button data-testid="tableCache.filterForm.stories.button1">Apply filter</button>
            </Grid>
            <Grid item sizes={col12}>
              <button data-testid="tableCache.filterForm.stories.button2" onClick={onReset}>
                Reset Filter
              </button>
            </Grid>
            <Grid item sizes={col12}>
              <button data-testid="tableCache.filterForm.stories.button3" onClick={onResetPaging}>
                Reset Paging
              </button>
            </Grid>
            <Grid
              item
              sizes={col12}
              title="Config version is used to compare what we have in the cache to what we expect to get from the cache. So you can change the version and reload the page. As a result the cache is reseted, because the expected version will be 0, and the version in the cache the last you previously applied."
            >
              <button data-testid="tableCache.filterForm.stories.button3" onClick={updateConfigVersion}>
                Config v{configVersion}++
              </button>
            </Grid>
          </Grid>
        </div>
      </Tile>
    ),
  };
};

export const TableStateCaching: StoryFn = () => {
  const tableCode = 'Table_Example';
  const cachingConfig = {
    sorting: true,
    currentPage: true,
    pageSize: true,
    filters: true,
    fixed: true,
  };

  const [data, setData] = useState<EmployeeData[] | undefined>();
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const rows = useEmployeeDataRows(data ?? []);

  const onUpdateData = (config: SearchRequestDto<TableFilter>) => {
    setLoading(true);
    void backendRequestMock(config).then(({ rows, totalCount }) => {
      setLoading(false);
      setData(rows);
      setTotalCount(totalCount);
    });
  };

  const { formFilter, tableCache, configVersion } = useTableFilterForm(tableCode);

  return (
    <Grid container spacing={4}>
      <Grid item container sizes={col10} spacing={4}>
        <Grid item sizes={col12}>
          <Table
            // Identifiers
            tableCode={tableCode}
            dataTestId={'TableStateCaching'}
            // Rows data
            rows={rows}
            // Configurations
            isLoading={loading}
            columns={columnsMock}
            cachingConfig={cachingConfig}
            cacheLoader={localStorageCacheLoader}
            canFixColumns={true}
            // Default states
            paging={{
              currentPage: 2,
              pageSize: 2,
              pageSizes: [1, 2, 5],
              totalCount: totalCount,
            }}
            configurationVersion={configVersion.toString()}
            defaultFilters={undefined}
            // Search DTO callback
            updateData={onUpdateData}
          />
        </Grid>
        <Grid item sizes={col12}>
          <Tile
            dataTestId="tableCache.filterForm.stories"
            gridSizes={{
              xs: 12,
            }}
            title="Table cache"
          >
            {tableCache ? JSON.stringify(tableCache) : 'Cache is empty'}
          </Tile>
        </Grid>
      </Grid>
      <Grid item container sizes={col2}>
        {formFilter}
      </Grid>
    </Grid>
  );
};

TableStateCaching.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Для сохранения состояния размера страницы (при пагинации), фильтрации, сортировки при обновлении страницы, необходимо добавить следующие пропсы:\n' +
        '\n* `tableCode`- ключ, по которому будет сохранено состояние в `localStorage`;\n' +
        '\n* `cachingConfig`- объект с настройками, описывающий, какое состояние нужно кешировать, а какое - нет. По умолчанию кеширование выключено.\n',
    },
  },
};

export const TableNewProps: StoryFn = () => {
  const tableCode = 'Table_Example_2';
  const cachingConfig = {
    sorting: true,
    currentPage: true,
    pageSize: true,
    filters: true,
    fixed: true,
  };

  const [data, setData] = useState<EmployeeData[] | undefined>();
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const rows = useEmployeeDataRows(data ?? []);

  const onUpdateData = (config: SearchRequestDto<TableFilter>) => {
    setLoading(true);
    void backendRequestMock(config).then(({ rows, totalCount }) => {
      setLoading(false);
      setData(rows);
      setTotalCount(totalCount);
    });
  };

  const { formFilter, tableCache } = useTableFilterForm(tableCode);

  return (
    <Grid container spacing={4}>
      <Grid item container sizes={col10} spacing={4}>
        <Grid item sizes={col12}>
          <Table
            // Identifiers
            tableCode={tableCode}
            dataTestId={'TableNewProps'}
            // Rows data
            rows={rows}
            // Configurations
            isLoading={loading}
            columns={columnsMock}
            cachingConfig={cachingConfig}
            canChangeVisibility={true}
            canReorderColumns={true}
            columnsResizing={true}
            // Default states
            paging={{
              currentPage: 2,
              pageSize: 2,
              pageSizes: [1, 2, 3, 5],
              totalCount: totalCount,
            }}
            defaultFilters={undefined}
            // Search DTO callback
            updateData={onUpdateData}
          />
        </Grid>
        <Grid item sizes={col12}>
          <Tile
            dataTestId="tableCache.filterForm.stories"
            gridSizes={{
              xs: 12,
            }}
            title="Table cache"
          >
            {tableCache ? JSON.stringify(tableCache) : 'Cache is empty'}
          </Tile>
        </Grid>
      </Grid>
      <Grid item container sizes={col2}>
        {formFilter}
      </Grid>
    </Grid>
  );
};

TableNewProps.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Для сохранения состояния размера страницы (при пагинации), фильтрации, сортировки при обновлении страницы, необходимо добавить следующие пропсы:\n' +
        '\n* `tableCode`- ключ, по которому будет сохранено состояние в `localStorage`;\n' +
        '\n* `cachingConfig`- объект с настройками, описывающий, какое состояние нужно кешировать, а какое - нет. По умолчанию кеширование выключено.\n',
    },
  },
};

export const TableColumnReset: StoryFn = () => {
  const tableCode = 'Table_Column_Reset_Demo';
  const [data, setData] = useState<EmployeeData[] | undefined>();
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const rows = useEmployeeDataRows(data ?? []);

  const onUpdateData = (config: SearchRequestDto<TableFilter>) => {
    setLoading(true);
    void backendRequestMock(config).then(({ rows, totalCount }) => {
      setLoading(false);
      setData(rows);
      setTotalCount(totalCount);
    });
  };

  return (
    <Grid container spacing={4}>
      <Grid item sizes={col12}>
        <Table
          tableCode={tableCode}
          dataTestId={'TableColumnReset'}
          rows={rows}
          columns={columnsMock}
          isLoading={loading}
          updateData={onUpdateData}
          canChangeVisibility={true}
          canReorderColumns={true}
          cacheLoader={localStorageCacheLoader}
          paging={{
            currentPage: 1,
            pageSize: 5,
            pageSizes: [5, 10, 20],
            totalCount: totalCount,
          }}
        />
      </Grid>
      <Grid item sizes={col12}>
        <Tile title="Сброс настроек колонок">
          <p>Кнопка «Сбросить» доступна в меню настройки колонок.</p>
          <p>При нажатии таблица сбросит настройки к значениям по умолчанию.</p>
        </Tile>
      </Grid>
    </Grid>
  );
};

TableColumnReset.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Демонстрация работы пропса `onResetTableSettings` — сброс видимости и порядка колонок к значениям из `defaultState`.',
    },
  },
};
