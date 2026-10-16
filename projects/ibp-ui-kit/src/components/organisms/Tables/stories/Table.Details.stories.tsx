import React from 'react';
import { useTheme } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';

import { dashSymbol } from '@sber-ibp/core';

import { Text } from '@/components/atoms';
import { Grid } from '@/components/atoms/gridTiles';
import { Table } from '@/components/organisms/Tables';
import { useEmployeeDataWithDetailsRows } from '@/components/organisms/Tables/Table/mocks/hooks/useEmployeeDataRows';
import { EmployeeDataWithDetails } from '@/components/organisms/Tables/Table/mocks/types';

import { columnsMock } from '../Table/mocks';
import { rowsEmployeeMockWithDetail } from '../Table/mocks/rowsMock';

export default {
  title: 'Organisms/Table/Details',
  component: Table,
  parameters: {
    viewMode: 'canvas',
  },
  argTypes: {
    rowDetailConfig: {
      description: 'Конфигурация для отображения детальной информации строки',
    },
  },
} as Meta;

const RowDetailTable = ({ row: { data } }: { row: { data: EmployeeDataWithDetails } }) => {
  const theme = useTheme();

  return (
    <>
      <tr style={{ backgroundColor: theme.palette.BG.BGTableAccent, marginBottom: '16px' }}>
        <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}></td>
        <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}></td>
        <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}>
          <Text type="BodySReg" color={theme.palette.Text.TextSecondary}>
            Параметр
          </Text>
        </td>
        <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}>
          <Text type="BodySReg" color={theme.palette.Text.TextSecondary}>
            Старое значение
          </Text>
        </td>
        <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}>
          <Text type="BodySReg" color={theme.palette.Text.TextSecondary}>
            Новое значение
          </Text>
        </td>
        <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}></td>
      </tr>
      {data?.details &&
        Object.entries(data.details)?.flatMap(([key, item]: [string, any]) => {
          if (item?.isGroup) {
            return Object.entries(item)
              .filter(([subKey]) => subKey !== 'isGroup')
              .map(([subKey, subItem]: [string, any], index) => (
                <>
                  {index === 0 && (
                    <tr style={{ backgroundColor: theme.palette.BG.BGTableAccent }}>
                      <td style={{ padding: '16px' }}></td>
                      <td style={{ padding: '16px' }}></td>
                      <td style={{ padding: '16px' }}>
                        <Text type="H6StrongSmb" color={theme.palette.Text.TextPrimary}>
                          {item?.name}
                        </Text>
                      </td>
                      <td style={{ padding: '16px' }}></td>
                      <td style={{ padding: '16px' }}></td>
                      <td style={{ padding: '16px' }}></td>
                    </tr>
                  )}
                  {index !== 0 && (
                    <tr style={{ backgroundColor: theme.palette.BG.BGTableAccent, marginBottom: '16px' }}>
                      <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}></td>
                      <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}></td>
                      <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}>
                        <Text
                          type="BodySReg"
                          color={subItem?.name ? theme.palette.Text.TextPrimary : theme.palette.Text.TextInactive}
                        >
                          {subItem?.name || dashSymbol}
                        </Text>
                      </td>
                      <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}>
                        <Text
                          type="BodySReg"
                          color={subItem?.oldValue ? theme.palette.Text.TextPrimary : theme.palette.Text.TextInactive}
                        >
                          {subItem?.oldValue || dashSymbol}
                        </Text>
                      </td>
                      <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}>
                        <Text
                          type="BodySReg"
                          color={subItem?.newValue ? theme.palette.Text.TextPrimary : theme.palette.Text.TextInactive}
                        >
                          {subItem?.newValue || dashSymbol}
                        </Text>
                      </td>
                      <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}></td>
                    </tr>
                  )}
                </>
              ));
          }
          return (
            <tr style={{ backgroundColor: theme.palette.BG.BGTableAccent, marginBottom: '16px' }}>
              <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}></td>
              <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}></td>
              <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}>
                <Text
                  type="BodySReg"
                  color={data?.details?.[key]?.name ? theme.palette.Text.TextPrimary : theme.palette.Text.TextInactive}
                >
                  {data?.details?.[key]?.name}
                </Text>
              </td>
              <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}>
                <Text
                  type="BodySReg"
                  color={
                    data?.details?.[key]?.oldValue ? theme.palette.Text.TextPrimary : theme.palette.Text.TextInactive
                  }
                >
                  {data?.details?.[key]?.oldValue || dashSymbol}
                </Text>
              </td>
              <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}>
                <Text
                  type="BodySReg"
                  color={
                    data?.details?.[key]?.newValue ? theme.palette.Text.TextPrimary : theme.palette.Text.TextInactive
                  }
                >
                  {data?.details?.[key]?.newValue || dashSymbol}
                </Text>
              </td>
              <td style={{ padding: '16px', borderBottom: '1px solid rgb(225, 237, 231)' }}></td>
            </tr>
          );
        })}
    </>
  );
};

export const TableDetail: StoryFn = () => {
  const rows = useEmployeeDataWithDetailsRows(rowsEmployeeMockWithDetail);
  const fiveColumns = columnsMock.slice(0, 4);
  const threeRows = rows.slice(0, 3);

  return (
    <Grid item container maxWidth={'900px'}>
      <Table
        columnsResizing
        dataTestId="TableDetail"
        columns={fiveColumns}
        rows={threeRows}
        isBordered
        rowDetailConfig={{
          contentComponent: RowDetailTable,
          showToggleIcon: (row) => Boolean(row?.hasDetails),
        }}
      />
    </Grid>
  );
};

TableDetail.parameters = {
  backgrounds: {
    default: 'white',
  },
  docs: {
    description: {
      story:
        'При добавлении в таблицу свойства contentComponent у строк появляется детальная информация. showToggleIcon - функция, определяющая видимость значка раскрытия строки \n',
    },
  },
};
