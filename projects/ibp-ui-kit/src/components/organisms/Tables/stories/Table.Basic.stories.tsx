import React, { ComponentProps, FC, useState } from 'react';
import { Meta, StoryFn } from '@storybook/react';
import { fn } from '@storybook/test';

import { SearchRequestDto } from '@sber-ibp/core';

import { Row, Table } from '@/components/organisms/Tables';
import { backendRequestMock } from '@/components/organisms/Tables/Table/mocks/backendRequestMock';
import { useEmployeeDataRows } from '@/components/organisms/Tables/Table/mocks/hooks/useEmployeeDataRows';
import { EmployeeData } from '@/components/organisms/Tables/Table/mocks/types';

import { columnsMock, rowsMock } from '../Table/mocks';

export default {
  title: 'Organisms/Table/Basic',
  component: Table,
  parameters: {
    viewMode: 'canvas',
  },
  argTypes: {
    rows: {
      description:
        'Массив объектов строк. Каждый объект имеет тип `Row<DTO>` и содержит данные для одной строки.' +
        '\nСвойство такого объекта соответствует ячейке этой стоки. \n' +
        '\nВ обычном случае значение ячейки имеет тип `BaseData` и может быть сразу записано по ключу (если оно готово к отображению в таблице).\n' +
        '\nЕсли значение ячейки требует дополнительной обработки перед рендером или экспортом, то по ключу ячейки записывается объект типа `TableRowFormat<DTO>`. Такой объект содержит поле `data`, куда записываются данные ячейки, а таже методы `render` и `exportRender`, которые будут подготавливать `data` к отображению в ячеке таблицы и экспорту в excel соответственно. \n',
    },
    columns: {
      description:
        'Каждый объект массива содержит название колонки `name` и текст, который будет отображаться в заголовке колонки `title`. ' +
        'Значения `name` должны использоваться в качестве ключей объекта в rows, а также в качестве `columnName` в остальных пропсах таблицы.',
    },
    classes: {
      description: 'Объект для переопределения стилей',
    },
    dataTestId: {
      description:
        '`data-testid` родительского компонента. Используется в качестве префикса к data-testId компонентов таблицы.',
    },
    isLoading: {
      description: 'При значении `true` отображается индикатор загрузки',
    },
    tableColumnExtensions: {
      description:
        'Массив настроек для колонок. Позволяет указать ширину колонки `width`, режим выравнивания текста внутри колонки `align`, включить перенос слов `wordWrapEnabled`, а также задать `render` метод для ячейки заголовка колонки.',
    },
    filters: {
      description: 'Фильтры для таблицы. При их изменении, выполняется запрос на обновление данных (см. `updateData`)',
    },
    updateData: {
      description:
        'Метод для обновления данных в таблице. Вызывается при изменении конфига (параметров пагинаци, фильтрации, сортировки). На вход принимает новый конфиг, который будет использоваться для отправки запроса.\n' +
        '\nПример использования в разделе `Paging` на вкладке `Docs` по кнопке `Show code`',
    },
    tableConfig: {
      description:
        'Основные настройки таблицы. Содержит параметры, позволяющие фиксировать заголовок таблицы при скролле `hasStickyHeader`, задать высоту таблицы `height` или использовать виртуальный скролл `isVirtualTable`.\n' +
        '\nОбязательным условием фиксации заголовка является заполненный параметр `height`.' +
        '\nВ случае использования isVirtualTable требуется указать estimatedRowHeight (средняя высота строк таблицы)',
    },
    rowProps: {
      description:
        'Позволяет задать обработчики кликов на строку `onRowClick` и `onDoubleRowClick`, индекс выделенной строки `defaultSelectedRowIndex`.',
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

export const Props: TableStory = Template.bind({});
Props.args = {
  employeeData: rowsMock,
  columns: columnsMock,
  dataTestId: 'PageName_ParentComponentName',
  isLoading: false,
  tableConfig: {
    hasStickyHeader: true,
    height: '80vh',
  },
  rowProps: {
    onRowClick: (row: Row<EmployeeData>) => console.log('clicked row', row),
  },
  onUiStateChanged: fn(),
};
Props.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
};

export const Main: TableStory = Template.bind({});
Main.args = {
  employeeData: rowsMock,
  canReorderColumns: true,
  columns: columnsMock.map((it) => ({ ...it, hidden: false })),
  dataTestId: 'PageName_ParentComponentName',
  onUiStateChanged: fn(),
};
Main.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Обязательными пропсами являются `rows`, `columns`, `dataTestId` (см. описание в таблице в разделе `Props`\n',
    },
  },
};

export const CustomHeaderCells: TableStory = Template.bind({});
CustomHeaderCells.args = {
  ...Main.args,
};
CustomHeaderCells.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Для того, чтобы задать кастомное содержимое ячейки заголовка таблицы, вы можете добавить свойство `tableColumnExtensions`, содержащее название колонки `columnName` и метод `render`.\n' +
        '\nКастомное содержимое ячейки тела таблицы добавляется за счет метода `render` в элементе массива `rows`, соответствеющем нужной ячейке (см. свойство active в rows).\n',
    },
  },
};

export const StickyHeader: TableStory = Template.bind({});
StickyHeader.args = {
  ...Main.args,
  tableConfig: {
    hasStickyHeader: true,
    height: '80vh',
  },
};
StickyHeader.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story:
        'Зафиксировать шапку таблицы можно при помощи `tableConfig`, содержащего поле `hasStickyHeader` со значением true и поле `height` с указанием высоты таблицы.',
    },
  },
};
