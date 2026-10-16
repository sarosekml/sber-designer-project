import React, { ComponentProps, FC, useCallback, useEffect, useState } from 'react';
import { Meta, StoryFn } from '@storybook/react';
import { fn } from '@storybook/test';

import { SearchRequestDto } from '@sber-ibp/core';

import { Button } from '@/components/atoms';
import { Grid } from '@/components/atoms/gridTiles';
import { Table } from '@/components/organisms/Tables';
import { backendRequestMock } from '@/components/organisms/Tables/Table/mocks/backendRequestMock';
import { useEmployeeDataRows } from '@/components/organisms/Tables/Table/mocks/hooks/useEmployeeDataRows';
import { EmployeeData } from '@/components/organisms/Tables/Table/mocks/types';
import { useInitialColumnsConfig } from '@/components/organisms/Tables/Table/mocks/useInitialColumnsConfig';

import { columnsMock, columnsOrderMock, columnsWidthsMock, hiddenColumnsMock, rowsMock } from '../Table/mocks/';
import { useEventBasedTableStateController } from '../utils';

export default {
  title: 'Organisms/Table/Configuration',
  component: Table,
  parameters: {
    viewMode: 'canvas',
  },
  argTypes: {
    columnsResizing: {
      description: 'Настройки ресайзинга колонок',
    },
    canReorderColumns: {
      description: 'Возможность изменения порядка колонок',
    },
    canChangeVisibility: {
      description: 'Возможность изменения видимости колонок',
    },
    updateColumnsConfig: {
      description: 'Функция для обновления конфигурации колонок',
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

export const ColumnResizing: TableStory = Template.bind({});
ColumnResizing.args = {
  employeeData: rowsMock,
  columns: columnsMock.map((it) => ({ ...it, hidden: false })),
  columnsResizing: true,
  onUiStateChanged: fn(),
};
ColumnResizing.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Ресайзинг колонок включается при помощи указания в `columnsResizing` массива `columnWidths`, содержащего название и исходную ширину каждой колонки.',
    },
  },
};

export const ColumnsMinMaxWidth: TableStory = Template.bind({});
ColumnsMinMaxWidth.args = {
  employeeData: rowsMock,
  columns: columnsMock.map((it) => ({ ...it, hidden: false })),
  columnsResizing: {
    minWidth: 100,
    maxWidth: 300,
  },
  onUiStateChanged: fn(),
};
ColumnsMinMaxWidth.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'По умолчанию при ресайзинге колонок минимальная ширина - 80px, максимальная - 600px. \n' +
        '\n Переопределить эти значения можно при помощи свойств `minWidth` и `maxWidth` пропса `columnsResizing`. \n' +
        '\n В примере значения переопределены на 100px и 300px соответственно.\n' +
        '\n Переопределить ',
    },
  },
};

export const ResizingMode: TableStory = Template.bind({});
ResizingMode.args = {
  employeeData: rowsMock,
  columns: columnsMock.map((it) => ({ ...it, hidden: false })),
  columnsResizing: {
    resizingMode: 'nextColumn',
  },
  onUiStateChanged: fn(),
};
ResizingMode.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Ресайзинг колонок может осуществляться в следующих режимах: \n' +
        '\n * nextColumn. Если пользователь меняет ширину колонки, то изменяется и ширина следующей колонки.\n' +
        '\n * widget (по-умолчанию). В этом режиме колонки справа будут сохранять свою ширину.\n' +
        '\nЗа указание режима ресайзинга отвечает свойство `resizingMode` объекта `columnsResizing`',
    },
  },
};

export const ColumnsConfigSaving = () => {
  const tableCode = 'ConfigSavingTableCode';
  const controller = useEventBasedTableStateController<EmployeeData, EmployeeData>(tableCode);

  const initialConfig = {
    columnWidths: columnsWidthsMock,
    order: columnsOrderMock,
    hiddenColumnNames: hiddenColumnsMock,
  };
  /** Get initial values from localStorage. If item doesn't exist, use default values. It's just an example. You can fetch data from backend */
  const loadedConfig = useInitialColumnsConfig(tableCode, initialConfig);

  /**
   * Set loaded values via controller to be able to reset to initial values
   */
  useEffect(() => {
    controller.setColumnOrder(loadedConfig.order);
    controller.setColumnWidths(loadedConfig.columnWidths);
    controller.setHiddenColumns(loadedConfig.hiddenColumnNames);
  }, [controller, loadedConfig]);

  /** Save config state to the localStorage. It's just an example. You can add a request here */
  const updateColumnsConfig = useCallback(({ columnOrderState, columnWidthsState, hiddenColumnsState }: any) => {
    localStorage.setItem(
      tableCode,
      JSON.stringify({
        order: columnOrderState,
        columnWidths: columnWidthsState,
        hiddenColumnNames: hiddenColumnsState,
      }),
    );
  }, []);

  return (
    <Grid container spacing={2}>
      <Grid item>
        <Table
          tableCode={tableCode}
          rows={useEmployeeDataRows(rowsMock)}
          columns={columnsMock}
          dataTestId={'ConfigSaving'}
          canReorderColumns={true}
          columnsResizing={true}
          canChangeVisibility={true}
          updateColumnsConfig={updateColumnsConfig}
          onUiStateChanged={fn()}
        />
      </Grid>
      <Grid item>
        <Button
          dataTestId="tableCache.filterForm.stories.button1"
          onClick={() => {
            controller.resetColumnOrder();
            controller.resetColumnWidths();
            controller.resetHiddenColumns();
          }}
        >
          Reset config
        </Button>
      </Grid>
    </Grid>
  );
};
ColumnsConfigSaving.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Для сохранения настроек колонок (ширина, порядок, видимость) при обновлении страницы необходимо в пропс `updateColumnsConfig` передать колбэк, принимающий актуальное состояние настроек. Внутри этого колбэка можно выполнить передачу данных на сервер. См. пример по кнопке `showCode`.\n' +
        '\nПример интерактивный.',
    },
  },
};
